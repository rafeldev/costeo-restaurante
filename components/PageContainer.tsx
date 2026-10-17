import { ReactNode } from "react";
import { AppFooter } from "@/components/AppFooter";
import { MainNav } from "@/components/MainNav";

export function PageContainer({
  title,
  description,
  children,
  showHeader = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  showHeader?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MainNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-24 sm:px-6 sm:pt-[120px]">
        {showHeader ? (
          <header className="mb-8">
            <h1 className="font-headline-xl text-primary">{title}</h1>
            <p className="mt-1 max-w-3xl text-base text-secondary">{description}</p>
          </header>
        ) : null}
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
