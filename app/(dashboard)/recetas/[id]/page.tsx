import { PageContainer } from "@/components/PageContainer";
import { RecetaDetalleModule } from "@/components/recetas/RecetaDetalleModule";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RecetaDetallePage({ params }: PageProps) {
  const { id } = await params;
  return (
    <PageContainer
      title="Detalle de receta"
      description="Revisa el desglose de costos, precio sugerido y ajusta la receta."
      showNav={false}
    >
      <RecetaDetalleModule recetaId={id} />
    </PageContainer>
  );
}
