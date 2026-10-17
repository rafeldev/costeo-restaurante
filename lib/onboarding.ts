import { db } from "@/lib/db";
import { ONBOARDING_TOUR_VERSION } from "@/lib/onboarding-steps";

export const ONBOARDING_VERSION = ONBOARDING_TOUR_VERSION;

export type OnboardingStatus = {
  shouldShow: boolean;
  version: number;
};

export type OnboardingOutcome = "completed" | "skipped";

export function shouldShowOnboarding(userVersion: number): boolean {
  return userVersion < ONBOARDING_VERSION;
}

export async function getOnboardingStatus(ownerId: string): Promise<OnboardingStatus> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: ownerId },
    select: { onboardingVersion: true },
  });

  return {
    shouldShow: shouldShowOnboarding(user.onboardingVersion),
    version: ONBOARDING_VERSION,
  };
}

export async function markOnboarding(
  ownerId: string,
  outcome: OnboardingOutcome,
): Promise<void> {
  const now = new Date();

  await db.user.update({
    where: { id: ownerId },
    data: {
      onboardingVersion: ONBOARDING_VERSION,
      onboardingCompletedAt: outcome === "completed" ? now : null,
      onboardingSkippedAt: outcome === "skipped" ? now : null,
    },
  });
}
