#!/usr/bin/env bash
# Локальный стенд: временный PostgreSQL + заглушки Supabase + миграции + тесты.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT=54329
TMP="$(mktemp -d)"
chmod 755 "$TMP"
RUN=()
if [ "$(id -u)" -eq 0 ]; then
  chown postgres "$TMP"
  RUN=(runuser -u postgres --)
fi
DATA="$TMP/data"
SOCK="$TMP/sock"
mkdir -p "$SOCK"
[ "${#RUN[@]}" -gt 0 ] && chown postgres "$SOCK"

started=0
cleanup() {
  if [ "$started" -eq 1 ]; then
    "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -w -l "$TMP/pg.log" \
  -o "-p $PORT -k $SOCK -c listen_addresses=''" start >/dev/null
started=1

psql_run() { "${RUN[@]}" psql -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

psql_run -d postgres -c "create database aiu_test" 
DB=aiu_test

fail=0
apply() {
  local f="$1"
  if ! psql_run -d "$DB" -f "$f" >/dev/null; then
    echo "FAIL setup: $f"
    exit 1
  fi
}

apply "$ROOT/supabase/tests/_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do apply "$f"; done
[ -f "$ROOT/supabase/seed.sql" ] && apply "$ROOT/supabase/seed.sql"

for t in "$ROOT"/supabase/tests/*.test.sql; do
  [ -e "$t" ] || continue
  name="$(basename "$t")"
  if out="$(psql_run -d "$DB" -f "$t" 2>&1)"; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    echo "$out" | sed 's/^/    /'
    fail=1
  fi
done

exit "$fail"
