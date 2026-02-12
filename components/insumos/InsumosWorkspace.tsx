"use client";

import { useState } from "react";
import { ComprasInsumosModule } from "@/components/compras/ComprasInsumosModule";
import { InventarioModule } from "@/components/inventario/InventarioModule";
import { InsumosModule } from "@/components/insumos/InsumosModule";

type TabKey = "insumos" | "compras" | "inventario";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "insumos", label: "Insumos" },
  { key: "compras", label: "Compras" },
  { key: "inventario", label: "Inventario" },
];

export function InsumosWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>("insumos");

  return (
    <section>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              className={
                isActive
                  ? "btn-primary min-h-10 px-4 py-2"
                  : "btn-secondary min-h-10 px-4 py-2"
              }
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "insumos" ? <InsumosModule /> : null}
      {activeTab === "compras" ? <ComprasInsumosModule /> : null}
      {activeTab === "inventario" ? <InventarioModule /> : null}
    </section>
  );
}
