export class DomainError extends Error {}

export class ValidationError extends DomainError {}

export class NotFoundError extends DomainError {}

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
