CREATE TABLE `progress_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`stage` text NOT NULL,
	`progress` integer NOT NULL,
	`message` text NOT NULL,
	`actor` text DEFAULT 'JanSamadhan system' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_progress_updates_challenge_created` ON `progress_updates` (`challenge_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_progress_updates_created_at` ON `progress_updates` (`created_at`);--> statement-breakpoint
PRAGMA optimize;
