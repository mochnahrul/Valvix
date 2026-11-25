from datetime import datetime
from typing import Dict, Any
from sqlalchemy import String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AIPersona(Base):
    __tablename__ = "ai_personas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    steam_id64: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.steam_id64", ondelete="CASCADE"), index=True
    )
    tone: Mapped[str] = mapped_column(String(20), default="playful")  # friendly, playful, brutal
    library_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    persona_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="personas")
