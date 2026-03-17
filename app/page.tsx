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
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-4 py-12">
      <main className="max-w-6xl w-full mx-auto flex flex-col items-center text-center gap-8">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-4xl sm:text-5xl font-black text-[#CA4C4C] tracking-tight mb-2">
            Lucy&apos;s Game Room
          </h1>
          <p className="text-lg sm:text-xl text-[#0A2041]/80 font-semibold">
            Pick. Predict. Play along.
          </p>
        </div>

        {/* Posters */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center w-full">
          {/* Hollywood's Biggest Night */}
          <Link
            href="/biggest-night/ballot"
            className="relative w-80 h-96 sm:w-96 sm:h-[480px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow hover:scale-105 transform transition-transform"
          >
            <Image
              src="/hollywoods-biggest-night-logo.svg"
              alt="Hollywood's Biggest Night"
              fill
              className="object-cover"
              priority
            />
          </Link>

          {/* Bracket Challenge */}
          <Link
            href="/dashboard/brackets"
            className="relative w-80 h-96 sm:w-96 sm:h-[480px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow hover:scale-105 transform transition-transform"
            style={{ boxShadow: '0 0 40px 10px #FEE689' }}
          >
            <Image
              src="/Copy of March Madness 2026 (750 x 1000 px) (800 x 1000 px).svg"
              alt="Bracket Challenge"
              fill
              className="object-cover"
              priority
            />
          </Link>
        </div>

        {/* CTA button */}
        <div className="mt-4">
          <Link
            href={isAuthed ? "/dashboard" : "/sign-in"}
            className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition shadow-sm"
          >
            {isAuthed ? "Go to my dashboard" : "Sign in to begin"}
          </Link>
        </div>
      </main>
    </div>
  );
}

