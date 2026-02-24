"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/PageContainer";
import { RecetasModule } from "@/components/recetas/RecetasModule";

function RecetasContent() {
  const searchParams = useSearchParams();
  const filterInsumoId = searchParams.get("insumoId");

  return <RecetasModule filterInsumoId={filterInsumoId} />;
}

export default function RecetasPage() {
  return (
    <PageContainer
      title="Recetas"
      description="Construye recetas con insumos y calcula su precio sugerido."
    >
      <Suspense>
        <RecetasContent />
      </Suspense>
    </PageContainer>
  );
}
