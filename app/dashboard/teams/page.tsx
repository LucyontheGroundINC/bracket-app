"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import toast from "react-hot-toast";

type Tournament = { id: number; name: string; year: number; isActive?: boolean };
type Team = { id: number; name: string; seed: number | null; tournamentId: number };

function getErrorMessage(e: unknown, fallback = "Something went wrong") {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

function extractApiError(json: unknown, fallback: string) {
  if (json && typeof json === "object" && "error" in json) {
    return String((json as { error?: unknown }).error ?? fallback);
  }
  return fallback;
}

export default function TeamsManagerPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Debug/utility toggle: show all teams regardless of tournament
  const [showAllTeams, setShowAllTeams] = useState(false);

  // single add
  const [teamName, setTeamName] = useState("");
  const [teamSeed, setTeamSeed] = useState<number | "">("");

  // bulk add
  const [bulkText, setBulkText] = useState("");

  // ------------------ helpers ------------------
  const selectedTournamentLabel = useMemo(() => {
    const t = tournaments.find((t) => t.id === selectedTid);
    return t ? `${t.name} ${t.year}` : "Select tournament";
  }, [tournaments, selectedTid]);

  const fetchTeams = async (tournamentId: number) => {
    setLoadingTeams(true);
    try {
      const url = showAllTeams ? "/api/teams" : `/api/teams?tournamentId=${tournamentId}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(extractApiError(json, "Failed to load teams"));
      }

      const rows = Array.isArray(json)
        ? json
        : json && typeof json === "object" && "rows" in json
        ? ((json as { rows?: unknown }).rows ?? [])
        : [];

      setTeams(rows as Team[]);
    } catch (e: unknown) {
      console.error("fetchTeams error:", e);
      toast.error(getErrorMessage(e, "Failed to load teams"));
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  // ------------------ load tournaments ------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tournaments", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(extractApiError(json, "Failed to load tournaments"));
        }

        const rows = (Array.isArray(json) ? json : []) as Tournament[];
        setTournaments(rows);

        // Default to: active tournament, else id=1 if present, else first
        setSelectedTid((prev) => {
          if (prev != null) return prev;
          const active = rows.find((t) => t.isActive);
          const id1 = rows.find((t) => t.id === 1);
          return active?.id ?? id1?.id ?? rows[0]?.id ?? null;
        });
      } catch (e: unknown) {
        toast.error(getErrorMessage(e, "Failed to load tournaments"));
      }
    })();
  }, []);

  // ------------------ load teams when selection/toggle changes ------------------
  useEffect(() => {
    if (!selectedTid) return;
    fetchTeams(selectedTid);
    // fetchTeams closes over showAllTeams, so include it in deps via the toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTid, showAllTeams]);

  // ------------------ actions ------------------
  async function addSingleTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTid) return toast.error("Pick a tournament first");

    const name = teamName.trim();
    if (!name) return toast.error("Team name required");

    const saving = toast.loading("Adding team…");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name,
          seed: teamSeed === "" ? null : Number(teamSeed),
          tournamentId: selectedTid,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractApiError(json, "Failed to add team"));

      toast.success("Team added", { id: saving });
      setTeamName("");
      setTeamSeed("");

      await fetchTeams(selectedTid);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to add team"), { id: saving });
    }
  }

  async function addBulkTeams(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTid) return toast.error("Pick a tournament first");

    const lines = bulkText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!lines.length) return toast.error("Nothing to import");

    const parsed = lines.map((line) => {
      const m = line.split(",").map((s) => s.trim());
      if (m.length >= 2 && !Number.isNaN(Number(m[0]))) {
        return { seed: Number(m[0]), name: m.slice(1).join(", ") };
      }
      return { seed: null as number | null, name: line };
    });

    const saving = toast.loading("Adding teams…");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          tournamentId: selectedTid,
          teams: parsed,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractApiError(json, "Bulk insert failed"));

      const addedCount = Array.isArray(json) ? json.length : parsed.length;
      toast.success(`Added ${addedCount} teams`, { id: saving });

      setBulkText("");
      await fetchTeams(selectedTid);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to add teams"), { id: saving });
    }
  }

  async function wipeTeamsForTournament() {
    if (!selectedTid) {
      toast.error("Pick a tournament first");
      return;
    }

    const sure = window.confirm(
      "WIPE ALL DATA FOR THIS TOURNAMENT?\n\n" +
        "This will permanently delete:\n" +
        "• games\n" +
        "• teams\n" +
        "• bracket matches\n\n" +
        "This cannot be undone."
    );
    if (!sure) return;

    const saving = toast.loading("Wiping tournament data…");

    try {
      const res = await fetch("/api/teams/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTid,
          wipeMatches: true,
        }),
      });

      const json = await res.json().catch(() => null);
      console.log("WIPE RESPONSE:", res.status, json);

      if (!res.ok) {
        throw new Error(extractApiError(json, `Failed (status ${res.status})`));
      }

      toast.success("Tournament wiped. Ready for fresh import ✅", { id: saving });

      // reset local state
      setTeams([]);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Wipe failed"), { id: saving });
    }
  }

  // THIS is the only generator that matters for your current bracket page
  // because /dashboard/brackets reads from Supabase table "matches".
  async function generateBracketMatchesFromSongs() {
    if (!selectedTid) return toast.error("Pick a tournament first");

    const sure = window.confirm(
      "Generate bracket matches from your songs?\n\nThis will REPLACE the current placeholder matches."
    );
    if (!sure) return;

    const saving = toast.loading("Generating bracket matches…");
    try {
      const res = await fetch("/api/matches/generate-from-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: selectedTid, mode: "seeded", wipeAll: true }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractApiError(json, `Failed (status ${res.status})`));

      const inserted =
        json && typeof json === "object" && "inserted" in json
          ? Number((json as { inserted?: unknown }).inserted ?? 0)
          : 0;

      toast.success(`Matches generated (${inserted})`, { id: saving });
      toast("Now refresh /dashboard/brackets to see the songs 👀");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to generate matches"), { id: saving });
    }
  }

  // ------------------ render ------------------
  return (
    <RequireAuth>
      <main className="p-6 space-y-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Teams Manager</h1>
            <p className="text-gray-600">Add and view songs (teams) for a tournament.</p>
          </div>

          <div className="ml-auto flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Tournament</label>
              <select
                className="border rounded px-3 py-2"
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

              <p className="text-xs text-gray-500 mt-2">
                selectedTid: <span className="font-mono">{String(selectedTid)}</span> • teams:{" "}
                <span className="font-mono">{teams.length}</span>
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm mb-1">
              <input
                type="checkbox"
                checked={showAllTeams}
                onChange={(e) => setShowAllTeams(e.target.checked)}
              />
              Show all teams
            </label>

            <button
              type="button"
              onClick={generateBracketMatchesFromSongs}
              className="rounded bg-[#0A2041] text-white px-4 py-2 disabled:opacity-60"
              disabled={!selectedTid}
              title="Replace placeholder matches with song matchups"
            >
              Generate Bracket Matches from Songs
            </button>

            <button
              type="button"
              onClick={wipeTeamsForTournament}
              className="rounded border border-red-600 text-red-700 px-4 py-2 hover:bg-red-50 disabled:opacity-60"
              disabled={!selectedTid}
            >
              Wipe teams (start fresh)
            </button>
          </div>
        </div>

        {/* Teams list */}
        <section className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Teams — {showAllTeams ? "All tournaments" : selectedTournamentLabel}
            </h2>
            {loadingTeams && <span className="text-sm text-gray-500">Loading…</span>}
          </div>

          {teams.length === 0 ? (
            <p className="text-sm text-gray-600">No teams yet.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="border rounded px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-xs text-gray-500">
                      Seed: {team.seed ?? "—"}
                      {showAllTeams ? (
                        <>
                          {" "}
                          • Tournament: <span className="font-mono">{team.tournamentId}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">ID: {team.id}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Single add */}
        <section className="rounded border p-4">
          <h3 className="font-semibold mb-3">Add a team (single)</h3>
          <form onSubmit={addSingleTeam} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Team name</label>
              <input
                className="border rounded px-3 py-2 min-w-[240px]"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder='e.g. "Dreams - Cranberries"'
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Seed</label>
              <input
                className="border rounded px-3 py-2 w-24"
                type="number"
                min={1}
                max={64}
                value={teamSeed}
                onChange={(e) => setTeamSeed(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 2"
              />
            </div>
            <button
              className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
              disabled={!selectedTid || !teamName.trim()}
            >
              Add team
            </button>
          </form>
        </section>

        {/* Bulk add */}
        <section className="rounded border p-4">
          <h3 className="font-semibold mb-3">Bulk add teams</h3>
          <p className="text-sm text-gray-600 mb-2">
            Paste one per line. Optional format: <code>Seed, Team Name</code>.
          </p>
          <pre className="bg-gray-50 border rounded p-2 text-sm overflow-auto">
{`1, Dreams - Cranberries
16, Sorry Not Sorry - Demi Lovato
8, Dancing On My Own - Robyn`}
          </pre>
          <form onSubmit={addBulkTeams} className="mt-3 space-y-3">
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[140px]"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"1, Dreams - Cranberries\n16, Sorry Not Sorry - Demi Lovato"}
            />
            <button
              className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
              disabled={!selectedTid || !bulkText.trim()}
            >
              Add teams
            </button>
          </form>
        </section>
      </main>
    </RequireAuth>
  );
}
