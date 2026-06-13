import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { fr } from "@/lib/i18n";

/** Top navigation bar. */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          {/* Theme-aware logo (light/dark variants) */}
          <Image src="/logo_light.png" alt="" width={26} height={26} className="dark:hidden" priority />
          <Image src="/logo_dark.png" alt="" width={26} height={26} className="hidden dark:block" priority />
          {fr.appName}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/scrutins" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {fr.nav.scrutins}
          </Link>
          <Link href="/themes" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {fr.nav.themes}
          </Link>
          <Link href="/groupes" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {fr.nav.groups}
          </Link>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
