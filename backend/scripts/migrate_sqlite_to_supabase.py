"""Copy existing local MausamMitra records into Supabase Postgres.

Run only after applying backend/migrations/001_skill_metrics.sql and setting
DATABASE_URL to the Supabase transaction-pooler connection string. The source
SQLite file is read-only and is never changed or deleted.
"""

from __future__ import annotations

import argparse
import os
from datetime import timezone
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.pool import NullPool


ROOT = Path(__file__).resolve().parents[2]
TABLES = ("model_skill_metrics", "weight_history")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, default=ROOT / "mausammitra.db", help="Existing SQLite database to copy (read-only).")
    args = parser.parse_args()
    target_url = os.environ.get("DATABASE_URL", "")
    if not target_url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise SystemExit("Set DATABASE_URL to the Supabase PostgreSQL connection string before running this script.")
    if not args.sqlite.is_file():
        raise SystemExit(f"SQLite source not found: {args.sqlite}")

    source = create_engine(f"sqlite:///{args.sqlite.resolve().as_posix()}")
    target = create_engine(target_url, poolclass=NullPool, connect_args={"prepare_threshold": None})
    copied: dict[str, int] = {}
    try:
        source_meta, target_meta = MetaData(), MetaData()
        with source.connect() as source_conn, target.begin() as target_conn:
            for name in TABLES:
                if name not in source_meta.tables:
                    try:
                        source_table = Table(name, source_meta, autoload_with=source_conn)
                    except NoSuchTableError:
                        copied[name] = 0
                        continue
                else:
                    source_table = source_meta.tables[name]
                target_table = Table(name, target_meta, autoload_with=target_conn)
                rows = [dict(row) for row in source_conn.execute(select(source_table)).mappings()]
                for row in rows:
                    for column in ("updated_at", "recorded_at"):
                        value = row.get(column)
                        if value is not None and value.tzinfo is None:
                            row[column] = value.replace(tzinfo=timezone.utc)
                inserted = 0
                for offset in range(0, len(rows), 500):
                    batch = rows[offset:offset + 500]
                    if not batch:
                        continue
                    stmt = insert(target_table).values(batch).on_conflict_do_nothing(index_elements=[target_table.c.id])
                    result = target_conn.execute(stmt)
                    inserted += result.rowcount or 0
                target_conn.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {name}), 1), "
                    f"EXISTS (SELECT 1 FROM {name}))"
                ))
                copied[name] = inserted
    finally:
        source.dispose()
        target.dispose()

    print("Inserted records (existing IDs were left unchanged):")
    for name, count in copied.items():
        print(f"  {name}: {count}")
    print("SQLite source remains unchanged.")


if __name__ == "__main__":
    main()
