import { fr } from "@/lib/i18n";

export default function Home() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{fr.tagline}</h1>
      <p className="max-w-2xl text-zinc-600">{fr.home.intro}</p>
      <p className="text-sm text-zinc-400">{fr.home.comingSoon}</p>
    </section>
  );
}
