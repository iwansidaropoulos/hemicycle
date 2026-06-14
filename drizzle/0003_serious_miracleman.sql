ALTER TABLE `scrutin_ai` ADD `arguments_pour` text;--> statement-breakpoint
ALTER TABLE `scrutin_ai` ADD `arguments_contre` text;--> statement-breakpoint
ALTER TABLE `scrutins` ADD `text_key` text;--> statement-breakpoint
CREATE INDEX `scrutins_textkey_idx` ON `scrutins` (`text_key`);