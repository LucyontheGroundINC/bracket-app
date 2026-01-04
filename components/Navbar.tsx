'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

const ADMIN_EMAIL = 'lucyonthegroundwithrocks@gmail.com';

export default function Navbar() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const pathname = usePathname();

  const isAuthed = !!email;
  const isAdmin = email === ADMIN_EMAIL;

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Build nav items based on auth/admin
  const items: Array<{ href: string; label: string; show: boolean }> = [
    { href: '/', label: 'Home', show: true },
    { href: '/dashboard', label: 'Dashboard', show: isAuthed },
    { href: '/dashboard/brackets', label: 'My Bracket', show: isAuthed },
    { href: '/dashboard/leaderboard', label: 'Leaderboard', show: isAuthed },
    { href: '/admin/settings', label: 'Admin Settings', show: isAdmin },
  ];

  const visibleItems = items.filter((i) => i.show);

  const linkClass =
    'text-[#FEE689] hover:text-[#FFEFB0] transition-colors';

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0A2041] shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="relative h-10 w-40 sm:h-12 sm:w-52">
            <Image
              src="/LOTG_Logo_Substack-Image-copy.png"
              alt="Lucy Bracket Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop nav (md+) */}
        <nav className="hidden md:flex items-center gap-4 text-xs sm:text-sm">
          {visibleItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile menu button (<md) */}
        <div className="md:hidden">
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-3 py-2 text-[#FEE689] hover:text-[#FFEFB0] hover:border-white/30 transition"
          >
            {/* Simple hamburger / X */}
            <span className="font-semibold text-sm">
              {open ? '✕' : '☰'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0A2041]">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 text-sm">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${linkClass} py-1`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
