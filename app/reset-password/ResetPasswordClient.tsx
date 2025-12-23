"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordClient() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // If the recovery link is valid, Supabase will establish a session in the browser.
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    };

    init();

    // If Supabase fires PASSWORD_RECOVERY, also consider the page "valid"
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(!!session);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      // Optional but recommended: sign out after change to force fresh login
      await supabase.auth.signOut();

      setMessage("Password updated ✅ Redirecting to sign-in…");
      setTimeout(() => router.replace("/sign-in"), 800);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <div className="p-6">Loading…</div>;

  if (!hasSession) {
    return (
      <main className="mx-auto max-w-md p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-sm opacity-70">
          This reset link is invalid or expired. Please request a new password reset from the sign-in page.
        </p>

        <button
          className="rounded bg-black text-white px-4 py-2"
          onClick={() => router.replace("/sign-in")}
        >
          Go to sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>
      <p className="text-sm opacity-70 mb-4">
        Enter your new password below.
      </p>

      <form onSubmit={handleSetPassword} className="space-y-3">
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded border px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>

      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  );
}
