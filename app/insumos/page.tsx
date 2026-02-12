import { PageContainer } from "@/components/PageContainer";
import { InsumosWorkspace } from "@/components/insumos/InsumosWorkspace";

export default function InsumosPage() {
  return (
    <PageContainer
      title="Insumos"
      description="Gestiona materias primas, compras e inventario en un solo módulo."
    >
      <InsumosWorkspace />
    </PageContainer>
  );
}
