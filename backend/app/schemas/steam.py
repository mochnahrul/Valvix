from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        serialize_by_alias=True,
    )


class GameAchievementGuide(CamelModel):
    summary: str
    steps: List[str]
    difficulty: str = "Medium"  # Easy | Medium | Hard


class AchievementGuideRequest(CamelModel):
    app_id: int = Field(alias="appId")
    achievement_api_name: str = Field(alias="achievementApiName")
    name: str
    description: Optional[str] = ""


class GameAchievement(CamelModel):
    id: str
    name: str
    description: str
    icon_url: str = Field(alias="iconUrl")
    unlocked: bool = False
    unlock_time: Optional[str] = Field(default=None, alias="unlockTime")
    is_hidden: Optional[bool] = Field(default=False, alias="isHidden")
    rarity_percent: Optional[float] = Field(default=None, alias="rarityPercent")
    ai_guide: Optional[GameAchievementGuide] = Field(default=None, alias="aiGuide")


class SteamGame(CamelModel):
    app_id: int = Field(alias="appId")
    name: str
    header_image: str = Field(alias="headerImage")
    capsule_image: str = Field(alias="capsuleImage")
    poster_image: str = Field(alias="posterImage")
    price_initial_idr: int = Field(default=0, alias="priceInitialIDR")
    price_final_idr: int = Field(default=0, alias="priceFinalIDR")
    discount_percent: int = Field(default=0, alias="discountPercent")
    is_free: bool = Field(default=False, alias="isFree")
    playtime_forever: int = Field(default=0, alias="playtimeForever")  # in minutes
    playtime_2weeks: int = Field(default=0, alias="playtime2Weeks")    # in minutes
    genres: List[str] = Field(default_factory=list)
    is_multiplayer: bool = Field(default=False, alias="isMultiplayer")
    is_coop: bool = Field(default=False, alias="isCoop")
    is_split_screen: bool = Field(default=False, alias="isSplitScreen")
    has_controller_support: bool = Field(default=False, alias="hasControllerSupport")
    achievements_total: Optional[int] = Field(default=0, alias="achievementsTotal")
    achievements_unlocked: Optional[int] = Field(default=0, alias="achievementsUnlocked")
    achievements: Optional[List[GameAchievement]] = None
    last_played: Optional[str] = Field(default=None, alias="lastPlayed")
    estimated_completion_hours: Optional[int] = Field(default=None, alias="estimatedCompletionHours")


class UserProfile(CamelModel):
    steam_id64: str = Field(alias="steamId64")
    vanity_url: str = Field(default="", alias="vanityUrl")
    persona_name: str = Field(alias="personaName")
    real_name: Optional[str] = Field(default=None, alias="realName")
    avatar_url: str = Field(alias="avatarUrl")
    profile_url: str = Field(alias="profileUrl")
    status: str = "offline"  # online | in-game | offline
    currently_playing: Optional[str] = Field(default=None, alias="currentlyPlaying")
    member_since: str = Field(default="Steam Member", alias="memberSince")
    country_code: str = Field(default="ID", alias="countryCode")
