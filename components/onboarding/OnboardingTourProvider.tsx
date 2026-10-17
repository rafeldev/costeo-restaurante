"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACTIONS, EVENTS, Joyride, STATUS, type EventHandler, type Step } from "react-joyride";
import { toast } from "sonner";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOUR_VERSION,
  type TourStepDefinition,
} from "@/lib/onboarding-steps";
import { waitForElement } from "@/lib/onboarding-dom";
import { TourTooltip } from "@/components/onboarding/TourTooltip";
import { OnboardingTourContext } from "@/components/onboarding/useOnboardingTour";

const TOUR_STEP_KEY = "calculachef:tour-step";

type TourState = {
  run: boolean;
  stepIndex: number;
  phase: "idle" | "running" | "navigating";
};

type OnboardingStatusResponse = {
  shouldShow: boolean;
  version: number;
};

type TourMode = "automatic" | "manual";

type StoredTour = {
  userId: string;
  version: number;
  stepId: string;
  mode: TourMode;
};

function emitTourEvent(name: string, stepId: string) {
  window.dispatchEvent(new CustomEvent(name, { detail: { stepId } }));
}

function getStepsForViewport(): TourStepDefinition[] {
  const desktop = window.matchMedia("(min-width: 1024px)").matches;
  const smallMobile = window.matchMedia("(max-width: 639px)").matches;

  return ONBOARDING_STEPS
    .filter((step) => desktop || !step.desktopOnly)
    .map((step) => ({
      ...step,
      target: smallMobile && step.mobileTarget ? step.mobileTarget : step.target,
    }));
}

function getResumeIndex(steps: TourStepDefinition[], stepId?: string): number {
  if (!stepId) return 0;
  const exactIndex = steps.findIndex((step) => step.id === stepId);
  if (exactIndex >= 0) return exactIndex;

  const originalIndex = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
  const nextAvailable = ONBOARDING_STEPS
    .slice(originalIndex + 1)
    .find((candidate) => steps.some((step) => step.id === candidate.id));

  return nextAvailable ? steps.findIndex((step) => step.id === nextAvailable.id) : steps.length - 1;
}

function parseStoredTour(value: string): StoredTour | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredTour>;
    if (
      typeof parsed.userId === "string" &&
      parsed.version === ONBOARDING_TOUR_VERSION &&
      typeof parsed.stepId === "string" &&
      (parsed.mode === "automatic" || parsed.mode === "manual")
    ) {
      return parsed as StoredTour;
    }
  } catch {
    // Invalid or legacy session data is discarded below.
  }

  return null;
}

