'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_EMAIL = 'lucyonthegroundwithrocks@gmail.com';

type Tournament = {
  id: number;
  name: string;
  year: number | null;
  isLockedManual: boolean | null;
  lockAt: string | null; // ISO from API
  isActive?: boolean | null; // optional: if your API returns it
};

type TeamRow = {
  id: number;
  name: string;
  seed: number | null;
  region: string | null;
};

type TabKey = 'overview' | 'tournaments' | 'teams' | 'maintenance';

export default function AdminSettingsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | ''>('');

  // Create tournament
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentYear, setNewTournamentYear] = useState<number | ''>('');

  // Lock settings
  const [lockAt, setLockAt] = useState<string>(''); // datetime-local value
  const [lockManual, setLockManual] = useState<boolean>(false);
  const [savingLock, setSavingLock] = useState(false);

  // Teams form
  const [teamName, setTeamName] = useState('');
  const [teamSeed, setTeamSeed] = useState<number | ''>('');
  const [teamRegion, setTeamRegion] = useState<string>('East');
  const [savingTeam, setSavingTeam] = useState(false);

  // Teams list
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Maintenance / status
  const [maintenanceStatus, setMaintenanceStatus] = useState<string>('');

  // ------------------ Auth / Admin check ------------------
  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error loading user:', error.message);
        setIsAdmin(false);
        return;
      }
      const email = data.user?.email ?? null;
      const uid = data.user?.id ?? null;
      setUserEmail(email);
      setUserId(uid);
      setIsAdmin(email === ADMIN_EMAIL);
    };

    init();
  }, []);

  // ------------------ Load tournaments ------------------
