import React from "react";
import { SteamGame } from "@/types/steam";
import { Badge } from "@/components/ui/badge";
import { getGameReleaseYear, handlePosterError } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Play, Trophy } from "lucide-react";

export interface GameCardBadge {
  label: string;
  variant?: "emerald" | "blue" | "orange" | "purple" | "default";
  icon?: React.ReactNode;
}

export interface GameCardProps {
  game: SteamGame;
  onClick?: () => void;
  topBadge?: GameCardBadge | null;
  bottomPill?: string | React.ReactNode;
  secondaryMeta?: React.ReactNode;
  className?: string;
  priceDisplay?: string | null;
}

export function GameCard({
  game,
  onClick,
  topBadge,
  bottomPill,
  secondaryMeta,
  className = "",
  priceDisplay,
}: GameCardProps) {
  const { formatPrice } = useCurrency();
  const displayPrice = priceDisplay !== undefined ? priceDisplay : formatPrice(game.priceInitialIDR);
  const releaseYear = getGameReleaseYear(game.appId, game.name);
  const primaryGenre = game.genres && game.genres.length > 0 ? game.genres[0] : null;

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus overflow-hidden transition-colors duration-200 hover:shadow-card flex flex-col justify-between relative min-w-0 ${className}`}
    >
      {/* 2:3 Vertical Poster Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-canvas isolate">
        <img
          src={game.posterImage}
          alt={game.name}
          onError={(e) => handlePosterError(e, game.headerImage)}
          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] will-change-transform"
        />

        {/* Static Subtle Bottom Vignette (no layer shift on hover) */}
        <div className="absolute -inset-px bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />

        {/* Tactile Center Hover Play Micro-Interaction */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/75 border border-white/25 text-white flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </div>
        </div>

        {/* Floating Top Badge */}
        {topBadge && (
          <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex">
            <Badge
              variant={topBadge.variant || "default"}
              className="text-[10px] font-bold py-0.5 px-2 bg-black/80 backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-1 max-w-full min-w-0"
            >
              <span className="shrink-0">{topBadge.icon}</span>
              <span className="truncate">{topBadge.label}</span>
            </Badge>
          </div>
        )}

        {/* Floating Bottom Quick Stat Pill */}
        {bottomPill && (
          <div className="absolute bottom-2.5 right-2.5 left-2.5 z-10 flex justify-end">
            <span className="text-[10px] font-mono font-bold text-text-primary bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 shadow-sm max-w-full truncate">
              {bottomPill}
            </span>
          </div>
        )}
      </div>

      {/* Unified Card Footer */}
      <div className="p-3 bg-surface border-t border-border flex-1 flex flex-col justify-between gap-1.5 min-w-0">
        <div className="min-w-0">
          {/* Row 1: Title and Single Distinct Price */}
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <h3
              className="flex-1 min-w-0 text-xs font-heading font-bold text-text-primary truncate group-hover:text-signal-emerald transition-colors leading-snug"
              title={game.name}
            >
              {game.name}
            </h3>
            {displayPrice && (
              <span className="text-[11px] font-mono text-text-secondary shrink-0 font-semibold">
                {displayPrice}
              </span>
            )}
          </div>

          {/* Row 2: Metadata (Release Year & Primary Genre) */}
          <div className="flex items-center justify-between gap-2 text-[10px] text-text-dim mt-1 font-mono min-w-0">
            <span className="truncate min-w-0">
              {releaseYear ? `${releaseYear}` : ""}
              {releaseYear && primaryGenre ? " • " : ""}
              {primaryGenre || (!releaseYear ? "Steam Game" : "")}
            </span>
            {!secondaryMeta && game.achievementsTotal && game.achievementsTotal > 0 ? (
              <span className="inline-flex items-center gap-1 text-signal-purple shrink-0 font-medium">
                <Trophy className="w-2.5 h-2.5" />
                <span>
                  {game.achievementsUnlocked || 0}/{game.achievementsTotal}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Optional Secondary Metadata Slot (Trophies, CPH, Squad stats) */}
        {secondaryMeta && <div className="pt-1 min-w-0">{secondaryMeta}</div>}
      </div>
    </div>
  );
}
