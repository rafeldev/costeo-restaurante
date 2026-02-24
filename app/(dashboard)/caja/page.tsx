import { PageContainer } from "@/components/PageContainer";
import { CajaPOS } from "@/components/caja/CajaPOS";

export default function CajaPage() {
  return (
    <PageContainer
      title="Caja"
      description="Punto de venta: agrega productos desde las recetas, cobra o cancela el ticket."
      showNav={false}
    >
      <CajaPOS />
    </PageContainer>
  );
}
