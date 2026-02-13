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
        { href: "/biggest-night/how-to-play", label: "How to Play" },
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

  const isBiggestNightTheme = context === "biggest-night";

  const activeClass = isBiggestNightTheme ? "text-bn-primary" : "text-[#FEE689]";
  const inactiveClass = isBiggestNightTheme
    ? "text-bn-muted/70 hover:text-bn-primary transition-colors font-semibold"
    : "text-white/70 hover:text-[#FEE689] transition-colors font-semibold";
  const subActiveClass = isBiggestNightTheme ? "text-bn-primary" : "text-[#FEE689]";
  const subInactiveClass = isBiggestNightTheme
    ? "text-bn-muted/70 hover:text-bn-primary/90 transition-colors font-semibold"
    : "text-white/70 hover:text-[#FFEFB0] transition-colors font-semibold";

  const dividerClass = isBiggestNightTheme ? "text-bn-muted/20" : "text-white/20";
  const headerClass = isBiggestNightTheme
    ? "bg-bn-bg shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
    : "bg-[#0A2041] shadow-[0_2px_12px_rgba(0,0,0,0.25)]";
  const mobileButtonClass = isBiggestNightTheme
    ? "inline-flex items-center justify-center rounded-lg border border-bn-muted/30 px-3 py-2 text-bn-primary hover:text-bn-primary/90 hover:border-bn-muted/50 transition"
    : "inline-flex items-center justify-center rounded-lg border border-white/20 px-3 py-2 text-[#FEE689] hover:text-[#FFEFB0] hover:border-white/30 transition";
  const mobilePanelClass = isBiggestNightTheme
    ? "md:hidden border-t border-bn-muted/20 bg-bn-bg"
    : "md:hidden border-t border-white/10 bg-[#0A2041]";
  const mobileActiveClass = isBiggestNightTheme
    ? "bg-bn-muted/10 text-bn-primary"
    : "bg-white/10 text-[#FEE689]";
  const mobileInactiveClass = isBiggestNightTheme
    ? "text-bn-muted/80 hover:bg-bn-muted/10"
    : "text-white/80 hover:bg-white/5";
  const mobileLabelClass = isBiggestNightTheme
    ? "text-bn-muted/60"
    : "text-white/55";
  const ctaClass = isBiggestNightTheme
    ? "rounded-full bg-bn-primary text-bn-bg px-4 py-2 text-xs font-black hover:opacity-90 disabled:opacity-60"
    : "rounded-full bg-[#FEE689] text-[#0A2041] px-4 py-2 text-xs font-black hover:opacity-90 disabled:opacity-60";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href);
  }

  return (
    <header className={`sticky top-0 z-50 w-full ${headerClass}`}>
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
                <span className={`${dividerClass} select-none`}>|</span>
              ) : null}
            </div>
          ))}

          {isAdmin ? (
            <>
              <span className={`${dividerClass} select-none`}>|</span>
              <Link href="/admin" className={inactiveClass}>
                Admin
              </Link>

            </>
          ) : null}

          <span className={`${dividerClass} select-none`}>|</span>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className={ctaClass}
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
            className={mobileButtonClass}
          >
            <span className="font-semibold text-sm">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Second Row: Contextual Subnav (desktop only) */}
      {subNav.length > 0 ? (
        <div className={`hidden md:block ${isBiggestNightTheme ? "border-t border-bn-muted/20" : "border-t border-white/10"}`}>
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 text-xs sm:text-sm">
            <span className={`${mobileLabelClass} font-bold tracking-wide uppercase`}>
              {context === "biggest-night" ? "Biggest Night" : "Bracket Madness"}
            </span>
            <span className={`${dividerClass} select-none`}>|</span>

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
                  <span className={`${dividerClass} select-none`}>|</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Mobile dropdown panel */}
      {open ? (
        <div className={mobilePanelClass}>
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2 text-sm">
            {/* Global links */}
            {globalNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "py-2 rounded-xl px-3 transition-colors font-bold",
                  isActive(item.href)
                    ? mobileActiveClass
                    : mobileInactiveClass,
                ].join(" ")}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {isAdmin ? (
              <Link
                href="/admin"
                className={`py-2 rounded-xl px-3 transition-colors font-bold ${mobileInactiveClass}`}
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            ) : null}

            {/* Context subnav */}
            {subNav.length > 0 ? (
              <div className={`mt-2 pt-3 ${isBiggestNightTheme ? "border-t border-bn-muted/20" : "border-t border-white/10"}`}>
                <div className={`text-[11px] font-black tracking-[0.18em] uppercase ${mobileLabelClass} px-3 mb-2`}>
                  {context === "biggest-night" ? "Biggest Night" : "Bracket Madness"}
                </div>

                {subNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "py-2 rounded-xl px-3 transition-colors font-bold",
                      isActive(item.href)
                        ? mobileActiveClass
                        : mobileInactiveClass,
                    ].join(" ")}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Sign out */}
            <div className={`mt-3 pt-3 ${isBiggestNightTheme ? "border-t border-bn-muted/20" : "border-t border-white/10"}`}>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loggingOut}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-black hover:opacity-90 disabled:opacity-60 ${
                  isBiggestNightTheme ? "bg-bn-primary text-bn-bg" : "bg-[#FEE689] text-[#0A2041]"
                }`}
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>

              {email ? (
                <div className={`mt-2 text-[11px] ${mobileLabelClass} px-1 truncate`}>
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
