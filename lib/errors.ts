export class DomainError extends Error {}

export class ValidationError extends DomainError {}

export class NotFoundError extends DomainError {}

export class ConflictError extends DomainError {}

export class InventoryCountOpenError extends ConflictError {
  readonly code = "INVENTORY_COUNT_OPEN";

  constructor(
    public readonly tomaId: string,
    public readonly periodo: string,
  ) {
    super("No se puede modificar el inventario mientras existe una toma abierta");
  }
}

export type StockShortage = {
  insumoId: string;
  nombre: string;
  requerido: number;
  disponible: number;
};

export class InsufficientStockError extends DomainError {
  constructor(public readonly faltantes: StockShortage[]) {
    super("Stock insuficiente para registrar la producción");
  }
}
