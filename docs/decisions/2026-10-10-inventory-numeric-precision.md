# Precisión numérica en costeo e inventario

**Fecha:** 2026-10-10

## Decisión

Mantener los cálculos de costeo e inventario con `number` de JavaScript. Persistir cantidades y costos con las escalas `Decimal` ya definidas en Prisma: cuatro decimales para cantidades y costos unitarios, y dos para totales monetarios.

Los detalles de faltantes expuestos por la API se normalizan a cuatro decimales para evitar residuos binarios como `110.00000000000001`.

## Motivo

Los redondeos actuales y las magnitudes del dominio hacen bajo el riesgo observado. Migrar todos los cálculos a `Prisma.Decimal` aumentaría la complejidad de servicios, DTO y pruebas sin una discrepancia real que lo justifique.

## Revisión

Reevaluar esta decisión si aparecen diferencias entre movimientos y reportes, si se agregan cálculos acumulativos de alto volumen o si se implementa costeo histórico/FIFO/promedio ponderado.
