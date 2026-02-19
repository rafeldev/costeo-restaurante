"use client";

import { useState } from "react";
import { ComprasInsumosModule } from "@/components/compras/ComprasInsumosModule";
import { InventarioModule } from "@/components/inventario/InventarioModule";
import { InsumosModule } from "@/components/insumos/InsumosModule";
import { Tabs } from "@/components/ui/Tabs";

type TabKey = "insumos" | "compras" | "inventario";

export function InsumosWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>("insumos");

  return (
    <Tabs
      aria-label="Secciones de insumos"
      value={activeTab}
      onChange={setActiveTab}
      items={[
        { key: "insumos", label: "Insumos", panel: <InsumosModule /> },
        { key: "compras", label: "Compras", panel: <ComprasInsumosModule /> },
        { key: "inventario", label: "Inventario", panel: <InventarioModule /> },
      ]}
    />
  );
}
