CREATE TABLE `deputies` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`prenom` text NOT NULL,
	`group_id` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deputies_group_idx` ON `deputies` (`group_id`);--> statement-breakpoint
CREATE TABLE `dossier_themes` (
	`dossier_id` text NOT NULL,
	`theme` text NOT NULL,
	PRIMARY KEY(`dossier_id`, `theme`),
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `dossier_themes_theme_idx` ON `dossier_themes` (`theme`);--> statement-breakpoint
CREATE TABLE `dossiers` (
	`id` text PRIMARY KEY NOT NULL,
	`titre` text NOT NULL,
	`type` text,
	`url` text
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`libelle` text NOT NULL,
	`abrege` text,
	`couleur` text,
	`effectif` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scrutin_ai` (
	`scrutin_id` text PRIMARY KEY NOT NULL,
	`explanation` text,
	`summary` text,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP,
	`model` text,
	`source_hash` text,
	FOREIGN KEY (`scrutin_id`) REFERENCES `scrutins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scrutin_group_results` (
	`scrutin_id` text NOT NULL,
	`group_id` text NOT NULL,
	`pour` integer DEFAULT 0 NOT NULL,
	`contre` integer DEFAULT 0 NOT NULL,
	`abstention` integer DEFAULT 0 NOT NULL,
	`non_votant` integer DEFAULT 0 NOT NULL,
	`effectif` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`scrutin_id`, `group_id`),
	FOREIGN KEY (`scrutin_id`) REFERENCES `scrutins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sgr_group_idx` ON `scrutin_group_results` (`group_id`);--> statement-breakpoint
CREATE TABLE `scrutins` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer,
	`date` text,
	`titre` text NOT NULL,
	`objet` text,
	`forme` text DEFAULT 'ordinaire' NOT NULL,
	`type_code` text,
	`is_final` integer DEFAULT false NOT NULL,
	`resultat` text,
	`count_pour` integer DEFAULT 0 NOT NULL,
	`count_contre` integer DEFAULT 0 NOT NULL,
	`count_abstention` integer DEFAULT 0 NOT NULL,
	`count_non_votant` integer DEFAULT 0 NOT NULL,
	`session_id` text,
	`dossier_id` text,
	`url` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scrutins_date_idx` ON `scrutins` (`date`);--> statement-breakpoint
CREATE INDEX `scrutins_dossier_idx` ON `scrutins` (`dossier_id`);--> statement-breakpoint
CREATE INDEX `scrutins_session_idx` ON `scrutins` (`session_id`);--> statement-breakpoint
CREATE INDEX `scrutins_forme_final_idx` ON `scrutins` (`forme`,`is_final`);--> statement-breakpoint
CREATE TABLE `session_ai` (
	`session_id` text PRIMARY KEY NOT NULL,
	`summary` text,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP,
	`model` text,
	`source_hash` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text,
	`numero` integer
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`scrutin_id` text NOT NULL,
	`deputy_id` text NOT NULL,
	`position` text NOT NULL,
	PRIMARY KEY(`scrutin_id`, `deputy_id`),
	FOREIGN KEY (`scrutin_id`) REFERENCES `scrutins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `votes_deputy_idx` ON `votes` (`deputy_id`);