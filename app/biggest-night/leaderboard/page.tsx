"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";

type LeaderboardRow = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalScore: number;
  correctCount: number;
};

type Season = {
  id: string;
  name: string;
  year: number | null;
};

type ApiResponse = {
  season: Season | null;
  leaderboard: unknown[];
  note?: string;
};

function normalizeRow(input: unknown): LeaderboardRow {
  const r =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};

  return {
    userId: String(r.userId ?? r.user_id ?? ""),
    displayName:
      typeof r.displayName === "string" && r.displayName.trim()
        ? r.displayName
        : null,
    avatarUrl:
      typeof r.avatarUrl === "string" && r.avatarUrl.trim()
        ? r.avatarUrl
        : null,
    totalScore: Number(r.totalScore ?? 0) || 0,
    correctCount: Number(r.correctCount ?? 0) || 0,
  };
}

export default function BiggestNightLeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load current user (for "(you)" highlight)
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    };
    loadUser();
  }, []);

  // Load leaderboard
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setNote(null);

      try {
        const res = await fetch("/api/biggest-night/leaderboard", {
          cache: "no-store",
        });

        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(j?.error ?? "Failed to load leaderboard.");
        }

        const json = (await res.json()) as ApiResponse;

        setSeason(json.season ?? null);

        const normalized = Array.isArray(json.leaderboard)
          ? json.leaderboard
              .map(normalizeRow)
              .filter((r) => r.userId)
          : [];

        normalized.sort((a, b) => {
          if (b.totalScore !== a.totalScore)
            return b.totalScore - a.totalScore;
          if (b.correctCount !== a.correctCount)
            return b.correctCount - a.correctCount;
          return (a.displayName ?? "").localeCompare(b.displayName ?? "");
        });

        setRows(normalized);
        setNote(json.note ?? null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Something went wrong.");
        setRows([]);
        setSeason(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const myRowIndex = useMemo(() => {
    if (!currentUserId) return -1;
    return rows.findIndex((r) => r.userId === currentUserId);
  }, [rows, currentUserId]);

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#CA4C4C] pt-24 pb-10 px-4 relative overflow-hidden">
      {/* Statue Background Decoration */}
      <div className="absolute top-0 left-0 w-48 h-full opacity-10 pointer-events-none">
        <img src="/hollywoods-biggest-night-statue.svg" alt="" className="w-full h-full object-cover" />
      </div>
      <div className="absolute top-0 right-0 w-48 h-full opacity-10 pointer-events-none">
        <img src="/hollywoods-biggest-night-statue.svg" alt="" className="w-full h-full object-cover" />
      </div>
      <main className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0A2041]">
              Hollywood's Biggest Night
            </h1>
            <p className="text-sm text-[#CA4C4C]/85 mt-1">
              Scores update after winners are set. Tie-breaker: points → correct
              picks.
            </p>

            {season?.name ? (
              <p className="text-xs text-[#CA4C4C]/80 mt-1">
                Season:{" "}
                <span className="font-semibold">
                  {season.year
                    ? `${season.name} (${season.year})`
                    : season.name}
                </span>
              </p>
            ) : null}
          </div>

          <Link
            href="/biggest-night/ballot"
            className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black bg-[#CA4C4C] text-[#F8F5EE] hover:opacity-95"
          >
            Back to Ballot →
          </Link>
        </div>

        {/* Status */}
        {loading ? (
          <div className="mb-4 text-sm text-[#CA4C4C]/85">
            Loading leaderboard…
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 text-sm text-red-200 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">
            {error}
          </div>
        ) : null}

        {note ? (
          <div className="mb-4 text-sm bg-[#CA4C4C] border border-[#CA4C4C] rounded-xl px-4 py-3 text-[#F8F5EE]/80">
            {note}
          </div>
        ) : null}

        {/* Table */}
        <div className="bg-[#CA4C4C] border border-[#CA4C4C] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F8F5EE]/20 flex text-xs font-semibold text-[#F8F5EE]/70">
            <div className="w-12">Rank</div>
            <div className="flex-1">Player</div>
            <div className="w-24 text-right">Correct</div>
            <div className="w-24 text-right">Points</div>
          </div>

          {!loading && rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-[#F8F5EE]/70 text-center">
              No scores yet. Once winners are set, rankings will appear here.
            </div>
          ) : (
            rows.map((row, idx) => {
              const rank = idx + 1;
              const isMe = row.userId === currentUserId;

              return (
                <div
                  key={row.userId}
                  className={[
                    "px-4 py-3 flex items-center text-sm border-t border-[#F8F5EE]/15",
                    isMe ? "bg-[#FEE689]" : "",
                  ].join(" ")}
                >
                  <div className="w-12 font-semibold">{rank}</div>

                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <Avatar
                      name={row.displayName ?? "Player"}
                      src={row.avatarUrl}
                    />
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {row.displayName ?? "Player"}
                        {isMe ? (
                          <span className="ml-2 text-[11px] text-[#CA4C4C]/60">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      {isMe && myRowIndex >= 0 ? (
                        <div className="text-[11px] text-[#CA4C4C]/60">
                          Chaos favors the bold.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="w-24 text-right text-[#F8F5EE]/80">
                    {row.correctCount}
                  </div>
                  <div className="w-24 text-right font-black text-[#F8F5EE]">
                    {row.totalScore}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 text-xs text-[#CA4C4C]/80">
          Points will scale with nominee difficulty once weights are finalized.
        </div>
      </main>
    </div>
  );
}
