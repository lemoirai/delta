#!/bin/sh
# Local/CI PocketBase. Creates (or resets) the test superuser, then serves.
set -eu

: "${PB_SUPERUSER_EMAIL:?PB_SUPERUSER_EMAIL is required}"
: "${PB_SUPERUSER_PASSWORD:?PB_SUPERUSER_PASSWORD is required}"

/pb/pocketbase superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" \
  --dir=/pb_data --migrationsDir=/pb_migrations

exec /pb/pocketbase serve --http=0.0.0.0:8090 \
  --dir=/pb_data --hooksDir=/pb_hooks --migrationsDir=/pb_migrations "$@"
