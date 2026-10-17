# Costeo Restaurante MVP

Aplicación web para calcular costos de producción y precio sugerido de venta en recetas de restaurante (iniciando con hamburguesas caseras, pero modelo genérico).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma ORM + PostgreSQL
- React Hook Form + Zod
- Vitest y Playwright para pruebas unitarias, de integración y navegador

## Funcionalidades MVP

- CRUD de insumos (materia prima, unidad base, merma y costo).
- CRUD de recetas con ingredientes y rendimiento por porciones.
- Configuración global de costeo: overhead, margen objetivo, impuesto y redondeo.
- Cálculo de costo por receta y precio sugerido final.
- Semáforo básico de rentabilidad con base en margen real vs objetivo.



## Configuración local

1. Instala dependencias:

```bash
npm ci
```

1. Configura variables de entorno en `.env`:

```bash
DATABASE_URL="postgresql://usuario:password@localhost:5432/restaurante?schema=public"
AUTH_SECRET="reemplazar-con-una-clave-larga-y-segura"
AUTH_TRUST_HOST="true"
SEED_OWNER_EMAIL="owner@example.com"
SEED_OWNER_PASSWORD="una-clave-local-de-12-caracteres"
SEED_RESTAURANT_NAME="Restaurante de demostración"
```

1. Genera cliente Prisma y migra:

```bash
npm run db:generate
npm run db:migrate
```

1. Carga datos iniciales:

```bash
npm run db:seed
```

1. Ejecuta el proyecto:

```bash
npm run dev
```



## Scripts

- `npm run dev`: levanta la app en desarrollo.
- `npm run lint`: revisa reglas de lint.
- `npm run test`: ejecuta pruebas unitarias.
- `npm run test:integration`: migra una PostgreSQL desechable en `DATABASE_URL_TEST` y ejecuta integración.
- `npm run test:e2e`: ejecuta el smoke de navegador.
- `npm run typecheck`: valida TypeScript.
- `npm run audit:prod`: comprueba vulnerabilidades de producción.
- `npm run db:generate`: genera Prisma Client.
- `npm run db:migrate`: crea/aplica migraciones.
- `npm run db:seed`: inserta usuario inicial, configuración e insumos base.
- `npm run user:create -- --email=usuario@dominio.com --password=clave-segura --restaurant="Mi restaurante"`: aprovisiona una cuenta, configuración y áreas iniciales.



## Deploy sugerido (Vercel + Neon/Supabase)

1. Crear bases o ramas separadas de Neon para preview y producción.
2. Configurar `DATABASE_URL` pooled y `DIRECT_DATABASE_URL` para migraciones.
3. Configurar Auth y `CRON_SECRET` a partir de `.env.example`. Upstash y Sentry son opcionales.
4. Ejecutar migraciones mediante el pipeline antes de promover producción.
5. Verificar `/api/health`, login y monitoreo después del deploy.

El procedimiento de despliegue, restauración e incidentes está en `docs/operations-pilot.md`.
