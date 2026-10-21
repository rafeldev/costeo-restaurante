import { PageContainer } from "@/components/PageContainer";
import { MezclaMenuModule } from "@/components/mezcla/MezclaMenuModule";

export default function MezclaPage() {
  return (
    <PageContainer
      title="Ventas y Mezcla de Menú"
      description="Registra las unidades vendidas por receta y analiza popularidad frente a rentabilidad."
      showHeader
    >
      <MezclaMenuModule />
    </PageContainer>
  );
}
