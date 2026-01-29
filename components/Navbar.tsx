"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

const ADMIN_EMAIL = "lucyonthegroundwithrocks@gmail.com";

type NavItem = { href: string; label: string };

export default function Navbar() {
  const pathname = usePathname();

  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = email === ADMIN_EMAIL;

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Load current user + subscribe to auth changes
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      setOpen(false);
      window.location.assign("/sign-in");
    } finally {
      setLoggingOut(false);
    }
  }

  // ---- Determine which “game context” we’re in ----
  const inBiggestNight = pathname.startsWith("/biggest-night");

  // IMPORTANT: bracket context should NOT be "all dashboard"
  // Only consider bracket routes as “bracket mode”.
  const inBracketMadness =
    pathname.startsWith("/dashboard/brackets") ||
    pathname.startsWith("/dashboard/leaderboard") ||
    pathname.startsWith("/dashboard/matches") ||
    pathname.startsWith("/dashboard/picks");

  const context: "biggest-night" | "bracket" | "none" = inBiggestNight
    ? "biggest-night"
    : inBracketMadness
    ? "bracket"
    : "none";

  // ---- Global (Level 1) nav ----
  const globalNav: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/brackets", label: "Bracket Madness" },
      { href: "/biggest-night/ballot", label: "Biggest Night" },
    ],
    []
  );

  // ---- Contextual (Level 2) nav ----
  const subNav: NavItem[] = useMemo(() => {
    if (context === "biggest-night") {
      return [
        { href: "/biggest-night/ballot", label: "Ballot" },
        { href: "/biggest-night/leaderboard", label: "Leaderboard" },
      ];
    }
    if (context === "bracket") {
      return [
        { href: "/dashboard/brackets", label: "My Bracket" },
        { href: "/dashboard/leaderboard", label: "Leaderboard" },
      ];
    }
    return [];
  }, [context]);

  const activeClass = "text-[#FEE689]";
  const inactiveClass = "text-white/70 hover:text-[#FEE689] transition-colors font-semibold";
  const subActiveClass = "text-[#FEE689]";
  const subInactiveClass = "text-white/70 hover:text-[#FFEFB0] transition-colors font-semibold";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0A2041] shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
      {/* Top Row: Logo + Global Nav */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="relative h-10 w-40 sm:h-12 sm:w-52">
            <Image
              src="/LOTG_Logo_Substack-Image-copy.png"
              alt="Lucy On The Ground"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop Global Nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          {globalNav.map((item, idx) => (
            <div key={item.href} className="flex items-center gap-4">
              <Link
                href={item.href}
                className={[
                  "font-semibold transition-colors",
                  isActive(item.href) ? activeClass : inactiveClass,
                ].join(" ")}
              >
                {item.label}
              </Link>

              {idx < globalNav.length - 1 ? (
                <span className="text-white/20 select-none">|</span>
              ) : null}
            </div>
          ))}

          {isAdmin ? (
            <>
              <span className="text-white/20 select-none">|</span>
             <Link href="/admin" className={inactiveClass}>
  Admin
</Link>

            </>
          ) : null}

          <span className="text-white/20 select-none">|</span>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="rounded-full bg-[#FEE689] text-[#0A2041] px-4 py-2 text-xs font-black hover:opacity-90 disabled:opacity-60"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-3 py-2 text-[#FEE689] hover:text-[#FFEFB0] hover:border-white/30 transition"
          >
            <span className="font-semibold text-sm">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Second Row: Contextual Subnav (desktop only) */}
      {subNav.length > 0 ? (
        <div className="hidden md:block border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 text-xs sm:text-sm">
            <span className="text-white/50 font-bold tracking-wide uppercase">
              {context === "biggest-night" ? "Biggest Night" : "Bracket Madness"}
            </span>
            <span className="text-white/20 select-none">|</span>

            {subNav.map((item, idx) => (
              <div key={item.href} className="flex items-center gap-4">
                <Link
                  href={item.href}
                  className={[
                    "font-semibold transition-colors",
                    isActive(item.href) ? subActiveClass : subInactiveClass,
                  ].join(" ")}
                >
                  {item.label}
                </Link>
                {idx < subNav.length - 1 ? (
                  <span className="text-white/20 select-none">|</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Mobile dropdown panel */}
      {open ? (
        <div className="md:hidden border-t border-white/10 bg-[#0A2041]">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2 text-sm">
            {/* Global links */}
            {globalNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "py-2 rounded-xl px-3 transition-colors font-bold",
                  isActive(item.href)
                    ? "bg-white/10 text-[#FEE689]"
                    : "text-white/80 hover:bg-white/5",
                ].join(" ")}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {isAdmin ? (
              <Link
                href="/admin"
                className="py-2 rounded-xl px-3 transition-colors font-bold text-white/80 hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            ) : null}

            {/* Context subnav */}
            {subNav.length > 0 ? (
              <div className="mt-2 pt-3 border-t border-white/10">
                <div className="text-[11px] font-black tracking-[0.18em] uppercase text-white/55 px-3 mb-2">
                  {context === "biggest-night" ? "Biggest Night" : "Bracket Madness"}
                </div>

                {subNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "py-2 rounded-xl px-3 transition-colors font-bold",
                      isActive(item.href)
                        ? "bg-white/10 text-[#FEE689]"
                        : "text-white/80 hover:bg-white/5",
                    ].join(" ")}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Sign out */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loggingOut}
                className="w-full rounded-2xl bg-[#FEE689] text-[#0A2041] px-4 py-3 text-sm font-black hover:opacity-90 disabled:opacity-60"
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>

              {email ? (
                <div className="mt-2 text-[11px] text-white/55 px-1 truncate">
                  Signed in as {email}
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
