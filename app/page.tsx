import Link from "next/link";
import { AlertasInventarioCard } from "@/components/inventario/AlertasInventarioCard";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardHeader } from "@/components/ui/Card";

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
          <Card key={module.title}>
            <CardHeader title={module.title} description={module.description} />
            <Link
              href={module.href}
              className="btn-primary mt-4 inline-flex items-center"
            >
              Ir al módulo
            </Link>
          </Card>
        ))}
      </section>
      <section className="mt-6">
        <AlertasInventarioCard />
      </section>
    </PageContainer>
  );
}
