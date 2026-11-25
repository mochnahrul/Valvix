import { useState, useMemo } from "react";
import { SteamGame, UserProfile } from "@/types/steam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/common/GameCard";
import { formatHours, calculateCostPerHour } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  Flame,
  Clock,
  Coins,
  Search,
  Shuffle,
  Trophy,
  Filter,
  Gamepad2,
  ArrowUpDown,
  Zap,
  Share2,
} from "lucide-react";

interface BacklogPickerViewProps {
  onSelectGame: (game: SteamGame) => void;
  userGames?: SteamGame[];
  currentProfile?: UserProfile;
  onOpenShareShowcase?: () => void;
}

export type BacklogBucket =
  | "all"
  | "shame"
  | "quick_wins"
  | "unfinished"
  | "high_value";

export type SortOption =
  | "best_value"
  | "playtime_desc"
  | "playtime_asc"
  | "price_desc"
  | "achievements";

export function BacklogPickerView({
  onSelectGame,
  userGames,
  currentProfile: _currentProfile,
  onOpenShareShowcase,
}: BacklogPickerViewProps) {
  const { formatPrice } = useCurrency();
  const games = userGames && userGames.length > 0 ? userGames : [];
  const [activeBucket, setActiveBucket] = useState<BacklogBucket>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("best_value");
  const [randomPickNotification, setRandomPickNotification] = useState<string | null>(null);

  // Pre-calculate buckets
  const unplayedGames = useMemo(
    () => games.filter((g) => g.playtimeForever === 0),
    [games]
  );

  const quickWins = useMemo(
    () =>
      games.filter((g) => {
        const hours = g.playtimeForever / 60;
        const achTotal = g.achievementsTotal || 0;
        const achUnlocked = g.achievementsUnlocked || 0;
        const achPct = achTotal > 0 ? achUnlocked / achTotal : 0;
        // Quick wins: Games with < 15 hours played, or games with > 50% achievements unlocked but not 100%
        return (hours > 0 && hours <= 15) || (achPct >= 0.5 && achPct < 1.0);
      }),
    [games]
  );

  const unfinishedBusiness = useMemo(
    () =>
      games.filter((g) => {
        const hours = g.playtimeForever / 60;
        const achRemaining = (g.achievementsTotal || 0) - (g.achievementsUnlocked || 0);
        // Games started (> 1 hour) where achievements remain, or between 2 and 60 hours
        return (hours >= 2 && hours <= 60) || (hours > 1 && achRemaining > 0);
      }),
    [games]
  );

  const highValue = useMemo(
    () =>
      games.filter((g) => {
        const cph = calculateCostPerHour(g.priceInitialIDR, g.playtimeForever);
        return cph !== null && cph < 25000 && g.playtimeForever >= 180;
      }),
    [games]
  );

  // Filter & Sort Logic
  const filteredGames = useMemo(() => {
    let result = [...games];

    // Bucket filter
    if (activeBucket === "shame") {
      result = unplayedGames;
    } else if (activeBucket === "quick_wins") {
      result = quickWins;
    } else if (activeBucket === "unfinished") {
      result = unfinishedBusiness;
    } else if (activeBucket === "high_value") {
      result = highValue;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.genres || []).some((genre) => genre.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "best_value": {
          const cphA = calculateCostPerHour(a.priceInitialIDR, a.playtimeForever);
          const cphB = calculateCostPerHour(b.priceInitialIDR, b.playtimeForever);
          if (cphA !== null && cphB !== null) return cphA - cphB;
          if (cphA !== null) return -1;
          if (cphB !== null) return 1;
          return b.playtimeForever - a.playtimeForever;
        }
        case "playtime_desc":
          return b.playtimeForever - a.playtimeForever;
        case "playtime_asc":
          return a.playtimeForever - b.playtimeForever;
        case "price_desc":
          return b.priceInitialIDR - a.priceInitialIDR;
        case "achievements": {
          const pctA = a.achievementsTotal ? (a.achievementsUnlocked || 0) / a.achievementsTotal : 0;
          const pctB = b.achievementsTotal ? (b.achievementsUnlocked || 0) / b.achievementsTotal : 0;
          return pctB - pctA;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [games, activeBucket, searchQuery, sortBy, unplayedGames, quickWins, unfinishedBusiness, highValue]);

  // Pick a random game action
  const handlePickRandom = () => {
    // Prefer games in the active bucket or unplayed
    const candidatePool = filteredGames.length > 0 ? filteredGames : unplayedGames;
    if (candidatePool.length === 0) return;

    const randomIndex = Math.floor(Math.random() * candidatePool.length);
    const chosen = candidatePool[randomIndex];

    setRandomPickNotification(`Selected "${chosen.name}" for your next session!`);
    setTimeout(() => {
      setRandomPickNotification(null);
    }, 4000);

    onSelectGame(chosen);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Quick Action */}
      <div className="p-5 sm:p-6 bg-surface border border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-card">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="orange" className="gap-1 shrink-0">
              <Flame className="w-3 h-3" />
              <span>Backlog Decision Engine</span>
            </Badge>
            <span className="text-xs text-text-secondary font-medium">
              {unplayedGames.length} Unplayed Titles
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary tracking-tight">
            Tame Your Steam Library
          </h1>
          <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
            Stop scrolling and start playing. Filter by zero-hour games, weekend-sized quick wins, or unfinished journeys.
          </p>
        </div>

        {/* Random Backlog Picker Action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="md"
            onClick={() => onOpenShareShowcase?.()}
            className="rounded-xl gap-2 font-semibold text-xs px-4"
          >
            <Share2 className="w-3.5 h-3.5 text-signal-purple" />
            <span>Share Showcase</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handlePickRandom}
            className="rounded-xl gap-2 font-semibold text-xs px-5"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Pick a Random Game</span>
          </Button>
        </div>
      </div>

      {/* Notification Toast */}
      {randomPickNotification && (
        <div className="p-3 bg-surface border border-signal-emerald/40 rounded-xl flex items-center gap-2 text-xs font-medium text-signal-emerald min-w-0">
          <Zap className="w-4 h-4 shrink-0" />
          <span className="truncate">{randomPickNotification}</span>
        </div>
      )}

      {/* 2. Smart Bucket Tabs (Sleek Modern Segmented Track) */}
      <div className="inline-flex items-center gap-1.5 p-1.5 bg-surface/50 rounded-2xl border border-white/[0.05] overflow-x-auto no-scrollbar max-w-full">
        <button
          onClick={() => setActiveBucket("all")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeBucket === "all"
              ? "bg-surface-elevated text-text-primary border border-white/[0.10] shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>All Games ({games.length})</span>
        </button>

        <button
          onClick={() => setActiveBucket("shame")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeBucket === "shame"
              ? "bg-signal-orange/15 text-signal-orange border border-signal-orange/30 shadow-sm"
              : "text-text-secondary hover:text-signal-orange hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-signal-orange" />
          <span>Pile of Shame ({unplayedGames.length})</span>
        </button>

        <button
          onClick={() => setActiveBucket("quick_wins")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeBucket === "quick_wins"
              ? "bg-signal-emerald/15 text-signal-emerald border border-signal-emerald/30 shadow-sm"
              : "text-text-secondary hover:text-signal-emerald hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-signal-emerald" />
          <span>Quick Wins ({quickWins.length})</span>
        </button>

        <button
          onClick={() => setActiveBucket("unfinished")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeBucket === "unfinished"
              ? "bg-signal-blue/15 text-signal-blue border border-signal-blue/30 shadow-sm"
              : "text-text-secondary hover:text-signal-blue hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-signal-blue" />
          <span>Unfinished Business ({unfinishedBusiness.length})</span>
        </button>

        <button
          onClick={() => setActiveBucket("high_value")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeBucket === "high_value"
              ? "bg-signal-emerald/15 text-signal-emerald border border-signal-emerald/30 shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-signal-emerald" />
          <span>Best Value ({highValue.length})</span>
        </button>
      </div>

      {/* 3. Search & Sort Controls Bar */}
      <div className="p-3.5 bg-surface border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search by title or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-canvas border border-border focus:border-signal-emerald pl-8 pr-3 py-1.5 text-xs text-text-primary rounded-xl outline-none placeholder:text-text-dim"
          />
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs min-w-0">
          <span className="text-text-secondary flex items-center gap-1 shrink-0 font-medium">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort By:</span>
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-canvas border border-border text-text-primary rounded-xl px-3 py-1.5 text-xs outline-none focus:border-signal-emerald cursor-pointer font-medium w-full sm:w-auto min-w-0"
          >
            <option value="best_value">Cost-Per-Hour (Best Value)</option>
            <option value="playtime_desc">Playtime (High to Low)</option>
            <option value="playtime_asc">Playtime (Low to High)</option>
            <option value="price_desc">Store Price (Highest First)</option>
            <option value="achievements">Trophy Progress %</option>
          </select>
        </div>
      </div>

      {/* 4. Consistent 2:3 Vertical Poster Grid */}
      {filteredGames.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border rounded-2xl space-y-3">
          <Filter className="w-8 h-8 text-text-dim mx-auto" />
          <h3 className="text-base font-heading font-bold text-text-primary">
            No games found in this bucket
          </h3>
          <p className="text-xs text-text-secondary">
            Try adjusting your search query or switching to another filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredGames.map((game) => {
            const costPerHour = calculateCostPerHour(
              game.priceInitialIDR,
              game.playtimeForever
            );

            const isUnplayed = game.playtimeForever === 0;

            const achievementPct =
              game.achievementsTotal && game.achievementsTotal > 0
                ? Math.round(
                    ((game.achievementsUnlocked || 0) / game.achievementsTotal) * 100
                  )
                : null;

            const topBadge = isUnplayed
              ? { label: "Pile of Shame", variant: "orange" as const, icon: <Flame className="w-3 h-3 text-signal-orange" /> }
              : costPerHour !== null && costPerHour < 15000
              ? { label: "Best Value", variant: "emerald" as const, icon: <Coins className="w-3 h-3 text-signal-emerald" /> }
              : game.isCoop
              ? { label: "Co-op", variant: "blue" as const }
              : null;

            const bottomPill = isUnplayed
              ? "Untouched (0h)"
              : `${formatHours(game.playtimeForever)}`;

            const secondaryMeta = (
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                {achievementPct !== null ? (
                  <div className="flex items-center gap-1.5 text-text-dim">
                    <Trophy className="w-3 h-3 text-signal-purple" />
                    <span className="font-mono text-text-secondary">{achievementPct}%</span>
                  </div>
                ) : (
                  <span className="text-text-dim text-[10px]">No Trophies</span>
                )}

                {costPerHour !== null ? (
                  <span className="font-mono text-[10px] text-signal-emerald font-semibold">
                    {formatPrice(costPerHour)}/h
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-signal-orange font-semibold">
                    0h Logged
                  </span>
                )}
              </div>
            );

            return (
              <GameCard
                key={game.appId}
                game={game}
                onClick={() => onSelectGame(game)}
                topBadge={topBadge}
                bottomPill={bottomPill}
                secondaryMeta={secondaryMeta}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
