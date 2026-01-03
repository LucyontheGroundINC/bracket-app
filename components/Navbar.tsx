"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
type LockStatus = 'unknown' | 'open' | 'locked';

type TournamentApiRow = {
  id: number;
  name?: string;
  year?: number | null;
  isLockedManual?: boolean | null;
  lockAt?: string | null;
};


const ADMIN_EMAIL = "lucyonthegroundwithrocks@gmail.com";

function NavItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "relative group px-3 py-2 rounded-md text-sm font-medium transition",
        isActive
          ? "text-blue-400 bg-gray-900/60"
          : "text-blue-300 hover:text-white hover:bg-gray-800/70",
        "hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.65)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      ].join(" ")}
    >
      <span className="relative z-10">{label}</span>
      <span
        className={[
          "pointer-events-none absolute left-2 right-2 -bottom-0.5 h-0.5 rounded",
          "bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400",
          "transition-transform duration-300 origin-left",
          isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        ].join(" ")}
      />
    </Link>
  );
}

export default function NavBar() {
  const [signingOut, setSigningOut] = useState(false);
  const [show, setShow] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
const [lockStatus, setLockStatus] = useState<LockStatus>('unknown'); // 🆕
  async function handleSignOut() {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      window.location.href = "/sign-in";
    } finally {
      setSigningOut(false);
    }
  }

// hide-on-scroll
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShow(y < lastScrollY || y < 50);
      setLastScrollY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScrollY]);

  // 🆕 Load bracket lock status once on mount
  useEffect(() => {
    async function loadLockStatus() {
      try {
        const res = await fetch("/api/tournaments");
        if (!res.ok) {
          setLockStatus("unknown");
          return;
        }
        const data: TournamentApiRow[] = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          setLockStatus("unknown");
          return;
        }

        // assume latest tournament in array is "active"
        const active = data[data.length - 1];
        const manual = !!active.isLockedManual;
        const lockAtDate = active.lockAt ? new Date(active.lockAt) : null;
        const now = new Date();

        const locked = manual || (lockAtDate ? now >= lockAtDate : false);
        setLockStatus(locked ? "locked" : "open");
      } catch {
        setLockStatus("unknown");
      }
    }

    loadLockStatus();
  }, []);

  // close mobile menu on route change
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Detect admin
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (error || !data.user) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(data.user.email === ADMIN_EMAIL);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50",
        "bg-black md:bg-black/90 md:backdrop-blur supports-[backdrop-filter]:md:bg-black/80",
        "shadow-[0_1px_0_0_rgba(59,130,246,0.25)]",
        "transition-transform duration-300",
        show ? "translate-y-0" : "-translate-y-full",
      ].join(" ")}
    >
      {/* Top bar */}
      <div className="mx-auto max-w-6xl px-4 py-5 md:py-6 flex items-center gap-3">
        <Link
          href="/"
          className="font-semibold text-blue-400 text-lg tracking-wide hover:text-white transition"
        >
          Bracket App
        </Link>

        {/* Desktop nav */}
        <nav className="ml-4 hidden md:flex items-center gap-2">
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/dashboard/teams" label="Teams" />
          <NavItem href="/dashboard/games" label="Games" />
          <NavItem href="/dashboard/brackets" label="Brackets" />
          <NavItem href="/dashboard/leaderboard" label="Leaderboard" />
          <NavItem href="/dashboard/picks" label="Picks" />

          {/* 🔐 Admin-only link */}
          {isAdmin && (
            <NavItem href="/admin/settings" label="Admin Settings" />
          )}
        </nav>

               {/* Desktop actions */}
        <div className="ml-auto hidden md:flex items-center gap-3">
          {/* 🆕 Lock status pill */}
          {lockStatus !== "unknown" && (
            <span
              className={[
                "px-3 py-1 rounded-full text-xs font-semibold border",
                lockStatus === "locked"
                  ? "bg-[#CA4C4C]/10 text-[#CA4C4C] border-[#CA4C4C]/60"
                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/60",
              ].join(" ")}
            >
              {lockStatus === "locked" ? "Bracket Locked" : "Bracket Open"}
            </span>
          )}

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={[
              "px-3 py-2 rounded-md text-sm font-medium transition",
              "border border-blue-400/70 text-blue-300",
              "hover:bg-blue-500 hover:text-black",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              "disabled:opacity-60",
            ].join(" ")}
            title="Sign out"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>


        {/* Mobile: hamburger */}
        <div className="ml-auto md:hidden">
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-md text-blue-300 hover:text-white hover:bg-gray-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
          >
            <div className="relative w-6 h-5">
              <span
                className={[
                  "absolute left-0 right-0 top-0 h-0.5 bg-blue-400 transition-transform",
                  open ? "translate-y-2 rotate-45" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute left-0 right-0 top-2 h-0.5 bg-blue-400 transition-opacity",
                  open ? "opacity-0" : "opacity-100",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute left-0 right-0 top-4 h-0.5 bg-blue-400 transition-transform",
                  open ? "-translate-y-2 -rotate-45" : "",
                ].join(" ")}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile panel (collapsible) */}
      <div
        className={[
          "md:hidden overflow-hidden border-t border-gray-800/70",
          "relative z-50",
          "transition-[max-height,opacity] duration-300.ease-in-out",
          open ? "max-h-96 opacity-100 animate-scaleIn" : "max-h-0 opacity-0 animate-scaleOut",
        ].join(" ")}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
          <NavItem
            href="/dashboard"
            label="Dashboard"
            onClick={() => setOpen(false)}
          />
          <NavItem
            href="/dashboard/teams"
            label="Teams"
            onClick={() => setOpen(false)}
          />
          <NavItem
            href="/dashboard/games"
            label="Games"
            onClick={() => setOpen(false)}
          />
          <NavItem
            href="/dashboard/leaderboard"
            label="Leaderboard"
            onClick={() => setOpen(false)}
          />
          <NavItem
            href="/dashboard/picks"
            label="Picks"
            onClick={() => setOpen(false)}
          />

          {/* 🔐 Admin-only link (mobile) */}
          {isAdmin && (
            <NavItem
              href="/admin/settings"
              label="Admin Settings"
              onClick={() => setOpen(false)}
            />
          )}

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={[
              "mt-2 w-full text-left px-3 py-2 rounded-md text-sm font-medium transition",
              "border border-blue-400/70 text-blue-300",
              "hover:bg-blue-500 hover:text-black",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              "disabled:opacity-60",
            ].join(" ")}
            title="Sign out"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* thin gradient accent */}
      <div className="pointer-events-none h-[1px] w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
    </header>
  );
}
