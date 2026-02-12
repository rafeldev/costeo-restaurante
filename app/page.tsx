import Link from "next/link";
import { PageContainer } from "@/components/PageContainer";

const modules = [
  {
    title: "Insumos",
    description: "Registra materias primas, costo por unidad y merma.",
    href: "/insumos",
  },
  {
    title: "Recetas",
    description: "Define ingredientes por receta y rendimiento en porciones.",
    href: "/recetas",
  },
  {
    title: "Configuración",
    description: "Ajusta margen objetivo, overhead, impuestos y redondeo.",
    href: "/configuracion",
  },
];

export default function Home() {
  return (
    <PageContainer
      title="Costeo de producción para restaurantes"
      description="MVP para calcular costo por receta y precio sugerido de venta al público."
    >
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {modules.map((module) => (
          <article key={module.title} className="surface-card p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{module.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{module.description}</p>
            <Link
              href={module.href}
              className="btn-primary mt-4 inline-flex items-center"
            >
              Ir al módulo
            </Link>
          </article>
        ))}
      </section>
    </PageContainer>
  );
}
