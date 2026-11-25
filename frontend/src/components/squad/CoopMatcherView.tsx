import { useState, useMemo, useEffect, useRef } from "react";
import {
  UserProfile,
  SteamGame,
  SquadMember,
} from "@/types/steam";
import { fetchCoopIntersection, fetchUserFriends } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GamerAvatar } from "@/components/common/GamerAvatar";
import { GameCard } from "@/components/common/GameCard";
import { LoadingState } from "@/components/common/LoadingSpinner";
import { formatHours, handlePosterError } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users2,
  Play,
  RotateCcw,
  Crosshair,
  Gamepad2,
  Tv,
  Check,
  Shield,
  Crown,
  Trophy,
  Filter,
  Search,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CoopMatcherViewProps {
  currentProfile: UserProfile;
  onSelectGame: (game: SteamGame) => void;
  userGames?: SteamGame[];
}

export type MultiplayerFilter =
  | "all"
  | "online_coop"
  | "split_screen"
  | "pve"
  | "controller";

export function CoopMatcherView({
  currentProfile,
  onSelectGame,
  userGames,
}: CoopMatcherViewProps) {
  const { formatPrice } = useCurrency();
  const games = userGames && userGames.length > 0 ? userGames : [];

  // Squad Lobby State: load real Steam friends from backend
  const [friends, setFriends] = useState<SquadMember[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState<boolean>(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isLoadingIntersection, setIsLoadingIntersection] = useState<boolean>(false);

  const [activeFilter, setActiveFilter] = useState<MultiplayerFilter>("all");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const INITIAL_FRIEND_LIMIT = 11;
  const [visibleFriendLimit, setVisibleFriendLimit] = useState(INITIAL_FRIEND_LIMIT);
  const [liveIntersected, setLiveIntersected] = useState<SteamGame[] | null>(null);

  // Fetch real Steam friends for the logged-in user
  useEffect(() => {
    let isMounted = true;
    if (currentProfile?.steamId64) {
      setIsLoadingFriends(true);
      fetchUserFriends(currentProfile.steamId64).then((res) => {
        if (isMounted) {
          if (res && res.length > 0) {
            const mapped: SquadMember[] = res.map((f) => ({
              steamId64: f.steamId64,
              personaName: f.personaName,
              avatarUrl: f.avatarUrl,
              status: f.status,
              currentlyPlaying: f.currentlyPlaying,
              ownedAppIds: [],
              playtimes: {},
            }));
            setFriends(mapped);

            // Default: select the first 1-2 friends who are in-game or online
            const activeFriends = mapped.filter(
              (m) => m.status === "in-game" || m.status === "online"
            );
            if (activeFriends.length > 0) {
              setSelectedFriendIds(activeFriends.slice(0, 2).map((m) => m.steamId64));
            } else if (mapped.length > 0) {
              setSelectedFriendIds([mapped[0].steamId64]);
            }
          }
          setIsLoadingFriends(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentProfile?.steamId64]);

  // Live backend intersection for selected squad
  useEffect(() => {
    let isMounted = true;
    const squadIds = [currentProfile.steamId64, ...selectedFriendIds];
    setIsLoadingIntersection(true);

    fetchCoopIntersection(squadIds, activeFilter).then((res) => {
      if (isMounted) {
        if (res) {
          if (res.intersectedGames) {
            setLiveIntersected(res.intersectedGames);
          }
          if (res.members && res.members.length > 0) {
            const memberMap = new Map(res.members.map((m) => [m.steamId64, m]));
            setFriends((prevFriends) =>
              prevFriends.map((f) => {
                const updated = memberMap.get(f.steamId64);
                if (updated) {
                  return {
                    ...f,
                    ownedAppIds: updated.ownedAppIds || f.ownedAppIds,
                    playtimes: updated.playtimes || f.playtimes,
                  };
                }
                return f;
              })
            );
          }
        }
        setIsLoadingIntersection(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentProfile.steamId64, selectedFriendIds, activeFilter]);

  // Roulette states
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [rouletteIndex, setRouletteIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerGame, setWinnerGame] = useState<SteamGame | null>(null);
  const rouletteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup roulette timer on unmount
  useEffect(() => {
    return () => {
      if (rouletteTimerRef.current) {
        clearTimeout(rouletteTimerRef.current);
      }
    };
  }, []);

  const closeRoulette = () => {
    if (rouletteTimerRef.current) {
      clearTimeout(rouletteTimerRef.current);
    }
    setIsSpinning(false);
    setIsRouletteOpen(false);
  };

  // Toggle friend in/out of the squad
  const toggleFriend = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Sort friends: selected friends first, then in-game, then online, then offline
  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const aSelected = selectedFriendIds.includes(a.steamId64);
      const bSelected = selectedFriendIds.includes(b.steamId64);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const statusWeight = (status?: string) =>
        status === "in-game" ? 3 : status === "online" ? 2 : 1;
      return statusWeight(b.status) - statusWeight(a.status);
    });
  }, [friends, selectedFriendIds]);

  // Search filter across Steam friends
  const filteredFriends = useMemo(() => {
    if (!friendSearchQuery.trim()) return sortedFriends;
    const q = friendSearchQuery.toLowerCase().trim();
    return sortedFriends.filter(
      (f) =>
        f.personaName.toLowerCase().includes(q) ||
        f.steamId64.includes(q) ||
        (f.currentlyPlaying && f.currentlyPlaying.toLowerCase().includes(q))
    );
  }, [sortedFriends, friendSearchQuery]);

  // Pagination for friends display
  const displayedFriends = useMemo(() => {
    if (friendSearchQuery.trim()) {
      return filteredFriends;
    }
    return filteredFriends.slice(0, visibleFriendLimit);
  }, [filteredFriends, friendSearchQuery, visibleFriendLimit]);

  // Compute exact intersection of games owned by Player 1 AND all selected friends
  const activeSquad = useMemo(() => {
    return friends.filter((f) => selectedFriendIds.includes(f.steamId64));
  }, [friends, selectedFriendIds]);

  const intersectedGames = useMemo(() => {
    if (liveIntersected !== null) {
      return liveIntersected;
    }
    return games.filter((g) => g.isMultiplayer || g.isCoop);
  }, [liveIntersected, games]);

  // Squad Roulette Spinning Logic
  const startRouletteSpin = () => {
    if (intersectedGames.length === 0) return;
    setIsRouletteOpen(true);
    setIsSpinning(true);
    setWinnerGame(null);

    let speed = 60; // ms per tick
    let currentIdx = 0;
    const totalTicks = 35 + Math.floor(Math.random() * 15);
    let ticks = 0;

    const runTick = () => {
      if (intersectedGames.length === 0) {
        setIsSpinning(false);
        return;
      }
      currentIdx = (currentIdx + 1) % intersectedGames.length;
      setRouletteIndex(currentIdx);
      ticks++;

      if (ticks < totalTicks) {
        // Exponential deceleration curve
        if (ticks > totalTicks - 15) {
          speed += 28;
        } else if (ticks > totalTicks - 8) {
          speed += 50;
        }
        rouletteTimerRef.current = setTimeout(runTick, speed);
      } else {
        // Landed on winner
        const winningGame = intersectedGames[currentIdx];
        setWinnerGame(winningGame);
        setIsSpinning(false);
      }
    };

    rouletteTimerRef.current = setTimeout(runTick, speed);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Quick Action */}
      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="blue" className="gap-1">
              <Users2 className="w-3 h-3" />
              <span>Squad Game-Night Lounge</span>
            </Badge>
            <span className="text-xs text-text-secondary font-medium">
              {activeSquad.length + 1} Players in Squad
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary tracking-tight">
            Co-op Library Intersector
          </h1>
          <p className="text-xs text-text-secondary max-w-xl">
            Select friends to find games you all own together. Never waste 30 minutes asking "What should we play tonight?" again.
          </p>
        </div>

        {/* Spin Squad Roulette Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={startRouletteSpin}
            disabled={intersectedGames.length === 0}
            className="rounded-xl gap-2 font-semibold text-xs px-5 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Spin Squad Roulette</span>
          </Button>
        </div>
      </div>

      {/* 2. Squad Lobby Selector (Top Panel) */}
      <div className="p-5 bg-surface border border-border rounded-2xl space-y-4 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-signal-blue" />
            <h3 className="text-sm font-heading font-bold text-text-primary">
              Squad Roster ({activeSquad.length + 1} Active)
            </h3>
            <span className="text-xs text-text-secondary font-mono hidden md:inline">
              • {friends.length} Friends
            </span>
          </div>

          {/* Search Friend Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
            <input
              type="text"
              placeholder="Search friends by name..."
              value={friendSearchQuery}
              onChange={(e) => setFriendSearchQuery(e.target.value)}
              className="w-full bg-canvas border border-border focus:border-signal-blue/60 pl-8 pr-7 py-1.5 text-xs text-text-primary rounded-xl outline-none placeholder:text-text-dim transition-colors"
            />
            {friendSearchQuery && (
              <button
                type="button"
                onClick={() => setFriendSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary transition-colors"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Squad Members Horizontal Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Player 1 (You / Leader - Always Locked) */}
          <div className="p-3 bg-canvas border border-signal-emerald/30 rounded-xl relative flex flex-col items-center text-center space-y-2">
            <span className="absolute top-2 right-2 text-signal-emerald" title="Squad Leader">
              <Crown className="w-3.5 h-3.5" />
            </span>

            <div className="relative">
              <GamerAvatar
                src={currentProfile.avatarUrl}
                alt={currentProfile.personaName}
                className="w-12 h-12 border border-signal-emerald/40 shadow-sm"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-signal-emerald border-2 border-canvas" />
            </div>

            <div className="space-y-0.5 w-full min-w-0">
              <div className="text-xs font-heading font-bold text-text-primary truncate w-full">
                {currentProfile.personaName}
              </div>
              <Badge variant="emerald" className="text-[9px] py-0 px-1.5">
                Leader (You)
              </Badge>
            </div>
          </div>

          {/* Friends Toggle Cards */}
          {isLoadingFriends ? (
            <div className="col-span-full py-2">
              <LoadingState
                variant="blue"
                size="md"
                message="Loading Steam friends..."
                subMessage="Querying player presence and avatars"
              />
            </div>
          ) : friends.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs text-text-secondary">
              No Steam friends found or friend list is private on Steam.
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs text-text-secondary">
              No friends found matching "{friendSearchQuery}".
            </div>
          ) : (
            displayedFriends.map((friend) => {
              const isSelected = selectedFriendIds.includes(friend.steamId64);
              const isInGame = friend.status === "in-game";
              const isOnline = friend.status === "online";

              return (
                <button
                  key={friend.steamId64}
                  onClick={() => toggleFriend(friend.steamId64)}
                  className={`p-3 rounded-xl border transition-all flex flex-col items-center text-center space-y-2 cursor-pointer relative group ${
                    isSelected
                      ? "bg-canvas border-signal-blue/50 shadow-sm"
                      : "bg-surface hover:bg-canvas border-border/60 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="absolute top-2 right-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-signal-blue text-canvas"
                          : "border border-border text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  </div>

                  <div className="relative">
                    <GamerAvatar
                      src={friend.avatarUrl}
                      alt={friend.personaName}
                      className={`w-12 h-12 border transition-all ${
                        isSelected ? "border-signal-blue" : "border-border opacity-70"
                      }`}
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-canvas ${
                        isInGame ? "bg-signal-purple" : (isOnline ? "bg-signal-emerald" : "bg-text-dim/60")
                      }`}
                    />
                  </div>

                  <div className="space-y-0.5 w-full min-w-0">
                    <div className="text-xs font-heading font-bold text-text-primary truncate w-full">
                      {friend.personaName}
                    </div>
                    <span
                      className={`text-[10px] font-medium block truncate w-full ${
                        isInGame
                          ? "text-signal-purple"
                          : isOnline
                          ? "text-signal-emerald"
                          : "text-text-dim"
                      }`}
                    >
                      {isInGame
                        ? friend.currentlyPlaying
                          ? `Playing ${friend.currentlyPlaying}`
                          : "In-Game"
                        : isOnline
                        ? "Online"
                        : "Offline"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Load More Pagination Strip */}
        {!friendSearchQuery && filteredFriends.length > INITIAL_FRIEND_LIMIT && (
          <div className="flex items-center justify-center pt-3 border-t border-border/60">
            {visibleFriendLimit < filteredFriends.length ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVisibleFriendLimit((prev) => prev + 12)}
                className="rounded-xl px-5 text-xs font-semibold gap-2 border-border hover:border-signal-blue/40 shadow-sm"
              >
                <ChevronDown className="w-3.5 h-3.5 text-signal-blue" />
                <span>
                  Load More Friends ({filteredFriends.length - visibleFriendLimit} remaining)
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleFriendLimit(INITIAL_FRIEND_LIMIT)}
                className="rounded-xl px-5 text-xs font-semibold gap-2 text-text-secondary hover:text-text-primary"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Less</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 3. Multiplayer Mode Filter Pills (Sleek Modern Segmented Track) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1.5 p-1.5 bg-surface/50 rounded-2xl border border-white/[0.05] overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === "all"
                ? "bg-surface-elevated text-text-primary border border-white/[0.10] shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-signal-blue" />
            <span>All Shared Games ({intersectedGames.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter("online_coop")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === "online_coop"
                ? "bg-signal-blue/15 text-signal-blue border border-signal-blue/30 shadow-sm"
                : "text-text-secondary hover:text-signal-blue hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <Users2 className="w-3.5 h-3.5 text-signal-blue" />
            <span>Online Co-op</span>
          </button>

          <button
            onClick={() => setActiveFilter("split_screen")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === "split_screen"
                ? "bg-signal-emerald/15 text-signal-emerald border border-signal-emerald/30 shadow-sm"
                : "text-text-secondary hover:text-signal-emerald hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-signal-emerald" />
            <span>Local / Split-Screen</span>
          </button>

          <button
            onClick={() => setActiveFilter("controller")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === "controller"
                ? "bg-surface-elevated text-text-primary border border-white/[0.10] shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-text-secondary" />
            <span>Full Controller Support</span>
          </button>
        </div>

        <div className="text-xs text-text-secondary font-mono">
          <span>Match: </span>
          <strong className="text-signal-emerald font-semibold">
            {intersectedGames.length} Available Titles
          </strong>
        </div>
      </div>

      {/* 4. Shared Library Grid */}
      {isLoadingIntersection ? (
        <div className="p-8 text-center bg-surface border border-border rounded-2xl">
          <LoadingState
            variant="blue"
            size="lg"
            message="Comparing squad libraries in real-time..."
            subMessage="Calculating common multiplayer titles across all active squad members"
          />
        </div>
      ) : intersectedGames.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border rounded-2xl space-y-3">
          <Filter className="w-8 h-8 text-text-dim mx-auto" />
          <h3 className="text-base font-heading font-bold text-text-primary">
            No common games found across this squad selection
          </h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Try deselecting one of the squad members or removing restrictive filter tags to discover shared multiplayer titles.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {intersectedGames.map((game) => {
            const squadMeta = (
              <div className="space-y-1 text-[10px] font-mono text-text-secondary bg-canvas/80 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-text-primary font-semibold">You:</span>
                  <span className="text-signal-emerald font-bold">
                    {formatHours(game.playtimeForever)}
                  </span>
                </div>

                {activeSquad.slice(0, 3).map((friend) => {
                  const friendMinutes = friend.playtimes?.[game.appId] || 0;

                  return (
                    <div
                      key={friend.steamId64}
                      className="flex items-center justify-between gap-2 min-w-0"
                    >
                      <span className="truncate flex-1 min-w-0">
                        {friend.personaName}:
                      </span>
                      <span className={`shrink-0 ${friendMinutes === 0 ? "text-signal-orange" : "text-text-primary"}`}>
                        {formatHours(friendMinutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );

            return (
              <GameCard
                key={game.appId}
                game={game}
                onClick={() => onSelectGame(game)}
                topBadge={{
                  label: activeSquad.length > 0 ? `${activeSquad.length + 1} All Own` : "Co-op Ready",
                  variant: "blue",
                  icon: <Users2 className="w-3 h-3 text-signal-blue" />,
                }}
                bottomPill={game.playtimeForever > 0 ? formatHours(game.playtimeForever) : "Untouched (0h)"}
                secondaryMeta={squadMeta}
              />
            );
          })}
        </div>
      )}

      {/* 5. Mechanical Squad Roulette Modal */}
      <AnimatePresence>
        {isRouletteOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0D0F14]/85 backdrop-blur-md"
              onClick={() => {
                if (!isSpinning) closeRoulette();
              }}
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 text-center space-y-6"
            >
              {/* Header Title */}
              <div className="space-y-1">
                <Badge variant="blue" className="px-3 py-1 text-xs mx-auto gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Squad Game Selector</span>
                </Badge>
                <h2 className="text-2xl font-heading font-extrabold text-text-primary tracking-tight">
                  {isSpinning ? "Spinning Squad Roulette..." : "Game Selected!"}
                </h2>
                <p className="text-xs text-text-secondary">
                  {isSpinning
                    ? "Cycling through your shared multiplayer library..."
                    : `Landed on the perfect match for all ${activeSquad.length + 1} players.`}
                </p>
              </div>

              {/* Roulette Visual Reel Card */}
              <div className="relative mx-auto w-48 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-canvas">
                {intersectedGames.length > 0 && (
                  <motion.img
                    key={intersectedGames[rouletteIndex]?.appId}
                    src={intersectedGames[rouletteIndex]?.posterImage}
                    alt={intersectedGames[rouletteIndex]?.name}
                    onError={(e) => handlePosterError(e, intersectedGames[rouletteIndex]?.headerImage)}
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Celebratory Winner Glow Overlay */}
                {winnerGame && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-gradient-to-t from-signal-blue/40 via-transparent to-transparent flex flex-col justify-end p-3"
                  >
                    <span className="text-xs font-heading font-extrabold text-white bg-signal-blue/90 px-3 py-1 rounded-full shadow-lg mx-auto">
                      Tonight's Game!
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Winner Name Details */}
              <div className="space-y-1 min-w-0">
                <h3 className="text-xl font-heading font-extrabold text-text-primary line-clamp-2 break-words">
                  {winnerGame
                    ? winnerGame.name
                    : intersectedGames[rouletteIndex]?.name}
                </h3>
                <p className="text-xs text-text-secondary font-mono truncate">
                  {winnerGame
                    ? `${(winnerGame.genres || []).slice(0, 3).join(" • ")} • ${formatPrice(
                        winnerGame.priceInitialIDR
                      )}`
                    : "Rolling..."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {winnerGame ? (
                  <>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setIsRouletteOpen(false);
                        onSelectGame(winnerGame);
                      }}
                      className="w-full sm:w-auto px-6 rounded-xl font-semibold text-xs gap-2"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>View Achievements</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="md"
                      onClick={startRouletteSpin}
                      className="w-full sm:w-auto px-5 rounded-xl text-xs gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Spin Again</span>
                    </Button>
                  </>
                ) : (
                  <div className="text-xs font-mono text-signal-blue animate-pulse">
                    Decelerating wheel...
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
