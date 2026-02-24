import { PageContainer } from "@/components/PageContainer";
import { RecetasModule } from "@/components/recetas/RecetasModule";

export default function RecetasPage() {
  return (
    <PageContainer
      title="Recetas"
      description="Construye recetas con insumos y calcula su precio sugerido."
      showNav={false}
    >
      <RecetasModule />
    </PageContainer>
  );
}
