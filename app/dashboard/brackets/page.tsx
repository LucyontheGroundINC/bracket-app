'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

// ------------------ Types ------------------
type Match = {
  id: string;
  region: string | null;
  round: number;
  match_order: number;
  team1_name: string;
  team2_name: string;
  team1_seed: number | null;
  team2_seed: number | null;
  winner: 'team1' | 'team2' | null;
};

type PicksMap = Record<string, 'team1' | 'team2' | null>;

type TournamentLockState = {
  id: number;
  name: string;
  isLockedManual: boolean | null;
  lockAt: string | null; // ISO string from /api/tournaments
};

type DisplayTeams = {
  team1Name: string | null;
  team1Seed: number | null;
  team2Name: string | null;
  team2Seed: number | null;
};

type WinnerDisplay = {
  name: string;
  seed: number | null;
};

type PickRow = {
  match_id: string | number;
  chosen_winner: 'team1' | 'team2' | null;
};

type BracketViewMode = 'guided' | 'full';

// ------------------ Config ------------------
const ADMIN_EMAIL = 'lucyonthegroundwithrocks@gmail.com';

const roundLabels: Record<number, string> = {
  1: 'Round 1',
  2: 'Round 2',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
};

// Per-round vertical connector styles
const VERTICAL_CONNECTOR_STYLES: Record<number, string> = {
  1: 'absolute top-[-170px] bottom-[49px] w-[3px] rounded-full bg-[#A7C4E7]/55 pointer-events-none',
  2: 'absolute top-[-398px] bottom-[50px] w-[3px] rounded-full bg-[#A7C4E7]/55 pointer-events-none',
  3: 'absolute top-[-854px] bottom-[50px] w-[3px] rounded-full bg-[#A7C4E7]/55 pointer-events-none',
  4: 'absolute top-[-200px] bottom-[-198px] w-[3px] rounded-full bg-[#A7C4E7]/55 pointer-events-none',
};

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Unknown error';
}

