/**
 * Valvix Core Domain Types
 */

export interface GameAchievementGuide {
  summary: string;
  steps: string[];
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface GameAchievement {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  unlocked: boolean;
  unlockTime?: string;
  isHidden?: boolean;
  rarityPercent?: number;
  aiGuide?: GameAchievementGuide;
}

export interface SteamGame {
  appId: number;
  name: string;
  headerImage: string;
  capsuleImage: string;
  posterImage: string;
  priceInitialIDR: number;
  priceFinalIDR: number;
  discountPercent: number;
  isFree?: boolean;
  playtimeForever: number; // in minutes
  playtime2Weeks: number;  // in minutes
  genres: string[];
  isMultiplayer: boolean;
  isCoop: boolean;
  isSplitScreen: boolean;
  hasControllerSupport: boolean;
  achievementsTotal?: number;
  achievementsUnlocked?: number;
  achievements?: GameAchievement[];
  lastPlayed?: string;
  estimatedCompletionHours?: number;
}

export interface UserProfile {
  steamId64: string;
  vanityUrl: string;
  personaName: string;
  realName?: string;
  avatarUrl: string;
  profileUrl: string;
  status: "online" | "in-game" | "offline";
  currentlyPlaying?: string;
  memberSince: string;
  countryCode: string;
}

export interface SquadMember {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  status?: string;
  currentlyPlaying?: string;
  ownedAppIds: number[];
  playtimes: Record<number, number>; // appId -> minutes
}

export type RoastTone = "friendly" | "playful" | "brutal";

export interface GenreDominance {
  genre: string;
  percentage: number;
}

export interface TelemetrySnapshot {
  totalGames: number;
  totalPlaytimeHours: number;
  unplayedCount: number;
  unplayedPercentage: number;
  totalLibraryValueIDR: number;
  unplayedValueIDR: number;
  averageCostPerHourIDR: number;
  mostExpensiveUnplayed: string;
}

export interface AIPersonaData {
  steamId64: string;
  telemetryHash: string;
  archetypeTitle: string;
  playstyleSummary: string;
  strengths: string[];
  comedyRoast: string;
  dominantGenres: GenreDominance[];
  telemetrySnapshot: TelemetrySnapshot;
  generatedAt: string;
}

export type ModuleType = "overview" | "backlog" | "coop" | "persona";
