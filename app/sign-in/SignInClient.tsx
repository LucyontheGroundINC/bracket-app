"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { syncUserToDB } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";

type Mode = "signin" | "signup";

function safeReturnTo(value: string | null) {
  // prevent open redirects
  if (!value) return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}

function setAdminBypassCookie(email: string | null | undefined) {
  const isAdmin = isAdminEmail(email);
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `lotg_admin_bypass=${isAdmin ? "1" : "0"}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
}

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Memoize so it doesn't change unexpectedly on re-renders
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get("returnTo")),
    [searchParams]
  );

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(""); // required for signup

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // If already signed in, go to returnTo (NOT always dashboard)
  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return;
      if (data.user) {
        setAdminBypassCookie(data.user.email ?? null);
        router.replace(returnTo);
      }
    };
    check();
  }, [router, returnTo]);

  // Listen for auth changes; when signed in, sync user (non-blocking) + redirect to returnTo
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const u = session.user;
        setAdminBypassCookie(u.email ?? null);

        const nameFromMeta =
          (u.user_metadata?.display_name as string | undefined) ??
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null;

        // Fire-and-forget sync so it never blocks navigation
        Promise.resolve()
          .then(() =>
            syncUserToDB({
              id: u.id,
              email: u.email!,
              displayName: nameFromMeta,
            })
          )
          .catch((err) => console.warn("syncUserToDB failed:", err));

        router.replace(returnTo);
      }

      if (event === "SIGNED_OUT") {
        setAdminBypassCookie(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [router, returnTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const em = email.trim();
    const pw = password;

    if (!em || !pw) {
      setMessage("Please enter your email and password.");
      return;
    }

    if (mode === "signup" && !displayName.trim()) {
      setMessage("Please enter a display name.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signup") {
        const dn = displayName.trim();

        const { data, error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: {
            data: { display_name: dn },
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        // If email confirmation is enabled, session may be null
        if (!data.session) {
          setMessage("Account created! Please check your email, then sign in.");
          // Don't redirect; they may need to verify email first.
          return;
        }

        // If session exists, redirect immediately (and let auth listener handle sync)
        router.replace(returnTo);
        return;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: em,
          password: pw,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        // Redirect immediately on success (do not rely on auth event timing)
        if (data.session?.user) {
          setAdminBypassCookie(data.session.user.email ?? null);
          router.replace(returnTo);
          return;
        }

        // Fallback (should be rare)
        router.replace(returnTo);
        return;
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setMessage(null);

    const em = email.trim();
    if (!em) {
      setMessage("Enter your email first, then click Forgot password.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Password reset email sent. Check your inbox.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      <p className="text-sm opacity-70 mb-4">
        {mode === "signin"
          ? "Sign in with your email and password."
          : "Create your account with a display name."}
      </p>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={[
            "px-3 py-2 rounded border text-sm font-semibold",
            mode === "signin" ? "bg-black text-white" : "bg-white",
          ].join(" ")}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={[
            "px-3 py-2 rounded border text-sm font-semibold",
            mode === "signup" ? "bg-black text-white" : "bg-white",
          ].join(" ")}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" && (
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (required)"
            className="w-full rounded border px-3 py-2"
          />
        )}

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border px-3 py-2"
        />

        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
        >
          {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {mode === "signin" && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            className="text-sm underline opacity-80 disabled:opacity-60"
          >
            Forgot password?
          </button>
        )}
      </form>

      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  );
}