export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const [state, setState] = useState<TourState>({ run: false, stepIndex: 0, phase: "idle" });
  const [steps, setSteps] = useState<TourStepDefinition[]>([]);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const statusCheckedRef = useRef(false);
  const resumeCheckedRef = useRef(false);
  const resumeInProgressRef = useRef(false);
  const finishingRef = useRef(false);
  const activeModeRef = useRef<TourMode>("automatic");
  const tourRunRef = useRef(0);
  const previousUserIdRef = useRef(userId);
  const sessionChangingRef = useRef(false);

  const finish = useCallback((outcome: "completed" | "skipped", stepId: string) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    tourRunRef.current += 1;
    setPendingIndex(null);
    setState({ run: false, stepIndex: 0, phase: "idle" });

    try {
      sessionStorage.removeItem(TOUR_STEP_KEY);
    } catch {
      // Storage may be unavailable in privacy-restricted contexts.
    }

    emitTourEvent(`onboarding:${outcome}`, stepId);
    void fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("No se pudo guardar el estado del recorrido", error);
      }
    });

    if (outcome === "completed") {
      toast.success("¡Listo! Empieza por configurar tus parámetros de costeo.");
    }

    window.setTimeout(() => {
      finishingRef.current = false;
    }, 0);
  }, []);

  const moveToStep = useCallback((nextIndex: number, currentSteps: TourStepDefinition[] = steps) => {
    const nextStep = currentSteps[nextIndex];
    if (!nextStep) {
      const lastStep = currentSteps.at(-1);
      if (lastStep) finish("completed", lastStep.id);
      return;
    }

    try {
      if (userId) {
        sessionStorage.setItem(TOUR_STEP_KEY, JSON.stringify({
          userId,
          version: ONBOARDING_TOUR_VERSION,
          stepId: nextStep.id,
          mode: activeModeRef.current,
        } satisfies StoredTour));
      }
    } catch {
      // The database remains the source of truth for completed tours.
    }

    setPendingIndex(nextIndex);
    setState({ run: false, stepIndex: nextIndex, phase: "navigating" });
    if (pathname !== nextStep.route) router.push(nextStep.route);
  }, [finish, pathname, router, steps, userId]);

  const begin = useCallback((initialStepId: string | undefined, mode: TourMode) => {
    if (status !== "authenticated" || pathname === "/login" || !userId) return;
    const viewportSteps = getStepsForViewport();
    const initialIndex = getResumeIndex(viewportSteps, initialStepId);
    statusCheckedRef.current = true;
    finishingRef.current = false;
    activeModeRef.current = mode;
    tourRunRef.current += 1;
    setSteps(viewportSteps);
    moveToStep(initialIndex, viewportSteps);
  }, [moveToStep, pathname, status, userId]);

  const start = useCallback(() => begin(undefined, "manual"), [begin]);

  useEffect(() => {
    if (previousUserIdRef.current === userId) return;
    sessionChangingRef.current = true;
    tourRunRef.current += 1;
    const resetRun = tourRunRef.current;
    statusCheckedRef.current = false;
    resumeCheckedRef.current = false;
    resumeInProgressRef.current = false;

    const resetTimer = window.setTimeout(() => {
      if (resetRun !== tourRunRef.current) return;
      previousUserIdRef.current = userId;
      setPendingIndex(null);
      setSteps([]);
      setState({ run: false, stepIndex: 0, phase: "idle" });
      sessionChangingRef.current = false;
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [userId]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      pathname === "/login" ||
      pendingIndex === null ||
      sessionChangingRef.current
    ) return;
    const step = steps[pendingIndex];
    if (!step || pathname !== step.route) return;

    const controller = new AbortController();
    void waitForElement(step.target, 5000, controller.signal).then((element) => {
      if (controller.signal.aborted) return;
      if (!element) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`No se encontró el ancla del recorrido: ${step.target}`);
        }
        moveToStep(pendingIndex + 1);
        return;
      }

      setPendingIndex(null);
      setState({ run: true, stepIndex: pendingIndex, phase: "running" });
    });

    return () => controller.abort();
  }, [moveToStep, pathname, pendingIndex, status, steps]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      pathname === "/login" ||
      !userId ||
      resumeCheckedRef.current ||
      resumeInProgressRef.current ||
      sessionChangingRef.current
    ) return;
    let resumeTimer: number | undefined;
    const controller = new AbortController();
    let resumePending = false;

    try {
      const storedValue = sessionStorage.getItem(TOUR_STEP_KEY);
      const storedTour = storedValue ? parseStoredTour(storedValue) : null;
      if (!storedTour || storedTour.userId !== userId) {
        if (storedValue) sessionStorage.removeItem(TOUR_STEP_KEY);
        resumeCheckedRef.current = true;
      } else if (storedTour.mode === "manual") {
        resumePending = true;
        resumeInProgressRef.current = true;
        resumeTimer = window.setTimeout(() => {
          resumeInProgressRef.current = false;
          resumeCheckedRef.current = true;
          statusCheckedRef.current = true;
          begin(storedTour.stepId, "manual");
        }, 0);
      } else {
        resumePending = true;
        resumeInProgressRef.current = true;
        const requestRun = tourRunRef.current;
        void fetch("/api/onboarding", { cache: "no-store", signal: controller.signal })
          .then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<OnboardingStatusResponse>;
          })
          .then((onboarding) => {
            if (requestRun !== tourRunRef.current) return;
            resumeInProgressRef.current = false;
            resumeCheckedRef.current = true;
            statusCheckedRef.current = true;
            if (onboarding.shouldShow) begin(storedTour.stepId, "automatic");
            else sessionStorage.removeItem(TOUR_STEP_KEY);
          })
          .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            resumeInProgressRef.current = false;
            resumeCheckedRef.current = true;
            statusCheckedRef.current = true;
            if (process.env.NODE_ENV === "development") {
              console.warn("No se pudo reanudar el recorrido", error);
            }
          });
      }
    } catch {
      resumeCheckedRef.current = true;
      // Continue with the database status check when storage is unavailable.
    }

    return () => {
      controller.abort();
      if (resumeTimer !== undefined) window.clearTimeout(resumeTimer);
      if (resumePending && !resumeCheckedRef.current) resumeInProgressRef.current = false;
    };
  }, [begin, pathname, status, userId]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      pathname !== "/" ||
      statusCheckedRef.current ||
      resumeInProgressRef.current ||
      sessionChangingRef.current ||
      state.phase !== "idle"
    ) return;

    const controller = new AbortController();
    const requestRun = tourRunRef.current;
    void fetch("/api/onboarding", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<OnboardingStatusResponse>;
      })
      .then((onboarding) => {
        statusCheckedRef.current = true;
        if (requestRun === tourRunRef.current && onboarding.shouldShow) {
          begin(undefined, "automatic");
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        statusCheckedRef.current = true;
        if (process.env.NODE_ENV === "development") {
          console.warn("No se pudo consultar el estado del recorrido", error);
        }
      });

    return () => controller.abort();
  }, [begin, pathname, state.phase, status]);

  const handleEvent: EventHandler = useCallback((data) => {
    const currentStep = steps[data.index];
    if (!currentStep) return;

    if (data.type === EVENTS.TOOLTIP) {
      emitTourEvent("onboarding:step", currentStep.id);
      return;
    }

    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      moveToStep(data.index + 1);
      return;
    }

    if (data.type === EVENTS.TOUR_END && data.status === STATUS.SKIPPED) {
      finish("skipped", currentStep.id);
      return;
    }

    if (data.type !== EVENTS.STEP_AFTER) return;
    if (data.action === ACTIONS.CLOSE || data.action === ACTIONS.SKIP) {
      finish("skipped", currentStep.id);
    } else if (data.action === ACTIONS.PREV) {
      moveToStep(Math.max(0, data.index - 1));
    } else if (data.action === ACTIONS.NEXT) {
      if (data.index === steps.length - 1) finish("completed", currentStep.id);
      else moveToStep(data.index + 1);
    }
  }, [finish, moveToStep, steps]);

  const joyrideSteps: Step[] = steps.map((step) => ({
    id: step.id,
    target: step.target,
    title: step.title,
    content: step.content,
    placement: step.placement,
  }));
  const contextValue = useMemo(() => ({ start, isRunning: state.phase !== "idle" }), [start, state.phase]);

  return (
    <OnboardingTourContext.Provider value={contextValue}>
      {children}
      {status === "authenticated" && pathname !== "/login" ? (
        <Joyride
          run={state.run}
          stepIndex={state.stepIndex}
          steps={joyrideSteps}
          continuous
          onEvent={handleEvent}
          tooltipComponent={TourTooltip}
          locale={{
            back: "Atrás",
            close: "Cerrar",
            last: "Finalizar",
            next: "Siguiente",
            nextWithProgress: "Siguiente ({current} de {total})",
            skip: "Omitir recorrido",
          }}
          options={{
            buttons: ["back", "primary", "skip"],
            closeButtonAction: "skip",
            dismissKeyAction: "close",
            overlayClickAction: false,
            primaryColor: "var(--accent)",
            scrollOffset: 112,
            showProgress: true,
            skipBeacon: true,
            spotlightPadding: 8,
            targetWaitTimeout: 5000,
            zIndex: 60,
          }}
        />
      ) : null}
    </OnboardingTourContext.Provider>
  );
}
