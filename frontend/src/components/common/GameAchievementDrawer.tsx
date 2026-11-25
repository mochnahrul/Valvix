import { useState, useEffect } from "react";
import { SteamGame, GameAchievement } from "@/types/steam";
import { fetchGameAchievements, fetchAchievementGuide, getStoredAuthUser } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, LoadingState } from "@/components/common/LoadingSpinner";
import { formatHours, calculateCostPerHour, handlePosterError } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  X,
  Trophy,
  Clock,
  Coins,
  Compass,
  Search,
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Youtube,
  Users2,
} from "lucide-react";

interface GameAchievementDrawerProps {
  game: SteamGame | null;
  steamId64?: string;
  onClose: () => void;
  onNavigateToCoop?: () => void;
}

export function GameAchievementDrawer({
  game,
  steamId64,
  onClose,
  onNavigateToCoop,
}: GameAchievementDrawerProps) {
  const { formatPrice } = useCurrency();
  const activeSteamId = steamId64 || getStoredAuthUser()?.steamId64 || "";

  // Filter & Search states (all hooks must run unconditionally before early return)
  const [filter, setFilter] = useState<"all" | "locked" | "unlocked" | "hidden">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Live achievements state
  const [achievementsList, setAchievementsList] = useState<GameAchievement[]>(
    game?.achievements || []
  );
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);

  // Revealed secret achievements set
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  // Expanded AI Guides set
  const [expandedGuides, setExpandedGuides] = useState<Record<string, boolean>>({});
  const [loadingGuides, setLoadingGuides] = useState<Record<string, boolean>>({});

  // Fetch live achievements when game opens or changes
  useEffect(() => {
    if (!game) return;
    let isMounted = true;
    setFilter("all");
    setSearchQuery("");
    setRevealedSecrets({});
    setExpandedGuides({});
    setAchievementsList(game.achievements || []);

    if (game.appId && activeSteamId) {
      setIsLoadingAchievements(true);
      fetchGameAchievements(game.appId, activeSteamId)
        .then((loaded) => {
          if (isMounted && loaded) {
            setAchievementsList(loaded);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingAchievements(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [game?.appId, activeSteamId]);

  // Lock background page scroll while drawer is open
  useEffect(() => {
    if (!game) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [Boolean(game)]);

  if (!game) return null;

  const achievements = achievementsList.length > 0 ? achievementsList : game.achievements || [];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const lockedCount = achievements.length - unlockedCount;
  const hiddenCount = achievements.filter((a) => a.isHidden).length;

  const totalTrophies = achievements.length > 0 ? achievements.length : (game.achievementsTotal || 0);
  const totalUnlocked = achievements.length > 0 ? unlockedCount : (game.achievementsUnlocked || 0);

  const costPerHour = calculateCostPerHour(game.priceInitialIDR, game.playtimeForever);
  const completionPercentage =
    totalTrophies > 0 ? Math.round((totalUnlocked / totalTrophies) * 100) : null;

  // Toggle secret visibility
  const toggleSecret = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Toggle AI Guide with live API call
  const toggleGuide = async (achievement: GameAchievement) => {
    if (expandedGuides[achievement.id]) {
      setExpandedGuides((prev) => ({ ...prev, [achievement.id]: false }));
      return;
    }

    if (!achievement.aiGuide) {
      setLoadingGuides((prev) => ({ ...prev, [achievement.id]: true }));
      try {
        const guide = await fetchAchievementGuide(
          game.appId,
          achievement.id,
          achievement.name,
          achievement.description
        );
        achievement.aiGuide = guide;
        setAchievementsList((prev) => [...prev]);
      } catch (err) {
        console.warn("Failed to generate AI guide:", err);
      } finally {
        setLoadingGuides((prev) => ({ ...prev, [achievement.id]: false }));
      }
    }

    setExpandedGuides((prev) => ({ ...prev, [achievement.id]: true }));
  };

  // Filter achievements
  const filteredAchievements = achievements.filter((a) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "locked" && !a.unlocked) ||
      (filter === "unlocked" && a.unlocked) ||
      (filter === "hidden" && a.isHidden);

    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden overscroll-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0D0F14]/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-xl bg-surface border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">
          {/* 1. Header Banner & Close Button */}
          <div className="relative h-44 sm:h-48 w-full overflow-hidden shrink-0 bg-canvas">
            <img
              src={game.headerImage}
              alt={game.name}
              onError={(e) => handlePosterError(e)}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#151821] via-[#151821]/60 to-transparent" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#0D0F14]/80 border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-[#0D0F14] transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Thumbnail Poster Overlap */}
            <div className="absolute bottom-3 left-5 right-5 flex items-end gap-3.5 min-w-0">
              <div className="w-16 sm:w-20 aspect-[2/3] rounded-lg overflow-hidden border-2 border-surface shadow-lg shrink-0 bg-canvas">
                <img
                  src={game.posterImage}
                  alt={game.name}
                  onError={(e) => handlePosterError(e, game.headerImage)}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-1 mb-0.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold text-signal-emerald uppercase tracking-wider shrink-0">
                    Game Telemetry
                  </span>
                  {game.isCoop && (
                    <Badge variant="blue" className="py-0 px-2 text-[10px] shrink-0">
                      Co-op
                    </Badge>
                  )}
                </div>
                <h2 className="text-base sm:text-xl font-heading font-extrabold text-text-primary tracking-tight leading-tight line-clamp-2 break-words">
                  {game.name}
                </h2>
                <p className="text-[11px] text-text-secondary truncate">
                  {(game.genres || []).join(" • ")}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Economy & Telemetry Strip */}
          <div className="p-4 sm:p-5 border-b border-border bg-surface-subtle shrink-0 space-y-3.5">
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <div className="p-2.5 bg-canvas border border-border rounded-xl min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-text-secondary truncate">
                  <Clock className="w-3.5 h-3.5 text-signal-blue shrink-0" />
                  <span className="truncate">Playtime</span>
                </div>
                <div className="mt-1 text-xs sm:text-base font-heading font-bold text-text-primary truncate">
                  {formatHours(game.playtimeForever)}
                </div>
              </div>

              <div className="p-2.5 bg-canvas border border-border rounded-xl min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-text-secondary truncate">
                  <Coins className="w-3.5 h-3.5 text-signal-emerald shrink-0" />
                  <span className="truncate">Cost / Hr</span>
                </div>
                <div
                  className="mt-1 text-xs sm:text-base font-mono font-bold text-signal-emerald truncate"
                  title={
                    costPerHour !== null
                      ? `${formatPrice(costPerHour)}/h`
                      : game.playtimeForever === 0
                      ? "Unplayed (0h)"
                      : game.priceInitialIDR === 0
                      ? "Free to Play"
                      : "Under 1h played"
                  }
                >
                  {costPerHour !== null
                    ? `${formatPrice(costPerHour)}/h`
                    : game.playtimeForever === 0
                    ? "0h"
                    : game.priceInitialIDR === 0
                    ? "Free"
                    : "< 1h"}
                </div>
              </div>

              <div className="p-2.5 bg-canvas border border-border rounded-xl min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-text-secondary truncate">
                  <Trophy className="w-3.5 h-3.5 text-signal-purple shrink-0" />
                  <span className="truncate">Trophies</span>
                </div>
                <div className="mt-1 text-xs sm:text-base font-heading font-bold text-text-primary truncate">
                  {totalTrophies > 0
                    ? `${totalUnlocked}/${totalTrophies}`
                    : "None"}
                </div>
              </div>
            </div>

            {/* Achievement Progress Bar */}
            {completionPercentage !== null && (
              <div className="p-3 bg-canvas border border-border rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary font-medium flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-signal-purple" />
                    <span>Achievement Completion</span>
                  </span>
                  <span className="font-mono font-bold text-signal-purple">
                    {completionPercentage}%
                  </span>
                </div>

                <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-signal-purple rounded-full transition-all duration-500"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <a href={`steam://run/${game.appId}`} className="flex-1">
                <Button variant="primary" size="sm" className="w-full gap-2 rounded-xl text-xs font-semibold">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch in Steam</span>
                </Button>
              </a>

              {game.isCoop && onNavigateToCoop && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onNavigateToCoop();
                  }}
                  className="gap-1.5 rounded-xl text-xs"
                >
                  <Users2 className="w-3.5 h-3.5 text-signal-blue" />
                  <span>Match Co-op</span>
                </Button>
              )}

              <a
                href={`https://store.steampowered.com/app/${game.appId}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" className="rounded-xl px-2.5" title="Steam Store">
                  <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
                </Button>
              </a>
            </div>
          </div>

          {/* 3. Search & Filter Bar */}
          <div className="p-4 border-b border-border bg-surface shrink-0 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Search trophies or requirements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-canvas border border-border focus:border-signal-purple pl-8 pr-3 py-1.5 text-xs text-text-primary rounded-xl outline-none placeholder:text-text-dim font-medium"
              />
            </div>

            {/* Filter Pills (Segmented Track) */}
            <div className="inline-flex items-center gap-1 p-1 bg-canvas/80 rounded-xl border border-white/[0.05] overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  filter === "all"
                    ? "bg-surface-elevated text-text-primary border border-white/[0.10] shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                All ({achievements.length})
              </button>

              <button
                onClick={() => setFilter("locked")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  filter === "locked"
                    ? "bg-signal-orange/15 text-signal-orange border border-signal-orange/30 shadow-sm"
                    : "text-text-secondary hover:text-signal-orange hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                Locked ({lockedCount})
              </button>

              <button
                onClick={() => setFilter("unlocked")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  filter === "unlocked"
                    ? "bg-signal-emerald/15 text-signal-emerald border border-signal-emerald/30 shadow-sm"
                    : "text-text-secondary hover:text-signal-emerald hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                Unlocked ({unlockedCount})
              </button>

              {hiddenCount > 0 && (
                <button
                  onClick={() => setFilter("hidden")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                    filter === "hidden"
                      ? "bg-signal-purple/15 text-signal-purple border border-signal-purple/30 shadow-sm"
                      : "text-text-secondary hover:text-signal-purple hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  Secret ({hiddenCount})
                </button>
              )}
            </div>
          </div>

          {/* 4. Scrollable Achievement List */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
            {isLoadingAchievements ? (
              <LoadingState
                variant="purple"
                size="lg"
                message="Syncing Steam achievements..."
                subMessage="Fetching unlocked milestones and global completion percentages"
                className="py-14"
              />
            ) : filteredAchievements.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Trophy className="w-8 h-8 text-text-dim mx-auto" />
                <p className="text-sm font-heading font-semibold text-text-primary">
                  {achievements.length === 0 ? "No Steam achievements registered" : "No achievements match your filter"}
                </p>
                <p className="text-xs text-text-secondary">
                  {achievements.length === 0
                    ? "This game does not support Steam achievements or stats."
                    : "Try clearing your search or switching to \"All\"."}
                </p>
              </div>
            ) : (
              filteredAchievements.map((achievement) => {
                const isSecret = achievement.isHidden && !achievement.unlocked;
                const isRevealed = revealedSecrets[achievement.id];
                const isGuideOpen = expandedGuides[achievement.id];
                const isGuideLoading = loadingGuides[achievement.id];

                return (
                  <div
                    key={achievement.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      achievement.unlocked
                        ? "bg-canvas/60 border-border"
                        : "bg-surface border-border hover:border-border-focus"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Trophy Icon */}
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-border bg-canvas">
                        <img
                          src={achievement.iconUrl}
                          alt={achievement.name}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%23151821'/><circle cx='32' cy='32' r='14' fill='%23A855F7' fill-opacity='0.2'/></svg>";
                          }}
                          className={`w-full h-full object-cover ${
                            !achievement.unlocked ? "grayscale contrast-125 opacity-70" : ""
                          }`}
                        />
                        {achievement.unlocked ? (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-signal-emerald text-canvas rounded-tl-[4px] flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-canvas/90 text-text-dim rounded-tl-[4px] flex items-center justify-center">
                            <Lock className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      {/* Achievement Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-heading font-bold text-text-primary truncate">
                            {achievement.name}
                          </h4>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {achievement.rarityPercent !== undefined && (
                              <span className="text-[10px] font-mono text-text-secondary">
                                {achievement.rarityPercent}% of players
                              </span>
                            )}
                            {achievement.unlocked ? (
                              <Badge variant="emerald" className="text-[9px] py-0 px-1.5">
                                Unlocked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                                Locked
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Description with Spoiler Protection */}
                        {isSecret && !isRevealed ? (
                          <div className="flex items-center justify-between py-1 bg-surface-subtle px-2.5 rounded-lg border border-border/60">
                            <span className="text-xs text-text-dim italic">
                              Secret Achievement • Details hidden to prevent spoilers
                            </span>
                            <button
                              onClick={() => toggleSecret(achievement.id)}
                              className="text-xs text-signal-purple hover:underline flex items-center gap-1 font-medium ml-2 shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Reveal</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-text-secondary leading-relaxed">
                              {achievement.description}
                            </p>
                            {isSecret && isRevealed && (
                              <button
                                onClick={() => toggleSecret(achievement.id)}
                                className="text-[10px] text-text-dim hover:text-text-secondary flex items-center gap-0.5 shrink-0"
                                title="Re-hide spoiler"
                              >
                                <EyeOff className="w-3 h-3" />
                                <span>Hide</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Locked Actions: AI Guide & YouTube Search */}
                        {!achievement.unlocked && (
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleGuide(achievement)}
                              className="rounded-lg h-7 px-2.5 text-[11px] gap-1.5 border-border hover:border-signal-purple/50 text-text-primary hover:text-signal-purple"
                            >
                              {isGuideLoading ? (
                                <LoadingSpinner size="xs" variant="purple" />
                              ) : (
                                <Compass className="w-3 h-3 text-signal-purple" />
                              )}
                              <span>
                                {isGuideOpen
                                  ? "Close Guide"
                                  : isGuideLoading
                                  ? "Generating..."
                                  : "How to Unlock (AI Guide)"}
                              </span>
                              {isGuideOpen ? (
                                <ChevronUp className="w-3 h-3 text-text-secondary" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-text-secondary" />
                              )}
                            </Button>

                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                                `${game.name} ${achievement.name} achievement guide`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-signal-orange transition-colors"
                            >
                              <Youtube className="w-3.5 h-3.5 text-signal-orange" />
                              <span>YouTube Guide</span>
                            </a>
                          </div>
                        )}

                        {/* Expanded AI Guide Drawer Card */}
                        {isGuideOpen && achievement.aiGuide && (
                          <div className="mt-2.5 p-3.5 bg-canvas border border-signal-purple/30 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-heading font-bold text-signal-purple flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5" />
                                <span>Tactical Strategy Guide</span>
                              </span>
                              <Badge variant="purple" className="text-[10px]">
                                Difficulty: {achievement.aiGuide.difficulty}
                              </Badge>
                            </div>

                            <p className="text-text-primary text-[11px] leading-relaxed">
                              {achievement.aiGuide.summary}
                            </p>

                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider block">
                                Recommended Steps:
                              </span>
                              <ol className="list-decimal list-inside space-y-1 text-[11px] text-text-secondary">
                                {achievement.aiGuide.steps.map((step, idx) => (
                                  <li key={idx} className="leading-relaxed">
                                    <span className="text-text-primary">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
