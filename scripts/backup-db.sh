#!/bin/bash
# Copia semanal de la base (Supabase) a un SSD externo. Ver scripts/backup-db.sh --help en README.
set -euo pipefail
umask 077

PG_BIN="/opt/homebrew/opt/libpq/bin"
URL_FILE="$HOME/.config/costeo-backup/db_url"
DEST="${BACKUP_DIR:-/Volumes/ext_rafedev0/db_backup_costeo_restaurante}"

notify() {
  osascript -e "display notification \"$1\" with title \"Backup costeo-restaurante\"" >/dev/null 2>&1 || true
}
fail() {
  echo "$(date '+%F %T') ERROR: $1" >&2
  notify "FALLÓ: $1"
  exit 1
}

[ -d "$DEST" ] || fail "SSD no montado ($DEST)"
[ -r "$URL_FILE" ] || fail "falta $URL_FILE"

FILE="$DEST/costeo-$(date +%F_%H%M%S).dump"

# Escribe directo al nombre final: bajo launchd macOS niega mv/rm en el SSD.
"$PG_BIN/pg_dump" --format=custom --no-owner --no-privileges \
  --dbname="$(cat "$URL_FILE")" --file="$FILE" || fail "pg_dump falló ($FILE puede estar incompleto)"
"$PG_BIN/pg_restore" --list "$FILE" >/dev/null || fail "el dump no es válido: $FILE"

# Sin rotación: bajo launchd macOS no deja listar/borrar en el SSD. Borra copias viejas a mano.

echo "$(date '+%F %T') OK $FILE ($(du -h "$FILE" | cut -f1))"
