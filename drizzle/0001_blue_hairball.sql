CREATE INDEX `idx_challenges_created_at` ON `challenges` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_challenges_district_title` ON `challenges` (`district`,`title`);--> statement-breakpoint
CREATE INDEX `idx_challenges_status` ON `challenges` (`status`);--> statement-breakpoint
CREATE INDEX `idx_notifications_created_at` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_partners_created_at` ON `partners` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_projects_created_at` ON `projects` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_projects_challenge_id` ON `projects` (`challenge_id`);--> statement-breakpoint
PRAGMA optimize;
