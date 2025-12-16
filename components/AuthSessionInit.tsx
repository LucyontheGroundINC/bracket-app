"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthSessionInit() {
  useEffect(() => {
    // Ensure the magic-link tokens (if present) are parsed & session is stored
    supabase.auth.getSession();

    // Any time auth changes (including first sign-in), sync user into our DB
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user;
      if (!user?.id || !user.email) return;

      const displayName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;

      try {
        await fetch("/api/auth/sync-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            displayName,
          }),
        });
      } catch {
        // fine to ignore in dev; we’ll harden later
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}

