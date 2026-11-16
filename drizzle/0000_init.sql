CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`patient_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changes` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_patient_time` ON `audit_log` (`patient_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `care_report_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `care_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "care_report_revisions_actor_type_check" CHECK("care_report_revisions"."actor_type" in ('group', 'teacher'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_report_revisions_report_version_unique` ON `care_report_revisions` (`report_id`,`version`);--> statement-breakpoint
CREATE TABLE `care_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`group_id` text,
	`observed_date` text NOT NULL,
	`observed_time` text NOT NULL,
	`shift` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `student_groups`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "care_reports_shift_check" CHECK("care_reports"."shift" in ('frueh', 'spaet', 'nacht')),
	CONSTRAINT "care_reports_body_check" CHECK(length("care_reports"."body") between 1 and 10000),
	CONSTRAINT "care_reports_version_check" CHECK("care_reports"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `reports_patient_when` ON `care_reports` (`patient_id`,`observed_date`,`observed_time`,`created_at`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `measurement_requirements` (
	`patient_id` text NOT NULL,
	`field` text NOT NULL,
	`is_expected` integer NOT NULL,
	PRIMARY KEY(`patient_id`, `field`),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "measurement_requirements_is_expected_check" CHECK("measurement_requirements"."is_expected" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	CONSTRAINT "sessions_actor_type_check" CHECK("sessions"."actor_type" in ('group', 'teacher'))
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `student_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`patient_id` text NOT NULL,
	`access_code_hash` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "student_groups_is_active_check" CHECK("student_groups"."is_active" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_groups_patient_id_unique` ON `student_groups` (`patient_id`);--> statement-breakpoint
CREATE TABLE `vital_daily_records` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`date` text NOT NULL,
	`systolic_mmhg` integer,
	`diastolic_mmhg` integer,
	`pulse_bpm` integer,
	`temperature_c` real,
	`weight_kg` real,
	`height_cm` real,
	`pain_score` integer,
	`glucose_mg_dl` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vital_daily_records_pain_check" CHECK("vital_daily_records"."pain_score" is null or ("vital_daily_records"."pain_score" between 0 and 10)),
	CONSTRAINT "vital_daily_records_version_check" CHECK("vital_daily_records"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vital_daily_records_patient_date_unique` ON `vital_daily_records` (`patient_id`,`date`);