import Image from "next/image";
import Link from "next/link";

import { HemicycleGroups } from "@/components/hemicycle-groups";
import { getGroups } from "@/db/queries";
import { fr } from "@/lib/i18n";

export const revalidate = 3600;

export default async function Home() {
  const groups = await getGroups();

  return (
    <div className="space-y-8 py-2">
      {/* Masthead banner (theme-aware) */}
      <Image
        src="/banner_light.webp"
        alt={`${fr.appName} — ${fr.tagline}`}
        width={1600}
        height={400}
        priority
        className="block h-auto w-full rounded-lg dark:hidden"
      />
      <Image
        src="/banner_dark.webp"
        alt={`${fr.appName} — ${fr.tagline}`}
        width={1600}
        height={400}
        priority
        className="hidden h-auto w-full rounded-lg dark:block"
      />

      <HemicycleGroups groups={groups} />

      <section className="space-y-4 pt-2 text-center">
        <p className="mx-auto max-w-2xl text-zinc-600 dark:text-zinc-400">
          {fr.home.intro}
        </p>
        <Link
          href="/scrutins"
          className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {fr.home.browseScrutins}
        </Link>
      </section>
    </div>
  );
}
