import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = {
  title: "Iniciar sesión | CalculaChef",
  description: "Accede a CalculaChef para gestionar costos, recetas e inventario.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[var(--parchment)]" />}>
      <LoginScreen />
    </Suspense>
  );
}
