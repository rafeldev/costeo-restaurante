import { PageContainer } from "@/components/PageContainer";
import { ConfiguracionModule } from "@/components/configuracion/ConfiguracionModule";

export default function ConfiguracionPage() {
  return (
    <PageContainer
      title="Configuración de costeo"
      description="Define los parámetros globales para calcular precio sugerido."
      showNav={false}
    >
      <ConfiguracionModule />
    </PageContainer>
  );
}
