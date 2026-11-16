CREATE TABLE `vital_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` real NOT NULL,
	`observed_date` text NOT NULL,
	`observed_time` text NOT NULL,
	`submission_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vital_entries_kind_check" CHECK("vital_entries"."kind" in ('systolic', 'diastolic', 'pulse', 'temperature', 'weight', 'height', 'pain', 'glucose'))
);
--> statement-breakpoint
CREATE INDEX `vital_entries_patient_when` ON `vital_entries` (`patient_id`,`observed_date`,`observed_time`,`created_at`);--> statement-breakpoint
CREATE INDEX `vital_entries_submission` ON `vital_entries` (`patient_id`,`submission_id`);--> statement-breakpoint
ALTER TABLE `patients` ADD `date_of_birth` text;