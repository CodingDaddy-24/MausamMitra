from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class SkillMetric(Base):
    __tablename__ = "model_skill_metrics"
    __table_args__ = (UniqueConstraint("provider", "variable", "location_key", name="uq_model_skill_scope"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    variable: Mapped[str] = mapped_column(String(30), index=True)
    location_key: Mapped[str] = mapped_column(String(180), default="INDIA")
    mae: Mapped[float] = mapped_column(Float)
    rmse: Mapped[float] = mapped_column(Float)
    correlation: Mapped[float | None] = mapped_column(Float, nullable=True)
    bias: Mapped[float | None] = mapped_column(Float, nullable=True)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    reference_name: Mapped[str] = mapped_column(String(100), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WeightSnapshot(Base):
    __tablename__ = "weight_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    variable: Mapped[str] = mapped_column(String(30), index=True)
    location_key: Mapped[str] = mapped_column(String(180), default="INDIA")
    weight: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(100))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
