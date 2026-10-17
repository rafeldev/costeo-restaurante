DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TomaInventario"
    WHERE "estado" = 'EN_CURSO'
    GROUP BY "ownerId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear el índice: existen múltiples tomas abiertas para un usuario';
  END IF;
END $$;

CREATE UNIQUE INDEX "TomaInventario_single_open_owner_idx"
ON "TomaInventario" ("ownerId")
WHERE "estado" = 'EN_CURSO';
