import Link from "next/link";

import { fr } from "@/lib/i18n";

/** Top navigation bar. The list/group/theme views are wired up in later phases. */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight">
          {fr.appName}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600">
          <Link href="/scrutins" className="hover:text-zinc-900">
            {fr.nav.scrutins}
          </Link>
          <Link href="/themes" className="hover:text-zinc-900">
            {fr.nav.themes}
          </Link>
          <Link href="/groupes" className="hover:text-zinc-900">
            {fr.nav.groups}
          </Link>
        </nav>
      </div>
    </header>
  );
}
