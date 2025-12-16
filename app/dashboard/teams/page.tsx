"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import toast from "react-hot-toast";

type Tournament = { id: number; name: string; year: number; isActive?: boolean };
type Team = { id: number; name: string; seed: number | null; tournamentId: number };

export default function TeamsManagerPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // single add
  const [teamName, setTeamName] = useState("");
  const [teamSeed, setTeamSeed] = useState<number | "">("");

  // bulk add (one per line: "Seed, Team Name" or just "Team Name")
  const [bulkText, setBulkText] = useState("");

  // load tournaments on mount
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/tournaments");
      if (!res.ok) {
        toast.error("Failed to load tournaments");
        return;
      }
      const rows = (await res.json()) as Tournament[];
      setTournaments(rows);
      if (rows.length && selectedTid == null) {
        setSelectedTid(rows[0].id);
      }
    })();
  }, []);

  // load teams whenever tournament changes
  useEffect(() => {
    if (!selectedTid) return;
    (async () => {
      setLoadingTeams(true);
      try {
        const res = await fetch(`/api/teams?tournamentId=${selectedTid}`);
        if (!res.ok) throw new Error("Failed to load teams");
        const rows = (await res.json()) as Team[];
        setTeams(rows);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load teams");
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, [selectedTid]);

  const selectedTournamentLabel = useMemo(() => {
    const t = tournaments.find(t => t.id === selectedTid);
    return t ? `${t.name} ${t.year}` : "Select tournament";
  }, [tournaments, selectedTid]);

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
        body: JSON.stringify({
          name,
          seed: teamSeed === "" ? null : Number(teamSeed),
          tournamentId: selectedTid,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to add team");
      toast.success("Team added", { id: saving });
      setTeamName("");
      setTeamSeed("");
      // refresh teams
      const r2 = await fetch(`/api/teams?tournamentId=${selectedTid}`);
      setTeams(await r2.json());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add team");
    }
  }

  async function addBulkTeams(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTid) return toast.error("Pick a tournament first");
    const lines = bulkText
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    if (!lines.length) return toast.error("Nothing to import");

    // parse lines: allow "Seed, Team Name" OR "Team Name"
    const parsed = lines.map(line => {
      const m = line.split(",").map(s => s.trim());
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
        body: JSON.stringify({
          tournamentId: selectedTid,
          teams: parsed,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Bulk insert failed");
      toast.success(`Added ${json.length ?? parsed.length} teams`, { id: saving });
      setBulkText("");
      // refresh teams
      const r2 = await fetch(`/api/teams?tournamentId=${selectedTid}`);
      setTeams(await r2.json());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add teams");
    }
  }

  return (
    <RequireAuth>
      <main className="p-6 space-y-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Teams Manager</h1>
            <p className="text-gray-600">Add and view teams for a tournament.</p>
          </div>

          <div className="ml-auto">
            <label className="block text-sm font-medium mb-1">Tournament</label>
            <select
              className="border rounded px-3 py-2"
              value={selectedTid ?? ""}
              onChange={(e) => setSelectedTid(Number(e.target.value) || null)}
            >
              <option value="">Select…</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Teams list */}
        <section className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Teams — {selectedTournamentLabel}</h2>
            {loadingTeams && <span className="text-sm text-gray-500">Loading…</span>}
          </div>
          {teams.length === 0 ? (
            <p className="text-sm text-gray-600">No teams yet.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {teams.map(team => (
                <li key={team.id} className="border rounded px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-xs text-gray-500">
                      Seed: {team.seed ?? "—"}
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
                placeholder="Duke"
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
            Paste one per line. Optional format: <code>Seed, Team Name</code>. Example:
          </p>
          <pre className="bg-gray-50 border rounded p-2 text-sm overflow-auto">
{`1, Alabama
2, Arizona
3, Baylor
UConn
Gonzaga`}
          </pre>
          <form onSubmit={addBulkTeams} className="mt-3 space-y-3">
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[140px]"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="1, Alabama&#10;2, Arizona&#10;3, Baylor"
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
