#!/bin/sh
set -e

echo "Waiting for Postgres..."
python3 - <<'PYEOF'
import time
import sys
from sqlalchemy import create_engine
from core.config import get_settings

settings = get_settings()
for i in range(30):
    try:
        engine = create_engine(settings.DATABASE_URL)
        conn = engine.connect()
        conn.close()
        print("Postgres is ready.")
        sys.exit(0)
    except Exception as e:
        print(f"Postgres not ready yet ({e}); retrying...")
        time.sleep(2)
print("Postgres never became ready.")
sys.exit(1)
PYEOF

echo "Running database migrations..."
alembic upgrade head

echo "Starting: $@"
exec "$@"
