"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

function isPublicPath(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname === "/signup" ||
    pathname === "/reset-password" ||
    pathname === "/coming-soon"
  );
}

function safeReturnTo(pathname: string, search: string) {
  const full = `${pathname}${search ?? ""}`;
  if (!full.startsWith("/")) return "/dashboard";
  if (full.startsWith("//")) return "/dashboard";
  return full;
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const redirectToSignIn = () => {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const returnTo = safeReturnTo(pathname, search);
      window.location.assign(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    };

    async function verify() {
      if (isPublicPath(pathname)) {
        if (!mounted) return;
        setIsAuthed(true);
        setChecked(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session?.user) {
        setIsAuthed(true);
        setChecked(true);
      } else {
        setChecked(true);
        redirectToSignIn();
      }
    }

    verify();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;

      if (!session?.user && !isPublicPath(pathname)) {
        setIsAuthed(false);
        redirectToSignIn();
        return;
      }

      if (isPublicPath(pathname)) {
        setIsAuthed(true);
        return;
      }

      if (session?.user) setIsAuthed(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-4">
        <div className="rounded-2xl bg-white/70 border border-[#0A2041]/10 px-4 py-3 text-sm text-[#0A2041]/70">
          Checking login…
        </div>
      </div>
    );
  }

  return isAuthed ? <>{children}</> : null;
}
