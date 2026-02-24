"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/PageContainer";
import { ProduccionesModule } from "@/components/producciones/ProduccionesModule";

function ProduccionesContent() {
  const searchParams = useSearchParams();
  const filterRecetaId = searchParams.get("recetaId");

  return <ProduccionesModule filterRecetaId={filterRecetaId} />;
}

export default function ProduccionesPage() {
  return (
    <PageContainer
      title="Producciones"
      description="Historial de producción, costos acumulados y gestión de registros."
    >
      <Suspense>
        <ProduccionesContent />
      </Suspense>
    </PageContainer>
  );
}
