import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

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
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}

