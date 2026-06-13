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
} as const;
