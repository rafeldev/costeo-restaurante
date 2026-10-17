import { PageContainer } from "@/components/PageContainer";
import { ConfiguracionModule } from "@/components/configuracion/ConfiguracionModule";

export default function ConfiguracionPage() {
  return (
    <PageContainer
      title="Parámetros Globales de Costeo"
      description="Calibra rentabilidad, impuestos, alertas y políticas de precio desde un solo lugar."
    >
      <ConfiguracionModule />
    </PageContainer>
  );
}
