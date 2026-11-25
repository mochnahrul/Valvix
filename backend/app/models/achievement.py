from datetime import datetime
from typing import Optional, List
from sqlalchemy import Integer, String, Text, Boolean, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AchievementGuide(Base):
    __tablename__ = "achievement_guides"

    app_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    achievement_api_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    icon_url: Mapped[str] = mapped_column(Text, default="")
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    rarity_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # AI Guide fields
    guide_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    guide_steps: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Easy, Medium, Hard
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
