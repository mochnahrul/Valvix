import { useState, useEffect } from "react";
import { UserProfile, SteamGame, AIPersonaData } from "@/types/steam";
import { fetchUserPersona, fetchUserFriends } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameAchievementDrawer } from "@/components/common/GameAchievementDrawer";
import { GameCard } from "@/components/common/GameCard";
import { formatHours, handlePosterError } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  Sparkles,
  Flame,
  Gamepad2,
  Users2,
  TrendingUp,
  Clock,
  Coins,
  Trophy,
  ArrowRight,
  ChevronRight,
  Play,
  Share2,
} from "lucide-react";

interface OverviewBentoProps {
  currentProfile: UserProfile;
  onNavigate: (module: "overview" | "backlog" | "coop" | "persona") => void;
  onSelectGame?: (game: SteamGame) => void;
  onOpenShareShowcase?: () => void;
  userGames?: SteamGame[];
}

export function OverviewBento({
  currentProfile,
  onNavigate,
  onSelectGame,
  onOpenShareShowcase,
  userGames,
}: OverviewBentoProps) {
  const { currency, formatPrice } = useCurrency();
  const games = userGames && userGames.length > 0 ? userGames : [];

  if (games.length === 0) {
    return (
      <div className="space-y-7 pb-12 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 h-72 bg-surface/50 border border-border rounded-2xl" />
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface/50 border border-border rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-[2/3] bg-surface/50 border border-border rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Key games dynamically derived from actual library
  const sortedByPlaytime = [...games].sort((a, b) => b.playtimeForever - a.playtimeForever);
  const mostPlayed = sortedByPlaytime[0];

  const unplayedList = games.filter((g) => g.playtimeForever === 0);
  const unplayedGem = unplayedList.length > 0
    ? [...unplayedList].sort((a, b) => (b.priceInitialIDR || 0) - (a.priceInitialIDR || 0))[0]
    : null;

  // Best Value: lowest cost per hour paid title, distinct from mostPlayed
  const paidPlayed = games.filter(
    (g) => g.playtimeForever > 120 && (g.priceInitialIDR || 0) > 0 && (!mostPlayed || g.appId !== mostPlayed.appId)
  );
  const bestValue = paidPlayed.length > 0
    ? [...paidPlayed].sort(
        (a, b) =>
          a.priceInitialIDR / (a.playtimeForever / 60) -
          b.priceInitialIDR / (b.playtimeForever / 60)
      )[0]
    : sortedByPlaytime.find((g) => !mostPlayed || g.appId !== mostPlayed.appId) || mostPlayed;

  // Find game closest to 100% trophies (highest percentage with trophies remaining), distinct from previous picks
  const trophyCandidates = games.filter(
    (g) =>
      (g.achievementsTotal || 0) > 0 &&
      (g.achievementsUnlocked || 0) > 0 &&
      (g.achievementsUnlocked || 0) < (g.achievementsTotal || 0) &&
      (!mostPlayed || g.appId !== mostPlayed.appId) &&
      (!bestValue || g.appId !== bestValue.appId)
  );
  const trophyTarget = trophyCandidates.length > 0
    ? [...trophyCandidates].sort(
        (a, b) =>
          (b.achievementsUnlocked || 0) / (b.achievementsTotal || 1) -
          (a.achievementsUnlocked || 0) / (a.achievementsTotal || 1)
      )[0]
    : games.find(
        (g) =>
          (g.achievementsTotal || 0) > 0 &&
          (g.achievementsUnlocked || 0) < (g.achievementsTotal || 0) &&
          (!mostPlayed || g.appId !== mostPlayed.appId) &&
          (!bestValue || g.appId !== bestValue.appId)
      ) ||
      sortedByPlaytime.find(
        (g) =>
          (!mostPlayed || g.appId !== mostPlayed.appId) &&
          (!bestValue || g.appId !== bestValue.appId)
      ) ||
      mostPlayed;

  // Find most played multiplayer/coop title, distinct from other cards
  const squadCandidates = games.filter(
    (g) =>
      (g.isCoop || g.isMultiplayer) &&
      (!mostPlayed || g.appId !== mostPlayed.appId) &&
      (!bestValue || g.appId !== bestValue.appId) &&
      (!trophyTarget || g.appId !== trophyTarget.appId) &&
      (!unplayedGem || g.appId !== unplayedGem.appId)
  );
  const squadReady = squadCandidates.length > 0
    ? [...squadCandidates].sort((a, b) => b.playtimeForever - a.playtimeForever)[0]
    : sortedByPlaytime.find(
        (g) =>
          (!mostPlayed || g.appId !== mostPlayed.appId) &&
          (!bestValue || g.appId !== bestValue.appId) &&
          (!trophyTarget || g.appId !== trophyTarget.appId)
      ) || mostPlayed;

  // Selected game for detail modal
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);

  const handleOpenGame = (game: SteamGame) => {
    if (onSelectGame) {
      onSelectGame(game);
    } else {
      setSelectedGame(game);
    }
  };

  // Spotlight game (defaults to the player's most played game)
  const [spotlightGame, setSpotlightGame] = useState<SteamGame | null>(mostPlayed);

  // Sync spotlight if mostPlayed updates
  useEffect(() => {
    if (mostPlayed && mostPlayed.appId > 0) {
      setSpotlightGame(mostPlayed);
    }
  }, [mostPlayed?.appId]);

  const activeSpotlight = (spotlightGame && spotlightGame.appId > 0 ? spotlightGame : mostPlayed) || sortedByPlaytime[0];

  // Live AI Persona state
  const [livePersona, setLivePersona] = useState<AIPersonaData | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentProfile?.steamId64) {
      fetchUserPersona(currentProfile.steamId64, "playful", false, currency).then((data) => {
        if (isMounted && data) {
          setLivePersona(data);
        }
      });
      fetchUserFriends(currentProfile.steamId64).then((friendsList) => {
        if (isMounted && friendsList) {
          setSteamFriendsCount(friendsList.length);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentProfile?.steamId64, currency]);

  const [steamFriendsCount, setSteamFriendsCount] = useState<number>(0);

  // Computed metrics
  const totalGames = games.length;
  const unplayedGames = unplayedList;
  const totalMinutes = games.reduce((acc, g) => acc + g.playtimeForever, 0);
  const totalValueIDR = games.reduce((acc, g) => acc + (g.priceInitialIDR || 0), 0);
  const totalHours = totalMinutes / 60;
  const coopGames = games.filter((g) => g.isCoop || g.isMultiplayer);

  // Curated Shelf Game Cards configuration from REAL games
  const rawShelf = [
    {
      game: bestValue,
      tag: "Best Value",
      badgeVariant: "emerald" as const,
      stat:
        bestValue && bestValue.priceInitialIDR > 0 && bestValue.playtimeForever > 0
          ? `${formatPrice(
              Math.round(
                bestValue.priceInitialIDR / (bestValue.playtimeForever / 60)
              )
            )}/h`
          : bestValue ? `${formatHours(bestValue.playtimeForever)} played` : "",
    },
    {
      game: mostPlayed,
      tag: "Most Played",
      badgeVariant: "blue" as const,
      stat: mostPlayed ? `${formatHours(mostPlayed.playtimeForever)}` : "",
    },
    ...(unplayedGem
      ? [
          {
            game: unplayedGem,
            tag: "Pile of Shame",
            badgeVariant: "orange" as const,
            stat: "Untouched (0h)",
          },
        ]
      : []),
    {
      game: trophyTarget,
      tag: "Trophy Target",
      badgeVariant: "purple" as const,
      stat:
        trophyTarget && trophyTarget.achievementsTotal && trophyTarget.achievementsTotal > 0
          ? `${trophyTarget.achievementsUnlocked || 0}/${
              trophyTarget.achievementsTotal
            } Trophies (${Math.round(
              (((trophyTarget.achievementsUnlocked || 0) /
                trophyTarget.achievementsTotal) *
                100)
            )}%)`
          : "No Trophies",
    },
    {
      game: squadReady,
      tag: "Squad Ready",
      badgeVariant: "blue" as const,
      stat: squadReady?.isCoop ? "Co-op Supported" : "Multiplayer PvP",
    },
  ];

  // Guarantee strictly distinct valid games (no duplicate appIds, no invalid items)
  const seenAppIds = new Set<number>();
  const curatedShelf = rawShelf.filter(({ game }) => {
    if (!game || !game.appId || seenAppIds.has(game.appId)) return false;
    seenAppIds.add(game.appId);
    return true;
  });

  const spotlightAchievementPercent =
    activeSpotlight.achievementsTotal && activeSpotlight.achievementsTotal > 0
      ? Math.round(
          ((activeSpotlight.achievementsUnlocked || 0) /
            activeSpotlight.achievementsTotal) *
            100
        )
      : 0;

  return (
    <div className="space-y-6 sm:space-y-7 pb-10">
      {/* 1. TOP SECTION: ASYMMETRIC SPLIT 7/5 GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT (7 cols): Featured Game Spotlight */}
        <div className="lg:col-span-7 rounded-2xl bg-surface border border-border overflow-hidden p-5 sm:p-7 flex flex-col justify-between relative shadow-card group min-w-0">
          {/* Subtle Blurred Game Backdrop */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src={activeSpotlight.headerImage}
              alt=""
              className="w-full h-full object-cover blur-3xl opacity-15 scale-125"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/85 to-surface/40" />
          </div>

          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start relative z-10 min-w-0">
            {/* Crisp Vertical Game Poster */}
            <div
              onClick={() => handleOpenGame(activeSpotlight)}
              className="w-28 sm:w-36 aspect-[2/3] shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-lg cursor-pointer group/poster hover:scale-[1.02] transition-transform duration-200 relative bg-canvas"
            >
              <img
                src={activeSpotlight.posterImage}
                alt={activeSpotlight.name}
                onError={(e) => handlePosterError(e, activeSpotlight.headerImage)}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/poster:bg-black/35 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-signal-emerald flex items-center justify-center text-[#0A0C10] opacity-0 group-hover/poster:opacity-100 transition-opacity shadow-md">
                  <Play className="w-4 h-4 ml-0.5 fill-current" />
                </div>
              </div>
            </div>

            {/* Game Info & Clean Progress */}
            <div className="flex-1 min-w-0 w-full space-y-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Badge variant="emerald" className="px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                  Featured Spotlight
                </Badge>
                <span className="text-xs text-text-secondary font-medium truncate min-w-0">
                  {currentProfile.personaName} • {formatHours(activeSpotlight.playtimeForever)} logged
                </span>
              </div>

              <div className="min-w-0">
                <h2
                  onClick={() => handleOpenGame(activeSpotlight)}
                  className="text-xl sm:text-3xl font-heading font-extrabold text-text-primary tracking-tight hover:text-signal-emerald transition-colors cursor-pointer line-clamp-2 break-words"
                >
                  {activeSpotlight.name}
                </h2>
                <p className="text-xs text-text-secondary mt-1 font-medium truncate">
                  {(activeSpotlight.genres || []).slice(0, 3).join(" • ") || "Steam Title"}
                </p>
              </div>

              {/* Achievement Progress Bar */}
              {activeSpotlight.achievementsTotal && activeSpotlight.achievementsTotal > 0 ? (
                <div className="pt-1 space-y-1.5 w-full">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-text-secondary font-medium flex items-center gap-1.5 truncate">
                      <Trophy className="w-3.5 h-3.5 text-signal-purple shrink-0" />
                      <span className="truncate">
                        {activeSpotlight.achievementsUnlocked || 0}/{activeSpotlight.achievementsTotal} Achievements
                      </span>
                    </span>
                    <span className="font-bold text-signal-purple shrink-0">
                      {spotlightAchievementPercent}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-signal-purple rounded-full transition-all duration-500"
                      style={{ width: `${spotlightAchievementPercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-1 space-y-1.5 w-full">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-text-dim" />
                      <span>Achievements</span>
                    </span>
                    <span className="text-xs font-semibold text-text-dim">
                      No Trophies
                    </span>
                  </div>

                  <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border">
                    <div className="h-full w-full bg-white/[0.03] rounded-full" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 pt-5 border-t border-border mt-5 relative z-10">
            <Button
              variant="primary"
              size="md"
              className="gap-2 rounded-xl text-xs font-bold px-4"
              onClick={() => handleOpenGame(activeSpotlight)}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Track Achievements</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              className="gap-2 rounded-xl text-xs font-medium"
              onClick={() => onNavigate("coop")}
            >
              <Users2 className="w-3.5 h-3.5 text-signal-blue" />
              <span>Find Co-op Squad</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              className="gap-2 rounded-xl text-xs font-medium"
              onClick={() => onOpenShareShowcase?.()}
            >
              <Share2 className="w-3.5 h-3.5 text-signal-purple" />
              <span>Share Card</span>
            </Button>

            <button
              onClick={() => {
                const currentIdx = sortedByPlaytime.findIndex(
                  (g) => g.appId === (spotlightGame?.appId ?? mostPlayed.appId)
                );
                const nextGame = sortedByPlaytime[(currentIdx + 1) % Math.min(sortedByPlaytime.length, 5)] || mostPlayed;
                setSpotlightGame(nextGame);
              }}
              className="sm:ml-auto text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors font-mono py-1.5 px-2.5 rounded-lg hover:bg-surface-elevated"
            >
              <span>Cycle</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT (5 cols): Tight 2x2 Clean Stats Grid */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5 sm:gap-4 min-w-0">
          {/* Stat 1: Library Size */}
          <div className="p-4 sm:p-5 bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus rounded-2xl flex flex-col justify-between transition-colors shadow-card group min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-secondary font-semibold truncate">Total Games</span>
              <div className="w-8 h-8 rounded-xl bg-signal-emerald/10 text-signal-emerald flex items-center justify-center shrink-0">
                <Gamepad2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 min-w-0">
              <span className="text-2xl sm:text-3xl font-heading font-black text-text-primary tabular-nums tracking-tight block truncate">
                {totalGames}
              </span>
            </div>
            <div className="text-[11px] font-mono text-signal-emerald font-semibold mt-1 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-emerald shrink-0" />
              <span className="truncate">Steam Library</span>
            </div>
          </div>

          {/* Stat 2: Playtime */}
          <div className="p-4 sm:p-5 bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus rounded-2xl flex flex-col justify-between transition-colors shadow-card group min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-secondary font-semibold truncate">Hours Played</span>
              <div className="w-8 h-8 rounded-xl bg-signal-blue/10 text-signal-blue flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 min-w-0">
              <span className="text-2xl sm:text-3xl font-heading font-black text-text-primary tabular-nums tracking-tight block truncate">
                {Math.round(totalHours).toLocaleString("en-US")}h
              </span>
            </div>
            <div className="text-[11px] font-mono text-signal-blue font-semibold mt-1 truncate">
              {(totalHours / 24).toFixed(0)} Days Equivalent
            </div>
          </div>

          {/* Stat 3: Total Value */}
          <div className="p-4 sm:p-5 bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus rounded-2xl flex flex-col justify-between transition-colors shadow-card group min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-secondary font-semibold truncate">Library Value</span>
              <div className="w-8 h-8 rounded-xl bg-signal-emerald/10 text-signal-emerald flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 min-w-0">
              <span
                className="text-base sm:text-xl xl:text-2xl font-mono font-bold text-signal-emerald tabular-nums block truncate"
                title={formatPrice(totalValueIDR)}
              >
                {formatPrice(totalValueIDR)}
              </span>
            </div>
            <div className="text-[11px] font-mono text-text-dim mt-1 truncate">
              {currency} Store Valuation
            </div>
          </div>

          {/* Stat 4: Pile of Shame */}
          <div
            onClick={() => onNavigate("backlog")}
            className="p-4 sm:p-5 bg-surface hover:bg-surface-elevated border border-signal-orange/25 hover:border-signal-orange/45 rounded-2xl flex flex-col justify-between cursor-pointer transition-colors shadow-card group min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-signal-orange font-semibold truncate">Pile of Shame</span>
              <div className="w-8 h-8 rounded-xl bg-signal-orange/15 text-signal-orange flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-2xl sm:text-3xl font-heading font-black text-signal-orange tabular-nums tracking-tight truncate">
                {unplayedGames.length}
              </span>
              <ArrowRight className="w-4 h-4 text-signal-orange group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
            <div className="text-[11px] font-mono text-signal-orange font-semibold mt-1 truncate">
              {totalGames > 0 ? ((unplayedGames.length / totalGames) * 100).toFixed(0) : 0}% Unplayed Backlog
            </div>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE SECTION: CURATED GAME SHELF (VERTICAL POSTERS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-signal-emerald shrink-0" />
            <h3 className="text-base font-heading font-extrabold text-text-primary tracking-tight truncate">
              Curated Highlights & Trophy Targets
            </h3>
          </div>
          <button
            onClick={() => onNavigate("backlog")}
            className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 font-medium transition-colors shrink-0"
          >
            <span>View All {totalGames}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5-Card Vertical Showcase Shelf */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {curatedShelf.map(({ game, tag, badgeVariant, stat }) => (
            <GameCard
              key={`${tag}-${game.appId}`}
              game={game}
              onClick={() => handleOpenGame(game)}
              topBadge={{ label: tag, variant: badgeVariant }}
              bottomPill={stat}
            />
          ))}
        </div>
      </div>

      {/* 3. BOTTOM SECTION: INTERACTIVE HIGHLIGHTS (PLAYER PERSONA & SQUAD CO-OP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 cols): AI Persona Card */}
        <div
          onClick={() => onNavigate("persona")}
          className="lg:col-span-7 p-5 sm:p-6 bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus transition-colors rounded-2xl flex flex-col justify-between cursor-pointer group shadow-card min-w-0"
        >
          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-signal-emerald/10 border border-signal-emerald/25 flex items-center justify-center text-signal-emerald shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-signal-emerald block">
                    Player Persona & Roast
                  </span>
                  <h4 className="text-lg sm:text-xl font-heading font-black text-text-primary tracking-tight line-clamp-2 break-words">
                    {livePersona ? livePersona.archetypeTitle : (unplayedGames.length > 5 ? "The Dedicated Backlogger" : "The Focused Achiever")}
                  </h4>
                </div>
              </div>

              <Badge variant="emerald" className="text-[11px] font-semibold px-2.5 py-0.5 shrink-0">
                Roast Ready
              </Badge>
            </div>

            {/* 3 Punchy Tags */}
            <div className="flex flex-wrap items-center gap-2">
              {(livePersona
                ? livePersona.strengths.slice(0, 3)
                : [
                    (mostPlayed?.genres || [])[0] || "PC Gamer",
                    `${Math.round(totalHours)}h Logged`,
                    `${unplayedGames.length} in Backlog`,
                  ]
              ).map((tag: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-canvas border border-border rounded-lg text-xs font-medium text-text-primary max-w-full truncate"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Short Punchy Roast Box */}
            <div className="p-3.5 bg-canvas border-l-2 border-signal-orange/60 border-y border-r border-border rounded-xl text-xs font-sans text-signal-orange leading-relaxed italic">
              <p className="line-clamp-3 break-words">
                "{livePersona
                  ? livePersona.comedyRoast
                  : `Your library holds ${totalGames} games with ${formatHours(totalMinutes)} playtime. AI is ready to roast your spending habits.`}"
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between text-xs text-signal-emerald font-bold">
            <span>View Full Player Persona</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Right (5 cols): Squad Co-op Matcher Widget */}
        <div
          onClick={() => onNavigate("coop")}
          className="lg:col-span-5 p-5 sm:p-6 bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus transition-colors rounded-2xl flex flex-col justify-between cursor-pointer group shadow-card min-w-0"
        >
          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-signal-blue/10 border border-signal-blue/25 flex items-center justify-center text-signal-blue shrink-0">
                  <Users2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-signal-blue block">
                    Co-op Squad Matcher
                  </span>
                  <h4 className="text-base font-heading font-extrabold text-text-primary tracking-tight truncate">
                    {steamFriendsCount > 0 ? `${steamFriendsCount} Steam Friends Linked` : "Co-op Squad Ready"}
                  </h4>
                </div>
              </div>

              <Badge variant="blue" className="text-[11px] font-semibold px-2.5 py-0.5 shrink-0">
                {coopGames.length} Titles
              </Badge>
            </div>

            {/* Mini Co-op Game Covers Strip */}
            <div className="flex items-center gap-2.5 pt-1 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                {coopGames.slice(0, 3).map((g) => (
                  <div
                    key={g.appId}
                    className="w-14 sm:w-16 aspect-[2/3] rounded-lg overflow-hidden border border-border shadow-sm cursor-pointer hover:scale-105 transition-transform bg-canvas"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenGame(g);
                    }}
                  >
                    <img
                      src={g.posterImage}
                      alt={g.name}
                      onError={(e) => handlePosterError(e, g.headerImage)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="pl-1 space-y-1 min-w-0 flex-1">
                <div className="text-xs text-signal-emerald font-bold truncate">
                  Shared Multiplayer
                </div>
                <div className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                  Intersect your library with friends in 1 click
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full mt-5 rounded-xl text-xs font-bold gap-2 h-10"
            onClick={() => onNavigate("coop")}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Spin Squad Roulette</span>
          </Button>
        </div>
      </div>

      {/* Interactive Game & Achievement Detail Drawer */}
      <GameAchievementDrawer
        game={selectedGame}
        steamId64={currentProfile.steamId64}
        onClose={() => setSelectedGame(null)}
        onNavigateToCoop={() => onNavigate("coop")}
      />
    </div>
  );
}
