ALTER TABLE "User"
  ADD COLUMN "onboardingVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingSkippedAt" TIMESTAMP(3);

-- Existing users can still launch the tour manually, but do not see it automatically.
UPDATE "User"
SET "onboardingVersion" = 1
WHERE "createdAt" < CURRENT_TIMESTAMP;
