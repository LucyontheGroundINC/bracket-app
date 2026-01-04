"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import toast from "react-hot-toast";

type Game = {
  id: number;
  round: number;
  gameIndex: number;
  teamAId: number | null;
  teamBId: number | null;
  winnerId: number | null;
};

type Team = { id: number; name: string; seed: number | null };

type PickRow = {
  id: number;
  bracketId: number;
  gameId: number;
  pickedTeamId: number;
  createdAt?: string | null;
};

function getErrorMessage(e: unknown, fallback = "Unknown error") {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

export default function BracketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bracketId = Number(params.id);

  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<Map<number, number>>(new Map()); // gameId -> pickedTeamId
  const [loading, setLoading] = useState(true);
  const [savingGameId, setSavingGameId] = useState<number | null>(null);

  // ---- initial load: bracket -> tournament -> games/teams -> picks ----
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        // 1) bracket (to get tournamentId)
        const bRes = await fetch(`/api/brackets/by-id?id=${bracketId}`);
        const bracketJson = await bRes.json().catch(() => null);

        const tidRaw = bracketJson?.tournamentId;
        const tid = Number(tidRaw);

        if (!bRes.ok || !Number.isFinite(tid)) {
          toast.error(bracketJson?.error ?? "Bracket not found");
          router.push("/dashboard/brackets");
          return;
        }

        if (!mounted) return;
        setTournamentId(tid);

        // 2) fetch games & teams in parallel
        const [gRes, tRes] = await Promise.all([
          fetch(`/api/games?tournamentId=${tid}`),
          fetch(`/api/teams?tournamentId=${tid}`),
        ]);

        const gJson = await gRes.json().catch(() => null);
        const tJson = await tRes.json().catch(() => null);

        if (!gRes.ok) throw new Error(gJson?.error ?? "Failed to load games");
        if (!tRes.ok) throw new Error(tJson?.error ?? "Failed to load teams");

        const g = (Array.isArray(gJson) ? gJson : []) as Game[];
        const t = (Array.isArray(tJson) ? tJson : []) as Team[];

        if (!mounted) return;
        setGames(g.sort((a, b) => a.round - b.round || a.gameIndex - b.gameIndex));
        setTeams(t);

        // 3) existing picks
        const pRes = await fetch(`/api/picks/by-bracket/${bracketId}`);
        const pJson = await pRes.json().catch(() => null);
        if (!pRes.ok) throw new Error(pJson?.error ?? "Failed to load picks");

        const pRows = (Array.isArray(pJson) ? pJson : []) as PickRow[];
        if (!mounted) return;
        setPicks(new Map(pRows.map((r) => [r.gameId, r.pickedTeamId])));
      } catch (e: unknown) {
        console.error("[BracketDetailPage] load error:", e);
        toast.error(getErrorMessage(e, "Failed to load bracket"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [bracketId, router]);

  const teamName = (id: number | null) => {
    if (id == null) return "—";
    const t = teams.find((x) => x.id === id);
    if (!t) return `#${id}`;
    return t.seed ? `${t.name} (Seed ${t.seed})` : t.name;
  };

  // group games by round
  const byRound = useMemo(() => {
    const map = new Map<number, Game[]>();
    for (const g of games) {
      if (!map.has(g.round)) map.set(g.round, []);
      map.get(g.round)!.push(g);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [games]);

  async function savePick(gameId: number, pickedTeamId: number | "") {
    if (pickedTeamId === "") return; // no-op

    setSavingGameId(gameId);

    // optimistic update
    const prev = new Map(picks);
    setPicks((m) => {
      const next = new Map(m);
      next.set(gameId, Number(pickedTeamId));
      return next;
    });

    const toastId = toast.loading("Saving pick…");

    try {
      const res = await fetch(`/api/picks/by-bracket/${bracketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, pickedTeamId: Number(pickedTeamId) }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save pick");

      toast.success("Pick saved", { id: toastId });
    } catch (e: unknown) {
      console.error("[BracketDetailPage] savePick error:", e);
      // revert optimistic update
      setPicks(prev);
      toast.error(getErrorMessage(e, "Could not save pick"), { id: toastId });
    } finally {
      setSavingGameId(null);
    }
  }

  return (
    <RequireAuth>
      <main className="p-6 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bracket #{bracketId}</h1>
            <p className="text-gray-600">
              {tournamentId ? `Tournament ID: ${tournamentId}` : "Loading tournament…"}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : byRound.length === 0 ? (
          <p className="text-gray-600">No games available for this tournament.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {byRound.map(([round, rows]) => (
              <section key={round} className="rounded border p-4">
                <h2 className="font-semibold mb-3">Round {round}</h2>
                <div className="space-y-2">
                  {rows.map((g) => {
                    const current = picks.get(g.id) ?? "";
                    const disabled = g.teamAId == null || g.teamBId == null;

                    return (
                      <div key={g.id} className="flex items-center gap-3">
                        <span className="w-16 text-xs text-gray-500">Game {g.gameIndex}</span>

                        <span className="flex-1">
                          {teamName(g.teamAId)} <span className="text-gray-500">vs</span>{" "}
                          {teamName(g.teamBId)}
                        </span>

                        <select
                          className="border rounded px-2 py-1 text-sm disabled:opacity-60"
                          value={current}
                          onChange={(e) =>
                            savePick(g.id, e.target.value === "" ? "" : Number(e.target.value))
                          }
                          disabled={disabled || savingGameId === g.id}
                        >
                          <option value="">Pick…</option>
                          {g.teamAId && <option value={g.teamAId}>{teamName(g.teamAId)}</option>}
                          {g.teamBId && <option value={g.teamBId}>{teamName(g.teamBId)}</option>}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </RequireAuth>
  );
}
