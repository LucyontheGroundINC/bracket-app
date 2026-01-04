"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthed(!!data.user);
    };
    check();
  }, []);

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-4">
      <main className="max-w-3xl w-full mx-auto flex flex-col items-center text-center gap-6">
        {/* Logo */}
        <div className="relative w-72 h-72 sm:w-96 sm:h-96 mb-4">

          <Image
            src="/MCE.svg" // stacked logo
            alt="Chaos Bracket Logo"
            fill
            className="object-contain drop-shadow-lg"
            priority
          />
        </div>

        {/* Title / Tagline */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#CA4C4C] tracking-tight mb-2">
            Main Character Music Madness 2025
          </h1>
          <p className="text-sm sm:text-base text-[#0A2041]/80 max-w-xl mx-auto">
            Fill out your bracket, lock in your takes, and see who survives
            the drama.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Link
            href={isAuthed ? "/dashboard" : "/sign-in"}
            className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition shadow-sm"
          >
            {isAuthed ? "Go to my dashboard" : "Sign in to begin"}
          </Link>
          {!isAuthed && (
            <Link
              href="/sign-in?mode=signup"

              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold bg-white/90 text-[#0A2041] border border-[#F5B8B0] hover:bg-white transition"
            >
              Create an account
            </Link>
          )}
        </div>

        {/* Tiny footnote */}
        <p className="text-[11px] text-[#0A2041]/60 mt-4 max-w-sm mx-auto">
          Once you&apos;re in, head to your dashboard to fill out your bracket
          and peek at the leaderboard as the games unfold.
        </p>
      </main>
    </div>
  );
}

