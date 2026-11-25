from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class UserLibrary(Base):
    __tablename__ = "user_libraries"

    steam_id64: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.steam_id64", ondelete="CASCADE"), primary_key=True
    )
    app_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("games_catalog.app_id", ondelete="CASCADE"), primary_key=True
    )
    playtime_forever: Mapped[int] = mapped_column(Integer, default=0)  # in minutes
    playtime_2weeks: Mapped[int] = mapped_column(Integer, default=0)   # in minutes
    rtime_last_played: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    achievements_unlocked: Mapped[int] = mapped_column(Integer, default=0)

    user = relationship("User", back_populates="libraries")
    game = relationship("GameCatalog", back_populates="libraries")