// ------------------ Component ------------------
export default function BracketPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingWinnerId, setSavingWinnerId] = useState<string | null>(null);
  const [savingPickId, setSavingPickId] = useState<string | null>(null);
  const [recentlySavedMatchId, setRecentlySavedMatchId] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  // This is the user whose picks we're currently showing (owner or shared user)
  const [userId, setUserId] = useState<string | null>(null);

  // Are we viewing someone else's bracket via ?u=<userId>?
  const [isReadOnlyView, setIsReadOnlyView] = useState(false);

  const isAdmin = userEmail === ADMIN_EMAIL;
  const winnerMode: 'user' | 'admin' = isAdmin ? 'admin' : 'user';

  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<BracketViewMode>('guided');

  const MOBILE_REGIONS = ['East', 'West', 'South', 'Midwest', 'Final Four'] as const;
  type MobileRegion = (typeof MOBILE_REGIONS)[number];

  const [mobileRegion, setMobileRegion] = useState<MobileRegion>('East');
  const [mobileRound, setMobileRound] = useState<number>(1);

  const [picks, setPicks] = useState<PicksMap>({});

  // Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  // ------------------ Detect mobile + default view mode ------------------
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      setViewMode(mobile ? 'guided' : 'full');
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ------------------ Load Data ------------------
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // Current auth user
        const { data: auth, error: userError } = await supabase.auth.getUser();
        if (userError) console.error('Error loading user:', userError.message);

        const authUser = auth.user ?? null;
        if (!mounted) return;

        setUserEmail(authUser?.email ?? null);

        // Read ?u=<userId> from the URL (shared view)
        let viewUserId: string | null = null;
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          viewUserId = params.get('u');
        }

        // This is the user whose picks we will load (target bracket owner)
        const targetUserId = viewUserId || authUser?.id || null;
        setUserId(targetUserId);

        // If a viewUserId is present and it does NOT match the logged-in user,
        // treat this as a read-only shared view
        const readOnly = !!viewUserId && (!authUser || viewUserId !== authUser.id);
        setIsReadOnlyView(readOnly);

        // Matches
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .order('region', { ascending: true })
          .order('round', { ascending: true })
          .order('match_order', { ascending: true });

        if (matchError) {
          console.error('Error loading matches:', matchError.message);
        }

        const matchRows = (Array.isArray(matchData) ? matchData : []) as unknown as Match[];
        setMatches(matchRows);

        // Picks for the target user (owner or shared user)
        if (targetUserId) {
          const { data: picksData, error: picksError } = await supabase
            .from('picks')
            .select('match_id, chosen_winner')
            .eq('user_id', targetUserId);

          if (picksError) {
            console.error('Error loading picks:', picksError.message);
            setPicks({});
          } else {
            const rows = (Array.isArray(picksData) ? picksData : []) as unknown as PickRow[];
            const map: PicksMap = {};

            for (const p of rows) {
              const w = p?.chosen_winner ?? null;
              if (w === 'team1' || w === 'team2') {
                map[String(p.match_id)] = w;
              }
            }

            setPicks(map);
          }
        } else {
          setPicks({});
        }
      } catch (e: unknown) {
        console.error('[BracketPage] load failed:', errorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // ------------------ Load lock state from tournaments API ------------------
  useEffect(() => {
    const checkLock = async () => {
      try {
        const res = await fetch('/api/tournaments/active');
        if (!res.ok) return;

        const t = (await res.json()) as TournamentLockState;

        const now = new Date();
        const lockAtDate = t.lockAt ? new Date(t.lockAt) : null;

        let locked = false;
        let message: string;

        if (t.isLockedManual) {
          locked = true;
          message = 'Picks locked — changes can no longer be made.';
        } else if (lockAtDate) {
          const formatted = lockAtDate.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          if (lockAtDate <= now) {
            locked = true;
            message = `Picks locked as of ${formatted}.`;
          } else {
            locked = false;
            message = `Picks are open — lock time: ${formatted}.`;
          }
        } else {
          locked = false;
          message = 'Picks are open — lock time not set yet.';
        }

        setIsLocked(locked);
        setLockMessage(message);
      } catch (e: unknown) {
        console.error('Error checking lock state:', errorMessage(e));
      }
    };

    checkLock();
  }, []);

  // ------------------ Helpers ------------------
  function shouldShowVertical(round: number, index: number) {
    if (round === 1) return index % 2 === 1; // 1,3,5,7
    if (round === 2) return index % 2 === 1;
    if (round === 3) return index === 1;
    if (round === 4) return false;
    return false;
  }

  function shouldShowHorizontal(round: number, side: 'left' | 'right' | 'center') {
    if (side === 'center') return { left: false, right: false };

    if (round === 1) {
      return {
        left: side === 'right', // right side → connector goes LEFT
        right: side === 'left', // left side → connector goes RIGHT
      };
    }

    if (round === 2 || round === 3 || round === 4) return { left: true, right: true };

    return { left: false, right: false };
  }

  // ------------------ Group matches by region & round ------------------
  const grouped = useMemo(() => {
    const map: Record<string, Record<number, Match[]>> = {};

    for (const m of matches) {
      const regionKey = m.region || 'Unknown';
      if (!map[regionKey]) map[regionKey] = {};
      if (!map[regionKey][m.round]) map[regionKey][m.round] = [];
      map[regionKey][m.round].push(m);
    }

    Object.values(map).forEach((roundMap) => {
      Object.values(roundMap).forEach((arr) => {
        arr.sort((a, b) => a.match_order - b.match_order);
      });
    });

    return map;
  }, [matches]);

  // ------------------ Mobile guided view ------------------
  const renderMobileBracket = () => {
    const regionKey = mobileRegion;
    const roundMatches =
      grouped[regionKey]?.[mobileRound]?.slice()?.sort((a, b) => a.match_order - b.match_order) ?? [];

    return (
      <div className="max-w-xl mx-auto">
        {/* Region tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {MOBILE_REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setMobileRegion(r)}
              className={[
                'shrink-0 px-4 py-2 rounded-full text-sm font-semibold border',
                mobileRegion === r
                  ? 'bg-[#0A2041] text-[#F8F5EE] border-[#0A2041]'
                  : 'bg-white/70 text-[#0A2041] border-[#F9DCD8]',
              ].join(' ')}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Round chips */}
        <div className="flex gap-2 overflow-x-auto py-3">
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setMobileRound(r)}
              className={[
                'shrink-0 px-3 py-1 rounded-full text-xs font-semibold border',
                mobileRound === r
                  ? 'bg-[#CA4C4C] text-[#F8F5EE] border-[#CA4C4C]'
                  : 'bg-white/70 text-[#0A2041] border-[#F9DCD8]',
              ].join(' ')}
            >
              {roundLabels[r] ?? `Round ${r}`}
            </button>
          ))}
        </div>

        {/* Matches list */}
        {roundMatches.length === 0 ? (
          <div className="bg-white/70 border border-[#F9DCD8] rounded-2xl p-4 text-sm text-[#0A2041]/70">
            No matches found for {regionKey} — {roundLabels[mobileRound] ?? `Round ${mobileRound}`}.
          </div>
        ) : (
          <div className="space-y-3">
            {roundMatches.map((m) => (
              <div key={m.id}>{renderMatchCard(m, { side: 'center', showVerticalConnector: false })}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ------------------ Bracket evaluation (auto-advance logic) ------------------
  const { getMatchDisplay, getMatchWinner } = (() => {
    const cache = new Map<string, DisplayTeams>();

    function getPickedOrOfficialWinnerKey(m: Match): 'team1' | 'team2' | null {
      // Admin view advances using official winners
      if (winnerMode === 'admin') return m.winner ?? null;

      // User view advances using that user's picks
      return (picks[m.id] as 'team1' | 'team2' | null) ?? null;
    }

    function getMatchDisplay(m: Match): DisplayTeams {
      const cached = cache.get(m.id);
      if (cached) return cached;

      // Final Four: always show DB values (manually populated slots)
      if ((m.region || '') === 'Final Four') {
        const base: DisplayTeams = {
          team1Name: m.team1_name || null,
          team1Seed: m.team1_seed,
          team2Name: m.team2_name || null,
          team2Seed: m.team2_seed,
        };
        cache.set(m.id, base);
        return base;
      }

      // Round 1: just use DB values
      if (m.round === 1) {
        const base: DisplayTeams = {
          team1Name: m.team1_name || null,
          team1Seed: m.team1_seed,
          team2Name: m.team2_name || null,
          team2Seed: m.team2_seed,
        };
        cache.set(m.id, base);
        return base;
      }

      const regionKey = m.region || 'Unknown';
      const regionRounds = grouped[regionKey] || {};
      const parentRound = m.round - 1;
      const parentMatches = regionRounds[parentRound] || [];

      // which two matches feed into this one
      const baseOrder = (m.match_order - 1) * 2 + 1;
      const parent1 = parentMatches.find((pm) => pm.match_order === baseOrder);
      const parent2 = parentMatches.find((pm) => pm.match_order === baseOrder + 1);

      const winner1 = parent1 ? getMatchWinner(parent1) : null;
      const winner2 = parent2 ? getMatchWinner(parent2) : null;

      const res: DisplayTeams = {
        team1Name: winner1?.name ?? null,
        team1Seed: winner1?.seed ?? null,
        team2Name: winner2?.name ?? null,
        team2Seed: winner2?.seed ?? null,
      };

      cache.set(m.id, res);
      return res;
    }

    function getMatchWinner(m: Match | undefined): WinnerDisplay | null {
      if (!m) return null;

      const display = getMatchDisplay(m);
      const key = getPickedOrOfficialWinnerKey(m);
      if (!key) return null;

      if (key === 'team1') {
        if (!display.team1Name) return null;
        return { name: display.team1Name, seed: display.team1Seed ?? null };
      } else {
        if (!display.team2Name) return null;
        return { name: display.team2Name, seed: display.team2Seed ?? null };
      }
    }

    return { getMatchDisplay, getMatchWinner };
  })();

  function getRegionChampion(region: string): WinnerDisplay | null {
    const regionRounds = grouped[region] || {};
    const round4Matches = regionRounds[4] || [];
    const finalMatch = round4Matches[0];
    if (!finalMatch) return null;
    return getMatchWinner(finalMatch);
  }

  function getSemiWinner(
    semi: Match | undefined,
    slot1: WinnerDisplay | null,
    slot2: WinnerDisplay | null
  ): WinnerDisplay | null {
    if (!semi || !slot1 || !slot2) return null;

    // Admin advances using official winner; users advance using their pick
    const key: 'team1' | 'team2' | null =
      winnerMode === 'admin' ? (semi.winner ?? null) : ((picks[semi.id] as 'team1' | 'team2' | null) ?? null);

    if (!key) return null;
    return key === 'team1' ? slot1 : slot2;
  }

  // ------------------ Handlers ------------------
  const handleSetWinner = async (matchId: string, winner: 'team1' | 'team2') => {
    if (!isAdmin) return;

    const current = matches.find((m) => m.id === matchId);
    if (!current) return;

    // Toggle behavior: click same winner again to clear it
    const nextWinner: 'team1' | 'team2' | null = current.winner === winner ? null : winner;

    try {
      setSavingWinnerId(matchId);

      const { error } = await supabase.from('matches').update({ winner: nextWinner }).eq('id', matchId);

      if (error) {
        console.error('Error setting winner:', error.message);
        return;
      }

      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, winner: nextWinner } : m)));
    } finally {
      setSavingWinnerId(null);
    }
  };

  const handlePick = async (matchId: string, winner: 'team1' | 'team2') => {
    if (isReadOnlyView) {
      alert('This is a shared read-only bracket. Log in to make your own picks.');
      return;
    }

    if (!userId) {
      alert('You must be logged in to make picks.');
      return;
    }

    if (isLocked) {
      alert('Picks are locked — you can no longer change your bracket.');
      return;
    }

    try {
      setSavingPickId(matchId);

      // Optimistic UI
      setPicks((prev) => ({ ...prev, [matchId]: winner }));

      const { error } = await supabase
        .from('picks')
        .upsert(
          { user_id: userId, match_id: matchId, chosen_winner: winner },
          { onConflict: 'user_id,match_id' }
        );

      if (error) {
        console.error('Error saving pick:', error.message);
        return;
      }

      // Show "Saved ✓" flash for this match
      setRecentlySavedMatchId(matchId);
      window.setTimeout(() => {
        setRecentlySavedMatchId((current) => (current === matchId ? null : current));
      }, 1000);
    } finally {
      setSavingPickId(null);
    }
  };

  const handleShareBracket = async () => {
    if (!userId || typeof window === 'undefined') return;

    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}?u=${userId}`;

    try {
      await navigator.clipboard.writeText(url);
      alert('Share link copied to clipboard!');
    } catch {
      window.prompt('Copy this link to share your bracket:', url);
    }
  };

  // ------------------ Match Card (Lucy aesthetic + connectors) ------------------
  const renderMatchCard = (
    m: Match,
    opts?: {
      side?: 'left' | 'right' | 'center';
      isLastRound?: boolean;
      showVerticalConnector?: boolean;
      overrideTeams?: DisplayTeams | null;
    }
  ) => {
    const side = opts?.side ?? 'left';
    const showVerticalConnector = opts?.showVerticalConnector ?? false;

    const baseTeams =
      opts?.overrideTeams ??
      (m.region === 'Final Four'
        ? {
            team1Name: m.team1_name || null,
            team1Seed: m.team1_seed,
            team2Name: m.team2_name || null,
            team2Seed: m.team2_seed,
          }
        : getMatchDisplay(m));

    const displayTeam1Name = baseTeams.team1Name;
    const displayTeam1Seed = baseTeams.team1Seed;
    const displayTeam2Name = baseTeams.team2Name;
    const displayTeam2Seed = baseTeams.team2Seed;

    const hasBothTeams = !!(displayTeam1Name && displayTeam2Name);

    // User pick state (only relevant for normal users / shared views)
    const userPick = picks[m.id] || null;
    const isDecided = m.winner !== null;
    const isCorrect = isDecided && userPick === m.winner;
    const isWrong = isDecided && userPick !== null && userPick !== m.winner;

    const justSaved = recentlySavedMatchId === m.id;

    const adminWinnerMode = isAdmin;
    const canAdminSetWinner = adminWinnerMode && savingWinnerId !== m.id && hasBothTeams;

    const baseCanPick = !!userId && savingPickId !== m.id && !isLocked && !isReadOnlyView;
    const canPick = baseCanPick && hasBothTeams;

    const handleTeamClick = (team: 'team1' | 'team2') => {
      if (adminWinnerMode) return handleSetWinner(m.id, team);
      return handlePick(m.id, team);
    };

    // For admin: highlight based on official winner
    // For users: highlight based on their pick
    const isTeam1Selected = adminWinnerMode ? m.winner === 'team1' : userPick === 'team1';
    const isTeam2Selected = adminWinnerMode ? m.winner === 'team2' : userPick === 'team2';

    const verticalClass = VERTICAL_CONNECTOR_STYLES[m.round] ?? '';
    const h = shouldShowHorizontal(m.round, side);

    return (
      <div className="relative h-full flex items-center">
        {/* Saved flash badge (only for user pick saves) */}
        {justSaved && !isLocked && !isReadOnlyView && !adminWinnerMode && (
          <div className="absolute -top-2 right-2 text-[10px] bg-[#A7C4E7] text-[#0A2041] px-2 py-[2px] rounded-full shadow-sm">
            Saved ✓
          </div>
        )}

        {/* Vertical pipe (per-round style) */}
        {showVerticalConnector && side !== 'center' && verticalClass && (
          <div
            className={verticalClass}
            style={{
              right: side === 'left' ? '-22px' : 'auto',
              left: side === 'right' ? '-22px' : 'auto',
            }}
          />
        )}

        {/* Horizontal connectors between rounds */}
        {h.left && (
          <div className="absolute top-[52%] -left-5 w-5 h-[3px] rounded-full bg-[#CA4C4C]/28 pointer-events-none" />
        )}
        {h.right && (
          <div className="absolute top-[52%] -right-5 w-5 h-[3px] rounded-full bg-[#CA4C4C]/28 pointer-events-none" />
        )}

        <div className="bg-white/95 border border-[#F9DCD8] rounded-2xl px-4 py-3 shadow-sm w-[320px] max-w-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <div className="text-[10px] uppercase tracking-wide text-[#0A2041]/60">Match #{m.match_order}</div>

            {isDecided ? (
              <div className="text-[10px] font-semibold bg-[#FEE689] text-[#0A2041] px-2 py-[2px] rounded-full">
                Final
              </div>
            ) : (
              <div className="text-[10px] text-[#0A2041]/40">No winner yet</div>
            )}
          </div>

          {/* Admin hint */}
          {adminWinnerMode && (
            <div className="text-[10px] text-[#0A2041]/50 mb-1">Admin: click a team to set the winner</div>
          )}

          {/* Team 1 */}
          <button
            type="button"
            onClick={() => handleTeamClick('team1')}
            disabled={adminWinnerMode ? !canAdminSetWinner : !canPick}
            className={[
              'w-full flex items-center justify-between rounded-xl px-2 py-2 border transition mt-1 disabled:opacity-60 disabled:cursor-not-allowed',
              adminWinnerMode
                ? m.winner === 'team1'
                  ? 'bg-[#A7C4E7]/40 border-[#A7C4E7]'
                  : 'bg-[#F9DCD8]/40 border-[#F9DCD8]'
                : m.winner === 'team1'
                ? 'bg-[#A7C4E7]/40 border-[#A7C4E7]'
                : isTeam1Selected
                ? 'bg-[#CA4C4C]/10 border-[#CA4C4C]'
                : 'bg-[#F9DCD8]/40 border-[#F9DCD8]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 text-left min-w-0 w-full">
              <span
                className={[
                  'h-3 w-3 rounded-full border shrink-0',
                  isTeam1Selected
                    ? adminWinnerMode
                      ? 'border-[#0A2041] bg-[#0A2041]'
                      : 'border-[#CA4C4C] bg-[#CA4C4C]'
                    : 'border-[#0A2041]/40 bg-white',
                ].join(' ')}
              />

              <span className="font-medium truncate" title={displayTeam1Name ?? ''}>
                {displayTeam1Name ?? '—'}
                {displayTeam1Seed != null && displayTeam1Name && (
                  <span className="text-[10px] text-[#0A2041]/60"> (Seed {displayTeam1Seed})</span>
                )}
              </span>
            </div>
          </button>

          {/* Team 2 */}
          <button
            type="button"
            onClick={() => handleTeamClick('team2')}
            disabled={adminWinnerMode ? !canAdminSetWinner : !canPick}
            className={[
              'w-full flex items-center justify-between rounded-xl px-2 py-2 border transition mt-1 disabled:opacity-60 disabled:cursor-not-allowed',
              adminWinnerMode
                ? m.winner === 'team2'
                  ? 'bg-[#A7C4E7]/40 border-[#A7C4E7]'
                  : 'bg-[#F9DCD8]/40 border-[#F9DCD8]'
                : m.winner === 'team2'
                ? 'bg-[#A7C4E7]/40 border-[#A7C4E7]'
                : isTeam2Selected
                ? 'bg-[#CA4C4C]/10 border-[#CA4C4C]'
                : 'bg-[#F9DCD8]/40 border-[#F9DCD8]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 text-left min-w-0 w-full">
              <span
                className={[
                  'h-3 w-3 rounded-full border shrink-0',
                  isTeam2Selected
                    ? adminWinnerMode
                      ? 'border-[#0A2041] bg-[#0A2041]'
                      : 'border-[#CA4C4C] bg-[#CA4C4C]'
                    : 'border-[#0A2041]/40 bg-white',
                ].join(' ')}
              />

              <span className="font-medium truncate" title={displayTeam2Name ?? ''}>
                {displayTeam2Name ?? '—'}
                {displayTeam2Seed != null && displayTeam2Name && (
                  <span className="text-[10px] text-[#0A2041]/60"> (Seed {displayTeam2Seed})</span>
                )}
              </span>
            </div>
          </button>

          {/* Status row */}
          <div className="mt-2 text-[11px] flex justify-between items-center">
            <span className="font-semibold text-[#0A2041]">{adminWinnerMode ? 'Winner' : 'Your pick'}</span>

            <span
              className={[
                'px-2 py-[2px] rounded-full border text-[10px]',
                adminWinnerMode
                  ? !m.winner
                    ? 'border-transparent text-[#0A2041]/40'
                    : 'bg-[#FEE689]/70 border-[#FEE689] text-[#0A2041]'
                  : !userPick
                  ? 'border-transparent text-[#0A2041]/40'
                  : isCorrect
                  ? 'bg-[#FEE689]/70 border-[#FEE689] text-[#0A2041]'
                  : isWrong
                  ? 'bg-[#CA4C4C]/10 border-[#CA4C4C] text-[#CA4C4C]'
                  : 'bg-white border-[#F9DCD8] text-[#0A2041]/70',
              ].join(' ')}
            >
              {adminWinnerMode && !m.winner && 'No winner yet'}
              {adminWinnerMode && m.winner && 'Winner set'}
              {!adminWinnerMode && !userPick && 'No pick yet'}
              {!adminWinnerMode && userPick && !isDecided && 'Waiting…'}
              {!adminWinnerMode && isCorrect && 'Correct'}
              {!adminWinnerMode && isWrong && 'Incorrect'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ------------------ Region caret grid (single region) ------------------
  const renderRegionBracket = (
    region: string,
    options?: { side?: 'left' | 'right'; hideRoundLabels?: boolean }
  ) => {
    const side = options?.side ?? 'left';
    const mirror = side === 'right';
    const hideRoundLabels = options?.hideRoundLabels ?? false;

    const regionRounds: Record<number, Match[]> = grouped[region] || {};
    const rounds = [1, 2, 3, 4];

    const counts = rounds.map((r) => regionRounds[r]?.length || 0);
    const baseMatches = counts.length ? Math.max(...counts) : 1;
    const totalRows = baseMatches * 2 || 2;

    const computeRow = (round: number, index: number) => {
      if (baseMatches === 8) {
        const base = Math.pow(2, round - 1);
        const step = Math.pow(2, round);
        return base + index * step;
      }
      return index * 2 + 1;
    };

    const hasAny = rounds.some((r) => (regionRounds[r] || []).length > 0);
    if (!hasAny) return null;

    return (
      <div className="flex flex-col gap-2">
        {/* Region label */}
        <div className="flex justify-center mb-1">
          <div className="inline-flex items-center rounded-full bg-[#CA4C4C] text-[#F8F5EE] text-xs px-4 py-1 font-semibold shadow-sm">
            {region}
          </div>
        </div>

        {/* Round chips */}
        {!hideRoundLabels && (
          <div className="flex gap-3 mt-1 mb-3">
            {rounds.map((round) => {
              const col = mirror ? 5 - round : round;
              return (
                <div key={round} className="flex-1 flex justify-center" style={{ order: col }}>
                  <div className="inline-flex items-center rounded-full bg-[#0A2041] text-[#F8F5EE] text-[9px] px-3 py-1 uppercase tracking-wide shadow-sm">
                    {roundLabels[round] || `Round ${round}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grid for region */}
        <div
          className="grid gap-x-6 gap-y-1 mt-4"
          style={{
            gridTemplateColumns: 'repeat(4, 340px)',
            gridTemplateRows: `repeat(${totalRows}, 110px)`,
          }}
        >
          {rounds.map((round) => {
            const roundMatches = regionRounds[round] || [];
            const isLastRound = round === 4;

            return roundMatches.map((m, index) => {
              const row = computeRow(round, index);
              const col = mirror ? 5 - round : round;

              const showVerticalForThisCard = shouldShowVertical(round, index);

              // For rounds > 1, we let renderMatchCard pull names from picks via getMatchDisplay
              const overrideTeams =
                round === 1 || (m.region || '') === 'Final Four' ? undefined : null; // null means use computed logic

              return (
                <div
                  key={m.id}
                  style={{
                    gridColumn: col,
                    gridRow: `${row} / span 1`,
                  }}
                  className="h-full flex items-center"
                >
                  {renderMatchCard(m, {
                    side,
                    isLastRound,
                    showVerticalConnector: showVerticalForThisCard,
                    overrideTeams: overrideTeams ?? undefined,
                  })}
                </div>
              );
            });
          })}
        </div>
      </div>
    );
  };

  // ------------------ Final Four + Championship ------------------
  const renderFinalFour = () => {
    const ffRounds: Record<number, Match[]> = grouped['Final Four'] || {};
    const semis = ffRounds[5] || []; // round 5
    const finals = ffRounds[6] || []; // round 6

    if (!semis.length && !finals.length) return null;

    const leftSemi = semis[0];
    const rightSemi = semis[1];
    const champ = finals[0];

    const eastChamp = getRegionChampion('East');
    const westChamp = getRegionChampion('West');
    const southChamp = getRegionChampion('South');
    const midwestChamp = getRegionChampion('Midwest');

    const leftSemiTeams: DisplayTeams = {
      team1Name: eastChamp?.name ?? null,
      team1Seed: eastChamp?.seed ?? null,
      team2Name: westChamp?.name ?? null,
      team2Seed: westChamp?.seed ?? null,
    };

    const rightSemiTeams: DisplayTeams = {
      team1Name: southChamp?.name ?? null,
      team1Seed: southChamp?.seed ?? null,
      team2Name: midwestChamp?.name ?? null,
      team2Seed: midwestChamp?.seed ?? null,
    };

    const leftFinalist = getSemiWinner(leftSemi, eastChamp, westChamp);
    const rightFinalist = getSemiWinner(rightSemi, southChamp, midwestChamp);

    const champTeams: DisplayTeams = {
      team1Name: leftFinalist?.name ?? null,
      team1Seed: leftFinalist?.seed ?? null,
      team2Name: rightFinalist?.name ?? null,
      team2Seed: rightFinalist?.seed ?? null,
    };

    return (
      <div className="px-20 pt-0 pb-6 flex flex-col items-center mt-10">
        {/* CHIP + LOGO AT THE TOP OF THE CENTER COLUMN */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="inline-flex items-center rounded-full bg-[#0A2041] text-[#F8F5EE] text-xs px-4 py-1 font-semibold shadow-sm">
            Final Four &amp; Championship
          </div>

          <div className="relative w-96 h-96 sm:w-96 sm:h-96">
            <Image src="/LOTG_Logo_Red_Navy.png" alt="Bracket Logo" fill className="object-contain drop-shadow-lg" />
          </div>
        </div>

        {/* GAMES ROW: LEFT SEMI — CHAMP — RIGHT SEMI */}
        <div className="flex items-center justify-center gap-16 relative mt-[1355px]">
          {/* Left Semi */}
          <div className="flex items-center">
            {leftSemi &&
              renderMatchCard(leftSemi, {
                side: 'center',
                isLastRound: false,
                showVerticalConnector: false,
                overrideTeams: leftSemiTeams,
              })}
          </div>

          {/* Connector → Championship */}
          {leftSemi && champ && <div className="h-[3px] w-16 rounded-full bg-[#A7C4E7]/55" />}

          {/* Championship */}
          <div className="flex items-center">
            {champ &&
              renderMatchCard(champ, {
                side: 'center',
                isLastRound: true,
                showVerticalConnector: false,
                overrideTeams: champTeams,
              })}
          </div>

          {/* Connector → Right Semi */}
          {rightSemi && champ && <div className="h-[3px] w-16 rounded-full bg-[#A7C4E7]/55" />}

          {/* Right Semi */}
          <div className="flex items-center">
            {rightSemi &&
              renderMatchCard(rightSemi, {
                side: 'center',
                isLastRound: false,
                showVerticalConnector: false,
                overrideTeams: rightSemiTeams,
              })}
          </div>
        </div>
      </div>
    );
  };

  // ------------------ Render ------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center">
        Loading bracket…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] p-6">
      {/* Top banner */}
      <header className="max-w-6xl mx-auto mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#CA4C4C] flex items-center gap-2">
            {isReadOnlyView ? 'Shared Bracket' : 'My Bracket'}
            <span
              className={[
                'inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold border',
                isLocked
                  ? 'bg-[#CA4C4C]/10 border-[#CA4C4C] text-[#7b2525]'
                  : 'bg-[#A7C4E7]/30 border-[#A7C4E7] text-[#0A2041]',
              ].join(' ')}
            >
              {isLocked ? 'Locked' : 'Open for picks'}
            </span>
          </h1>
          {lockMessage && <p className="text-[11px] text-[#0A2041]/70">{lockMessage}</p>}

          {/* MOBILE view toggle */}
          {isMobile && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode('guided')}
                className={[
                  'px-3 py-1 rounded-full text-[11px] font-semibold border transition',
                  viewMode === 'guided'
                    ? 'bg-[#0A2041] text-[#F8F5EE] border-[#0A2041]'
                    : 'bg-white/70 text-[#0A2041] border-[#F9DCD8]',
                ].join(' ')}
              >
                Guided picks
              </button>

              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={[
                  'px-3 py-1 rounded-full text-[11px] font-semibold border transition',
                  viewMode === 'full'
                    ? 'bg-[#CA4C4C] text-[#F8F5EE] border-[#CA4C4C]'
                    : 'bg-white/70 text-[#0A2041] border-[#F9DCD8]',
                ].join(' ')}
              >
                Full bracket
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 text-right text-xs text-[#0A2041]/60">
          {userEmail && <div>Signed in as {userEmail}</div>}

          {/* Only show share button when you're looking at your own bracket */}
          {!isReadOnlyView && userId && (
            <button
              type="button"
              onClick={handleShareBracket}
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#CA4C4C] bg-[#CA4C4C]/10 px-3 py-1 text-[11px] font-semibold text-[#CA4C4C] hover:bg-[#CA4C4C]/20 transition"
            >
              Share my bracket
            </button>
          )}
        </div>
      </header>

      {/* Optional helper text for full bracket on mobile */}
      {isMobile && viewMode === 'full' && (
        <div className="max-w-6xl mx-auto mb-3 text-[11px] text-[#0A2041]/60 px-1">
          Tip: swipe left/right to scroll the full bracket.
        </div>
      )}

      {/* Lock status banner */}
      {lockMessage && (
        <div
          className={[
            'max-w-6xl mx-auto mb-4 text-sm px-4 py-3 rounded-2xl border shadow-sm',
            isLocked
              ? 'bg-[#CA4C4C]/10 border-[#CA4C4C] text-[#7b2525]'
              : 'bg-[#A7C4E7]/20 border-[#A7C4E7] text-[#0A2041]',
          ].join(' ')}
        >
          <span className="font-semibold mr-1">{isLocked ? 'Picks locked' : 'Picks are open'}</span>
          {lockMessage}
        </div>
      )}

      {/* Main layout: guided mobile OR full bracket (also allowed on mobile) */}
      {isMobile && viewMode === 'guided' ? (
        <div className="pb-10">{renderMobileBracket()}</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[2300px] mx-auto grid grid-cols-[1fr_auto_1fr] gap-12 items-stretch">
            {/* Left stack: East + West */}
            <div className="relative flex flex-col gap-10">
              <div
                className="pointer-events-none absolute w-[3px] rounded-full bg-[#A7C4E7]/55"
                style={{ top: '955px', bottom: '965px', right: '0px' }}
              />
              {renderRegionBracket('East', { side: 'left', hideRoundLabels: false })}
              {renderRegionBracket('West', { side: 'left', hideRoundLabels: true })}
            </div>

            {/* Center: Final Four & Championship */}
            <div className="flex items-start justify-center">{renderFinalFour()}</div>

            {/* Right stack: South + Midwest */}
            <div className="relative flex flex-col gap-10">
              <div
                className="pointer-events-none absolute w-[3px] rounded-full bg-[#A7C4E7]/55"
                style={{ top: '955px', bottom: '965px', left: '-15px' }}
              />
              {renderRegionBracket('South', { side: 'right', hideRoundLabels: false })}
              {renderRegionBracket('Midwest', { side: 'right', hideRoundLabels: true })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
