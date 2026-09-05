import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { CookieBanner } from "@/components/cookie-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
const DESCRIPTION =
  "Après chaque déploiement, PostShip vérifie vos URLs critiques comme un utilisateur : HTTP, Open Graph, sitemap, SSL. Alerte Discord et email si ça casse, silence sinon.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Après chaque déploiement, on vérifie votre site — PostShip",
    template: "%s — PostShip",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "PostShip",
    description: DESCRIPTION,
    url: APP_URL,
    siteName: "PostShip",
    locale: "fr_FR",
    type: "website",
    // og:image / twitter:image are wired automatically by Next's file
    // convention (src/app/opengraph-image.tsx) — no static asset needed.
  },
  twitter: {
    card: "summary_large_image",
    title: "PostShip",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0c0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* Site-wide: the choice applies to every page, and a banner that
            only appears on marketing pages would ask again after login. */}
        <CookieBanner />
        <Toaster
          position="top-center"
          closeButton
          duration={5000}
          gap={8}
        />
      </body>
    </html>
  );
}
