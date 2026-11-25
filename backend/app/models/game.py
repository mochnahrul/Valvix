from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import Integer, String, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class GameCatalog(Base):
    __tablename__ = "games_catalog"

    app_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    header_image: Mapped[str] = mapped_column(Text, nullable=False)
    capsule_image: Mapped[str] = mapped_column(Text, nullable=False)
    poster_image: Mapped[str] = mapped_column(Text, nullable=False)
    price_initial_idr: Mapped[int] = mapped_column(Integer, default=0)
    price_final_idr: Mapped[int] = mapped_column(Integer, default=0)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0)
    is_free: Mapped[bool] = mapped_column(Boolean, default=False)
    genres: Mapped[List[str]] = mapped_column(JSON, default=list)
    categories: Mapped[List[str]] = mapped_column(JSON, default=list)
    is_multiplayer: Mapped[bool] = mapped_column(Boolean, default=False)
    is_coop: Mapped[bool] = mapped_column(Boolean, default=False)
    is_splitscreen: Mapped[bool] = mapped_column(Boolean, default=False)
    has_controller_support: Mapped[bool] = mapped_column(Boolean, default=False)
    achievements_total: Mapped[int] = mapped_column(Integer, default=0)
    estimated_completion_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    libraries = relationship("UserLibrary", back_populates="game", cascade="all, delete-orphan")
