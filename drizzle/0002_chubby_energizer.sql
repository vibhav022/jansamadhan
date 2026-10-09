CREATE TABLE `service_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`service_type` text NOT NULL,
	`facility_id` text NOT NULL,
	`facility_name` text NOT NULL,
	`citizen_name` text NOT NULL,
	`phone` text NOT NULL,
	`district` text NOT NULL,
	`booking_date` text NOT NULL,
	`time_slot` text NOT NULL,
	`quantity` integer,
	`notes` text,
	`latitude` real,
	`longitude` real,
	`status` text DEFAULT 'Requested' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_service_bookings_created_at` ON `service_bookings` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_bookings_phone` ON `service_bookings` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_service_bookings_type_status` ON `service_bookings` (`service_type`,`status`);--> statement-breakpoint
PRAGMA optimize;
