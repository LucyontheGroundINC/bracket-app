"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

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

    const setAdminBypassCookie = (isAdmin: boolean) => {
      const secure =
        typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `lotg_admin_bypass=${isAdmin ? "1" : "0"}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
    };

    const resolveIsAdmin = async (user: { id: string; email?: string | null } | null): Promise<boolean> => {
      if (!user) return false;

      if (isAdminEmail(user.email ?? null)) return true;

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return false;
      return prof?.is_admin === true;
    };

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
        const admin = await resolveIsAdmin(data.session.user);
        if (!mounted) return;
        setAdminBypassCookie(admin);
        setIsAuthed(true);
        setChecked(true);
      } else {
        setAdminBypassCookie(false);
        setChecked(true);
        redirectToSignIn();
      }
    }

    verify();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void (async () => {
        if (!mounted) return;

        if (!session?.user && !isPublicPath(pathname)) {
          setAdminBypassCookie(false);
          setIsAuthed(false);
          redirectToSignIn();
          return;
        }

        if (isPublicPath(pathname)) {
          const admin = await resolveIsAdmin(session?.user ?? null);
          if (!mounted) return;
          setAdminBypassCookie(admin);
          setIsAuthed(true);
          return;
        }

        if (session?.user) {
          const admin = await resolveIsAdmin(session.user);
          if (!mounted) return;
          setAdminBypassCookie(admin);
          setIsAuthed(true);
        }
      })();
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
