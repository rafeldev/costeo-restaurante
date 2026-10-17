# Operación del piloto

## Alta de un restaurante

1. Ejecutar las migraciones con la conexión directa de Neon.
2. Crear la cuenta con `npm run user:create -- --email=... --password=... --restaurant=...`.
3. Entregar la contraseña mediante un canal distinto al correo de invitación.
4. Confirmar configuración fiscal, áreas, mínimos y saldo inicial.
5. Completar una compra, producción y toma de prueba.

`prisma db seed` es solo para desarrollo y nunca debe utilizarse para crear clientes.

## Despliegue

1. Confirmar CI verde y ausencia de vulnerabilidades de producción.
2. Crear un punto de restauración o rama de respaldo en Neon.
3. Ejecutar `DIRECT_DATABASE_URL=... npx prisma migrate deploy`.
4. Promover en Vercel la revisión exacta validada en preview.
5. Comprobar `/api/health`, login, lectura de dashboard y Sentry.

Las migraciones deben ser compatibles hacia adelante. El rollback normal consiste en volver al deployment anterior de Vercel; restaurar la base es una medida de último recurso.

## Backup y restauración

1. Activar backups y PITR en Neon.
2. Una vez por ciclo del piloto, crear una rama desde un punto anterior.
3. Aplicar migraciones y ejecutar el smoke test sobre la rama restaurada.
4. Registrar fecha, responsable, RPO observado y duración de recuperación.

## Incidentes

1. Confirmar alcance, cliente afectado y último deployment.
2. Revisar Sentry y logs usando el identificador del error.
3. Bloquear temporalmente nuevas escrituras si existe riesgo de corrupción.
4. Revertir aplicación o aplicar una corrección compatible.
5. Informar al cliente por el canal acordado y documentar causa y prevención.

Nunca registrar contraseñas, cookies, cadenas de conexión, archivos CSV completos ni datos de formularios en tickets o logs.

## Restablecimiento de acceso

El piloto no ofrece recuperación autoservicio. Verificar la identidad por el canal acordado, generar una contraseña aleatoria de al menos 12 caracteres y registrar quién autorizó el cambio. La rotación de `AUTH_SECRET` revoca globalmente todas las sesiones en una emergencia.
