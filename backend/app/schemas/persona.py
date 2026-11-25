from typing import List, Dict
from pydantic import Field
from app.schemas.steam import CamelModel


class GenreDominance(CamelModel):
    genre: str
    percentage: float


class TelemetrySnapshot(CamelModel):
    total_games: int = Field(alias="totalGames")
    total_playtime_hours: float = Field(alias="totalPlaytimeHours")
    unplayed_count: int = Field(alias="unplayedCount")
    unplayed_percentage: float = Field(alias="unplayedPercentage")
    total_library_value_idr: int = Field(alias="totalLibraryValueIDR")
    unplayed_value_idr: int = Field(alias="unplayedValueIDR")
    average_cost_per_hour_idr: int = Field(alias="averageCostPerHourIDR")
    most_expensive_unplayed: str = Field(alias="mostExpensiveUnplayed")


class PersonaRequest(CamelModel):
    tone: str = "playful"  # friendly | playful | brutal
    force_refresh: bool = Field(default=False, alias="forceRefresh")
    currency: str = "USD"


class AIPersonaLLMOutput(CamelModel):
    archetype_title: str = Field(alias="archetypeTitle")
    playstyle_summary: str = Field(alias="playstyleSummary")
    strengths: List[str]
    comedy_roast: str = Field(alias="comedyRoast")


class AIPersonaData(CamelModel):
    steam_id64: str = Field(alias="steamId64")
    telemetry_hash: str = Field(alias="telemetryHash")
    archetype_title: str = Field(alias="archetypeTitle")
    playstyle_summary: str = Field(alias="playstyleSummary")
    strengths: List[str]
    comedy_roast: str = Field(alias="comedyRoast")
    dominant_genres: List[GenreDominance] = Field(alias="dominantGenres")
    telemetry_snapshot: TelemetrySnapshot = Field(alias="telemetrySnapshot")
    generated_at: str = Field(alias="generatedAt")
