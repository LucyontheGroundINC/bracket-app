'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import EditProfileCard from '@/components/EditProfileCard';

const ADMIN_EMAIL = 'lucyonthegroundwithrocks@gmail.com';

type UserInfo = {
  id: string;
  displayName: string;
  email: string | null;
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoadingUser(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          setUser(null);
          setAuthEmail(null);
          return;
        }

        const { data: auth, error } = await supabase.auth.getUser();
        if (error || !auth.user) {
     console.error(
  "Error loading auth user in dashboard:",
  error instanceof Error ? error.message : String(error)
);

          setUser(null);
          setAuthEmail(null);
          return;
        }

        const u = auth.user;

        const displayName =
          (u.user_metadata?.displayName as string | undefined) ||
          (u.user_metadata?.full_name as string | undefined) ||
          (u.user_metadata?.name as string | undefined) ||
          (u.email ? u.email.split('@')[0] : 'Player');

        setUser({
          id: u.id,
          email: u.email ?? null,
          displayName,
        });

        setAuthEmail(u.email ?? null);
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, []);

  const isAdmin = authEmail === ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 pb-10 px-4">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Top heading / intro */}
        <section>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#CA4C4C]">
            Dashboard
          </h1>
          <p className="text-sm text-[#0A2041]/70 mt-1">
            One stop for your bracket, profile, and links to everything else.
          </p>

          {!loadingUser && user && (
            <p className="text-xs text-[#0A2041]/60 mt-1">
              Signed in as{' '}
              <span className="font-semibold text-[#0A2041]">
                {user.displayName}
              </span>
            </p>
          )}
        </section>

        {/* Main content + profile sidebar */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
          {/* LEFT: main dashboard content */}
          <div className="space-y-4">
            {/* My Bracket summary */}
            <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#CA4C4C] mb-2">
                My Bracket
              </h2>
              <p className="text-xs text-[#0A2041]/75 mb-3">
                Jump into your bracket to make picks, see matchups, and follow
                the chaos.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/brackets"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition"
                >
                  Go to My Bracket
                </Link>
                <Link
                  href="/dashboard/leaderboard"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#A7C4E7] text-[#0A2041] hover:bg-[#8eaed0] transition"
                >
                  View Leaderboard
                </Link>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#CA4C4C] mb-2">
                Quick Links
              </h2>
              <ul className="text-xs text-[#0A2041]/80 space-y-2">
                <li className="flex justify-between items-center gap-2">
                  <span>See the full bracket layout</span>
                  <Link
                    href="/dashboard/brackets"
                    className="text-[#CA4C4C] hover:underline font-semibold"
                  >
                    Open bracket
                  </Link>
                </li>
                <li className="flex justify-between items-center gap-2">
                  <span>Check your rank on the leaderboard</span>
                  <Link
                    href="/dashboard/leaderboard"
                    className="text-[#CA4C4C] hover:underline font-semibold"
                  >
                    Leaderboard
                  </Link>
                </li>
                <li className="flex justify-between items-center gap-2">
                  <span>Review your picks by game</span>
                  <Link
                    href="/dashboard/picks"
                    className="text-[#CA4C4C] hover:underline font-semibold"
                  >
                    My picks
                  </Link>
                </li>
              </ul>
            </div>

            {/* Admin hint */}
            {isAdmin && (
              <div className="bg-[#FDF3EE] border border-dashed border-[#CA4C4C] rounded-2xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-[#CA4C4C] mb-1">
                  Admin shortcut
                </h2>
                <p className="text-[11px] text-[#0A2041]/80 mb-2">
                  You’re logged in as the admin. Use the control center to set
                  lock time, manage teams, and run maintenance tools.
                </p>
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition"
                >
                  Go to Admin Control Center
                </Link>
              </div>
            )}
          </div>

          {/* RIGHT: Profile editor card */}
          <aside className="space-y-4">
            <EditProfileCard />
          </aside>
        </section>
      </main>
    </div>
  );
}