const refreshTournaments = async () => {
  setLoadingTournaments(true);
  try {
    const res = await fetch("/api/tournaments?v=admin", { cache: "no-store" });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Failed to load tournaments:", json);
      setTournaments([]);
      return;
    }

    const list = Array.isArray(json) ? json : json ? [json] : [];
    setTournaments(list);
  } catch (err) {
    console.error("Error loading tournaments:", err);
    setTournaments([]);
  } finally {
    setLoadingTournaments(false);
  }
};


  // ------------------ Load lock settings when tournament changes ------------------
  useEffect(() => {
    const loadLockSettings = async () => {
      if (!selectedTournamentId) {
        setLockAt('');
        setLockManual(false);
        return;
      }
      try {
        const res = await fetch(`/api/tournaments/${selectedTournamentId}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const t: Tournament = await res.json();

        if (t.lockAt) {
          const dt = new Date(t.lockAt);
          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16); // yyyy-MM-ddTHH:mm
          setLockAt(local);
        } else {
          setLockAt('');
        }
        setLockManual(!!t.isLockedManual);
      } catch (err) {
        console.error('Error loading lock settings:', err);
      }
    };

    if (isAdmin && selectedTournamentId) {
      loadLockSettings();
    }
  }, [isAdmin, selectedTournamentId]);

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
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load teams');

        const json: unknown = await res.json();

        if (!Array.isArray(json)) {
          console.error('[admin/settings] /api/teams did not return an array:', json);
          setTeams([]);
          return;
        }

        setTeams(json as TeamRow[]);
      } catch (err) {
        console.error(err);
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };

    if (isAdmin && selectedTournamentId) {
      loadTeams();
    }
  }, [isAdmin, selectedTournamentId]);

  // ------------------ Actions ------------------
  async function handleCreateTournament(e: FormEvent) {
    e.preventDefault();
    if (!newTournamentName.trim()) {
      alert('Please enter a tournament name.');
      return;
    }

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTournamentName.trim(),
          year: newTournamentYear === '' ? null : Number(newTournamentYear),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('Create tournament failed:', err);
        alert('Failed to create tournament.');
        return;
      }

      const created: unknown = await res.json();
      const createdAny = created as Partial<Tournament> | null;

      if (!createdAny || typeof createdAny.id !== 'number') {
        console.error('[admin/settings] Create tournament unexpected response:', created);
        alert('Tournament created, but response was unexpected.');
        await refreshTournaments();
        return;
      }

      setTournaments((prev) => [...prev, createdAny as Tournament]);
      setNewTournamentName('');
      setNewTournamentYear('');
      setSelectedTournamentId(createdAny.id);
      alert('Tournament created!');
    } catch (err) {
      console.error(err);
      alert('Error creating tournament.');
    }
  }

  async function handleSaveLockSettings(e: FormEvent) {
    e.preventDefault();
    if (!selectedTournamentId) {
      alert('Select a tournament first.');
      return;
    }

    setSavingLock(true);
    try {
      const lockAtValue = lockAt === '' ? null : new Date(lockAt).toISOString();

      const res = await fetch(`/api/tournaments/${selectedTournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLockedManual: lockManual,
          lockAt: lockAtValue,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('Saving lock failed:', err);
        alert('Failed to save lock settings.');
        return;
      }

      alert('Lock settings updated.');
      await refreshTournaments();
    } catch (err) {
      console.error(err);
      alert('Error updating lock settings.');
    } finally {
      setSavingLock(false);
    }
  }

  async function handleSetActiveTournament() {
    if (!selectedTournamentId) {
      alert('Select a tournament first.');
      return;
    }

    const sure = window.confirm(
      'Set this tournament as ACTIVE?\n\nThis will deactivate all other tournaments.'
    );
    if (!sure) return;

    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentId}/activate`, {
        method: 'PUT',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error('Activate tournament failed:', json);
        alert(
          (json && (json as any).error) ||
            `Failed to set active tournament (status ${res.status}).`
        );
        return;
      }

      alert(`Active tournament set ✅\n\n${(json as any)?.name ?? 'Selected tournament'}`);
      await refreshTournaments();
    } catch (e) {
      console.error(e);
      alert('Error setting active tournament.');
    }
  }

  async function handleAddTeam(e: FormEvent) {
    e.preventDefault();
    if (!selectedTournamentId) {
      alert('Select a tournament first.');
      return;
    }
    if (!teamName.trim()) {
      alert('Enter a team name.');
      return;
    }

    setSavingTeam(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          name: teamName.trim(),
          seed: teamSeed === '' ? null : Number(teamSeed),
          region: teamRegion,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('Add team failed:', err);
        alert('Failed to add team.');
        return;
      }

      // refresh teams list safely
      try {
        const r2 = await fetch(`/api/teams?tournamentId=${selectedTournamentId}`, {
          cache: 'no-store',
        });
        const json2: unknown = await r2.json().catch(() => null);

        if (Array.isArray(json2)) {
          setTeams(json2 as TeamRow[]);
        } else {
          console.warn('[admin/settings] /api/teams refresh did not return array:', json2);
          setTeams([]);
        }
      } catch {
        // ignore
      }

      setTeamName('');
      setTeamSeed('');
      setTeamRegion('East');
      alert('Team added!');
    } catch (err) {
      console.error(err);
      alert('Error adding team.');
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleRecalcScores() {
    if (!selectedTournamentId) {
      alert('Select a tournament first.');
      return;
    }

    setMaintenanceStatus('Recalculating scores…');

    try {
      const res = await fetch('/api/scores/recalc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId }),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        console.error('Recalc failed – status:', res.status, 'json:', json);
        setMaintenanceStatus(
          (json && (json as any).error) || `Failed to recalc scores (status ${res.status}).`
        );
        return;
      }

      setMaintenanceStatus(
        `Scores recalculated for ${(json as any)?.updatedBrackets ?? 0} brackets across ${
          (json as any)?.users ?? 0
        } players ✅`
      );
    } catch (err) {
      console.error('Recalc error:', err);
      setMaintenanceStatus('Error recalculating scores.');
    }
  }

  async function handleNukeTournamentPicks() {
    if (!selectedTournamentId) {
      alert('Select a tournament first.');
      return;
    }

    const sure = window.confirm(
      '⚠ This will delete ALL picks for the selected tournament in the main bracket database.\n\n' +
        'This cannot be undone. Are you absolutely sure?'
    );
    if (!sure) return;

    setMaintenanceStatus('Nuking picks for this tournament…');

    try {
      const res = await fetch('/api/admin/reset-tournament-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('reset-tournament-picks failed:', err);
        setMaintenanceStatus('Failed to delete tournament picks.');
        return;
      }

      const json: any = await res.json().catch(() => ({}));
      setMaintenanceStatus(`Deleted ${json.deleted ?? 0} picks for this tournament ✅`);
    } catch (err) {
      console.error(err);
      setMaintenanceStatus('Error deleting tournament picks.');
    }
  }

  async function handleResetMyPicks() {
    if (!userId) {
      alert('No user ID found.');
      return;
    }
    const sure = window.confirm(
      'This will delete ALL picks associated with your account in Supabase.\nThis cannot be undone. Continue?'
    );
    if (!sure) return;

    setMaintenanceStatus('Resetting your picks…');
    try {
      const { error } = await supabase.from('picks').delete().eq('user_id', userId);

      if (error) {
        console.error('Reset picks error:', error.message);
        setMaintenanceStatus('Failed to reset your picks.');
        return;
      }
      setMaintenanceStatus('Your picks have been reset ✅');
    } catch (err) {
      console.error(err);
      setMaintenanceStatus('Error resetting your picks.');
    }
  }

  // ------------------ UI helpers ------------------
  const tabButtonClasses = (key: TabKey) =>
    [
      'px-3 py-2 rounded-full text-xs font-semibold transition',
      activeTab === key
        ? 'bg-[#CA4C4C] text-[#F8F5EE]'
        : 'bg-white/70 text-[#0A2041] hover:bg-white',
      'border border-[#F5B8B0]',
    ].join(' ');

  const groupedTeamsByRegion = useMemo(() => {
    const groups: Record<string, TeamRow[]> = {};
    for (const t of teams) {
      const region = t.region || 'Unknown';
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

const activeTournament = (Array.isArray(tournaments) ? tournaments : []).find((t) => t.isActive);


  // ------------------ Render ------------------
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center">
        Checking access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-semibold mb-2 text-[#CA4C4C]">Not authorized</h1>
        <p className="text-sm text-[#0A2041]/80 text-center max-w-md">
          You must be signed in as the admin ({ADMIN_EMAIL}) to view this page.
        </p>
        {userEmail && (
          <p className="mt-2 text-xs text-[#0A2041]/60">You are signed in as: {userEmail}</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 pb-10 px-4">
      <main className="max-w-5xl mx-auto">
        {/* Title + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#CA4C4C]">Admin Control Center</h1>
            <p className="text-sm text-[#0A2041]/70 mt-1">
              Manage tournaments, teams, locks, and scoring.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('overview')} className={tabButtonClasses('overview')}>
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tournaments')}
              className={tabButtonClasses('tournaments')}
            >
              Tournaments
            </button>
            <button onClick={() => setActiveTab('teams')} className={tabButtonClasses('teams')}>
              Teams
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={tabButtonClasses('maintenance')}
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
                    (Currently active:{' '}
                    <span className="font-semibold">{activeTournament.name}</span>)
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedTournamentId}
                onChange={(e) =>
                  setSelectedTournamentId(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select tournament…</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.year ? `(${t.year})` : ''} {t.isActive ? '✅ Active' : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedTournamentId}
                onClick={handleSetActiveTournament}
                className={[
                  'px-3 py-2 rounded-lg text-xs font-semibold transition border',
                  selectedTournamentId
                    ? 'bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0] border-[#A7C4E7]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300',
                ].join(' ')}
              >
                Set Active
              </button>

              {loadingTournaments && <span className="text-xs text-[#0A2041]/60">Loading…</span>}
            </div>
          </div>
        </div>

        {/* Tabs content */}
        <div className="space-y-6">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <section className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-3 text-[#CA4C4C]">Quick Overview</h2>
              <ul className="list-disc list-inside text-sm text-[#0A2041]/80 space-y-2">
                <li>
                  Use the <strong>Tournaments</strong> tab to create contests and control the{' '}
                  <em>lock date/time</em>.
                </li>
                <li>
                  Use the <strong>Teams</strong> tab to add teams and double-check seeds/regions in
                  the “Teams by Region” panel.
                </li>
                <li>
                  Use the <strong>Maintenance</strong> tab to recalc scores or reset picks.
                </li>
              </ul>
            </section>
          )}

          {/* TOURNAMENTS */}
          {activeTab === 'tournaments' && (
            <section className="grid md:grid-cols-2 gap-5">
              {/* Create Tournament */}
              <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">Create New Tournament</h2>
                <form onSubmit={handleCreateTournament} className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs mb-1 text-[#0A2041]/70">Tournament Name</label>
                    <input
                      type="text"
                      value={newTournamentName}
                      onChange={(e) => setNewTournamentName(e.target.value)}
                      className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                      placeholder="e.g. Lucy’s Chaos Bracket 2026"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-[#0A2041]/70">Year (optional)</label>
                    <input
                      type="number"
                      value={newTournamentYear}
                      onChange={(e) =>
                        setNewTournamentYear(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full bg-[#FDF3EE] border border-[#F5B8B0] rounded-lg px-3 py-2 text-sm"
                      placeholder="2026"
                    />
                  </div>
                  <button
                    type="submit"
                    className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition"
                  >
                    Create Tournament
                  </button>
                </form>
              </div>

              {/* Lock Settings */}
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
                      'mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold',
                      selectedTournamentId
                        ? 'bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0]'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {savingLock ? 'Saving…' : 'Save Lock Settings'}
                  </button>
                </form>
              </div>
            </section>
          )}

          {/* TEAMS */}
          {activeTab === 'teams' && (
            <section className="space-y-5">
              {/* Add Team */}
              <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">
                  Add Teams to Tournament
                </h2>
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
                      <label className="block text-xs mb-1 text-[#0A2041]/70">
                        Seed (optional)
                      </label>
                      <input
                        type="number"
                        value={teamSeed}
                        onChange={(e) =>
                          setTeamSeed(e.target.value === '' ? '' : Number(e.target.value))
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
                      {!loadingTournaments && tournaments.length === 0 && (
  <div className="text-xs text-[#CA4C4C] mt-2">
    No tournaments loaded. Visit <code>/api/tournaments</code> to verify.
  </div>
)}

                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingTeam || !selectedTournamentId}
                    className={[
                      'mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold',
                      selectedTournamentId
                        ? 'bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a]'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {savingTeam ? 'Saving…' : 'Add Team'}
                  </button>

                  {!selectedTournamentId && (
                    <p className="mt-2 text-[11px] text-[#CA4C4C]">
                      Select a tournament above before adding teams.
                    </p>
                  )}
                </form>
              </div>

              {/* Teams by Region */}
              <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#CA4C4C]">Teams by Region</h2>
                  {loadingTeams && <span className="text-xs text-[#0A2041]/60">Loading…</span>}
                </div>

                {(!selectedTournamentId || teams.length === 0) && !loadingTeams ? (
                  <p className="text-xs text-[#0A2041]/70">
                    {selectedTournamentId
                      ? 'No teams found for this tournament yet.'
                      : 'Select a tournament above to view its teams.'}
                  </p>
                ) : (
                  <div className="grid md:grid-cols-4 gap-4 text-xs">
                    {['East', 'West', 'South', 'Midwest'].map((region) => {
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
                                  {t.seed != null && (
                                    <span className="text-[11px] text-[#0A2041]/60">#{t.seed}</span>
                                  )}
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
          )}

          {/* MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <section className="space-y-5">
              <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold mb-3 text-[#CA4C4C]">
                  Maintenance & Utilities
                </h2>
                <p className="text-sm text-[#0A2041]/80 mb-3">
                  Use these tools after updating winners or making scoring changes.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <button
                    onClick={handleRecalcScores}
                    disabled={!selectedTournamentId}
                    className={[
                      'inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold',
                      selectedTournamentId
                        ? 'bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0]'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    Recalculate Leaderboard Scores
                  </button>

                  <button
                    onClick={handleNukeTournamentPicks}
                    disabled={!selectedTournamentId}
                    className={[
                      'inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold',
                      selectedTournamentId
                        ? 'bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a]'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    Nuke picks for selected tournament
                  </button>
                </div>

                {!selectedTournamentId && (
                  <p className="mt-2 text-[11px] text-[#CA4C4C]">
                    Select a tournament above before running maintenance actions.
                  </p>
                )}
              </div>

              <div className="bg-[#FDF3EE] border border-[#CA4C4C] rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold mb-2 text-[#CA4C4C]">Danger Zone</h2>
                <p className="text-[11px] text-[#0A2041]/80 mb-3">
                  These actions are destructive. Please double-check before you click.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <button
                    onClick={handleResetMyPicks}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a]"
                  >
                    Reset <span className="mx-1 font-bold">my</span> picks (Supabase)
                  </button>
                  <p className="text-[11px] text-[#0A2041]/80 max-w-md">
                    Deletes all rows in the Supabase <code className="font-mono">picks</code> table
                    where <code className="font-mono">user_id</code> = your account.
                  </p>
                </div>

                {maintenanceStatus && (
                  <p className="mt-3 text-xs text-[#0A2041]/80">{maintenanceStatus}</p>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
