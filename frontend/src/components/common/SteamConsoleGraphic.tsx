import { TrendingUp, Gamepad2, Users2, Trophy, Flame, Layers } from "lucide-react";

export function SteamConsoleGraphic() {
  return (
    <div className="relative w-full max-w-xl select-none pointer-events-none">
      {/* Subtle ambient highlight */}
      <div className="absolute -inset-4 bg-signal-emerald/[0.04] blur-2xl rounded-3xl" />

      {/* Clean Editorial Product Preview Card */}
      <div className="relative rounded-2xl bg-surface border border-border shadow-card overflow-hidden">
        {/* Top Window Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-signal-emerald shrink-0" />
            <span className="text-[11px] font-mono font-semibold text-text-secondary truncate">
              valvix.app / library-overview
            </span>
          </div>
          <span className="text-[10px] font-mono text-signal-emerald bg-signal-emerald/10 border border-signal-emerald/20 px-2 py-0.5 rounded-full shrink-0">
            Sample Preview
          </span>
        </div>

        {/* Preview Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* 2-Column Stat Strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-canvas border border-border space-y-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-text-secondary">
                <span className="truncate">Library Value</span>
                <TrendingUp className="w-3.5 h-3.5 text-signal-emerald shrink-0" />
              </div>
              <div className="text-base sm:text-lg font-mono font-bold text-text-primary truncate tabular-nums">
                $1,226
              </div>
              <div className="text-[11px] text-signal-emerald font-mono truncate">
                42 Unplayed Titles
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-canvas border border-border space-y-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-text-secondary">
                <span className="truncate">Time Logged</span>
                <Gamepad2 className="w-3.5 h-3.5 text-signal-blue shrink-0" />
              </div>
              <div className="text-base sm:text-lg font-mono font-bold text-text-primary truncate tabular-nums">
                2,490h
              </div>
              <div className="text-[11px] text-signal-blue font-mono truncate">
                92 Steam Games
              </div>
            </div>
          </div>

          {/* Mini Feature Row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border flex items-center gap-2 min-w-0">
              <Layers className="w-3.5 h-3.5 text-signal-orange shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-text-primary truncate">Backlog</div>
                <div className="text-[10px] text-text-dim truncate">Quick Wins</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border flex items-center gap-2 min-w-0">
              <Users2 className="w-3.5 h-3.5 text-signal-blue shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-text-primary truncate">Co-op</div>
                <div className="text-[10px] text-text-dim truncate">31 Friends</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border flex items-center gap-2 min-w-0">
              <Trophy className="w-3.5 h-3.5 text-signal-purple shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-text-primary truncate">Trophies</div>
                <div className="text-[10px] text-text-dim truncate">AI Guides</div>
              </div>
            </div>
          </div>

          {/* Persona Strip */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-3.5 h-3.5 text-signal-orange shrink-0" />
              <span className="text-[11px] text-text-secondary truncate">
                Archetype: <strong className="text-text-primary">The Seasonal Sale Hoarder</strong>
              </span>
            </div>
            <span className="text-[10px] font-mono text-text-dim shrink-0">USD • Live Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
