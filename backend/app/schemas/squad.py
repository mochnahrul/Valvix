from typing import Optional, List, Dict
from pydantic import Field
from app.schemas.steam import CamelModel, SteamGame


class SteamFriendItem(CamelModel):
    steam_id64: str = Field(alias="steamId64")
    persona_name: str = Field(alias="personaName")
    avatar_url: str = Field(alias="avatarUrl")
    profile_url: Optional[str] = Field(default=None, alias="profileUrl")
    status: str = "offline"  # online | in-game | offline
    currently_playing: Optional[str] = Field(default=None, alias="currentlyPlaying")


class SquadMember(CamelModel):
    steam_id64: str = Field(alias="steamId64")
    persona_name: str = Field(alias="personaName")
    avatar_url: str = Field(alias="avatarUrl")
    status: Optional[str] = "offline"
    currently_playing: Optional[str] = Field(default=None, alias="currentlyPlaying")
    owned_app_ids: List[int] = Field(default_factory=list, alias="ownedAppIds")
    playtimes: Dict[int, int] = Field(default_factory=dict)  # appId -> minutes


class CoopIntersectionRequest(CamelModel):
    steam_ids: List[str] = Field(alias="steamIds")
    filter_tag: Optional[str] = Field(default="all", alias="filterTag")


class CoopIntersectionResponse(CamelModel):
    members: List[SquadMember]
    intersected_games: List[SteamGame] = Field(alias="intersectedGames")
    total_shared_games: int = Field(alias="totalSharedGames")
