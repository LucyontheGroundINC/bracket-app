"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        // RequireAuth should prevent this, but keep it safe
        window.location.assign("/sign-in");
        return;
      }

      setEmail(user.email ?? null);

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && prof?.is_admin === true) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 px-4">
        <div className="max-w-3xl mx-auto text-sm text-[#0A2041]/70">
          Checking admin access…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 px-4">
        <main className="max-w-2xl mx-auto">
          <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-6 shadow-sm">
            <h1 className="text-xl font-black text-[#CA4C4C]">Admin only</h1>
            <p className="mt-2 text-sm text-[#0A2041]/70">
              {email ? (
                <>
                  You’re signed in as <span className="font-semibold">{email}</span>, but this page is restricted.
                </>
              ) : (
                "This page is restricted."
              )}
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-black bg-[#0A2041] text-[#F8F5EE]"
              >
                Back to Dashboard →
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
