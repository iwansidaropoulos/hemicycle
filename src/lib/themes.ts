/**
 * Fixed theme taxonomy (brief §7). Themes are assigned by the AI tagging step
 * to *dossiers*; scrutins inherit their dossier's themes. This is a closed list
 * — no free-form tags — so the theme filter is stable and exhaustive.
 *
 * `id` is the stable key stored in `dossier_themes.theme`; `label` is the
 * French UI label.
 */

export interface Theme {
  id: string;
  label: string;
}

export const THEMES: Theme[] = [
  { id: "sante", label: "Santé" },
  { id: "fiscalite", label: "Fiscalité et budget" },
  { id: "environnement", label: "Environnement et énergie" },
  { id: "justice", label: "Justice" },
  { id: "securite", label: "Sécurité et ordre public" },
  { id: "defense", label: "Défense et forces armées" },
  { id: "affaires-etrangeres", label: "Affaires étrangères" },
  { id: "immigration", label: "Immigration et asile" },
  { id: "education", label: "Éducation et enseignement supérieur" },
  { id: "travail", label: "Travail et emploi" },
  { id: "economie", label: "Économie et entreprises" },
  { id: "logement", label: "Logement et urbanisme" },
  { id: "agriculture", label: "Agriculture et pêche" },
  { id: "transports", label: "Transports et mobilités" },
  { id: "numerique", label: "Numérique et télécommunications" },
  { id: "culture", label: "Culture et médias" },
  { id: "sports", label: "Sports" },
  { id: "institutions", label: "Institutions et vie publique" },
  { id: "collectivites", label: "Collectivités et outre-mer" },
  { id: "social", label: "Solidarités et protection sociale" },
  { id: "famille", label: "Famille et enfance" },
  { id: "retraites", label: "Retraites" },
  { id: "recherche", label: "Recherche et innovation" },
  { id: "egalite", label: "Égalité et lutte contre les discriminations" },
  { id: "europe", label: "Union européenne" },
];

const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/** Look up a theme's French label by id, falling back to the id itself. */
export function themeLabel(id: string): string {
  return THEME_BY_ID.get(id)?.label ?? id;
}

/** Whether an id belongs to the taxonomy. */
export function isKnownTheme(id: string): boolean {
  return THEME_BY_ID.has(id);
}
