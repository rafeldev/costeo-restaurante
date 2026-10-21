"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { GlobalLoadingBar } from "@/components/GlobalLoadingBar";
import { OnboardingTourProvider } from "@/components/onboarding/OnboardingTourProvider";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <OnboardingTourProvider>
        <Suspense fallback={null}>
          <GlobalLoadingBar />
        </Suspense>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            className: "text-sm",
            duration: 3600,
          }}
        />
      </OnboardingTourProvider>
    </SessionProvider>
  );
}
