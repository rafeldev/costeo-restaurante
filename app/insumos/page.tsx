import { PageContainer } from "@/components/PageContainer";
import { InsumosModule } from "@/components/insumos/InsumosModule";

export default function InsumosPage() {
  return (
    <PageContainer
      title="Insumos"
      description="Gestiona materias primas para usarlas en tus recetas."
    >
      <InsumosModule />
    </PageContainer>
  );
}
