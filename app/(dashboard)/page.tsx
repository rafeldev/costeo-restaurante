import { AlertasInventarioCard } from "@/components/inventario/AlertasInventarioCard";

export default function DashboardHome() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">
          Bienvenido
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary">
          Costeo, inventario y punto de venta para tu restaurante.
        </p>
      </header>
      <section>
        <AlertasInventarioCard />
      </section>
    </main>
  );
}
