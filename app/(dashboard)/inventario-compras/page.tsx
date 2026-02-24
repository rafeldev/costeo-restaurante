"use client";

import { useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { ComprasInsumosModule } from "@/components/compras/ComprasInsumosModule";
import { InventarioModule } from "@/components/inventario/InventarioModule";
import { Tabs } from "@/components/ui/Tabs";

type TabKey = "compras" | "inventario";

export default function InventarioComprasPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("compras");

  return (
    <PageContainer
      title="Inventario y compras"
      description="Registra compras y consulta stock por insumo."
      showNav={false}
    >
      <Tabs
        aria-label="Secciones de inventario y compras"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "compras", label: "Compras", panel: <ComprasInsumosModule /> },
          { key: "inventario", label: "Inventario", panel: <InventarioModule /> },
        ]}
      />
    </PageContainer>
  );
}
