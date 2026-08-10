"""PostgreSQL connection helper."""

from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from app.config import get_settings


@contextmanager
def get_connection():
    """Yield a psycopg2 connection built from environment settings."""
    settings = get_settings()
    conn = psycopg2.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
    )
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_cursor():
    """Yield a dict cursor. Read-only helper; callers do not commit."""
    with get_connection() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield cur
        finally:
            cur.close()
