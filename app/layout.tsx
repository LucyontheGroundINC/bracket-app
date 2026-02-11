import "./globals.css";
import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import Navbar from "@/components/Navbar";
import RequireAuth from "@/components/RequireAuth";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Lucy On The Ground Game Center",
  description: "Lucy On The Ground games: Bracket Madness + Hollywood’s Biggest Night",
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon%20(512%20x%20512%20px).png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "Lucy On The Ground Game Center",
    description: "Lucy On The Ground games: Bracket Madness + Hollywood’s Biggest Night",
    url: "https://bracket.lucyontheground.com",
    siteName: "Lucy On The Ground Game Center",
    images: [
      {
        url: "https://bracket.lucyontheground.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lucy On The Ground Game Center",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucy On The Ground Game Center",
    description: "Lucy On The Ground games: Bracket Madness + Hollywood’s Biggest Night",
    images: ["https://bracket.lucyontheground.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} bg-[#F9DCD8] text-[#0A2041]`} style={{ fontFamily: '"Playfair Display", serif' }}>
        <Navbar />
        <RequireAuth>
          <main>{children}</main>
        </RequireAuth>
      </body>
    </html>
  );
}

