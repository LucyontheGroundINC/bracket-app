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
          (u.user_metadata?.display_name as string | undefined) ||
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
  Your Lucy On The Ground game center — jump into the latest game and track your stats.
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
            {/* Hollywood’s Biggest Night */}
<div className="bg-[#0A2041] text-[#F8F5EE] border border-white/10 rounded-2xl p-5 shadow-sm overflow-hidden relative">
  {/* subtle accent */}
  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#FEE689]/25 blur-2xl" />
  <div className="absolute -bottom-14 -left-10 h-56 w-56 rounded-full bg-[#CA4C4C]/20 blur-3xl" />

  <div className="relative">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-black tracking-wide uppercase text-[#FEE689]">
          Hollywood’s Biggest Night
        </h2>
        <p className="mt-2 text-sm font-extrabold leading-tight">
          Make your picks. Climb the leaderboard. Brag forever.
        </p>
        <p className="mt-2 text-xs text-white/75 max-w-prose">
          Tap a category, choose one nominee, and we save automatically. When winners are set,
          your score updates.
        </p>
      </div>

      <span className="shrink-0 text-[10px] font-black px-2 py-1 rounded-full bg-[#FEE689] text-[#0A2041]">
        NEW
      </span>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <Link
        href="/biggest-night/ballot"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-black bg-[#FEE689] text-[#0A2041] hover:opacity-90 transition"
      >
        Make Picks →
      </Link>

      <Link
        href="/biggest-night/leaderboard"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-black bg-white/10 text-[#F8F5EE] border border-white/15 hover:bg-white/15 transition"
      >
        View Leaderboard →
      </Link>
    </div>

    <p className="mt-3 text-[11px] text-white/55">
      Pro tip: pick your longshots — they’ll be worth more once we load the weights.
    </p>
  </div>
</div>

            {/* My Bracket summary */}
            <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
             <div className="flex items-center justify-between gap-3 mb-2">
  <h2 className="text-sm font-semibold text-[#CA4C4C]">Bracket Madness</h2>
  <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#F9DCD8] text-[#0A2041]/75 border border-[#0A2041]/10">
    COMING SOON
  </span>
</div>

             <p className="text-xs text-[#0A2041]/75 mb-3">
  Bracket Madness is coming soon. We’ll open picks closer to launch — but you can still peek around.
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
                  href="/admin"

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
