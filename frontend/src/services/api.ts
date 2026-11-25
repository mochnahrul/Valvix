import {
  UserProfile,
  SteamGame,
  GameAchievement,
  GameAchievementGuide,
  SquadMember,
  AIPersonaData,
  RoastTone,
} from "@/types/steam";
import { extractSteamIdentifier } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/+$/, "");
const TIMEOUT_MS = 25000;

export interface LibraryOverview {
  totalGames: number;
  totalPlaytimeHours: number;
  totalLibraryValueIDR: number;
  averageCostPerHourIDR: number;
  unplayedCount: number;
  unplayedPercentage: number;
  spotlightAppId?: number;
  topValueGame?: any;
  mostPlayedGame?: any;
  unplayedGem?: any;
}

export interface SyncResponse {
  profile: UserProfile;
  games: SteamGame[];
  overview: LibraryOverview;
  syncedAt: string;
  isCached: boolean;
}

export interface CoopIntersectionResponse {
  members: SquadMember[];
  intersectedGames: SteamGame[];
  totalSharedGames: number;
}

// LocalStorage & Session Cache helpers
const ACTIVE_PROFILE_KEY = "valvix_active_profile";
const AUTH_USER_KEY = "valvix_auth_user";
const CACHED_GAMES_PREFIX = "valvix_cached_games_";
const RECENT_PROFILES_KEY = "valvix_recent_profiles";

// In-memory cache for ultra-low latency navigation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T;
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function clearMemoryCache(): void {
  memoryCache.clear();
}

export function getStoredRecentProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(RECENT_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Failed to get stored recent profiles:", e);
  }
  return [];
}

export function addStoredRecentProfile(profile: UserProfile): void {
  try {
    if (!profile || !profile.steamId64) return;
    const current = getStoredRecentProfiles().filter((p) => p.steamId64 !== profile.steamId64);
    const updated = [profile, ...current].slice(0, 5);
    localStorage.setItem(RECENT_PROFILES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to store recent profile:", e);
  }
}

export function getStoredUserGames(steamId64: string): SteamGame[] {
  try {
    const raw = localStorage.getItem(`${CACHED_GAMES_PREFIX}${steamId64}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed to get stored games:", e);
  }
  return [];
}

export function setStoredUserGames(steamId64: string, games: SteamGame[]): void {
  try {
    if (games && games.length > 0) {
      localStorage.setItem(`${CACHED_GAMES_PREFIX}${steamId64}`, JSON.stringify(games));
    }
  } catch (e) {
    console.warn("Failed to set stored games:", e);
  }
}

export function getStoredAuthUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to load auth user from localStorage:", e);
  }
  return null;
}

export function setStoredAuthUser(profile: UserProfile | null): void {
  try {
    if (profile) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
      addStoredRecentProfile(profile);
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  } catch (e) {
    console.warn("Failed to set auth user in localStorage:", e);
  }
}

// Resilient fetch wrapper with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 1. Sync Profile & Owned Games
export async function syncUserProfile(identifier: string): Promise<SyncResponse> {
  const cleanId = extractSteamIdentifier(identifier);
  const res = await fetchWithTimeout(`${API_BASE}/sync/${encodeURIComponent(cleanId)}`, {
    method: "POST",
  });
  if (res.ok) {
    const data: SyncResponse = await res.json();
    setStoredAuthUser(data.profile);
    if (data.games && data.games.length > 0) {
      setStoredUserGames(data.profile.steamId64, data.games);
      setCached(`games_${data.profile.steamId64}`, data.games);
    }
    if (data.overview) {
      setCached(`overview_${data.profile.steamId64}`, data.overview);
    }
    return data;
  }
  throw new Error(`Sync failed with HTTP ${res.status}`);
}

// 2. Fetch User Games
export async function fetchUserGames(steamId64: string): Promise<SteamGame[]> {
  const cached = getCached<SteamGame[]>(`games_${steamId64}`);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE}/users/${steamId64}/games`);
    if (res.ok) {
      const data: SteamGame[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setStoredUserGames(steamId64, data);
        setCached(`games_${steamId64}`, data);
        return data;
      }
    }
  } catch (err) {
    console.info("Backend API unreachable, checking local cache:", err);
  }
  return getStoredUserGames(steamId64);
}

export interface SteamFriendItem {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl?: string;
  status: string;
  currentlyPlaying?: string;
}

// 4. Co-op Squad Matcher
export async function fetchUserFriends(steamId64: string): Promise<SteamFriendItem[]> {
  const cached = getCached<SteamFriendItem[]>(`friends_${steamId64}`);
  if (cached) {
    return cached;
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE}/users/${steamId64}/friends`);
    if (res.ok) {
      const data: SteamFriendItem[] = await res.json();
      setCached(`friends_${steamId64}`, data);
      return data;
    }
  } catch (err) {
    console.info("Could not fetch Steam friends:", err);
  }
  return [];
}

export async function fetchCoopIntersection(
  steamIds: string[],
  filterTag: string = "all"
): Promise<CoopIntersectionResponse> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/coop/intersect`, {
      method: "POST",
      body: JSON.stringify({ steamIds, filterTag }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.info("Backend API unreachable for coop intersection:", err);
  }

  return {
    members: [],
    intersectedGames: [],
    totalSharedGames: 0,
  };
}

// 5. Game Achievements
export async function fetchGameAchievements(
  appId: number,
  steamId64: string
): Promise<GameAchievement[]> {
  const cacheKey = `achievements_${appId}_${steamId64}`;
  const cached = getCached<GameAchievement[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE}/games/${appId}/achievements/${steamId64}`);
    if (res.ok) {
      const data: GameAchievement[] = await res.json();
      setCached(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.info("Backend API unreachable for achievements:", err);
  }
  return [];
}

// 6. AI Achievement Unlock Guide
export async function fetchAchievementGuide(
  appId: number,
  achievementApiName: string,
  name: string,
  description?: string
): Promise<GameAchievementGuide> {
  const cacheKey = `guide_${appId}_${achievementApiName}`;
  const cached = getCached<GameAchievementGuide>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE}/achievements/guide`, {
      method: "POST",
      body: JSON.stringify({
        appId,
        achievementApiName,
        name,
        description: description || "",
      }),
    });
    if (res.ok) {
      const data: GameAchievementGuide = await res.json();
      setCached(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.info("Backend API unreachable, using simulated AI guide fallback:", err);
  }

  return {
    summary: `Complete key narrative and mechanical requirements for '${name}'.`,
    steps: [
      `Review current build attributes and prerequisite quest triggers for '${name}'.`,
      "Equip optimal companion synergies or active buffs.",
      `Execute target challenge: ${description || "Follow the objective marker to trigger achievement."}`,
    ],
    difficulty: "Medium",
  };
}

// 7. AI Gaming Persona & Roast
export async function fetchUserPersona(
  steamId64: string,
  tone: RoastTone = "playful",
  forceRefresh: boolean = false,
  currency: string = "USD"
): Promise<AIPersonaData> {
  const res = await fetchWithTimeout(`${API_BASE}/users/${steamId64}/persona`, {
    method: "POST",
    body: JSON.stringify({ tone, forceRefresh, currency }),
  });
  if (res.ok) {
    return await res.json();
  }
  throw new Error(`Failed to fetch persona: HTTP ${res.status}`);
}
