import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <article className={`surface-card p-4 sm:p-5 ${className}`.trim()}>
      {children}
    </article>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function CardHeader({ title, description, className = "" }: CardHeaderProps) {
  return (
    <header className={className}>
      <h2 className="text-base font-semibold text-primary sm:text-lg">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-secondary">{description}</p>
      ) : null}
    </header>
  );
}
