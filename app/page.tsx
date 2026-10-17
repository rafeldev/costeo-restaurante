import { DashboardModule } from "@/components/dashboard/DashboardModule";
import { PageContainer } from "@/components/PageContainer";

export default function Home() {
  return (
    <PageContainer
      title="Control de Costos e Inventario"
      description="Visión operativa del costeo teórico de recetas y el estado del inventario."
    >
      <DashboardModule />
    </PageContainer>
  );
}
