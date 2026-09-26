import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Resolve OG/social image URLs against the real deployment URL (Vercel sets
// this in prod/preview); falls back to localhost in dev.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "atmosphere — weather",
  description:
    "A calm, ad-free personal weather app: a 10-day forecast and live radar. No trackers.",
  openGraph: {
    title: "atmosphere — weather",
    description:
      "A calm, ad-free personal weather app: a 10-day forecast and live radar.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "atmosphere — weather",
    description:
      "A calm, ad-free personal weather app: a 10-day forecast and live radar.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
      </body>
    </html>
  );
}
