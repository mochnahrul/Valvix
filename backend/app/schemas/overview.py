from typing import Optional, Dict, Any, List
from pydantic import Field
from app.schemas.steam import CamelModel, UserProfile, SteamGame


class LibraryOverview(CamelModel):
    total_games: int = Field(alias="totalGames")
    total_playtime_hours: float = Field(alias="totalPlaytimeHours")
    total_library_value_idr: int = Field(alias="totalLibraryValueIDR")
    average_cost_per_hour_idr: int = Field(alias="averageCostPerHourIDR")
    unplayed_count: int = Field(alias="unplayedCount")
    unplayed_percentage: float = Field(alias="unplayedPercentage")
    spotlight_app_id: Optional[int] = Field(default=None, alias="spotlightAppId")
    top_value_game: Optional[Dict[str, Any]] = Field(default=None, alias="topValueGame")
    most_played_game: Optional[Dict[str, Any]] = Field(default=None, alias="mostPlayedGame")
    unplayed_gem: Optional[Dict[str, Any]] = Field(default=None, alias="unplayedGem")


class SyncResponse(CamelModel):
    profile: UserProfile
    games: List[SteamGame]
    overview: LibraryOverview
    synced_at: str = Field(alias="syncedAt")
    is_cached: bool = Field(default=False, alias="isCached")
