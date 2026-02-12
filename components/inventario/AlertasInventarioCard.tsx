"use client";

import { useEffect, useState } from "react";
import type { AlertaInventarioDTO } from "@/lib/api-types";

const badgeStyles: Record<AlertaInventarioDTO["estadoReposicion"], string> = {
  verde: "bg-emerald-100 text-emerald-800",
  amarillo: "bg-amber-100 text-amber-800",
  rojo: "bg-red-100 text-red-800",
};

export function AlertasInventarioCard() {
  const [alertas, setAlertas] = useState<AlertaInventarioDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAlertas() {
      setLoading(true);
      try {
        const response = await fetch("/api/inventario/alertas");
        if (!response.ok) {
          throw new Error("No se pudieron cargar alertas");
        }
        const data: AlertaInventarioDTO[] = await response.json();
        setAlertas(data.filter((item) => item.estadoReposicion !== "verde").slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    void loadAlertas();
  }, []);

  return (
    <article className="surface-card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Alertas de inventario</h2>
      <p className="mt-1 text-sm text-slate-600">
        Insumos cerca o por debajo del stock mínimo.
      </p>
      {loading ? <p className="mt-3 text-sm text-slate-500">Cargando...</p> : null}
      {!loading && alertas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Sin alertas activas.</p>
      ) : null}
      <div className="mt-3 space-y-2">
        {alertas.map((alerta) => (
          <div
            key={alerta.insumoId}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-800">{alerta.nombre}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeStyles[alerta.estadoReposicion]}`}>
                {alerta.estadoReposicion}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Stock actual: {alerta.stockActual.toFixed(2)} · Mínimo: {alerta.stockMinimo.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
