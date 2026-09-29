import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const title = "Synthetic Data Platform";
const description =
  "Realistic, privacy-safe tabular, relational and document data — generated on demand. Seeded, validated and exportable to CSV, JSON, SQL and printable documents.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${title} — HackDataV2`, template: `%s · ${title}` },
  description,
  applicationName: title,
  keywords: ["synthetic data", "test data", "privacy", "CSV", "SQL", "invoices", "bank statements", "faker"],
  openGraph: {
    type: "website",
    title,
    description,
    siteName: title,
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0F2A3F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${plex.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
