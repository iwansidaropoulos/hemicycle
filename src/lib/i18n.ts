/**
 * Simple French dictionary for the UI. The interface is French-only (brief §3),
 * so this is a flat lookup table rather than a full i18n framework. Code stays
 * in English; user-facing strings live here.
 */

export const fr = {
  appName: "Hémicycle",
  tagline:
    "Suivre l'activité de vote de l'Assemblée nationale (17e législature)",
  nav: {
    scrutins: "Scrutins",
    themes: "Thèmes",
    groups: "Groupes",
    search: "Rechercher",
  },
  home: {
    intro:
      "Parcourez les scrutins publics de l'Assemblée nationale : par date, par thème ou par groupe parlementaire.",
    comingSoon: "Les premières données arriveront bientôt.",
  },
  footer: {
    dataSource: "Données : Assemblée nationale (Open Data)",
    licence: "sous Licence Ouverte / Etalab",
    aiNotice:
      "Les explications et résumés signalés comme générés par IA sont fournis à titre indicatif ; vérifiez toujours la source officielle.",
  },
  positions: {
    pour: "Pour",
    contre: "Contre",
    abstention: "Abstention",
    "non-votant": "Non-votant",
  },
  result: {
    adopte: "Adopté",
    rejete: "Rejeté",
  },
  forme: {
    solennel: "Scrutin solennel",
    ordinaire: "Scrutin ordinaire",
    motion: "Motion de censure",
  },
  scrutins: {
    title: "Scrutins",
    searchPlaceholder: "Rechercher par titre…",
    allThemes: "Tous les thèmes",
    none: "Aucun scrutin ne correspond.",
    count: (n: number) => `${n.toLocaleString("fr-FR")} scrutin${n > 1 ? "s" : ""}`,
    votants: "votants",
  },
  groups: {
    title: "Groupes parlementaires",
    members: "députés",
    participation: "participation",
    votedFor: "A voté pour",
    votedAgainst: "A voté contre",
    abstained: "S'est abstenu",
    absent: "N'a pas pris part",
    mixed: "Vote partagé",
    seeVotes: "Voir les votes du groupe",
  },
  themes: {
    title: "Thèmes",
    intro:
      "Les thèmes sont attribués aux dossiers législatifs ; chaque scrutin hérite des thèmes de son dossier.",
    empty:
      "Les thèmes seront disponibles une fois l'enrichissement par IA effectué.",
    count: (n: number) => `${n} scrutin${n > 1 ? "s" : ""}`,
  },
  pagination: {
    previous: "Précédent",
    next: "Suivant",
    page: (n: number) => `Page ${n}`,
  },
  ai: {
    badge: "Généré par IA",
    explanation: "En quoi consiste le scrutin",
    sessionSummary: "Résumé de la séance",
    notYet: "Pas encore disponible.",
  },
  detail: {
    officialLink: "Voir sur le site de l'Assemblée nationale",
    byGroup: "Répartition par groupe",
    hemicycle: "Répartition dans l'hémicycle",
    counts: "Décompte",
    dossier: "Dossier législatif",
    backToList: "← Tous les scrutins",
  },
} as const;
