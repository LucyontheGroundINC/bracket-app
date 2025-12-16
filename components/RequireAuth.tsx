"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      if (data.user) {
        setIsAuthed(true);
      } else {
        // not signed in → send to /sign-in
        router.replace("/sign-in");
      }
      setChecked(true);
    }

    verify();

    // keep listening for auth changes while mounted
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session?.user) {
        setIsAuthed(true);
      } else {
        router.replace("/sign-in");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // while checking, render nothing to avoid flicker
  if (!checked) return null;

  // only render children when authenticated
  return isAuthed ? <>{children}</> : null;
}
