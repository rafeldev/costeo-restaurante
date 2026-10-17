"use client";

import { createContext, useContext } from "react";

export type OnboardingTourContextValue = {
  start: () => void;
  isRunning: boolean;
};

export const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function useOnboardingTour(): OnboardingTourContextValue {
  const context = useContext(OnboardingTourContext);
  if (!context) throw new Error("useOnboardingTour debe usarse dentro de OnboardingTourProvider");
  return context;
}
