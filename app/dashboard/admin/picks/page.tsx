'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// same admin email as everywhere else
const ADMIN_EMAIL = 'lucyonthegroundwithrocks@gmail.com';

type MatchInfo = {
  round: number;
  match_order: number;
  team1_name: string;
  team2_name: string;
};

type AdminPickRow = {
  id: string;
  user_id: string;
  chosen_winner: 'team1' | 'team2';
  // Supabase sometimes types nested relations as arrays, so allow both
  match: MatchInfo | MatchInfo[] | null;
};

export default function AdminPicksPage() {
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [picks, setPicks] = useState<AdminPickRow[]>([]);
  const [savingPickId, setSavingPickId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // check current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('Error getting user:', userError.message);
        setIsAdmin(false);
        setAuthChecking(false);
        setLoading(false);
        return;
      }

      const email = user?.email ?? null;
      setAdminEmail(email);
      const admin = email === ADMIN_EMAIL;
      setIsAdmin(admin);
      setAuthChecking(false);

      if (!admin) {
        setLoading(false);
        return;
      }

      // admin: load all picks with match info
      const { data, error } = await supabase
        .from('picks')
        .select(
          `
          id,
          user_id,
          chosen_winner,
          match:matches (
            round,
            match_order,
            team1_name,
            team2_name
          )
        `
        )
        .order('user_id', { ascending: true })
        .order('match_id', { ascending: true });

      if (error) {
        console.error('Error loading picks for admin:', error.message);
      } else {
        // Let TypeScript chill, we’ll normalize at render time
        setPicks((data || []) as AdminPickRow[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const handleAdminUpdatePick = async (
    pickId: string,
    newWinner: 'team1' | 'team2'
  ) => {
    try {
      setSavingPickId(pickId);

      const { error } = await supabase
        .from('picks')
        .update({ chosen_winner: newWinner })
        .eq('id', pickId);

      if (error) {
        console.error('Error updating pick as admin:', error.message);
        return;
      }

      // update local state
      setPicks((prev) =>
        prev.map((p) =>
          p.id === pickId ? { ...p, chosen_winner: newWinner } : p
        )
      );
    } finally {
      setSavingPickId(null);
    }
  };

  // group by user_id for display
  const picksByUser = picks.reduce<Record<string, AdminPickRow[]>>(
    (acc, row) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(row);
      return acc;
    },
    {}
  );

  if (authChecking) {
    return (
      <div className="min-h-screen bg-white p-4 text-black">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Admin Picks</h1>
          <p>Checking permissions…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white p-4 text-black">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Admin Picks</h1>
          <p className="text-sm text-red-600">
            You are not authorized to view this page.
          </p>
          {adminEmail && (
            <p className="text-xs text-gray-600 mt-2">
              Logged in as: {adminEmail}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 text-black">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Admin Picks</h1>
          <p>Loading all picks…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 text-black">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Admin Picks</h1>
        <p className="text-xs text-gray-600 mb-4">
          Logged in as admin: {adminEmail}
        </p>

        {!picks.length ? (
          <p className="text-sm text-gray-600">
            No picks found yet. Once users make picks, they’ll show up here.
          </p>
        ) : (
          Object.entries(picksByUser).map(([userId, userPicks]) => (
            <div key={userId} className="mb-6 border rounded-lg p-3 bg-gray-50">
              <div className="mb-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  User ID:
                </span>{' '}
                <span className="font-mono text-xs">{userId}</span>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-2">Round</th>
                    <th className="text-left py-1 pr-2">Match</th>
                    <th className="text-left py-1 pr-2">Teams</th>
                    <th className="text-left py-1 pr-2">Picked</th>
                    <th className="text-left py-1">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {userPicks.map((p) => {
                    // normalize match to a single object
                    const matchRaw = p.match;
                    const match: MatchInfo | null = Array.isArray(matchRaw)
                      ? matchRaw[0] ?? null
                      : matchRaw;

                    if (!match) {
                      return (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-1 pr-2" colSpan={5}>
                            (Missing match info)
                          </td>
                        </tr>
                      );
                    }

                    const pickedName =
                      p.chosen_winner === 'team1'
                        ? match.team1_name
                        : match.team2_name;

                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-1 pr-2">R{match.round}</td>
                        <td className="py-1 pr-2">#{match.match_order}</td>
                        <td className="py-1 pr-2">
                          {match.team1_name} vs {match.team2_name}
                        </td>
                        <td className="py-1 pr-2 font-semibold">
                          {pickedName}
                        </td>
                        <td className="py-1">
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                handleAdminUpdatePick(p.id, 'team1')
                              }
                              disabled={savingPickId === p.id}
                              className={`px-2 py-1 rounded border text-[11px] hover:bg-gray-100 disabled:opacity-50 ${
                                p.chosen_winner === 'team1'
                                  ? 'bg-blue-100 border-blue-500'
                                  : ''
                              }`}
                            >
                              {match.team1_name}
                            </button>
                            <button
                              onClick={() =>
                                handleAdminUpdatePick(p.id, 'team2')
                              }
                              disabled={savingPickId === p.id}
                              className={`px-2 py-1 rounded border text-[11px] hover:bg-gray-100 disabled:opacity-50 ${
                                p.chosen_winner === 'team2'
                                  ? 'bg-blue-100 border-blue-500'
                                  : ''
                              }`}
                            >
                              {match.team2_name}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
