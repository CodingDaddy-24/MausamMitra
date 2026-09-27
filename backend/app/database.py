from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    database_url = get_settings().database_url
    parsed_url = make_url(database_url)
    if parsed_url.get_backend_name() != "postgresql":
        raise RuntimeError("DATABASE_URL must use Supabase PostgreSQL.")
    if "pooler.supabase.com" in (parsed_url.host or "") and parsed_url.port == 6543:
        # Supavisor transaction pooling is appropriate for Vercel/serverless.
        return create_engine(database_url, poolclass=NullPool, connect_args={"prepare_threshold": None})
    return create_engine(database_url, pool_pre_ping=True, pool_size=3, max_overflow=2)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
