import { useState, useEffect } from "react";
import { UserProfile, SteamGame } from "@/types/steam";
import {
  syncUserProfile,
  fetchUserFriends,
  getStoredRecentProfiles,
  addStoredRecentProfile,
  SteamFriendItem,
} from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { GamerAvatar } from "@/components/common/GamerAvatar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ValvixMark } from "@/components/common/ValvixLogo";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_CONFIG, SupportedCurrency } from "@/lib/utils";
import {
  Sparkles,
  RefreshCw,
  LayoutGrid,
  Layers,
  Users2,
  ChevronDown,
  ExternalLink,
  Unplug,
  User,
  Check,
  Search,
  Globe,
} from "lucide-react";

export type ModuleType = "overview" | "backlog" | "coop" | "persona";

interface NavbarProps {
  currentProfile: UserProfile;
  onSelectProfile: (profile: UserProfile, games?: SteamGame[]) => void;
  activeModule: ModuleType;
  onChangeModule: (module: ModuleType) => void;
  unplayedCount?: number;
  onManualSync?: () => void;
  isSyncingExternal?: boolean;
  onLogout?: () => void;
}

export function Navbar({
  currentProfile,
  onSelectProfile,
  activeModule,
  onChangeModule,
  unplayedCount = 2,
  onManualSync,
  isSyncingExternal = false,
  onLogout,
}: NavbarProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [friendsList, setFriendsList] = useState<SteamFriendItem[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<UserProfile[]>([]);
  const { currency, setCurrency } = useCurrency();

  const isSyncing = isSyncingExternal || switchingId !== null;

  // Load friends and recent accounts when opening profile switcher
  useEffect(() => {
    if (isSwitcherOpen) {
      setRecentProfiles(getStoredRecentProfiles());
      if (currentProfile?.steamId64) {
        fetchUserFriends(currentProfile.steamId64).then((friends) => {
          if (friends && friends.length > 0) {
            setFriendsList(friends.slice(0, 5));
          }
        });
      }
    }
  }, [isSwitcherOpen, currentProfile?.steamId64]);

  const navLinks = [
    { id: "overview" as ModuleType, label: "Overview", icon: LayoutGrid },
    {
      id: "backlog" as ModuleType,
      label: "Backlog Picker",
      icon: Layers,
      count: unplayedCount,
    },
    { id: "coop" as ModuleType, label: "Co-op Matcher", icon: Users2 },
    { id: "persona" as ModuleType, label: "AI Persona", icon: Sparkles },
  ];

  const handleManualSync = () => {
    if (onManualSync) {
      onManualSync();
    }
  };

  // Direct switch handler for any profile or friend
  const handleDirectSwitch = async (identifier: string) => {
    if (!identifier.trim()) return;
    setSwitchingId(identifier);
    setSwitchError(null);

    try {
      const syncResult = await syncUserProfile(identifier.trim());
      if (syncResult && syncResult.profile) {
        addStoredRecentProfile(syncResult.profile);
        onSelectProfile(syncResult.profile, syncResult.games);
        setCustomInput("");
        setIsSwitcherOpen(false);
      } else {
        throw new Error("Invalid profile response");
      }
    } catch (err: any) {
      console.warn("Failed to switch profile:", err);
      setSwitchError("Could not switch profile. Ensure the profile exists and is set to Public.");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleDirectSwitch(customInput);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-9 h-9 bg-surface border border-border-focus rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <ValvixMark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-lg tracking-tight text-text-primary">
                Valvix
              </span>
              <Badge variant="emerald" className="text-[10px] py-0 px-2 hidden xs:inline-flex">
                Steam Hub
              </Badge>
            </div>
            <p className="text-[11px] text-text-secondary hidden sm:block truncate">
              Game Library & Squad Lounge
            </p>
          </div>
        </div>

        {/* Center Pill Navigation */}
        <nav className="hidden md:flex items-center bg-surface border border-border p-1 rounded-2xl gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeModule === link.id;

            return (
              <button
                key={link.id}
                onClick={() => onChangeModule(link.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-surface-elevated text-text-primary shadow-sm border border-border"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-signal-emerald" : "text-text-secondary"
                  }`}
                />
                <span>{link.label}</span>
                {link.count !== undefined && link.count > 0 && (
                  <span className="px-1.5 py-0.2 bg-signal-orange/20 text-signal-orange text-[10px] font-mono rounded-full font-semibold">
                    {link.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Currency Selector, Sync Button & Steam Avatar Pill */}
        <div className="flex items-center gap-2 relative">
          {/* Currency Selector */}
          <div className="relative flex items-center bg-surface border border-border hover:border-border-focus rounded-xl px-2 py-1.5 transition-colors">
            <Globe className="w-3.5 h-3.5 text-text-secondary shrink-0 mr-1 hidden sm:block" />
            <select
              aria-label="Select display currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
              className="bg-transparent text-xs font-mono font-semibold text-text-primary outline-none cursor-pointer pr-1"
            >
              {(Object.keys(CURRENCY_CONFIG) as SupportedCurrency[]).map((code) => (
                <option key={code} value={code} className="bg-surface text-text-primary">
                  {code}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="rounded-xl border-border hover:bg-surface-elevated text-xs gap-1.5"
            title="Refresh Steam Library"
          >
            {isSyncing ? (
              <LoadingSpinner size="sm" variant="emerald" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-text-secondary" />
            )}
            <span className="hidden sm:inline">Sync Library</span>
          </Button>

          {/* Steam User Pill */}
          <button
            onClick={() => {
              setIsSwitcherOpen(!isSwitcherOpen);
              setSwitchError(null);
            }}
            className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border hover:border-border-focus rounded-full transition-all text-left"
          >
            <div className="relative">
              <GamerAvatar
                src={currentProfile.avatarUrl}
                alt={currentProfile.personaName}
                className="w-7 h-7"
              />
              <span
                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#0F1115] ${
                  currentProfile.status === "in-game"
                    ? "bg-signal-emerald"
                    : "bg-signal-blue"
                }`}
              />
            </div>
            <div className="hidden sm:flex flex-col text-left min-w-0">
              <span className="text-xs font-semibold text-text-primary leading-tight max-w-[120px] truncate">
                {currentProfile.personaName}
              </span>
              <span className="text-[10px] text-text-secondary max-w-[120px] truncate">
                {currentProfile.currentlyPlaying
                  ? currentProfile.currentlyPlaying
                  : "Online"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-text-secondary shrink-0" />
          </button>

          {/* Profile Switcher Popover */}
          {isSwitcherOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSwitcherOpen(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-[min(21rem,calc(100vw-2rem))] bg-surface border border-border-focus rounded-2xl p-4 shadow-2xl space-y-3.5">
                {/* Active Profile Info */}
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <GamerAvatar
                    src={currentProfile.avatarUrl}
                    alt={currentProfile.personaName}
                    className="w-10 h-10 border border-signal-emerald/40"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-heading font-bold text-text-primary truncate">
                      {currentProfile.personaName}
                    </div>
                    <div className="text-[11px] text-text-secondary font-mono truncate">
                      {currentProfile.steamId64}
                    </div>
                  </div>
                  <Badge variant="emerald" className="text-[9px] py-0 px-2 shrink-0">
                    Active
                  </Badge>
                </div>

                {/* Quick Profile Actions */}
                <div className="space-y-1">
                  <a
                    href={currentProfile.profileUrl || `https://steamcommunity.com/profiles/${currentProfile.steamId64}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-signal-blue" />
                      <span>Steam Community Profile</span>
                    </span>
                    <ExternalLink className="w-3 h-3 text-text-dim" />
                  </a>

                  <button
                    onClick={() => {
                      setIsSwitcherOpen(false);
                      handleManualSync();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      {isSyncing ? (
                        <LoadingSpinner size="sm" variant="emerald" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-signal-emerald" />
                      )}
                      <span>Refresh & Sync Library</span>
                    </span>
                  </button>
                </div>

                {/* Recent Accounts */}
                {recentProfiles.filter((p) => p.steamId64 !== currentProfile.steamId64).length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-text-secondary font-semibold block px-1">
                      Recent Accounts
                    </span>
                    <div className="space-y-1">
                      {recentProfiles
                        .filter((p) => p.steamId64 !== currentProfile.steamId64)
                        .map((recent) => (
                          <button
                            key={recent.steamId64}
                            onClick={() => handleDirectSwitch(recent.steamId64)}
                            disabled={isSyncing}
                            className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-canvas transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GamerAvatar
                                src={recent.avatarUrl}
                                alt={recent.personaName}
                                className="w-6 h-6 shrink-0"
                              />
                              <span className="truncate text-text-primary font-medium">
                                {recent.personaName}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-signal-emerald font-semibold">
                              Switch
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Quick Switch from Steam Friends */}
                {friendsList.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <span className="text-[10px] font-mono uppercase text-text-secondary font-semibold block px-1">
                      Quick Switch (Steam Friends)
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {friendsList.map((friend) => {
                        const isCurrent = friend.steamId64 === currentProfile.steamId64;
                        const isThisSwitching = switchingId === friend.steamId64;

                        return (
                          <button
                            key={friend.steamId64}
                            onClick={() => !isCurrent && handleDirectSwitch(friend.steamId64)}
                            disabled={isCurrent || isSyncing}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors text-left ${
                              isCurrent
                                ? "bg-surface-elevated/70 cursor-default"
                                : "hover:bg-canvas cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GamerAvatar
                                src={friend.avatarUrl}
                                alt={friend.personaName}
                                className="w-6 h-6 shrink-0"
                              />
                              <span className="truncate text-text-primary font-medium text-xs">
                                {friend.personaName}
                              </span>
                            </div>

                            {isCurrent ? (
                              <Check className="w-3.5 h-3.5 text-signal-emerald shrink-0" />
                            ) : isThisSwitching ? (
                              <LoadingSpinner size="sm" variant="emerald" className="shrink-0" />
                            ) : (
                              <span className="text-[10px] font-mono text-signal-emerald font-semibold hover:underline shrink-0">
                                Switch
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Switch Account via SteamID / Profile URL */}
                <form
                  onSubmit={handleCustomSubmit}
                  className="pt-2.5 border-t border-border space-y-2"
                >
                  <label className="text-[10px] text-text-secondary block font-medium px-1">
                    Switch to another Steam ID or Profile URL:
                  </label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-text-dim absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="SteamID64 or Profile URL"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        className="w-full bg-canvas border border-border focus:border-signal-emerald pl-8 pr-2.5 py-1.5 text-xs text-text-primary rounded-xl outline-none placeholder:text-text-dim font-mono"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSyncing || !customInput.trim()}
                      className="rounded-xl px-3 text-xs gap-1.5 shrink-0"
                    >
                      {switchingId === customInput ? (
                        <>
                          <LoadingSpinner size="xs" variant="dark" />
                          <span>Switching...</span>
                        </>
                      ) : (
                        <span>Switch</span>
                      )}
                    </Button>
                  </div>

                  {switchError && (
                    <p className="text-[11px] text-signal-orange px-1 leading-snug">
                      {switchError}
                    </p>
                  )}
                </form>

                {/* Disconnect Profile Button */}
                {onLogout && (
                  <div className="pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        setIsSwitcherOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs text-signal-orange hover:bg-signal-orange/10 transition-colors font-medium"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                      <span>Disconnect Profile</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden grid grid-cols-4 gap-1 border-t border-border bg-surface-subtle/95 px-2 py-1.5">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = activeModule === link.id;

          return (
            <button
              key={link.id}
              onClick={() => onChangeModule(link.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[10px] font-medium transition-colors min-w-0 ${
                isActive
                  ? "bg-surface-elevated text-signal-emerald font-semibold border border-border"
                  : "text-text-secondary hover:text-text-primary border border-transparent"
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {link.count !== undefined && link.count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[14px] h-[14px] flex items-center justify-center bg-signal-orange text-[#0A0C10] text-[9px] font-mono rounded-full font-bold leading-none">
                    {link.count > 99 ? "99+" : link.count}
                  </span>
                )}
              </div>
              <span className="truncate max-w-full leading-tight">{link.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
