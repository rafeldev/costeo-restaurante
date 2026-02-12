# Costeo Restaurante MVP

Aplicación web para calcular costos de producción y precio sugerido de venta en recetas de restaurante (iniciando con hamburguesas caseras, pero modelo genérico).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma ORM + PostgreSQL
- React Hook Form + Zod
- Vitest para pruebas unitarias del motor de pricing

## Funcionalidades MVP

- CRUD de insumos (materia prima, unidad base, merma y costo).
- CRUD de recetas con ingredientes y rendimiento por porciones.
- Configuración global de costeo: overhead, margen objetivo, impuesto y redondeo.
- Cálculo de costo por receta y precio sugerido final.
- Semáforo básico de rentabilidad con base en margen real vs objetivo.

## Configuración local

1. Instala dependencias:

```bash
npm install
```

2. Configura variables de entorno en `.env`:

```bash
DATABASE_URL="postgresql://usuario:password@localhost:5432/restaurante?schema=public"
```

3. Genera cliente Prisma y migra:

```bash
npm run db:generate
npm run db:migrate
```

4. Carga datos iniciales:

```bash
npm run db:seed
```

5. Ejecuta el proyecto:

```bash
npm run dev
```

## Scripts

- `npm run dev`: levanta la app en desarrollo.
- `npm run lint`: revisa reglas de lint.
- `npm run test`: ejecuta pruebas unitarias.
- `npm run db:generate`: genera Prisma Client.
- `npm run db:migrate`: crea/aplica migraciones.
- `npm run db:seed`: inserta configuración e insumos base.

## Deploy sugerido (Vercel + Neon/Supabase)

1. Crear base PostgreSQL gestionada (Neon o Supabase).
2. Configurar `DATABASE_URL` en variables de entorno de Vercel.
3. Ejecutar migraciones en CI/CD o previo al primer deploy.
4. Deploy del repositorio en Vercel.

Recomendación: agregar un paso de migración controlada en pipeline antes de promover a producción.
