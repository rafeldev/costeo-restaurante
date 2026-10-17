"use client";

import { useSyncExternalStore } from "react";
import { ComprasInsumosModule } from "@/components/compras/ComprasInsumosModule";
import { InventarioModule } from "@/components/inventario/InventarioModule";
import { InsumosModule } from "@/components/insumos/InsumosModule";
import { InventorySetupModule } from "@/components/inventario/InventorySetupModule";

type TabKey = "insumos" | "compras" | "config-inventario" | "inventario";

function getTabFromLocation(): TabKey {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "compras" || tab === "config-inventario" || tab === "inventario" ? tab : "insumos";
}

function subscribeToTabChange(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("insumos-tab-change", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("insumos-tab-change", onStoreChange);
  };
}

export function InsumosWorkspace() {
  const activeTab = useSyncExternalStore(subscribeToTabChange, getTabFromLocation, () => "insumos");

  function changeTab(tab: TabKey) {
    const url = new URL(window.location.href);
    if (tab === "insumos") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("insumos-tab-change"));
  }

  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: "insumos", label: "Insumos", icon: "grocery" },
    { key: "compras", label: "Compras e Historial de Precios", icon: "receipt_long" },
    { key: "config-inventario", label: "Configuración y Movimientos", icon: "warehouse" },
    { key: "inventario", label: "Toma de Inventario", icon: "checklist_rtl" },
  ];

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, tabs.length - 1);
    if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex !== index) {
      event.preventDefault();
      changeTab(tabs[nextIndex]!.key);
      document.getElementById(`insumos-tab-${tabs[nextIndex]!.key}`)?.focus();
    }
  }

  return (
    <section className="relative z-10 md:-mx-2">
      <div className="-mx-4 bg-white px-4 pb-0 pt-5 shadow-[0_1px_8px_rgba(15,23,42,0.04)] sm:-mx-6 sm:px-6 md:-mx-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-[#ffdbca]/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#c25e19]">
                <span className="material-symbols-outlined text-[14px]" aria-hidden>inventory_2</span>
                Módulo de Escandallos
              </span>
              <span className="text-xs text-[#94a3b8]">·</span>
              <span className="text-xs font-semibold tracking-[0.02em] text-[#94a3b8]">Catálogo Maestro v2.4</span>
            </div>
            <h1 className="mt-1 text-[28px] font-bold leading-10 tracking-[-0.025em] text-[#0f172a] sm:text-[32px]">
              Gestión de Insumos y Materias Primas
            </h1>
            <p className="mt-0.5 max-w-3xl text-sm leading-6 text-[#475569]">
              Registra ingredientes base, factor de merma neta vs. bruta y calcula el costo real por gramo o mililitro para tus escandallos con precisión contable.
            </p>
          </div>
        </div>

        <div className="mt-4 flex max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Secciones de insumos">
          {tabs.map((tab, index) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                id={`insumos-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`insumos-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#f1f5f9] font-semibold text-[#c25e19]"
                    : "font-medium text-[#475569] hover:bg-[#f1f5f9]/60 hover:text-[#0f172a]"
                }`}
                onClick={() => changeTab(tab.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`insumos-panel-${activeTab}`} role="tabpanel" aria-labelledby={`insumos-tab-${activeTab}`} className="pt-6">
        {activeTab === "insumos" ? <InsumosModule /> : null}
        {activeTab === "compras" ? <ComprasInsumosModule /> : null}
        {activeTab === "config-inventario" ? <InventorySetupModule /> : null}
        {activeTab === "inventario" ? <InventarioModule /> : null}
      </div>
    </section>
  );
}
