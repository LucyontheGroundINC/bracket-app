"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type LeaderboardRow = {
  userId: string;
  displayName: string | null;
  email: string | null;
  totalScore: number;
  correctCount: number;
};

type TournamentSummary = {
  id: number;
  name: string;
  year?: number | null;
  isActive?: boolean | null;
};

function normalizeLeaderboardRow(input: unknown): LeaderboardRow {
  const r = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const userIdRaw = r.userId ?? r.user_id ?? "";
  const userId = typeof userIdRaw === "string" || typeof userIdRaw === "number" ? String(userIdRaw) : "";

  const displayNameRaw =
    r.userDisplayName ?? r.displayName ?? r.name ?? r.username ?? null;
  const displayName =
    typeof displayNameRaw === "string" && displayNameRaw.trim()
      ? displayNameRaw
      : null;

  const emailRaw = r.userEmail ?? r.email ?? r.user_email ?? null;
  const email = typeof emailRaw === "string" && emailRaw.trim() ? emailRaw : null;

  const totalScoreRaw = r.totalPoints ?? r.totalScore ?? r.score ?? r.points ?? 0;
  const totalScore = typeof totalScoreRaw === "number" ? totalScoreRaw : Number(totalScoreRaw) || 0;

  const correctRaw = r.correctCount ?? r.correct ?? r.correctPicks ?? 0;
  const correctCount = typeof correctRaw === "number" ? correctRaw : Number(correctRaw) || 0;

  return { userId, displayName, email, totalScore, correctCount };
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTournamentId, setActiveTournamentId] = useState<number | null>(null);
  const [activeTournamentName, setActiveTournamentName] = useState<string>("");

  // For rank-change arrows
  const previousRanksRef = useRef<Map<string, number>>(new Map());

  // ------------------ Load current user ------------------
  useEffect(() => {
    const loadUser = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("Error loading user for leaderboard:", authError.message);
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    };
    loadUser();
  }, []);

  // ------------------ Detect active tournament ------------------
  useEffect(() => {
    const loadActiveTournament = async () => {
      try {
        const res = await fetch("/api/tournaments", { cache: "no-store" });
        if (!res.ok) {
          console.error("Failed to load tournaments for leaderboard");
          return;
        }

        const list = (await res.json()) as unknown;

        if (!Array.isArray(list) || list.length === 0) return;

        // Prefer: isActive; fallback: last item
        const typed = list as TournamentSummary[];
        const active = typed.find((t) => !!t.isActive) ?? typed[typed.length - 1];

        if (!active || typeof active.id !== "number") return;

        setActiveTournamentId(active.id);
        setActiveTournamentName(
          active.year ? `${active.name} (${active.year})` : active.name
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
        console.error("Error loading tournaments for leaderboard:", msg);
      }
    };

    loadActiveTournament();
  }, []);

  // ------------------ Load leaderboard for active tournament ------------------
  useEffect(() => {
    if (!activeTournamentId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/scores/leaderboard?tournamentId=${activeTournamentId}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as unknown;
          console.error("Leaderboard fetch failed:", { status: res.status, json });

          const j = (typeof json === "object" && json !== null ? (json as Record<string, unknown>) : null);
          const msg = j && typeof j.error === "string" ? j.error : "Failed to load leaderboard";
          throw new Error(msg);
        }

        const json = (await res.json()) as unknown;

        const normalized: LeaderboardRow[] = Array.isArray(json)
          ? json.map(normalizeLeaderboardRow).filter((r) => r.userId)
          : [];

        // Sort by score desc, then name/email as tie-breaker
        normalized.sort((a, b) => {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          const nameA = (a.displayName ?? a.email ?? "").toLowerCase();
          const nameB = (b.displayName ?? b.email ?? "").toLowerCase();
          return nameA.localeCompare(nameB);
        });

        // Store old ranks before replacing rows (for ▲▼ arrows)
        const prevRanks = new Map<string, number>();
        rows.forEach((r, idx) => prevRanks.set(r.userId, idx));
        previousRanksRef.current = prevRanks;

        setRows(normalized);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
        console.error("Leaderboard load error:", msg);
        setError("Unable to load leaderboard right now.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    // intentionally not including rows so we use the previous snapshot for arrows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  const prevRanks = previousRanksRef.current;

  // ------------------ Render ------------------
  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 pb-10 px-4">
      <main className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#CA4C4C]">
              Leaderboard
            </h1>
            <p className="text-sm text-[#0A2041]/70 mt-1">
              See how your bracket stacks up against everyone else.
            </p>
            {activeTournamentName && (
              <p className="text-xs text-[#0A2041]/60 mt-1">
                Tournament:{" "}
                <span className="font-semibold">{activeTournamentName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        {loading && (
          <div className="mb-4 text-sm text-[#0A2041]/70">Loading scores…</div>
        )}
        {error && (
          <div className="mb-4 text-sm text-[#CA4C4C] bg-white/80 border border-[#F5B8B0] rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white/95 border border-[#F5B8B0] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F5B8B0]/70 flex text-xs font-semibold text-[#0A2041]/70">
            <div className="w-12">Rank</div>
            <div className="flex-1">Player</div>
            <div className="w-20 text-right">Correct</div>
            <div className="w-24 text-right">Points</div>
          </div>

          <AnimatePresence initial={false}>
            {rows.length === 0 && !loading ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 py-6 text-sm text-[#0A2041]/70 text-center"
              >
                No scores yet. Once games have winners and scores are
                recalculated, they’ll appear here.
              </motion.div>
            ) : (
              rows.map((row, index) => {
                const rank = index + 1;
                const isMe = !!currentUserId && row.userId === currentUserId;

                const previousIndex = prevRanks.get(row.userId);
                const movedUp =
                  previousIndex !== undefined && previousIndex > index;
                const movedDown =
                  previousIndex !== undefined && previousIndex < index;

                return (
                  <motion.div
                    key={row.userId}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 24,
                    }}
                    className={[
                      "px-4 py-3 flex items-center text-sm border-t border-[#F5B8B0]/40",
                      isMe ? "bg-[#FEE689]/40" : "bg-white/0",
                    ].join(" ")}
                  >
                    {/* Rank + arrow */}
                    <div className="w-12 flex items-center gap-1">
                      <span className="font-semibold text-[#0A2041]">
                        {rank}
                      </span>
                      {movedUp && (
                        <span className="text-[10px] text-emerald-600">▲</span>
                      )}
                      {movedDown && (
                        <span className="text-[10px] text-rose-600">▼</span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="flex-1 flex flex-col">
                      <span
                        className={["truncate", isMe ? "font-semibold" : ""].join(
                          " "
                        )}
                      >
                        {row.displayName || row.email || "Unknown player"}
                        {isMe && (
                          <span className="ml-2 text-[11px] text-[#0A2041]/70">
                            (you)
                          </span>
                        )}
                      </span>
                      {row.displayName && row.email && (
                        <span className="text-[11px] text-[#0A2041]/50 truncate">
                          {row.email}
                        </span>
                      )}
                    </div>

                    {/* Correct picks */}
                    <div className="w-20 text-right text-[#0A2041]/80">
                      {row.correctCount}
                    </div>

                    {/* Points */}
                    <div className="w-24 text-right font-semibold text-[#0A2041]">
                      {row.totalScore}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
