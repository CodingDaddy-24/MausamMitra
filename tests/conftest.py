import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./mausammitra-test.db"
