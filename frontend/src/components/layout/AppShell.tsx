import { useState, useEffect } from "react";
import { UserProfile, SteamGame } from "@/types/steam";
import { Navbar, ModuleType } from "@/components/common/Navbar";
import { OverviewBento } from "@/components/dashboard/OverviewBento";
import { BacklogPickerView } from "@/components/backlog/BacklogPickerView";
import { CoopMatcherView } from "@/components/squad/CoopMatcherView";
import { AiPersonaView } from "@/components/persona/AiPersonaView";
import { GameAchievementDrawer } from "@/components/common/GameAchievementDrawer";
import { ShareShowcaseModal } from "@/components/common/ShareShowcaseModal";
import { SteamLoginView } from "@/components/auth/SteamLoginView";
import { ValvixMark } from "@/components/common/ValvixLogo";
import {
  getStoredAuthUser,
  setStoredAuthUser,
  getStoredUserGames,
  syncUserProfile,
  fetchUserGames,
} from "@/services/api";

export function AppShell() {
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(getStoredAuthUser);
  const [activeModule, setActiveModule] = useState<ModuleType>("overview");
  const [selectedDrawerGame, setSelectedDrawerGame] = useState<SteamGame | null>(null);
  const [isShareShowcaseOpen, setIsShareShowcaseOpen] = useState<boolean>(false);
  const [games, setGames] = useState<SteamGame[]>(() => {
    const user = getStoredAuthUser();
    return user ? getStoredUserGames(user.steamId64) : [];
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Check URL parameters for return from Steam OpenID login (?steamId=...&auth=success)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamIdParam = params.get("steamId");
    if (steamIdParam) {
      setIsSyncing(true);
      syncUserProfile(steamIdParam).then((res) => {
        if (res && res.profile) {
          setCurrentProfile(res.profile);
          setStoredAuthUser(res.profile);
          if (res.games && res.games.length > 0) {
            setGames(res.games);
          }
        }
        setIsSyncing(false);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, []);

  // Sync / refresh library games when profile changes
  useEffect(() => {
    if (!currentProfile) return;
    setStoredAuthUser(currentProfile);

    let isMounted = true;
    fetchUserGames(currentProfile.steamId64).then((loadedGames) => {
      if (isMounted && loadedGames && loadedGames.length > 0) {
        setGames(loadedGames);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentProfile?.steamId64]);

  const handleProfileChange = (profile: UserProfile, newGames?: SteamGame[]) => {
    setCurrentProfile(profile);
    setStoredAuthUser(profile);
    if (newGames && newGames.length > 0) {
      setGames(newGames);
    }
  };

  const handleManualSync = async () => {
    if (!currentProfile) return;
    setIsSyncing(true);
    try {
      const syncResult = await syncUserProfile(currentProfile.vanityUrl || currentProfile.steamId64);
      if (syncResult) {
        if (syncResult.profile) setCurrentProfile(syncResult.profile);
        if (syncResult.games && syncResult.games.length > 0) setGames(syncResult.games);
      }
    } catch (err) {
      console.warn("Manual sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    setStoredAuthUser(null);
    setCurrentProfile(null);
    setGames([]);
  };

  // If not logged in, display Steam Login Gate
  if (!currentProfile) {
    return (
      <SteamLoginView
        onLoginSuccess={(profile) => {
          setCurrentProfile(profile);
          setStoredAuthUser(profile);
        }}
      />
    );
  }

  const activeUser = currentProfile;
  const unplayedGames = games.filter((g) => g.playtimeForever === 0);

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col font-sans selection:bg-signal-emerald/20 selection:text-signal-emerald relative overflow-x-hidden">
      {/* Subtle Top Ambient Atmosphere */}
      <div className="fixed inset-0 bg-subtle-glow pointer-events-none z-0" />

      {/* 1. Clean Navigation Bar */}
      <Navbar
        currentProfile={activeUser}
        onSelectProfile={handleProfileChange}
        activeModule={activeModule}
        onChangeModule={setActiveModule}
        unplayedCount={unplayedGames.length}
        onManualSync={handleManualSync}
        isSyncingExternal={isSyncing}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 relative z-10 min-w-0">
        {/* Module 1: Overview */}
        {activeModule === "overview" && (
          <OverviewBento
            currentProfile={activeUser}
            onNavigate={(mod) => setActiveModule(mod)}
            onSelectGame={(game) => setSelectedDrawerGame(game)}
            onOpenShareShowcase={() => setIsShareShowcaseOpen(true)}
            userGames={games}
          />
        )}

        {/* Module 2: Full Backlog Picker View */}
        {activeModule === "backlog" && (
          <BacklogPickerView
            currentProfile={activeUser}
            onSelectGame={(game) => setSelectedDrawerGame(game)}
            onOpenShareShowcase={() => setIsShareShowcaseOpen(true)}
            userGames={games}
          />
        )}

        {/* Module 3: Full Co-op Matcher & Squad Roulette */}
        {activeModule === "coop" && (
          <CoopMatcherView
            currentProfile={activeUser}
            onSelectGame={(game) => setSelectedDrawerGame(game)}
            userGames={games}
          />
        )}

        {/* Module 4: Full AI Persona & Passport View */}
        {activeModule === "persona" && (
          <AiPersonaView currentProfile={activeUser} userGames={games} />
        )}
      </main>

      {/* Global Interactive Drawer for App-wide game selection */}
      <GameAchievementDrawer
        game={selectedDrawerGame}
        steamId64={activeUser.steamId64}
        onClose={() => setSelectedDrawerGame(null)}
        onNavigateToCoop={() => setActiveModule("coop")}
      />

      {/* Global Share Showcase Modal (Rendered outside <main> at z-[100] above navbar) */}
      <ShareShowcaseModal
        isOpen={isShareShowcaseOpen}
        onClose={() => setIsShareShowcaseOpen(false)}
        currentProfile={activeUser}
        games={games}
      />

      {/* 3. Clean Footer */}
      <footer className="w-full border-t border-border bg-surface-subtle py-4 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-secondary text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <ValvixMark className="w-3.5 h-3.5 shrink-0" />
            <span className="font-heading font-bold text-text-primary">Valvix</span>
            <span className="text-text-dim">—</span>
            <span>Built for PC gamers who buy more games than they finish.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-text-dim text-[11px] font-mono">
            <span>Multi-Currency Store Valuation</span>
            <span>•</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
