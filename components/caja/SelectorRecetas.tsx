"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Receta } from "@/lib/caja-api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "./formatCurrency";
import { cn } from "@/lib/utils";

type Props = {
  recetas: Receta[];
  onAdd: (recetaId: string, cantidad: number, precioUnitario?: number) => void;
  addingId: string | null;
};

export function SelectorRecetas({ recetas, onAdd, addingId }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recetas;
    return recetas.filter((r) => r.nombre.toLowerCase().includes(q));
  }, [recetas, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Buscar recetas"
        />
      </div>
      <div
        className="flex flex-1 flex-col gap-1 overflow-auto rounded-md border border-border bg-muted/30 min-h-[200px] md:min-h-[320px]"
        role="list"
      >
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {recetas.length === 0
              ? "No hay recetas. Crea recetas con precio de venta para vender."
              : "No hay coincidencias."}
          </p>
        ) : (
          <TooltipProvider>
            {filtered.map((receta) => {
              const hasPrice = receta.precioVentaActual != null && receta.precioVentaActual > 0;
              const isAdding = addingId === `add-${receta.id}`;
              const row = (
                <div
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                    hasPrice && !addingId && "hover:bg-accent/50"
                  )}
                >
                  <span className="font-medium text-foreground truncate min-w-0">{receta.nombre}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {hasPrice ? formatCurrency(receta.precioVentaActual!) : "Sin precio"}
                  </span>
                  {hasPrice ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={!!addingId}
                      onClick={() => onAdd(receta.id, 1, receta.precioVentaActual ?? undefined)}
                      aria-label={`Agregar ${receta.nombre}`}
                    >
                      {isAdding ? "..." : "Agregar"}
                    </Button>
                  ) : null}
                </div>
              );
              return (
                <div key={receta.id} role="listitem">
                  {!hasPrice ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-not-allowed opacity-60">{row}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Configure el precio de venta en la receta para poder agregarla.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    row
                  )}
                </div>
              );
            })}
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
