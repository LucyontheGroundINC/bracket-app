"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dn = displayName.trim();
    const em = email.trim();

    if (!dn) {
      setError("Display name is required.");
      return;
    }
    if (!em) {
      setError("Email is required.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // 1) Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          data: { display_name: dn },
        },
      });

      if (signUpError) throw new Error(signUpError.message);

      const userId = data.user?.id;
      if (!userId) {
        // This can happen if email confirmation is enabled and user object is missing
        throw new Error("Signup succeeded but no user id was returned.");
      }

      // 2) Create/Upsert profile row using server route (bypasses RLS issues)
      const res = await fetch("/api/profile/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, displayName: dn }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Failed to create profile.");
      }

      // 3) Route user onward
      router.push("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-4 py-12">
      <main className="w-full max-w-md bg-white/90 border border-[#F5B8B0] rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-black text-[#CA4C4C]">Create account</h1>
        <p className="text-sm text-[#0A2041]/70 mt-1">
          Enter a display name so you show up on the leaderboard.
        </p>

        {error ? (
          <div className="mt-4 text-sm text-[#CA4C4C] bg-white border border-[#F5B8B0] rounded-xl px-4 py-3">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-[#0A2041]/70">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#0A2041]/10 px-3 py-2 bg-white"
              placeholder="Lucy"
              autoComplete="nickname"
              disabled={loading}
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[#0A2041]/70">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl border border-[#0A2041]/10 px-3 py-2 bg-white"
              placeholder="you@email.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[#0A2041]/70">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-[#0A2041]/10 px-3 py-2 bg-white"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={loading}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[#0A2041] text-[#F8F5EE] font-black py-3 hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
      </main>
    </div>
  );
}
