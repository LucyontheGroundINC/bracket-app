"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminOnly from "@/components/AdminOnly";

type Tournament = {
  id: number;
  name: string;
  year: number | null;
  isLockedManual: boolean | null;
  lockAt: string | null; // ISO string from API
  isActive?: boolean | null;
  createdAt?: string | null;
};

type TeamRow = {
  id: number;
  name: string;
  seed: number | null;
  region: string | null;
};

type TabKey = "overview" | "tournaments" | "teams" | "maintenance";

export default function AdminSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | "">("");
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);
  const [tournamentsDebug, setTournamentsDebug] = useState<unknown>(null);

  // Create tournament
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentYear, setNewTournamentYear] = useState<number | "">("");

  // Lock settings
  const [lockAt, setLockAt] = useState<string>(""); // datetime-local value
  const [lockManual, setLockManual] = useState<boolean>(false);
  const [savingLock, setSavingLock] = useState(false);

  // Teams form
  const [teamName, setTeamName] = useState("");
  const [teamSeed, setTeamSeed] = useState<number | "">("");
  const [teamRegion, setTeamRegion] = useState<string>("East");
  const [savingTeam, setSavingTeam] = useState(false);

  // Teams list
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [generatingBracket, setGeneratingBracket] = useState(false);

  // CSV Importer (Teams)
  const [teamsCsv, setTeamsCsv] = useState<string>("");
  const [teamsImportStatus, setTeamsImportStatus] = useState<string>("");
  const [teamsImporting, setTeamsImporting] = useState(false);

  // Maintenance / status
  const [maintenanceStatus, setMaintenanceStatus] = useState<string>("");

  // CSV Importer (Games)
  const [gamesCsv, setGamesCsv] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string>("");
  const [importing, setImporting] = useState(false);

  async function handleCsvFile(file: File) {
    const text = await file.text();
    setGamesCsv(text);
    setImportStatus("");
  }

  async function handleValidateGamesCsv() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }
    if (!gamesCsv.trim()) {
      alert("Paste CSV or upload a file first.");
      return;
    }

    setImportStatus("Validating…");

    const res = await fetch("/api/admin/import-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: selectedTournamentId,
        csv: gamesCsv,
        dryRun: true,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errors = Array.isArray(json?.errors) ? json.errors : [];
      const summary = errors.length
        ? `${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`
        : json?.error ?? json?.message ?? "Unknown error";
      setImportStatus(
        `Validation failed: ${summary}`
      );
      return;
    }

    setImportStatus(
      `✅ Valid. Parsed rows: ${json?.parsedRows ?? 0}. Resolved rows: ${json?.resolvedRows ?? 0}`
    );
  }

  async function handleImportGamesCsv() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }
    if (!gamesCsv.trim()) {
      alert("Paste CSV or upload a file first.");
      return;
    }

    const sure = window.confirm(
      "Import games from CSV?\n\nThis will upsert games for the selected tournament."
    );
    if (!sure) return;

    setImporting(true);
    setImportStatus("Importing…");

    try {
      const res = await fetch("/api/admin/import-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          csv: gamesCsv,
          dryRun: false,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errors = Array.isArray(json?.errors) ? json.errors : [];
        const summary = errors.length
          ? `${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`
          : json?.error ?? json?.message ?? "Unknown error";
        setImportStatus(`Import failed: ${summary}`);
        return;
      }

      setImportStatus(
        `✅ Imported. Rows upserted: ${json?.rowsUpserted ?? 0} (from ${json?.parsedRows ?? 0} parsed rows).`
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleValidateTeamsCsv() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }
    if (!teamsCsv.trim()) {
      alert("Paste CSV first.");
      return;
    }

    setTeamsImportStatus("Validating teams CSV…");

    const res = await fetch("/api/admin/import-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: selectedTournamentId,
        csv: teamsCsv,
        dryRun: true,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errors = Array.isArray(json?.errors) ? json.errors : [];
      const summary = errors.length
        ? `${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`
        : json?.error ?? json?.message ?? "Unknown error";
      setTeamsImportStatus(`Validation failed: ${summary}`);
      return;
    }

    setTeamsImportStatus(`✅ Valid. Parsed rows: ${json?.parsedRows ?? 0}`);
  }

  async function handleImportTeamsCsv() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }
    if (!teamsCsv.trim()) {
      alert("Paste CSV first.");
      return;
    }

    const sure = window.confirm(
      "Import teams from CSV?\n\nThis will upsert Name/Seed/Region rows for the selected tournament."
    );
    if (!sure) return;

    setTeamsImporting(true);
    setTeamsImportStatus("Importing teams…");

    try {
      const res = await fetch("/api/admin/import-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          csv: teamsCsv,
          dryRun: false,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errors = Array.isArray(json?.errors) ? json.errors : [];
        const summary = errors.length
          ? `${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`
          : json?.error ?? json?.message ?? "Unknown error";
        setTeamsImportStatus(`Import failed: ${summary}`);
        return;
      }

      setTeamsImportStatus(`✅ Imported. Rows upserted: ${json?.rowsUpserted ?? 0}`);

      const refreshed = await fetch(`/api/teams?tournamentId=${selectedTournamentId}`, {
        cache: "no-store",
      });
      const refreshedJson = await refreshed.json().catch(() => []);
      setTeams(Array.isArray(refreshedJson) ? refreshedJson : []);
    } finally {
      setTeamsImporting(false);
    }
  }

  async function handleGenerateBracketFromTeams() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }

    const sure = window.confirm(
      "Generate bracket matches from teams?\n\nThis will rebuild matches for this tournament."
    );
    if (!sure) return;

    setGeneratingBracket(true);
    setTeamsImportStatus("Generating bracket matches…");

    try {
      const res = await fetch("/api/matches/generate-from-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          mode: "seeded",
          wipeAll: true,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setTeamsImportStatus(`Generate failed: ${json?.error ?? json?.message ?? "Unknown error"}`);
        return;
      }

      setTeamsImportStatus(`✅ Bracket generated. Matches inserted: ${json?.inserted ?? 0}`);
    } finally {
      setGeneratingBracket(false);
    }
  }

  // ------------------ Load current user id (for "Reset my picks") ------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };

    init();
  }, []);

  // ------------------ Load tournaments ------------------
  const refreshTournaments = async () => {
    setLoadingTournaments(true);
    setTournamentsError(null);

    try {
      const res = await fetch("/api/tournaments?v=admin", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      // store what the page actually got (debug)
      setTournamentsDebug({ ok: res.ok, status: res.status, json });

      if (!res.ok) {
        console.error("Failed to load tournaments:", json);
        setTournaments([]);
        setTournamentsError(
          (json && (json.error || json.message)) ||
            `Failed to load tournaments (status ${res.status})`
        );
        return;
      }

      // normalize into an array no matter what
      const list: Tournament[] = Array.isArray(json) ? json : json ? [json] : [];
      setTournaments(list);

      // auto-select: if nothing selected, prefer active, else first item
      if (selectedTournamentId === "" && list.length > 0) {
        const active = list.find((t) => t && t.isActive);
        setSelectedTournamentId(active?.id ?? list[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error loading tournaments:", err);
      setTournaments([]);
      setTournamentsError(msg || "Error loading tournaments");
      setTournamentsDebug({ ok: false, status: "fetch-throw", error: msg || String(err) });
    } finally {
      setLoadingTournaments(false);
    }
  };

  useEffect(() => {
    refreshTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------ Load lock settings when tournament changes ------------------
  useEffect(() => {
    const loadLockSettings = async () => {
      if (!selectedTournamentId) {
        setLockAt("");
        setLockManual(false);
        return;
      }
      try {
        const res = await fetch(`/api/tournaments/${selectedTournamentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const t: Tournament = await res.json();

        if (t.lockAt) {
          const dt = new Date(t.lockAt);
          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16); // yyyy-MM-ddTHH:mm
          setLockAt(local);
        } else {
          setLockAt("");
        }
        setLockManual(!!t.isLockedManual);
      } catch (err) {
        console.error("Error loading lock settings:", err);
      }
    };

    if (selectedTournamentId) loadLockSettings();
  }, [selectedTournamentId]);

  // ------------------ Load teams list when tournament changes ------------------
  useEffect(() => {
    const loadTeams = async () => {
      if (!selectedTournamentId) {
        setTeams([]);
        return;
      }
      setLoadingTeams(true);
      try {
        const res = await fetch(`/api/teams?tournamentId=${selectedTournamentId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load teams");
        const json = await res.json();
        setTeams(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error(err);
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };

    if (selectedTournamentId) loadTeams();
  }, [selectedTournamentId]);

  // ------------------ Actions ------------------
  async function handleCreateTournament(e: FormEvent) {
    e.preventDefault();
    if (!newTournamentName.trim()) {
      alert("Please enter a tournament name.");
      return;
    }

    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTournamentName.trim(),
          year: newTournamentYear === "" ? null : Number(newTournamentYear),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Create tournament failed:", json);
        alert((json && (json.error || json.message)) || "Failed to create tournament.");
        return;
      }

      setNewTournamentName("");
      setNewTournamentYear("");
      await refreshTournaments();

      // json should be the created tournament DTO
      if (json?.id) setSelectedTournamentId(Number(json.id));
      alert("Tournament created!");
    } catch (err) {
      console.error(err);
      alert("Error creating tournament.");
    }
  }

  async function handleSaveLockSettings(e: FormEvent) {
    e.preventDefault();
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }

    setSavingLock(true);
    try {
      const lockAtValue = lockAt === "" ? null : new Date(lockAt).toISOString();

      const res = await fetch(`/api/tournaments/${selectedTournamentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isLockedManual: lockManual,
          lockAt: lockAtValue,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Saving lock failed:", json);
        alert((json && (json.error || json.message)) || "Failed to save lock settings.");
        return;
      }

      alert("Lock settings updated.");
      await refreshTournaments();
    } catch (err) {
      console.error(err);
      alert("Error updating lock settings.");
    } finally {
      setSavingLock(false);
    }
  }

  async function handleSetActiveTournament() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }

    const sure = window.confirm(
      "Set this tournament as ACTIVE?\n\nThis will deactivate all other tournaments."
    );
    if (!sure) return;

    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentId}/activate`, {
        method: "PUT",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Activate tournament failed:", json);
        alert((json && (json.error || json.message)) || `Failed (status ${res.status}).`);
        return;
      }

      alert("Active tournament set ✅");
      await refreshTournaments();
    } catch (e) {
      console.error(e);
      alert("Error setting active tournament.");
    }
  }

  async function handleAddTeam(e: FormEvent) {
    e.preventDefault();
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }
    if (!teamName.trim()) {
      alert("Enter a team name.");
      return;
    }

    setSavingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          name: teamName.trim(),
          seed: teamSeed === "" ? null : Number(teamSeed),
          region: teamRegion,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Add team failed:", json);
        alert((json && (json.error || json.message)) || "Failed to add team.");
        return;
      }

      // Refresh teams list
      try {
        const r2 = await fetch(`/api/teams?tournamentId=${selectedTournamentId}`, {
          cache: "no-store",
        });
        const j2 = await r2.json().catch(() => []);
        setTeams(Array.isArray(j2) ? j2 : []);
      } catch {
        // ignore
      }

      setTeamName("");
      setTeamSeed("");
      setTeamRegion("East");
      alert("Team added!");
    } catch (err) {
      console.error(err);
      alert("Error adding team.");
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleRecalcScores() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }

    setMaintenanceStatus("Recalculating scores…");

    try {
      const res = await fetch("/api/scores/recalc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: selectedTournamentId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Recalc failed – status:", res.status, "json:", json);
        setMaintenanceStatus(
          (json && (json.error || json.message)) || `Failed (status ${res.status}).`
        );
        return;
      }

      setMaintenanceStatus(
        `Scores recalculated for ${json?.updatedBrackets ?? 0} brackets across ${
          json?.users ?? 0
        } players ✅`
      );
    } catch (err) {
      console.error("Recalc error:", err);
      setMaintenanceStatus("Error recalculating scores.");
    }
  }

  async function handleNukeTournamentPicks() {
    if (!selectedTournamentId) {
      alert("Select a tournament first.");
      return;
    }

    const sure = window.confirm(
      "⚠ This will delete ALL picks for the selected tournament.\n\nThis cannot be undone. Continue?"
    );
    if (!sure) return;

    setMaintenanceStatus("Nuking picks for this tournament…");

    try {
      const res = await fetch("/api/admin/reset-tournament-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: selectedTournamentId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("reset-tournament-picks failed:", json);
        setMaintenanceStatus("Failed to delete tournament picks.");
        return;
      }

      setMaintenanceStatus(`Deleted ${json?.deleted ?? 0} picks ✅`);
    } catch (err) {
      console.error(err);
      setMaintenanceStatus("Error deleting tournament picks.");
    }
  }

  async function handleResetMyPicks() {
    if (!userId) {
      alert("No user ID found.");
      return;
    }
    const sure = window.confirm(
      "This will delete ALL picks associated with your account.\nThis cannot be undone. Continue?"
    );
    if (!sure) return;

    setMaintenanceStatus("Resetting your picks…");
    try {
      const { error } = await supabase.from("picks").delete().eq("user_id", userId);

      if (error) {
        console.error("Reset picks error:", error.message);
        setMaintenanceStatus("Failed to reset your picks.");
        return;
      }
      setMaintenanceStatus("Your picks have been reset ✅");
    } catch (err) {
      console.error(err);
      setMaintenanceStatus("Error resetting your picks.");
    }
  }

  // ------------------ UI helpers ------------------
  const tabButtonClasses = (key: TabKey) =>
    [
      "px-3 py-2 rounded-full text-xs font-semibold transition",
      activeTab === key
        ? "bg-[#CA4C4C] text-[#F8F5EE]"
        : "bg-white/70 text-[#0A2041] hover:bg-white",
      "border border-[#F5B8B0]",
    ].join(" ");

  const groupedTeamsByRegion = useMemo(() => {
    const groups: Record<string, TeamRow[]> = {};
    for (const t of teams) {
      const region = t.region || "Unknown";
      if (!groups[region]) groups[region] = [];
      groups[region].push(t);
    }
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => {
        const sa = a.seed ?? 999;
        const sb = b.seed ?? 999;
        return sa - sb;
      })
    );
    return groups;
  }, [teams]);

  const activeTournament = useMemo(
    () => (Array.isArray(tournaments) ? tournaments : []).find((t) => !!t?.isActive),
    [tournaments]
  );

  // ------------------ Render ------------------
  return (
    <AdminOnly>
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 pb-10 px-4">
        <main className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-black bg-[#0A2041] text-[#F8F5EE]"
              >
                ← Admin Control Center
              </Link>

              <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-[#CA4C4C]">
                Bracket Madness Admin
              </h1>
              <p className="text-sm text-[#0A2041]/70 mt-1">
                Manage tournaments, teams, locks, and scoring.
              </p>
              <p className="mt-2 text-[11px] text-[#0A2041]/60">Build marker: admin-settings-v4</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => setActiveTab("overview")} className={tabButtonClasses("overview")}>
                Overview
              </button>
              <button
                onClick={() => setActiveTab("tournaments")}
                className={tabButtonClasses("tournaments")}
              >
                Tournaments
              </button>
              <button onClick={() => setActiveTab("teams")} className={tabButtonClasses("teams")}>
                Teams
              </button>
              <button
                onClick={() => setActiveTab("maintenance")}
                className={tabButtonClasses("maintenance")}
              >
                Maintenance
              </button>
            </div>
          </div>

          {/* Tournament selector */}
          <div className="mb-6 bg-white/90 border border-[#F5B8B0] rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#CA4C4C]">Tournament</h2>
                <p className="text-xs text-[#0A2041]/70">
                  Most actions below apply to the selected tournament.
                  {activeTournament?.id ? (
                    <span className="ml-2 text-[#0A2041]/60">
                      (Currently active:{" "}
                      <span className="font-semibold">{activeTournament.name}</span>)
                    </span>
                  ) : null}
                </p>

                {tournamentsError ? (
                  <p className="mt-2 text-xs text-[#CA4C4C]">{tournamentsError}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTournamentId}
                  onChange={(e) =>
                    setSelectedTournamentId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select tournament…</option>
                  {(Array.isArray(tournaments) ? tournaments : []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.year ? `(${t.year})` : ""} {t.isActive ? "✅ Active" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!selectedTournamentId}
                  onClick={handleSetActiveTournament}
                  className={[
                    "px-3 py-2 rounded-lg text-xs font-semibold transition border",
                    selectedTournamentId
                      ? "bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0] border-[#A7C4E7]"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300",
                  ].join(" ")}
                >
                  Set Active
                </button>

                <button
                  type="button"
                  onClick={refreshTournaments}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/80 border border-[#F5B8B0] hover:bg-white"
                >
                  Refresh
                </button>

                {loadingTournaments ? (
                  <span className="text-xs text-[#0A2041]/60">Loading…</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 text-[11px] text-[#0A2041]/60">
              <div className="flex items-center justify-between">
                <span>
                  Debug: tournaments loaded = {Array.isArray(tournaments) ? tournaments.length : 0}
                </span>
                <span>
                  selectedTournamentId = {selectedTournamentId === "" ? "(none)" : selectedTournamentId}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs content */}
          <div className="space-y-6">
            {activeTab === "overview" ? (
              <section className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                <h2 className="text-lg font-semibold mb-3 text-[#CA4C4C]">Quick Overview</h2>
                <ul className="list-disc list-inside text-sm text-[#0A2041]/80 space-y-2">
                  <li>
                    Use the <strong>Tournaments</strong> tab to create contests and control the{" "}
                    <em>lock date/time</em>.
                  </li>
                  <li>
                    Use the <strong>Teams</strong> tab to add teams and double-check seeds/regions in
                    the “Teams by Region” panel.
                  </li>
                  <li>
                    Use the <strong>Maintenance</strong> tab to recalc scores, reset picks, and import games.
                  </li>
                </ul>

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-[#CA4C4C] font-semibold">
                    View tournaments fetch payload (debug)
                  </summary>
                  <pre className="mt-2 p-3 bg-[#FDF3EE] border border-[#F5B8B0] rounded-xl overflow-auto text-[11px]">
                    {JSON.stringify(tournamentsDebug, null, 2)}
                  </pre>
                </details>
              </section>
            ) : null}

            {activeTab === "tournaments" ? (
              <section className="grid md:grid-cols-2 gap-5">
                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">Create New Tournament</h2>
                  <form onSubmit={handleCreateTournament} className="space-y-3 text-sm">
                    <div>
                      <label className="block text-xs mb-1 text-[#0A2041]/70">
                        Tournament Name
                      </label>
                      <input
                        type="text"
                        value={newTournamentName}
                        onChange={(e) => setNewTournamentName(e.target.value)}
                        className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. Lucy’s Music Madness 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1 text-[#0A2041]/70">Year (required)</label>
                      <input
                        type="number"
                        value={newTournamentYear}
                        onChange={(e) =>
                          setNewTournamentYear(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                        placeholder="2026"
                      />
                      <p className="text-[11px] text-[#0A2041]/60 mt-1">
                        Your DB has <code>year</code> as NOT NULL, so you must provide it.
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition"
                    >
                      Create Tournament
                    </button>
                  </form>
                </div>

                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">Lock Settings</h2>
                  <form onSubmit={handleSaveLockSettings} className="space-y-3 text-sm">
                    <div>
                      <label className="block text-xs mb-1 text-[#0A2041]/70">
                        Lock at (date &amp; time)
                      </label>
                      <input
                        type="datetime-local"
                        value={lockAt}
                        onChange={(e) => setLockAt(e.target.value)}
                        className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                      />
                      <p className="text-[11px] text-[#0A2041]/60 mt-1">
                        After this time, users won’t be able to change their picks.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="manualLock"
                        type="checkbox"
                        checked={lockManual}
                        onChange={(e) => setLockManual(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor="manualLock" className="text-xs text-[#0A2041]/80">
                        Lock manually now (even if the date hasn’t passed)
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={savingLock || !selectedTournamentId}
                      className={[
                        "mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold",
                        selectedTournamentId
                          ? "bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0]"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {savingLock ? "Saving…" : "Save Lock Settings"}
                    </button>
                  </form>
                </div>
              </section>
            ) : null}

            {activeTab === "teams" ? (
              <section className="space-y-5">
                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">Add Teams to Tournament</h2>
                  <form onSubmit={handleAddTeam} className="space-y-3 text-sm">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1 text-[#0A2041]/70">Team Name</label>
                        <input
                          type="text"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                          placeholder="e.g. Teresa’s Table-Flippers"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1 text-[#0A2041]/70">Seed (optional)</label>
                        <input
                          type="number"
                          value={teamSeed}
                          onChange={(e) =>
                            setTeamSeed(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                          placeholder="1–16"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1 text-[#0A2041]/70">Region</label>
                        <select
                          value={teamRegion}
                          onChange={(e) => setTeamRegion(e.target.value)}
                          className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="East">East</option>
                          <option value="West">West</option>
                          <option value="South">South</option>
                          <option value="Midwest">Midwest</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingTeam || !selectedTournamentId}
                      className={[
                        "mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold",
                        selectedTournamentId
                          ? "bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a]"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {savingTeam ? "Saving…" : "Add Team"}
                    </button>

                    {!selectedTournamentId ? (
                      <p className="mt-2 text-[11px] text-[#CA4C4C]">
                        Select a tournament above before adding teams.
                      </p>
                    ) : null}
                  </form>
                </div>

                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-1 text-[#CA4C4C]">Bulk Import Teams (CSV)</h2>
                  <p className="text-xs text-[#0A2041]/70 mb-3">
                    Paste 64 team rows using <code>Region,Seed,Name</code> (header row optional).
                    Regions accepted: North, East, South, West.
                  </p>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <button
                        type="button"
                        onClick={handleValidateTeamsCsv}
                        disabled={!selectedTournamentId || !teamsCsv.trim() || teamsImporting}
                        className={[
                          "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border",
                          selectedTournamentId && teamsCsv.trim()
                            ? "bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0] border-[#A7C4E7]"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300",
                        ].join(" ")}
                      >
                        Validate
                      </button>

                      <button
                        type="button"
                        onClick={handleImportTeamsCsv}
                        disabled={!selectedTournamentId || !teamsCsv.trim() || teamsImporting}
                        className={[
                          "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border",
                          selectedTournamentId && teamsCsv.trim()
                            ? "bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] border-[#CA4C4C]"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300",
                        ].join(" ")}
                      >
                        {teamsImporting ? "Importing…" : "Import Teams"}
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateBracketFromTeams}
                        disabled={!selectedTournamentId || generatingBracket || teamsImporting}
                        className={[
                          "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border",
                          selectedTournamentId
                            ? "bg-[#0A2041] text-[#F8F5EE] hover:opacity-90 border-[#0A2041]"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300",
                        ].join(" ")}
                      >
                        {generatingBracket ? "Generating…" : "Generate Bracket Matches"}
                      </button>
                    </div>

                    <textarea
                      value={teamsCsv}
                      onChange={(e) => setTeamsCsv(e.target.value)}
                      placeholder={[
                        "Region,Seed,Name",
                        "North,1,Team A",
                        "North,16,Team B",
                        "... (64 team rows total)",
                      ].join("\n")}
                      className="w-full min-h-[180px] rounded-xl border border-[#F5B8B0] bg-[#FDF3EE] p-3 text-[12px] font-mono"
                    />

                    {teamsImportStatus ? (
                      <p className="text-xs text-[#0A2041]/80">{teamsImportStatus}</p>
                    ) : null}
                  </div>
                </div>

                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-[#CA4C4C]">Teams by Region</h2>
                    {loadingTeams ? (
                      <span className="text-xs text-[#0A2041]/60">Loading…</span>
                    ) : null}
                  </div>

                  {(!selectedTournamentId || teams.length === 0) && !loadingTeams ? (
                    <p className="text-xs text-[#0A2041]/70">
                      {selectedTournamentId
                        ? "No teams found for this tournament yet."
                        : "Select a tournament above to view its teams."}
                    </p>
                  ) : (
                    <div className="grid md:grid-cols-4 gap-4 text-xs">
                      {["East", "West", "South", "Midwest"].map((region) => {
                        const list = groupedTeamsByRegion[region] || [];
                        return (
                          <div
                            key={region}
                            className="bg-[#FDF3EE] border border-[#F5B8B0] rounded-xl p-3"
                          >
                            <h3 className="font-semibold mb-2 text-[#0A2041]">{region}</h3>
                            {list.length === 0 ? (
                              <p className="text-[11px] text-[#0A2041]/60">No teams yet.</p>
                            ) : (
                              <ul className="space-y-1">
                                {list.map((t) => (
                                  <li key={t.id} className="flex justify-between gap-2">
                                    <span className="truncate">{t.name}</span>
                                    {t.seed != null ? (
                                      <span className="text-[11px] text-[#0A2041]/60">#{t.seed}</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "maintenance" ? (
              <section className="space-y-5">
                {/* Maintenance & Utilities */}
                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">Maintenance & Utilities</h2>

                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <button
                      onClick={handleRecalcScores}
                      disabled={!selectedTournamentId}
                      className={[
                        "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold",
                        selectedTournamentId
                          ? "bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0]"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed",
                      ].join(" ")}
                    >
                      Recalculate Leaderboard Scores
                    </button>

                    <button
                      onClick={handleNukeTournamentPicks}
                      disabled={!selectedTournamentId}
                      className={[
                        "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold",
                        selectedTournamentId
                          ? "bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a]"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed",
                      ].join(" ")}
                    >
                      Nuke picks for selected tournament
                    </button>
                  </div>

                  {!selectedTournamentId ? (
                    <p className="mt-2 text-[11px] text-[#CA4C4C]">
                      Select a tournament above before running maintenance actions.
                    </p>
                  ) : null}

                  {maintenanceStatus ? (
                    <p className="mt-3 text-xs text-[#0A2041]/80">{maintenanceStatus}</p>
                  ) : null}
                </div>

                {/* CSV Importer card */}
                <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-1 text-[#CA4C4C]">Import Games (CSV)</h2>
                  <p className="text-xs text-[#0A2041]/70 mb-3">
                    Upload or paste a CSV to create/upsert games for the selected tournament.
                  </p>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCsvFile(f);
                        }}
                        className="text-xs"
                      />

                      <button
                        type="button"
                        onClick={handleValidateGamesCsv}
                        disabled={!selectedTournamentId || !gamesCsv.trim() || importing}
                        className={[
                          "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border",
                          selectedTournamentId && gamesCsv.trim()
                            ? "bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0] border-[#A7C4E7]"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300",
                        ].join(" ")}
                      >
                        Validate
                      </button>

                      <button
                        type="button"
                        onClick={handleImportGamesCsv}
                        disabled={!selectedTournamentId || !gamesCsv.trim() || importing}
                        className={[
                          "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border",
                          selectedTournamentId && gamesCsv.trim()
                            ? "bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] border-[#CA4C4C]"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300",
                        ].join(" ")}
                      >
                        {importing ? "Importing…" : "Import"}
                      </button>
                    </div>

                    <textarea
                      value={gamesCsv}
                      onChange={(e) => setGamesCsv(e.target.value)}
                      placeholder={[
                        "Paste CSV here…",
                        "",
                        "Option A (IDs): round,game_index,team_a_id,team_b_id,winner_id",
                        "Option B (Names): round,game_index,team_a_name,team_b_name,winner_name",
                      ].join("\n")}
                      className="w-full min-h-[140px] rounded-xl border border-[#F5B8B0] bg-[#FDF3EE] p-3 text-[12px] font-mono"
                    />

                    <p className="text-[11px] text-[#0A2041]/60">
                      Expected columns: <code>round,game_index</code> + either team IDs (
                      <code>team_a_id,team_b_id,winner_id</code>) or team names (
                      <code>team_a_name,team_b_name,winner_name</code>).
                    </p>

                    {importStatus ? (
                      <p className="text-xs text-[#0A2041]/80">{importStatus}</p>
                    ) : null}
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-[#FDF3EE] border border-[#CA4C4C] rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold mb-2 text-[#CA4C4C]">Danger Zone</h2>

                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <button
                      onClick={handleResetMyPicks}
                      className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a]"
                    >
                      Reset <span className="mx-1 font-bold">my</span> picks (Supabase)
                    </button>
                  </div>

                  {maintenanceStatus ? (
                    <p className="mt-3 text-xs text-[#0A2041]/80">{maintenanceStatus}</p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </AdminOnly>
  );
}
