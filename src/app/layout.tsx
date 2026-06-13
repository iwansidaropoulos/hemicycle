import type { Metadata } from "next";

import "./globals.css";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { fr } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${fr.appName} — ${fr.tagline}`,
  description: fr.home.intro,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <SiteHeader />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
