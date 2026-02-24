import { ReactNode } from "react";
import { MainNav } from "@/components/MainNav";

export function PageContainer({
  title,
  description,
  children,
  showNav = true,
}: {
  title: string;
  description: string;
  children: ReactNode;
  showNav?: boolean;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
      {showNav ? <MainNav /> : null}
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary">{description}</p>
      </header>
      {children}
    </main>
  );
}
