import { useState } from "react";
import { UserProfile } from "@/types/steam";
import { syncUserProfile } from "@/services/api";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SteamConsoleGraphic } from "@/components/common/SteamConsoleGraphic";
import { ValvixMark } from "@/components/common/ValvixLogo";
import {
  ArrowRight,
  ShieldCheck,
  Search,
  Coins,
  Users2,
  Gamepad2,
  Flame,
} from "lucide-react";

interface SteamLoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onExploreDemo?: () => void;
}

export function SteamLoginView({ onLoginSuccess }: SteamLoginViewProps) {
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Direct connect with ID / Vanity / Profile Link (No password needed)
  const handleDirectConnect = async (targetId?: string) => {
    const toSync = (targetId || identifier).trim();
    if (!toSync) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await syncUserProfile(toSync);
      if (result && result.profile) {
        onLoginSuccess(result.profile);
        return;
      }
      throw new Error("Could not resolve profile");
    } catch (err: any) {
      console.warn("Direct connect error:", err);
      setErrorMsg(
        "Failed to connect Steam account. Please ensure the Steam ID / Custom URL is correct and the profile is set to Public."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDirectConnect();
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col justify-center items-center px-4 sm:px-6 lg:px-10 py-10 relative overflow-x-hidden selection:bg-signal-emerald/20 selection:text-signal-emerald">
      {/* Subtle Top Ambient Light & Dot Grid */}
      <div className="fixed inset-0 bg-subtle-glow pointer-events-none" />
      <div className="fixed inset-0 bg-dots-pattern opacity-40 pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT COLUMN: Editorial Hero & Clean Product Preview (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-left min-w-0">
            {/* Top Brand Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-full text-xs">
              <ValvixMark className="w-4 h-4 shrink-0" />
              <span className="font-heading font-bold text-text-primary">Valvix</span>
              <span className="text-text-dim">•</span>
              <span className="text-text-secondary text-[11px]">Steam Library & Squad Lounge</span>
            </div>

            {/* Clean Typography Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text-primary leading-[1.1]">
                Your Steam Library,{" "}
                <span className="text-signal-emerald">Clearly Understood.</span>
              </h1>
              <p className="text-sm sm:text-base text-text-secondary max-w-xl leading-relaxed">
                Track your library valuation in USD, IDR, EUR, and more, tame your unplayed backlog, match co-op games with friends, and generate an AI gamer passport from real playtime data.
              </p>
            </div>

            {/* Authentic Product Preview Card */}
            <div className="pt-1">
              <SteamConsoleGraphic />
            </div>

            {/* Feature Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 min-w-0">
                <Coins className="w-4 h-4 text-signal-emerald" />
                <div className="text-xs font-heading font-bold text-text-primary">Global Valuation</div>
                <div className="text-[11px] text-text-secondary leading-snug">
                  Multi-currency store pricing & cost-per-hour
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 min-w-0">
                <Users2 className="w-4 h-4 text-signal-blue" />
                <div className="text-xs font-heading font-bold text-text-primary">Squad Co-op</div>
                <div className="text-[11px] text-text-secondary leading-snug">
                  Find shared multiplayer games across friends
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 min-w-0">
                <Flame className="w-4 h-4 text-signal-orange" />
                <div className="text-xs font-heading font-bold text-text-primary">AI Passport</div>
                <div className="text-[11px] text-text-secondary leading-snug">
                  Shareable card & habit roast from playtime
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Connect Steam Card (5 cols) */}
          <div className="lg:col-span-5 min-w-0">
            <div className="rounded-2xl bg-surface border border-border p-6 sm:p-7 shadow-card relative overflow-hidden space-y-6">
              {/* Crisp Top Accent Line */}
              <div className="absolute top-0 inset-x-0 h-0.5 bg-signal-emerald" />

              {/* Form Header */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-semibold text-signal-emerald uppercase tracking-wider">
                    Public Profile Sync
                  </span>
                  <span className="text-[10px] font-mono text-text-secondary px-2 py-0.5 rounded-md bg-canvas border border-border shrink-0">
                    No Password Needed
                  </span>
                </div>
                <h2 className="text-2xl font-heading font-extrabold text-text-primary tracking-tight">
                  Connect Your Steam
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Enter any public Steam Profile URL, custom vanity name, or SteamID64 to load your library.
                </p>
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Steam Profile URL or SteamID64
                  </label>
                  <div className="relative group">
                    <Search className="w-4 h-4 text-text-dim absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-signal-emerald transition-colors" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. 76561197960287930 or profile URL"
                      className="w-full bg-canvas border border-border rounded-xl pl-10 pr-4 py-3 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-signal-emerald transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* Quick 1-Click Preset Chip */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-text-dim font-semibold block">
                    Quick Demo Profile
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier("https://steamcommunity.com/profiles/76561197960287930/");
                      handleDirectConnect("76561197960287930");
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-canvas hover:bg-surface-elevated border border-border hover:border-signal-emerald/40 transition-all text-left text-xs group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Gamepad2 className="w-3.5 h-3.5 text-signal-emerald shrink-0" />
                      <span className="font-semibold text-text-primary shrink-0">Rabscuttle</span>
                      <span className="text-[11px] font-mono text-text-dim truncate">
                        Public Demo Library
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-signal-emerald font-semibold flex items-center gap-1 shrink-0">
                      <span>Try Demo</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-signal-orange/10 border border-signal-orange/25 text-xs text-signal-orange leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isLoading || !identifier.trim()}
                  className="w-full rounded-xl text-xs font-bold h-11 gap-2"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" variant="dark" />
                      <span>Syncing Steam Library...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Valvix Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                {/* Privacy & Safety Guarantee */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-text-dim pt-1 text-center">
                  <ShieldCheck className="w-4 h-4 text-signal-emerald shrink-0" />
                  <span>Read-only • Uses public Steam Web API data only</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
