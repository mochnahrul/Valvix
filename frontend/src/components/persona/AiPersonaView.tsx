import { useState, useRef, useEffect, useMemo } from "react";
import {
  UserProfile,
  RoastTone,
  AIPersonaData,
  SteamGame,
  GenreDominance,
} from "@/types/steam";
import { fetchUserPersona } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GamerAvatar } from "@/components/common/GamerAvatar";
import { formatHours } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toPng } from "html-to-image";
import { GamerDnaChart } from "./GamerDnaChart";
import { LoadingSpinner, LoadingState } from "@/components/common/LoadingSpinner";
import {
  Sparkles,
  Download,
  RotateCcw,
  Flame,
  Check,
  AlertCircle,
} from "lucide-react";

interface AiPersonaViewProps {
  currentProfile: UserProfile;
  userGames?: SteamGame[];
}

export function AiPersonaView({ currentProfile, userGames = [] }: AiPersonaViewProps) {
  const { currency, formatPrice } = useCurrency();
  const [tone, setTone] = useState<RoastTone>("playful");
  const [livePersona, setLivePersona] = useState<AIPersonaData | null>(null);
  const [personaByTone, setPersonaByTone] = useState<Record<string, AIPersonaData>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  // Computed metrics from real library
  const totalMinutes = userGames.reduce((acc, g) => acc + g.playtimeForever, 0);
  const totalHours = totalMinutes / 60;
  const unplayedGames = userGames.filter((g) => g.playtimeForever === 0);
  const unplayedValueIDR = unplayedGames.reduce((acc, g) => acc + (g.priceInitialIDR || 0), 0);
  const unplayedPercentage =
    userGames.length > 0 ? Math.round((unplayedGames.length / userGames.length) * 1000) / 10 : 0;
  const totalValueIDR = userGames.reduce((acc, g) => acc + (g.priceInitialIDR || 0), 0);
  const avgCostPerHourIDR = totalHours > 0 ? Math.round(totalValueIDR / totalHours) : 0;

  // Key highlight games from actual library
  const mostPlayedGame = [...userGames].sort((a, b) => b.playtimeForever - a.playtimeForever)[0];
  const paidGames = userGames.filter(
    (g) => g.playtimeForever > 120 && (g.priceInitialIDR || 0) > 0 && (!mostPlayedGame || g.appId !== mostPlayedGame.appId)
  );
  const bestRoiGame = paidGames.length > 0
    ? [...paidGames].sort(
        (a, b) =>
          a.priceInitialIDR / (a.playtimeForever / 60) -
          b.priceInitialIDR / (b.playtimeForever / 60)
      )[0]
    : userGames.find((g) => !mostPlayedGame || g.appId !== mostPlayedGame.appId) || mostPlayedGame;

  // Stable Dominant Genres derived directly from user's actual played library
  const dominantGenres = (() => {
    const genreCounts: Record<string, number> = {};
    let totalHits = 0;
    for (const g of userGames) {
      if (g.playtimeForever > 0 && g.genres) {
        for (const gn of g.genres) {
          genreCounts[gn] = (genreCounts[gn] || 0) + 1;
          totalHits++;
        }
      }
    }
    const computed = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genre, count]) => ({
        genre,
        percentage: Math.round((count / (totalHits || 1)) * 1000) / 10,
      }));
    if (computed.length > 0) return computed;
    return (
      livePersona?.dominantGenres || [
        { genre: "Action", percentage: 25.0 },
        { genre: "Adventure", percentage: 14.6 },
        { genre: "RPG", percentage: 11.8 },
        { genre: "Simulation", percentage: 7.6 },
      ]
    );
  })();

  // Load persona from backend with caching (keyed by tone + currency)
  const loadPersona = async (targetTone: RoastTone, force: boolean = false) => {
    const cacheKey = `${targetTone}_${currency}`;
    if (!force && personaByTone[cacheKey]) {
      setLivePersona(personaByTone[cacheKey]);
      return;
    }
    setIsScanning(true);
    try {
      const data = await fetchUserPersona(currentProfile.steamId64, targetTone, force, currency);
      if (data) {
        setLivePersona(data);
        setPersonaByTone((prev) => ({ ...prev, [cacheKey]: data }));
      }
    } catch (err) {
      console.warn("Failed to load AI persona:", err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    loadPersona(tone, false);
  }, [currentProfile.steamId64, tone, currency]);

  // Contextual fallback persona matching real library stats
  const persona = livePersona || {
    steamId64: currentProfile.steamId64,
    telemetryHash: "valvix_live",
    archetypeTitle:
      tone === "friendly"
        ? "The Dedicated Sports & Action Loyalist"
        : tone === "playful"
        ? "The Seasonal Sale Hoarder"
        : "The High-Yield Digital Hostage Crisis",
    playstyleSummary:
      tone === "friendly"
        ? `With over ${Math.round(totalHours)} hours logged and unwavering loyalty to ${mostPlayedGame?.name || "your top games"}, you know exactly what you love. Your ${unplayedGames.length} untouched titles represent an ambitious future roadmap of adventures.`
        : tone === "playful"
        ? `Stockpiles massive games during seasonal sales, only to log 0 minutes and immediately retreat to the comforting embrace of ${mostPlayedGame?.name || "comfort favorites"} for hundreds of hours.`
        : `You have ${formatPrice(unplayedValueIDR)} trapped in ${unplayedGames.length} games you haven't touched for even 60 seconds. An active hostage crisis for your storage while sinking time into ${mostPlayedGame?.name || "one game"}.`,
    strengths:
      tone === "friendly"
        ? [mostPlayedGame ? `${mostPlayedGame.name.split("™")[0].slice(0, 16)} Loyalist` : "Dedicated Player", `${Math.round(totalHours)}h Logged`, "Patient Collector"]
        : tone === "playful"
        ? ["Seasonal Sale Radar", "0-Minute Refund Avoider", "Endless Comfort Loops"]
        : [`${formatPrice(unplayedValueIDR)} Backlog Tax`, "SSD Space Squanderer", "Immunity to New Games"],
    comedyRoast:
      tone === "friendly"
        ? `You have logged an impressive ${Math.round(totalHours)} hours—with massive dedication to ${mostPlayedGame?.name || "your favorites"}! However, those ${unplayedGames.length} unplayed games worth ${formatPrice(unplayedValueIDR)} are patiently wondering if you'll ever visit before your retirement.`
        : tone === "playful"
        ? `You spent over ${formatPrice(unplayedValueIDR)} on ${unplayedGames.length} games you haven't touched for 60 seconds. You bought titles with grand ambitions, but ended up spending ${mostPlayedGame ? formatHours(mostPlayedGame.playtimeForever) : "hundreds of hours"} playing ${mostPlayedGame?.name || "the same game"} instead.`
        : `Your Steam library isn't a collection—it's an interest-free donation to Valve Corporation. You have ${formatPrice(unplayedValueIDR)} across ${unplayedGames.length} untouched titles rotting on your account, yet you treat your PC like a dedicated ${mostPlayedGame?.name || "game"} machine.`,
    dominantGenres,
    telemetrySnapshot: {
      totalGames: userGames.length || 92,
      totalPlaytimeHours: Math.round(totalHours),
      unplayedCount: unplayedGames.length,
      unplayedPercentage,
      totalLibraryValueIDR: totalValueIDR,
      unplayedValueIDR,
      averageCostPerHourIDR: avgCostPerHourIDR,
      mostExpensiveUnplayed: "Call of Duty®: Modern Warfare® (Rp 891.000)",
    },
    generatedAt: new Date().toISOString(),
  };

  // Compute 6-axis Gamer DNA metrics (0 - 100)
  const dnaMetrics = useMemo(() => {
    const dedication = Math.min(100, Math.round((totalHours / 1200) * 100));
    const uniqueGenres = new Set(userGames.flatMap((g) => g.genres || [])).size;
    const versatility = Math.min(100, Math.max(25, uniqueGenres * 10));
    const discipline = Math.max(15, 100 - Math.round(unplayedPercentage));
    const investedGames = userGames.filter((g) => g.playtimeForever >= 1200).length;
    const completion = Math.min(
      100,
      Math.max(20, Math.round((investedGames / Math.max(1, userGames.length)) * 300))
    );
    const coopCount = userGames.filter((g) => g.isCoop || g.isMultiplayer).length;
    const squadSynergy = Math.min(
      100,
      Math.max(20, Math.round((coopCount / Math.max(1, userGames.length)) * 250))
    );
    const efficiency =
      avgCostPerHourIDR > 0
        ? Math.min(100, Math.max(25, Math.round((20000 / avgCostPerHourIDR) * 80)))
        : 75;

    return [
      { label: "Dedication", shortLabel: "DED", value: dedication },
      { label: "Versatility", shortLabel: "VER", value: versatility },
      { label: "Discipline", shortLabel: "DIS", value: discipline },
      { label: "Completion", shortLabel: "CMP", value: completion },
      { label: "Squad Synergy", shortLabel: "SQD", value: squadSynergy },
      { label: "Value / ROI", shortLabel: "ROI", value: efficiency },
    ];
  }, [totalHours, userGames, unplayedPercentage, avgCostPerHourIDR]);

  // Handle tone change with live API call
  const handleToneChange = (newTone: RoastTone) => {
    if (newTone === tone) return;
    setTone(newTone);
  };

  // Force re-scan / regenerate persona from backend
  const handleRegenerate = () => {
    loadPersona(tone, true);
  };

  // Real PNG image export using html-to-image
  const handleExportPNG = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2, // 2x crisp retina resolution
        backgroundColor: "#0D0F14",
      });

      // Create download trigger
      const link = document.createElement("a");
      link.download = `valvix-passport-${currentProfile.personaName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
      link.href = dataUrl;
      link.click();

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error("Export error:", err);
      setExportError("Unable to capture image due to browser canvas restrictions. Take a screenshot instead!");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-7 pb-12 max-w-4xl mx-auto">
      {/* 1. Header Banner */}
      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="emerald" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Psychological Telemetry</span>
            </Badge>
            <span className="text-xs text-text-secondary font-mono">
              AI Persona Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary tracking-tight">
            Gamer Archetype & Library Roast
          </h1>
          <p className="text-xs text-text-secondary max-w-lg">
            Structured analysis generated directly from your library investment, playtime habits, and seasonal sale stockpiling telemetry.
          </p>
        </div>

        {/* Regenerate Action */}
        <Button
          variant="primary"
          size="md"
          onClick={handleRegenerate}
          disabled={isScanning}
          className="rounded-xl font-semibold text-xs gap-2 px-5 shrink-0"
        >
          {isScanning ? (
            <LoadingSpinner size="xs" variant="dark" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          <span>{isScanning ? "Analyzing Telemetry..." : "Regenerate Persona"}</span>
        </Button>
      </div>

      {/* 2. Roast Tone Controller */}
      <div className="p-4 bg-surface border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-card">
        <span className="text-xs text-text-secondary font-medium flex items-center gap-2">
          <Flame className="w-4 h-4 text-signal-orange" />
          <span>Select Roast Intensity:</span>
        </span>

        {/* Tone Selector Segmented Control (Sleek Modern Track) */}
        <div className="flex items-center bg-canvas/80 p-1 rounded-xl border border-white/[0.05] w-full sm:w-auto">
          <button
            onClick={() => handleToneChange("friendly")}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tone === "friendly"
                ? "bg-signal-emerald/15 text-signal-emerald border border-signal-emerald/30 shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            Friendly Banter
          </button>

          <button
            onClick={() => handleToneChange("playful")}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tone === "playful"
                ? "bg-signal-orange/15 text-signal-orange border border-signal-orange/30 shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            Playful Roast
          </button>

          <button
            onClick={() => handleToneChange("brutal")}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tone === "brutal"
                ? "bg-signal-purple/15 text-signal-purple border border-signal-purple/30 shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            Brutal Reality Check
          </button>
        </div>
      </div>

      {/* 3. The Collectible Gamer Passport Card (Exportable Target) */}
      <div className="relative">
        {/* Scanning Shimmer State */}
        {isScanning && (
          <div className="absolute inset-0 bg-[#0D0F14]/85 backdrop-blur-sm rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center">
            <LoadingState
              variant="emerald"
              size="xl"
              message="Analyzing Library & Play Habits..."
              subMessage="Synthesizing play patterns, backlog ratio, and top genres"
            />
          </div>
        )}

        <div
          ref={cardRef}
          className="p-5 sm:p-7 rounded-2xl bg-surface border border-border shadow-card space-y-6 relative overflow-hidden"
        >
          {/* Subtle Card Header Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-signal-emerald shrink-0" />
              <span className="font-semibold text-text-primary tracking-tight truncate">Steam Player Persona</span>
              <span className="text-text-dim text-[11px] hidden xs:inline">•</span>
              <span className="text-[11px] text-text-secondary hidden xs:inline">Valvix Verified</span>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-canvas border border-border text-text-secondary shrink-0">
              Community Profile
            </span>
          </div>

          {/* Card Header: Profile & Archetype Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1 border-b border-border pb-6">
            <div className="flex items-center gap-3.5 sm:shrink-0">
              <GamerAvatar
                src={currentProfile.avatarUrl}
                alt={currentProfile.personaName}
                className="w-14 h-14 rounded-2xl border border-white/15 shadow-md shrink-0"
              />
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-heading font-extrabold text-text-primary whitespace-nowrap">
                    {currentProfile.personaName}
                  </h3>
                  <Badge variant="emerald" className="text-[10px] py-0 px-2 shrink-0 whitespace-nowrap">
                    Verified Steam
                  </Badge>
                </div>
                <p className="text-xs font-mono text-text-secondary whitespace-nowrap">
                  SteamID: {currentProfile.steamId64}
                </p>
              </div>
            </div>

            {/* Archetype Highlight Badge */}
            <div className="text-left sm:text-right sm:flex-1 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium block">
                Primary Gaming Style
              </span>
              <h2 className="text-base sm:text-lg font-heading font-extrabold text-signal-emerald tracking-normal mt-0.5 leading-snug">
                {persona.archetypeTitle}
              </h2>
            </div>
          </div>

          {/* Playstyle Summary Prose */}
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-sans break-words">
            {persona.playstyleSummary}
          </p>

          {/* Playstyle Radar & Genre Breakdown */}
          <div className="p-4 sm:p-5 bg-canvas border border-border rounded-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-text-primary border-b border-border pb-3">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-signal-emerald shrink-0" />
                <span>Playstyle Radar & Favorite Genres</span>
              </span>
              <span className="text-text-secondary text-[11px] font-medium font-mono">
                {Math.round(totalHours).toLocaleString("en-US")} Total Hours • {userGames.length} Games
              </span>
            </div>

            {/* 2-Column Grid: Left Radar Polygon, Right Genre Bars + Trait Badges */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Radar Chart (5 cols) */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-2 bg-surface/30 rounded-2xl border border-white/[0.04]">
                <div className="text-xs font-semibold text-text-secondary mb-1">
                  Playstyle Radar
                </div>
                <GamerDnaChart metrics={dnaMetrics} />
              </div>

              {/* Dominant Genres and Traits (7 cols) */}
              <div className="md:col-span-7 space-y-4">
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-text-secondary">
                    Top Genre Breakdown
                  </div>
                  {dominantGenres.map((g: GenreDominance, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-secondary font-medium">{g.genre}</span>
                        <span className="font-mono font-semibold text-text-primary">
                          {g.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0
                              ? "bg-signal-emerald"
                              : idx === 1
                              ? "bg-signal-blue"
                              : idx === 2
                              ? "bg-signal-purple"
                              : "bg-signal-orange"
                          }`}
                          style={{ width: `${g.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3 Playstyle Trait Badges */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                  <div className="text-xs font-semibold text-text-secondary">
                    Playstyle Traits
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {persona.strengths.map((trait: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-surface border border-white/[0.08] hover:border-signal-emerald/40 rounded-lg text-xs font-medium text-text-primary transition-colors"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Telemetry Cards (Best Value, Time Sink, Shame Index) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-canvas border border-border rounded-xl min-w-0">
              <span className="text-[11px] text-text-secondary font-medium block mb-1">
                Best ROI Investment
              </span>
              <div className="font-heading font-bold text-sm text-text-primary truncate" title={bestRoiGame?.name}>
                {bestRoiGame?.name || "Library Top Pick"}
              </div>
              <div className="text-[11px] font-mono text-signal-emerald font-semibold mt-1 truncate">
                {bestRoiGame && bestRoiGame.playtimeForever > 0 && bestRoiGame.priceInitialIDR > 0
                  ? `${formatPrice(Math.round(bestRoiGame.priceInitialIDR / (bestRoiGame.playtimeForever / 60)))} / h`
                  : `${formatPrice(avgCostPerHourIDR)} / h avg`}
              </div>
            </div>

            <div className="p-3.5 bg-canvas border border-border rounded-xl min-w-0">
              <span className="text-[11px] text-text-secondary font-medium block mb-1">
                Forever Time Sink
              </span>
              <div className="font-heading font-bold text-sm text-text-primary truncate" title={mostPlayedGame?.name}>
                {mostPlayedGame?.name || "Most Played Game"}
              </div>
              <div className="text-[11px] font-mono text-signal-blue font-semibold mt-1 truncate">
                {mostPlayedGame
                  ? formatHours(mostPlayedGame.playtimeForever)
                  : `${Math.round(totalHours)} Hours Logged`}
              </div>
            </div>

            <div className="p-3.5 bg-canvas border border-signal-orange/30 rounded-xl min-w-0">
              <span className="text-[11px] text-signal-orange font-medium block mb-1">
                Backlog Shame Index
              </span>
              <div className="font-heading font-bold text-sm text-signal-orange truncate">
                {formatPrice(userGames.length > 0 ? unplayedValueIDR : persona.telemetrySnapshot.unplayedValueIDR)}
              </div>
              <div className="text-[11px] font-mono text-text-secondary mt-1 truncate">
                {userGames.length > 0 ? unplayedGames.length : persona.telemetrySnapshot.unplayedCount} Untouched (
                {userGames.length > 0 ? unplayedPercentage : persona.telemetrySnapshot.unplayedPercentage}%)
              </div>
            </div>
          </div>

          {/* The AI Roast Box */}
          <div className="p-4 sm:p-5 bg-canvas border border-signal-orange/25 rounded-2xl relative space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 font-bold text-signal-orange">
                <Flame className="w-4 h-4 text-signal-orange shrink-0" />
                <span>AI Persona Roast</span>
              </span>
              <span className="text-[11px] font-medium text-text-dim px-2 py-0.5 rounded-md bg-surface border border-border">
                Tone: {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </span>
            </div>

            <blockquote className="text-sm text-text-primary/90 leading-relaxed italic font-sans pl-3 border-l-2 border-signal-orange/50 break-words">
              "{persona.comedyRoast}"
            </blockquote>
          </div>

          {/* Card Footer Stamp */}
          <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t border-border/60">
            <span>Valvix • Steam Player Persona</span>
            <span>Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      {/* 4. Export & Share Action Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface border border-border rounded-2xl shadow-card">
        <div className="text-xs text-text-secondary">
          Export this gamer badge to share with your Discord squad or on social media.
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="rounded-xl font-semibold text-xs gap-2 px-5 w-full sm:w-auto shadow-sm"
          >
            {isExporting ? (
              <>
                <LoadingSpinner size="xs" variant="dark" />
                <span>Rendering PNG...</span>
              </>
            ) : exportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-canvas stroke-[3]" />
                <span>Saved to Downloads!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Shareable Card (PNG)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Export Error Alert Toast */}
      {exportError && (
        <div className="p-3 bg-surface border border-signal-orange/50 rounded-xl text-xs text-signal-orange flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
    </div>
  );
}
