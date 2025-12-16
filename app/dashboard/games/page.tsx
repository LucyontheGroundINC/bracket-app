"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import toast from "react-hot-toast";

type Tournament = { id: number; name: string; year: number; isActive?: boolean };
type Team = { id: number; name: string; seed: number | null; tournamentId: number };
type Game = {
  id: number;
  tournamentId: number;
  round: number;
  gameIndex: number;
  teamAId: number | null;
  teamBId: number | null;
  winnerId: number | null;
};

export default function AdminGamesPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [round, setRound] = useState<number | "">("");

  const [loading, setLoading] = useState(false);

  // Quick add fields
  const [qaRound, setQaRound] = useState<number | "">("");
  const [qaGameIndex, setQaGameIndex] = useState<number | "">("");
  const [qaTeamA, setQaTeamA] = useState<number | "">("");
  const [qaTeamB, setQaTeamB] = useState<number | "">("");

  // ---- load tournaments once ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tournaments");
        if (!res.ok) throw new Error("Failed to load tournaments");
        const rows = (await res.json()) as Tournament[];
        setTournaments(rows);
        if (rows.length && selectedTid == null) setSelectedTid(rows[0].id);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not load tournaments");
      }
    })();
  }, []);

  // ---- load teams when tournament changes ----
  useEffect(() => {
    if (!selectedTid) return;
    (async () => {
      try {
        const res = await fetch(`/api/teams?tournamentId=${selectedTid}`);
        if (!res.ok) throw new Error("Failed to load teams");
        const rows = (await res.json()) as Team[];
        setTeams(rows);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not load teams");
      }
    })();
  }, [selectedTid]);

  // ---- load games when tournament/round changes ----
  useEffect(() => {
    if (!selectedTid) return;
    (async () => {
      setLoading(true);
      try {
        const url =
          round === ""
            ? `/api/games?tournamentId=${selectedTid}`
            : `/api/games?tournamentId=${selectedTid}&round=${round}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load games");
        const rows = (await res.json()) as Game[];
        setGames(rows);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not load games");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedTid, round]);

  const teamName = (id: number | null) =>
    id == null ? "—" : teams.find((t) => t.id === id)?.name ?? `#${id}`;

  const roundsAvailable = useMemo(() => {
    const set = new Set<number>();
    games.forEach((g) => set.add(g.round));
    return [...(set.size ? Array.from(set) : [1, 2, 3, 4, 5, 6])].sort((a, b) => a - b);
  }, [games]);

  async function updateWinner(gameId: number, winnerId: number | "") {
    try {
      const saving = toast.loading("Updating winner…");
      const body: Partial<Game> = { winnerId: winnerId === "" ? null : Number(winnerId) };
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update");

      setGames((prev) => prev.map((g) => (g.id === gameId ? ({ ...g, winnerId: body.winnerId ?? null } as Game) : g)));
      toast.success("Winner updated", { id: saving });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update winner");
    }
  }

  async function deleteGame(id: number) {
    const sure = confirm("Delete this game?");
    if (!sure) return;
    try {
      const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      setGames((prev) => prev.filter((g) => g.id !== id));
      toast.success("Game deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
    }
  }

  async function quickAddGame(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTid) return toast.error("Pick a tournament");
    if (qaRound === "" || qaGameIndex === "") return toast.error("Round and Game Index are required");

    const payload = {
      tournamentId: selectedTid,
      round: Number(qaRound),
      gameIndex: Number(qaGameIndex),
      teamAId: qaTeamA === "" ? null : Number(qaTeamA),
      teamBId: qaTeamB === "" ? null : Number(qaTeamB),
    };

    try {
      const saving = toast.loading("Creating game…");
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create game");

      toast.success("Game created", { id: saving });
      // refresh list
      const url =
        round === ""
          ? `/api/games?tournamentId=${selectedTid}`
          : `/api/games?tournamentId=${selectedTid}&round=${round}`;
      const r2 = await fetch(url);
      setGames(await r2.json());

      // reset quick add fields
      setQaGameIndex("");
      setQaTeamA("");
      setQaTeamB("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create game");
    }
  }

  // --- Step 3A: seed round 1 from team seeds ---
  async function seedRound1() {
    if (!selectedTid) return toast.error("Pick a tournament first");
    const saving = toast.loading("Seeding Round 1…");
    try {
      const res = await fetch("/api/games/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: selectedTid, round: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to seed");
      toast.success(`Created ${json.created ?? 0} games`, { id: saving });
      // refresh list
      const url =
        round === ""
          ? `/api/games?tournamentId=${selectedTid}`
          : `/api/games?tournamentId=${selectedTid}&round=${round}`;
      const r2 = await fetch(url);
      setGames(await r2.json());
    } catch (e: any) {
      toast.error(e?.message ?? "Could not seed");
    }
  }

  return (
    <RequireAuth>
      <main className="p-6 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Games</h1>
            <p className="text-gray-600">Manage matchups and set winners.</p>
          </div>

          <div className="ml-auto">
            <label className="block text-sm font-medium mb-1">Tournament</label>
            <select
              className="border rounded px-3 py-2 min-w-[220px]"
              value={selectedTid ?? ""}
              onChange={(e) => setSelectedTid(Number(e.target.value) || null)}
            >
              <option value="">Select…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Round</label>
            <select
              className="border rounded px-3 py-2"
              value={round}
              onChange={(e) => setRound(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">All</option>
              {roundsAvailable.map((r) => (
                <option key={r} value={r}>
                  Round {r}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3A button – placed right after the Round selector */}
          <button
            onClick={seedRound1}
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            title="Create 1v16, 2v15, … from seeded teams"
          >
            Auto-create Round 1
          </button>
        </div>

        {/* Games table */}
        <section className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Games</h2>
            {loading && <span className="text-sm text-gray-500">Loading…</span>}
          </div>

          {games.length === 0 ? (
            <p className="text-sm text-gray-600">No games for this selection.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">ID</th>
                    <th className="py-2 pr-2">Round</th>
                    <th className="py-2 pr-2">Game #</th>
                    <th className="py-2 pr-2">Team A</th>
                    <th className="py-2 pr-2">Team B</th>
                    <th className="py-2 pr-2">Winner</th>
                    <th className="py-2 pr-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{g.id}</td>
                      <td className="py-2 pr-2">{g.round}</td>
                      <td className="py-2 pr-2">{g.gameIndex}</td>
                      <td className="py-2 pr-2">{teamName(g.teamAId)}</td>
                      <td className="py-2 pr-2">{teamName(g.teamBId)}</td>
                      <td className="py-2 pr-2">
                        <select
                          className="border rounded px-2 py-1"
                          value={g.winnerId ?? ""}
                          onChange={(e) => updateWinner(g.id, e.target.value === "" ? "" : Number(e.target.value))}
                        >
                          <option value="">—</option>
                          {g.teamAId && <option value={g.teamAId}>{teamName(g.teamAId)}</option>}
                          {g.teamBId && <option value={g.teamBId}>{teamName(g.teamBId)}</option>}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs rounded border px-2 py-1"
                            onClick={() => updateWinner(g.id, "")}
                            title="Clear winner"
                          >
                            Clear
                          </button>
                          <button
                            className="text-xs rounded border px-2 py-1 hover:bg-red-50 hover:text-red-600"
                            onClick={() => deleteGame(g.id)}
                            title="Delete game"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quick add a game */}
        <section className="rounded border p-4">
          <h3 className="font-semibold mb-3">Quick add game</h3>
          <form onSubmit={quickAddGame} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Round</label>
              <input
                type="number"
                min={1}
                className="border rounded px-3 py-2 w-24"
                value={qaRound}
                onChange={(e) => setQaRound(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Game Index</label>
              <input
                type="number"
                min={1}
                className="border rounded px-3 py-2 w-28"
                value={qaGameIndex}
                onChange={(e) => setQaGameIndex(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Team A</label>
              <select
                className="border rounded px-3 py-2 min-w-[200px]"
                value={qaTeamA}
                onChange={(e) => setQaTeamA(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">(none)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.seed ? `(Seed ${t.seed})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Team B</label>
              <select
                className="border rounded px-3 py-2 min-w-[200px]"
                value={qaTeamB}
                onChange={(e) => setQaTeamB(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">(none)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.seed ? `(Seed ${t.seed})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
              disabled={!selectedTid || qaRound === "" || qaGameIndex === ""}
            >
              Add game
            </button>
          </form>
        </section>
      </main>
    </RequireAuth>
  );
}

