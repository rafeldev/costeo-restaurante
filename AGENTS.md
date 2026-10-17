# Repository Guide

## Shape and entrypoints

- This is one npm application, not a workspace: Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4, Prisma 7, and PostgreSQL.
- `app/**/page.tsx` contains routes, `app/api/**/route.ts` contains the JSON API, `components/` contains client UI, and `lib/` owns domain rules, validation, serialization, and database services.
- Prisma's source of truth is `prisma/schema.prisma`; committed migrations are in `prisma/migrations/`, and `prisma/seed.ts` seeds the initial owner and catalog.
- Authentication is configured in root `auth.ts`. Root `proxy.ts` protects pages but deliberately lets unauthenticated API requests reach handlers, so every API handler must call `requireAuthUser()` and return a JSON 401.

## Commands

- Install with `npm ci`; `postinstall` also runs `prisma generate`.
- Local setup order: configure `.env`, then `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, and `npm run dev`.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
- Run one unit file with `npm test -- path/to/file.test.ts`; normal Vitest excludes `*.integration.test.ts`.
- Integration tests require a disposable PostgreSQL database in `DATABASE_URL_TEST`: `npm run test:integration`. The script first runs `prisma migrate deploy` against that database and then runs integration files serially.
- Run one integration file with `npm run test:integration -- path/to/file.integration.test.ts`. Never point `DATABASE_URL_TEST` at development or production data.
- After changing the Prisma schema, run `npm run db:migrate` to create/apply a committed migration and regenerate the client. Use `prisma migrate deploy` only to apply existing migrations.

## Domain and API constraints

- Data is multi-tenant. Scope reads and writes by the authenticated user's `ownerId`, including lookups of related IDs supplied by clients; do not rely on globally unique IDs as authorization.
- Keep stock-changing operations in `lib/inventory.ts` transactions. Purchases, manual movements, production, production edits, and cancellation update inventory and audit movements atomically; route handlers should call these services rather than reproduce the writes.
- API inputs use shared Zod schemas in `lib/validation.ts`. Normalize HTML/JSON numeric values with `parseNumberInput` before validation where existing routes do so.
- API responses must convert Prisma `Decimal` fields to plain numbers via `lib/serializers.ts`; returning raw Prisma records changes the DTO contract.
- Use domain errors plus `handleRouteError()` for inventory/service routes so insufficient stock remains HTTP 409, missing records 404, validation 400, and auth 401.
- Pricing and inventory calculations intentionally use JavaScript `number`; persistence uses four decimals for quantities/unit costs and two for monetary totals. Normalize externally reported shortages to four decimals. See `docs/decisions/2026-10-10-inventory-numeric-precision.md` before changing this policy.
- Database-backed API routes use `export const runtime = "nodejs"`; the Prisma PostgreSQL adapter is not an Edge runtime dependency.

## UI conventions

- UI copy and validation messages are Spanish.
- Reuse tokens/classes from `app/globals.css` and primitives in `components/ui/` instead of introducing a parallel component style. `.interface-design/system.md` documents the active visual and interaction patterns.
- Destructive actions and production registration use `ConfirmModal`; async success/error feedback uses Sonner toasts, and list states use `LoadingState`, `EmptyState`, and `ErrorState`.
