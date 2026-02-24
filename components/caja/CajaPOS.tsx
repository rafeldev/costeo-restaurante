"use client";

import { useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaja } from "@/hooks/useCaja";
import { CarritoCaja } from "./CarritoCaja";
import { SelectorRecetas } from "./SelectorRecetas";
import { cn } from "@/lib/utils";

export function CajaPOS() {
  const {
    venta,
    recetas,
    loading,
    error,
    actionLoading,
    successMessage,
    createNewVenta,
    addItem,
    removeItem,
    patchVenta,
    cerrar,
    cancelar,
    clearSuccess,
  } = useCaja();

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(clearSuccess, 4000);
    return () => clearTimeout(t);
  }, [successMessage, clearSuccess]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr,minmax(280px,360px)] md:gap-6">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-[320px] w-full rounded-md" />
        <Skeleton className="h-[280px] w-full rounded-md md:col-start-2 md:row-span-2 md:row-start-1" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr,minmax(280px,360px)] md:gap-6">
      {(error || successMessage) && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm md:col-span-2",
            error
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-green-600/50 bg-green-500/10 text-green-800 dark:text-green-200"
          )}
          role={error ? "alert" : "status"}
        >
          {error ?? successMessage}
        </div>
      )}

      {!venta ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-10 md:col-span-2">
          <p className="text-muted-foreground">Sin venta abierta</p>
          <Button
            onClick={createNewVenta}
            disabled={actionLoading === "create"}
            className="gap-2"
          >
            <ShoppingCart className="size-4" />
            {actionLoading === "create" ? "Creando…" : "Nueva venta"}
          </Button>
        </Card>
      ) : (
        <>
          <section className="flex flex-col" aria-label="Productos">
            <h2 className="sr-only">Productos disponibles</h2>
            <SelectorRecetas
              recetas={recetas}
              onAdd={(recetaId, cantidad, precioUnitario) =>
                addItem(recetaId, cantidad, precioUnitario)
              }
              addingId={actionLoading?.startsWith("add-") ? actionLoading : null}
            />
          </section>
          <section className="md:row-span-1" aria-label="Carrito y total">
            <CarritoCaja
              venta={venta}
              onRemoveItem={removeItem}
              onPatchVenta={patchVenta}
              onCobrar={cerrar}
              onCancelar={cancelar}
              loadingCobrar={actionLoading === "cerrar"}
              loadingCancelar={actionLoading === "cancelar"}
              loadingRemoveId={actionLoading?.startsWith("remove-") ? actionLoading : null}
            />
          </section>
        </>
      )}
    </div>
  );
}
