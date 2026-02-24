"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Venta, VentaItem } from "@/lib/caja-api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "./formatCurrency";
import { cn } from "@/lib/utils";

type Props = {
  venta: Venta;
  onRemoveItem: (itemId: string) => void;
  onPatchVenta: (data: { mesa?: string | null; notas?: string | null }) => void;
  onCobrar: () => void;
  onCancelar: () => void;
  loadingCobrar: boolean;
  loadingCancelar: boolean;
  loadingRemoveId: string | null;
};

export function CarritoCaja({
  venta,
  onRemoveItem,
  onPatchVenta,
  onCobrar,
  onCancelar,
  loadingCobrar,
  loadingCancelar,
  loadingRemoveId,
}: Props) {
  const [mesa, setMesa] = useState(venta.mesa ?? "");
  const [notas, setNotas] = useState(venta.notas ?? "");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const items = venta.items ?? [];
  const total = items.length > 0 ? items.reduce((s, i) => s + i.subtotal, 0) : 0;
  const canCobrar = items.length > 0;

  const handleMesaBlur = () => {
    const v = mesa.trim() || null;
    if (v !== (venta.mesa ?? null)) onPatchVenta({ mesa: v });
  };
  const handleNotasBlur = () => {
    const v = notas.trim() || null;
    if (v !== (venta.notas ?? null)) onPatchVenta({ notas: v });
  };

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Ticket</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm text-muted-foreground">
          Mesa (opcional)
          <Input
            type="text"
            placeholder="Ej. 3"
            value={mesa}
            onChange={(e) => setMesa(e.target.value)}
            onBlur={handleMesaBlur}
            className="mt-1"
            maxLength={80}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Notas (opcional)
          <Input
            type="text"
            placeholder="Ej. Sin cebolla"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={handleNotasBlur}
            className="mt-1"
            maxLength={500}
          />
        </label>
      </div>
      <Separator />
      <div
        className="flex flex-1 flex-col gap-1 overflow-auto min-h-[120px] max-h-[240px] md:max-h-[280px]"
        role="list"
        aria-label="Ítems del ticket"
      >
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Sin ítems. Agrega productos arriba.</p>
        ) : (
          items.map((item) => (
            <CarritoLine
              key={item.id}
              item={item}
              onRemove={() => onRemoveItem(item.id)}
              removing={loadingRemoveId === `remove-${item.id}`}
            />
          ))
        )}
      </div>
      <div className="flex flex-col gap-3 pt-2">
        <p
          className="text-lg font-semibold text-foreground tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          Total: {formatCurrency(total)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onCobrar}
            disabled={!canCobrar || loadingCobrar || loadingCancelar}
            className="flex-1 min-w-[120px]"
          >
            {loadingCobrar ? "Cobrando…" : "Cobrar"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCancelConfirm(true)}
            disabled={loadingCobrar || loadingCancelar}
            className="min-w-[120px]"
          >
            {loadingCancelar ? "Cancelando…" : "Cancelar ticket"}
          </Button>
        </div>
      </div>
      <ConfirmModal
        open={showCancelConfirm}
        title="Cancelar ticket"
        description="El ticket quedará sin cobrar y no se descontará inventario. ¿Continuar?"
        confirmLabel="Sí, cancelar"
        cancelLabel="No"
        variant="danger"
        onConfirm={() => {
          onCancelar();
          setShowCancelConfirm(false);
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </Card>
  );
}

function CarritoLine({
  item,
  onRemove,
  removing,
}: {
  item: VentaItem;
  onRemove: () => void;
  removing: boolean;
}) {
  const name = item.receta?.nombre ?? "Producto";
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-sm"
      role="listitem"
    >
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground truncate block">{name}</span>
        <span className="text-muted-foreground tabular-nums">
          {item.cantidad} × {formatCurrency(item.precioUnitario)} = {formatCurrency(item.subtotal)}
        </span>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Quitar ${name}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
