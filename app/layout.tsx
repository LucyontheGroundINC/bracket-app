import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import RequireAuth from "@/components/RequireAuth";

export const metadata: Metadata = {
  title: "Lucy On The Ground Game Center",
  description: "Lucy On The Ground games: Bracket Madness + Hollywood’s Biggest Night",
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
        <RequireAuth>
          <main>{children}</main>
        </RequireAuth>
      </body>
    </html>
  );
}

