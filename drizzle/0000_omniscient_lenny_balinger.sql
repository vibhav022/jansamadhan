CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Submitted' NOT NULL,
	`district` text NOT NULL,
	`address` text,
	`latitude` real,
	`longitude` real,
	`submitter_name` text NOT NULL,
	`submitter_type` text NOT NULL,
	`contact` text NOT NULL,
	`evidence_key` text,
	`assigned_institution` text,
	`industry_partner` text,
	`impact_score` integer DEFAULT 50 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`audience` text DEFAULT 'All' NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`expertise` text NOT NULL,
	`district` text,
	`engagement` text DEFAULT 'Available' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`title` text NOT NULL,
	`stage` text DEFAULT 'Proposal' NOT NULL,
	`progress` integer DEFAULT 10 NOT NULL,
	`institution` text NOT NULL,
	`industry` text,
	`faculty_lead` text,
	`next_milestone` text,
	`due_date` text,
	`created_at` text NOT NULL
);
