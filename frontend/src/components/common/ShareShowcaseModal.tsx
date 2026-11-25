import React, { useState, useRef, useMemo, useEffect } from "react";
import { UserProfile, SteamGame } from "@/types/steam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GamerAvatar } from "@/components/common/GamerAvatar";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  formatCompactNumber,
  formatHours,
  handlePosterError,
} from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Crown,
  Download,
  Copy,
  Check,
  X,
  Share2,
  Gamepad2,
  Clock,
  Coins,
  ShieldCheck,
  Medal,
  Flame,
  Layers,
  Award,
} from "lucide-react";

interface ShareShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile;
  games: SteamGame[];
}

export type ShowcaseMode = "completed" | "collection";

export const ShareShowcaseModal: React.FC<ShareShowcaseModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  games,
}) => {
  const { formatPrice, formatPriceCompact } = useCurrency();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ShowcaseMode>("completed");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  // 1. Calculate Comprehensive Statistics
  const stats = useMemo(() => {
    const totalMinutes = games.reduce((acc, g) => acc + (g.playtimeForever || 0), 0);
    const totalHours = totalMinutes / 60;
    const totalValue = games.reduce((acc, g) => acc + (g.priceInitialIDR || 0), 0);
    const avgCostPerHour = totalHours > 0 ? Math.round(totalValue / totalHours) : 0;
    const unplayedGames = games.filter((g) => g.playtimeForever === 0);

    // Completed games (100% unlocked), strictly sorted by playtime descending
    const completedGames = games
      .filter(
        (g) =>
          g.achievementsTotal &&
          g.achievementsTotal > 0 &&
          (g.achievementsUnlocked || 0) >= g.achievementsTotal
      )
      .sort((a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0));

    const completedHours = Math.round(
      completedGames.reduce((acc, g) => acc + (g.playtimeForever || 0), 0) / 60
    );

    // In-progress games with achievements, also sorted by playtime descending
    const inProgressTrophies = games
      .filter(
        (g) =>
          g.achievementsTotal &&
          g.achievementsTotal > 0 &&
          (g.achievementsUnlocked || 0) < g.achievementsTotal &&
          (g.achievementsUnlocked || 0) > 0
      )
      .sort((a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0));

    // Top played games (entire library sorted by playtime descending)
    const topPlayed = [...games].sort(
      (a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0)
    );

    // Achievement sums
    const totalUnlocked = games.reduce((acc, g) => acc + (g.achievementsUnlocked || 0), 0);
    const totalPossible = games.reduce((acc, g) => acc + (g.achievementsTotal || 0), 0);
    const avgCompletionRate =
      totalPossible > 0 ? Math.round((totalUnlocked / totalPossible) * 100) : 0;

    // Ranks
    let trophyRank = "Apprentice Hunter";
    if (completedGames.length >= 10 || totalUnlocked >= 500) {
      trophyRank = "Mythic Completionist";
    } else if (completedGames.length >= 3 || totalUnlocked >= 100) {
      trophyRank = "Diamond Achiever";
    } else if (completedGames.length >= 1 || totalUnlocked >= 25) {
      trophyRank = "Gold Hunter";
    }

    let collectorRank = "Apprentice Archivist";
    if (games.length >= 250 || totalHours >= 3000) {
      collectorRank = "Grandmaster Archivist";
    } else if (games.length >= 75 || totalHours >= 1500) {
      collectorRank = "Centurion Collector";
    } else if (games.length >= 25 || totalHours >= 500) {
      collectorRank = "Veteran Collector";
    }

    return {
      totalGames: games.length,
      totalHours: Math.round(totalHours),
      totalValue,
      avgCostPerHour,
      unplayedCount: unplayedGames.length,
      unplayedPercent: games.length > 0 ? Math.round((unplayedGames.length / games.length) * 100) : 0,
      completedGames,
      completedHours,
      inProgressTrophies,
      topPlayed,
      totalUnlocked,
      totalPossible,
      avgCompletionRate,
      trophyRank,
      collectorRank,
    };
  }, [games]);

  // Telemetry hash stamp
  const passportChecksum = useMemo(() => {
    const raw = `${currentProfile.steamId64}-${stats.totalGames}-${stats.totalUnlocked}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  }, [currentProfile.steamId64, stats.totalGames, stats.totalUnlocked]);

  // Determine game list: exactly max 7 game cards + 1 "+X more" card (8 slots in a 4x2 grid), ordered by playtime
  const { displayGames, remainingCount } = useMemo(() => {
    if (mode === "completed") {
      // Completed games sorted by playtime descending
      let pool = [...stats.completedGames].sort(
        (a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0)
      );

      // If fewer than 7 completed games, supplement with top-played in-progress trophy candidates
      if (pool.length < 7) {
        const addedIds = new Set(pool.map((g) => g.appId));
        const sortedInProgress = [...stats.inProgressTrophies].sort(
          (a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0)
        );
        for (const candidate of sortedInProgress) {
          if (!addedIds.has(candidate.appId)) {
            pool.push(candidate);
            addedIds.add(candidate.appId);
            if (pool.length >= 7) break;
          }
        }
      }

      // If still empty (new account), fallback to top played
      if (pool.length === 0) {
        pool = stats.topPlayed.slice(0, 7);
      }

      const totalPoolSize =
        stats.completedGames.length > 0
          ? stats.completedGames.length
          : stats.inProgressTrophies.length;

      if (totalPoolSize > 7) {
        return {
          displayGames: pool.slice(0, 7),
          remainingCount: totalPoolSize - 7,
        };
      }
      return {
        displayGames: pool.slice(0, 7),
        remainingCount: 0,
      };
    } else {
      // Collection mode: library titles strictly sorted by playtime descending
      const totalPoolSize = stats.totalGames;
      const sortedByPlaytime = [...stats.topPlayed].sort(
        (a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0)
      );

      if (totalPoolSize > 7) {
        return {
          displayGames: sortedByPlaytime.slice(0, 7),
          remainingCount: totalPoolSize - 7,
        };
      }
      return {
        displayGames: sortedByPlaytime.slice(0, 7),
        remainingCount: 0,
      };
    }
  }, [mode, stats]);

  // 2. Export Card to PNG
  const handleExportPng = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2, // 2x crisp retina resolution
        backgroundColor: "#0D0F14",
      });

      const fileName = `valvix-${mode === "completed" ? "trophy-hall" : "collection"}-${currentProfile.personaName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Export error:", err);
      setExportError("Unable to capture image. You can take a screenshot instead!");
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Copy Formatted Discord / Social Markdown
  const handleCopySummary = () => {
    let text = "";
    if (mode === "completed") {
      text = [
        `🏆 **${currentProfile.personaName}'s Steam Trophy Showcase on Valvix**`,
        `🎖️ Standing: ${stats.trophyRank}`,
        `👑 100% Completed Titles: ${stats.completedGames.length} perfect games (${stats.completedHours.toLocaleString()}h logged)`,
        `⭐ Total Achievements: ${stats.totalUnlocked.toLocaleString()} unlocked (${stats.avgCompletionRate}% avg)`,
        stats.completedGames.length > 0
          ? `🔥 Hall of Fame (By Playtime): ${stats.completedGames.slice(0, 5).map((g) => g.name).join(", ")}`
          : `🎯 Top Trophy Target: ${stats.inProgressTrophies[0]?.name || "N/A"}`,
        `🔗 Verified via Valvix Steam Lounge (Checksum: 0x${passportChecksum})`,
      ].join("\n");
    } else {
      text = [
        `🎮 **${currentProfile.personaName}'s Steam Collection Passport on Valvix**`,
        `🎖️ Collector Status: ${stats.collectorRank}`,
        `📚 Games in Library: ${stats.totalGames} titles (${stats.totalHours.toLocaleString()} hours played)`,
        `💎 Valuation: ${formatPrice(stats.totalValue)} (Avg ${formatPrice(stats.avgCostPerHour)}/h)`,
        `🔥 Most Played Titans: ${stats.topPlayed.slice(0, 5).map((g) => g.name).join(", ")}`,
        `🔗 Verified via Valvix Steam Lounge (Checksum: 0x${passportChecksum})`,
      ].join("\n");
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#07090E]/90 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window Container: Structured with pinned header & footer so outer corners never get cut by scrollbars */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-surface border border-white/10 rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden"
        >
          {/* Modal Header & Tabs (Pinned at top) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b border-white/[0.08] px-5 sm:px-7 py-3.5 flex-shrink-0 bg-surface">
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={mode === "completed" ? "purple" : "blue"}
                  className="gap-1 px-2 py-0.5 text-[10px]"
                >
                  <Share2 className="w-3 h-3" />
                  <span>
                    {mode === "completed" ? "Trophy Hall of Fame" : "Master Collection"}
                  </span>
                </Badge>
                <span className="text-[10px] font-mono text-text-secondary">
                  Collectible Card
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-heading font-extrabold text-text-primary tracking-tight mt-0.5">
                {mode === "completed"
                  ? "100% Achievement & Trophy Showcase"
                  : "Steam Library & Collection Passport"}
              </h2>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-white/[0.06] w-full sm:w-auto">
              <button
                onClick={() => setMode("completed")}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  mode === "completed"
                    ? "bg-signal-purple/20 text-signal-purple border border-signal-purple/40 shadow-sm"
                    : "text-text-secondary hover:text-text-primary border border-transparent"
                }`}
              >
                <Crown className="w-3 h-3 text-signal-purple" />
                <span>100% Trophies</span>
              </button>

              <button
                onClick={() => setMode("collection")}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  mode === "collection"
                    ? "bg-signal-blue/20 text-signal-blue border border-signal-blue/40 shadow-sm"
                    : "text-text-secondary hover:text-text-primary border border-transparent"
                }`}
              >
                <Gamepad2 className="w-3 h-3 text-signal-blue" />
                <span>Game Collection</span>
              </button>

              <button
                onClick={onClose}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors ml-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body: Inset scrollbar strictly contained within modal padding */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-3.5 space-y-3.5 custom-modal-scroll">
            {/* =========================================================================
                THE COLLECTIBLE PASSPORT CARD (Export Target for toPng)
               ========================================================================= */}
            <div
              ref={cardRef}
              className={`p-4 sm:p-6 rounded-2xl bg-[#0C0E15] border shadow-2xl relative overflow-hidden space-y-4 ${
                mode === "completed" ? "border-signal-purple/30" : "border-white/10"
              }`}
            >
              {/* Showcase Header Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-signal-emerald shrink-0" />
                  <span className="font-semibold text-text-primary tracking-tight truncate">Steam Community Showcase</span>
                  <span className="text-text-dim text-[11px] hidden xs:inline">•</span>
                  <span className="text-[11px] text-text-secondary hidden xs:inline">Valvix Verified</span>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-text-secondary shrink-0">
                  {mode === "completed" ? "100% Trophy Room" : "Library Passport"}
                </span>
              </div>

              {/* Card Header: Avatar & Player Rank */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-3">
                  <GamerAvatar
                    src={currentProfile.avatarUrl}
                    alt={currentProfile.personaName}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border border-white/20 shadow-md shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-heading font-extrabold text-text-primary tracking-tight whitespace-nowrap">
                        {currentProfile.personaName}
                      </h3>
                      <Badge variant={mode === "completed" ? "purple" : "blue"} className="text-[9px] py-0 px-1.5 gap-1 shrink-0 whitespace-nowrap">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Steam Verified</span>
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono text-text-secondary whitespace-nowrap">
                      SteamID: {currentProfile.steamId64}
                    </p>
                  </div>
                </div>

                {/* Status Badge Differentiated by Mode */}
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium block">
                    {mode === "completed" ? "Completionist Standing" : "Library Standing"}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-heading font-bold border mt-0.5 ${
                      mode === "completed"
                        ? "text-signal-purple border-signal-purple/30 bg-signal-purple/10"
                        : "text-signal-blue border-signal-blue/30 bg-signal-blue/10"
                    }`}
                  >
                    {mode === "completed" ? <Crown className="w-3.5 h-3.5 text-signal-purple" /> : <Medal className="w-3.5 h-3.5 text-signal-blue" />}
                    <span>{mode === "completed" ? stats.trophyRank : stats.collectorRank}</span>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  KEY STATISTICS GRID (Cohesive, Refined Aesthetic)
                 ========================================================================= */}
              {mode === "completed" ? (
                /* 100% Trophy & Achievement Mode Statistics */
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Crown className="w-3.5 h-3.5 text-signal-purple" />
                      <span>100% Games</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums whitespace-nowrap">
                      {stats.completedGames.length}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {stats.completedGames.length > 0 ? "Perfect Titles" : "In Progress"}
                    </div>
                  </div>

                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Trophy className="w-3.5 h-3.5 text-signal-emerald" />
                      <span>Achievements</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums whitespace-nowrap">
                      {formatCompactNumber(stats.totalUnlocked)}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      In {stats.totalGames} Titles
                    </div>
                  </div>

                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Award className="w-3.5 h-3.5 text-signal-orange" />
                      <span>Avg Unlock</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums whitespace-nowrap">
                      {stats.avgCompletionRate}%
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {formatCompactNumber(stats.totalUnlocked)}/{formatCompactNumber(stats.totalPossible)} Total
                    </div>
                  </div>

                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Clock className="w-3.5 h-3.5 text-signal-blue" />
                      <span>Trophy Playtime</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums whitespace-nowrap">
                      {formatCompactNumber(stats.completedHours)}h
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      In 100% Titles
                    </div>
                  </div>
                </div>
              ) : (
                /* Game Collection & Library Mode Statistics */
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Gamepad2 className="w-3.5 h-3.5 text-signal-blue" />
                      <span>Total Games</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums whitespace-nowrap">
                      {stats.totalGames}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      Owned Titles
                    </div>
                  </div>

                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Clock className="w-3.5 h-3.5 text-signal-purple" />
                      <span>Total Playtime</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums whitespace-nowrap">
                      {formatCompactNumber(stats.totalHours)}h
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      Logged Hours
                    </div>
                  </div>

                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Coins className="w-3.5 h-3.5 text-signal-orange" />
                      <span>Valuation</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums truncate whitespace-nowrap">
                      {formatPriceCompact(stats.totalValue)}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      Steam Catalog
                    </div>
                  </div>

                  <div className="p-3 bg-[#11141E] border border-white/[0.08] rounded-xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Flame className="w-3.5 h-3.5 text-signal-emerald" />
                      <span>Cost / Hour</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-heading font-black text-text-primary mt-1 tabular-nums truncate whitespace-nowrap">
                      {formatPriceCompact(stats.avgCostPerHour)}/h
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {stats.unplayedCount} Unplayed ({stats.unplayedPercent}%)
                    </div>
                  </div>
                </div>
              )}

              {/* Showcase Gallery Shelf */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs px-0.5">
                  <span className="font-semibold text-text-primary">
                    {mode === "completed"
                      ? "100% Completed Games (Ranked by Playtime)"
                      : "Top Played Games (Ranked by Playtime)"}
                  </span>
                  <span className="text-xs text-text-secondary">
                    Top 7 Highlights
                  </span>
                </div>

              {/* 4 columns x 2 rows = 8 slots grid with prominent game cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {displayGames.map((game) => {
                  const is100 =
                    game.achievementsTotal &&
                    game.achievementsTotal > 0 &&
                    (game.achievementsUnlocked || 0) >= game.achievementsTotal;

                  const achPct =
                    game.achievementsTotal && game.achievementsTotal > 0
                      ? Math.round(
                          ((game.achievementsUnlocked || 0) / game.achievementsTotal) * 100
                        )
                      : 0;

                  return (
                    <div
                      key={game.appId}
                      className="group relative bg-[#0D0F14] border border-white/[0.08] hover:border-white/20 rounded-2xl overflow-hidden flex flex-col p-2 h-full justify-between shadow-md transition-all"
                    >
                      {/* Prominent High-Resolution Game Poster Art */}
                      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-canvas flex-shrink-0">
                        <img
                          src={game.posterImage}
                          alt={game.name}
                          onError={(e) => handlePosterError(e, game.headerImage)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* 100% Perfect Laurel Badge or Progress Tag */}
                        {is100 ? (
                          <div className="absolute top-1.5 right-1.5 bg-signal-purple/95 backdrop-blur-md text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md border border-signal-purple/40">
                            <Crown className="w-2.5 h-2.5 text-signal-orange" />
                            <span>100%</span>
                          </div>
                        ) : (
                          achPct > 0 && (
                            <div className="absolute top-1.5 right-1.5 bg-black/85 backdrop-blur-md text-signal-emerald text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-md border border-white/10">
                              {achPct}%
                            </div>
                          )
                        )}
                      </div>

                      {/* Game Details (Identical height box) */}
                      <div className="mt-2 space-y-0.5 px-0.5 flex flex-col justify-end min-h-[34px] min-w-0">
                        <h4 className="text-xs font-heading font-bold text-text-primary truncate" title={game.name}>
                          {game.name}
                        </h4>
                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-text-secondary min-w-0">
                          <span className="font-semibold text-text-primary truncate">{formatHours(game.playtimeForever)}</span>
                          {(game.achievementsTotal || 0) > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-signal-emerald font-semibold shrink-0">
                              <span>{game.achievementsUnlocked || 0}/{game.achievementsTotal}</span>
                              <Trophy className="w-2.5 h-2.5" />
                            </span>
                          ) : (
                            <span className="text-text-dim font-medium shrink-0">No Trophies</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 8th Slot: Special "+X More" Indicator Card matching full poster aspect ratio and card height */}
                {remainingCount > 0 && (
                  <div className="group relative bg-[#0D0F14] border border-white/[0.08] hover:border-signal-purple/30 rounded-2xl overflow-hidden flex flex-col p-2 h-full justify-between shadow-md transition-all">
                    {/* Poster box with identical aspect-[2/3] ratio */}
                    <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#131622] border border-dashed border-white/20 flex flex-col items-center justify-center p-3 text-center space-y-2 group-hover:border-signal-purple/50 transition-colors flex-shrink-0">
                      <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-text-secondary group-hover:scale-110 group-hover:text-signal-purple group-hover:border-signal-purple/40 transition-all shadow-sm">
                        {mode === "completed" ? (
                          <Crown className="w-5 h-5 text-signal-purple" />
                        ) : (
                          <Layers className="w-5 h-5 text-signal-blue" />
                        )}
                      </div>
                      <div>
                        <div className="text-2xl font-heading font-black text-text-primary tracking-tight">
                          +{remainingCount}
                        </div>
                        <div className="text-[10px] font-mono text-text-secondary uppercase tracking-wider leading-tight mt-0.5">
                          {mode === "completed" ? "More Trophies" : "More Games"}
                        </div>
                      </div>
                    </div>

                    {/* Bottom details text container matching game card height */}
                    <div className="mt-2 space-y-0.5 px-0.5 flex flex-col justify-end min-h-[34px] min-w-0">
                      <h4 className="text-xs font-heading font-bold text-text-secondary truncate">
                        {mode === "completed" ? "Trophy Vault" : "Library Vault"}
                      </h4>
                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-text-dim min-w-0">
                        <span className="truncate">{mode === "completed" ? `${stats.completedGames.length} Perfect` : `${stats.totalGames} Titles`}</span>
                        <span className="inline-flex items-center gap-0.5 text-signal-purple font-semibold shrink-0">
                          <span>Vault</span>
                          <Trophy className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stamp Footer */}
            <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t border-white/[0.06]">
              <span>Valvix • Steam Community Showcase</span>
              <span>Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>
        </div>

        {/* Pinned Modal Action Buttons Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-5 sm:px-7 py-3.5 border-t border-white/[0.08] flex-shrink-0 bg-[#0D0F14]/95 backdrop-blur-md">
          <span className="text-[11px] text-text-secondary">
            {mode === "completed"
              ? "Share your 100% completed games ranked by playtime on Discord or social media."
              : "Share your top played Steam collection passport & valuation."}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopySummary}
              className="gap-2 rounded-xl text-xs font-medium px-3.5 py-2 w-full sm:w-auto"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-signal-emerald stroke-[2.5]" />
                  <span className="text-signal-emerald font-semibold">Copied Text!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Copy Summary</span>
                </>
              )}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPng}
              disabled={isExporting}
              className="gap-2 rounded-xl text-xs font-semibold px-4 py-2 w-full sm:w-auto shadow-sm"
            >
              {isExporting ? (
                <>
                  <LoadingSpinner size="xs" variant="dark" />
                  <span>Rendering PNG...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Saved to Downloads!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Card (PNG)</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {exportError && (
          <p className="text-xs text-center text-signal-orange font-mono pb-2">
            {exportError}
          </p>
        )}
      </motion.div>
    </div>
  </AnimatePresence>
);
};
