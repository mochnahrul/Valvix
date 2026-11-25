from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    steam_id64: Mapped[str] = mapped_column(String(32), primary_key=True)
    persona_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=False)
    profile_url: Mapped[str] = mapped_column(Text, nullable=False)
    real_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    country_code: Mapped[str] = mapped_column(String(10), default="ID")
    member_since: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="offline")
    currently_playing: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    libraries = relationship("UserLibrary", back_populates="user", cascade="all, delete-orphan")
    personas = relationship("AIPersona", back_populates="user", cascade="all, delete-orphan")
