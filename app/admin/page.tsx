"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminOnly from "@/components/AdminOnly";

export default function AdminHubPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Optional: a tiny loading state for the email line
  if (!email) {
    return (
      <AdminOnly>
        <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 px-4">
          <div className="max-w-4xl mx-auto text-sm text-[#0A2041]/70">
            Loading…
          </div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 pb-10 px-4">
        <main className="max-w-5xl mx-auto space-y-6">
          <section>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0A2041]">
              Admin Control Center
            </h1>
            <p className="text-sm text-[#0A2041]/70 mt-1">
              One place to manage all Lucy On The Ground games.
            </p>
            <p className="text-xs text-[#0A2041]/60 mt-1">
              Signed in as <span className="font-semibold">{email}</span>
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {/* Biggest Night */}
            <div className="rounded-3xl border border-[#0A2041]/10 bg-[#0A2041] text-[#F8F5EE] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#FEE689]/25 blur-2xl" />
              <div className="absolute -bottom-14 -left-10 h-56 w-56 rounded-full bg-[#CA4C4C]/20 blur-3xl" />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.2em] uppercase text-[#FEE689]">
                      Hollywood’s Biggest Night
                    </p>
                    <h2 className="mt-2 text-lg font-black">Results + Weights</h2>
                    <p className="mt-2 text-sm text-white/75">
                      Set lock time, edit weights, and mark winners per category.
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#FEE689] text-[#0A2041]">
                    LIVE
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/admin/biggest-night"
                    className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-black bg-[#FEE689] text-[#0A2041] hover:opacity-90 transition"
                  >
                    Open Biggest Night Admin →
                  </Link>
                  <Link
                    href="/biggest-night/leaderboard"
                    className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-black bg-white/10 border border-white/15 text-[#F8F5EE] hover:bg-white/15 transition"
                  >
                    View Leaderboard →
                  </Link>
                </div>
              </div>
            </div>

            {/* Bracket Madness */}
            <div className="rounded-3xl border border-[#0A2041]/10 bg-white/85 p-6 shadow-sm">
              <p className="text-[11px] font-black tracking-[0.2em] uppercase text-[#CA4C4C]">
                Bracket Madness
              </p>
              <h2 className="mt-2 text-lg font-black text-[#0A2041]">
                Tournament Admin
              </h2>
              <p className="mt-2 text-sm text-[#0A2041]/70">
                Manage matches, winners, lock settings, and maintenance tools.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-black bg-[#0A2041] text-[#F8F5EE] hover:opacity-95 transition"
                >
                  Open Bracket Admin →
                </Link>
                <Link
                  href="/dashboard/leaderboard"
                  className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-black bg-[#A7C4E7] text-[#0A2041] hover:opacity-95 transition border border-[#0A2041]/10"
                >
                  View Bracket Leaderboard →
                </Link>
              </div>

              <p className="mt-3 text-[11px] text-[#0A2041]/55">
                Tip: keep this page bookmarked for game-night ops.
              </p>
            </div>
          </section>
        </main>
      </div>
    </AdminOnly>
  );
}
