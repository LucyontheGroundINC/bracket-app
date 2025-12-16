"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { syncUserToDB } from "@/lib/api";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // If already signed in, go to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  // Listen for auth changes; when signed in, sync user and redirect
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const u = session.user;
        await syncUserToDB({
          id: u.id,
          email: u.email!,
          displayName:
            (u.user_metadata?.full_name as string | undefined) ??
            (u.user_metadata?.name as string | undefined) ??
            null,
        });
        router.replace("/dashboard"); // or "/user"
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    try {
      setSending(true);
      setMessage(null);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/sign-in`, // after clicking the link
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for the magic link.");
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>

      <form onSubmit={handleSendLink} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  );
}


