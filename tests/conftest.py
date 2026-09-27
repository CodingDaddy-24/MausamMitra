import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@127.0.0.1:5432/mausammitra_test"


@pytest.fixture(autouse=True)
def mock_database_session():
    from app.database import get_db
    from app.main import app

    session = MagicMock()
    session.scalars.return_value.all.return_value = []

    def dependency():
        yield session

    app.dependency_overrides[get_db] = dependency
    yield session
    app.dependency_overrides.pop(get_db, None)
