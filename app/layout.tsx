import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Lucy Bracket',
  description: 'Pop culture bracket challenge',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F9DCD8] text-[#0A2041]">
        {/* Global top nav */}
        <header className="border-b border-[#F9DCD8]/60 bg-[#0A2041] text-[#F8F5EE]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* Logo on the left */}
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-40 sm:h-12 sm:w-52">
                <Image
                  src="/LOTG_Logo_Substack-Image-copy.png" // make sure this file is in /public
                  alt="Lucy Bracket Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>

            {/* Nav links on the right */}
            <nav className="flex items-center gap-4 text-xs sm:text-sm">
              <Link href="/dashboard" className="hover:text-[#FEE689]">
                Dashboard
              </Link>
              <Link href="/dashboard/brackets" className="hover:text-[#FEE689]">
                My Bracket
              </Link>
              <Link href="/dashboard/leaderboard" className="hover:text-[#FEE689]">
                Leaderboard
              </Link>
              <Link href="/admin/settings" className="hover:text-[#FEE689]">
                Admin Settings
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
