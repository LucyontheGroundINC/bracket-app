"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { syncUserToDB } from "@/lib/api";

type Mode = "signin" | "signup";

export default function SignInPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(""); // required for signup

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // If already signed in, go to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) router.replace("/dashboard");
    });
  }, [router]);

  // Listen for auth changes; when signed in, sync user and redirect
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const u = session.user;

          // Use DB display name if you collect it at signup,
          // otherwise fall back to metadata (or null).
          const nameFromMeta =
            (u.user_metadata?.display_name as string | undefined) ??
            (u.user_metadata?.full_name as string | undefined) ??
            (u.user_metadata?.name as string | undefined) ??
            null;

          await syncUserToDB({
            id: u.id,
            email: u.email!,
            displayName: nameFromMeta,
          });

          router.replace("/dashboard");
        }
      }
    );

    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!email || !password) return;

    // Require display name on signup
    if (mode === "signup" && !displayName.trim()) {
      setMessage("Please enter a display name.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // store display name in auth metadata (handy fallback)
            data: { display_name: displayName.trim() },
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        // If email confirmations are OFF, you’ll be signed in immediately
        // and the onAuthStateChange handler will sync + redirect.
        // If confirmations are ON, session may be null until email is confirmed.
        if (!data.session) {
          setMessage(
            "Account created! Check your email to confirm, then sign in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        // redirect will happen via onAuthStateChange
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setMessage(null);
    if (!email) {
      setMessage("Enter your email first, then click Forgot password.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // you can later create a dedicated reset page; this at least triggers the email
        redirectTo: `${window.location.origin}/sign-in`,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Password reset email sent. Check your inbox.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong.";
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
          {loading
            ? "Working..."
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
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
