CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `campaign_recipients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider_message_id` text,
	`failure_code` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`queued_at` integer NOT NULL,
	`sent_at` integer,
	`delivered_at` integer,
	`read_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_contact_unique` ON `campaign_recipients` (`campaign_id`,`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_message_unique` ON `campaign_recipients` (`provider_message_id`);--> statement-breakpoint
CREATE INDEX `recipients_campaign_status_idx` ON `campaign_recipients` (`campaign_id`,`status`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`template_name` text NOT NULL,
	`template_language` text DEFAULT 'pt_BR' NOT NULL,
	`include_name_parameter` integer DEFAULT true NOT NULL,
	`audience_type` text DEFAULT 'all_active' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` integer NOT NULL,
	`scheduled_at` integer,
	`started_at` integer,
	`completed_at` integer,
	`total_recipients` integer DEFAULT 0 NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`delivered_count` integer DEFAULT 0 NOT NULL,
	`read_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `campaigns_status_idx` ON `campaigns` (`status`);--> statement-breakpoint
CREATE TABLE `consent_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`actor_user_id` integer,
	`detail` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `consent_contact_idx` ON `consent_events` (`contact_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone_e164` text NOT NULL,
	`phone_display` text NOT NULL,
	`neighborhood` text DEFAULT 'Não informado' NOT NULL,
	`leader_id` integer NOT NULL,
	`source` text DEFAULT 'lideranca_presencial' NOT NULL,
	`consent_at` integer NOT NULL,
	`consent_text_version` text DEFAULT '2026-01' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`opted_out_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`leader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_phone_unique` ON `contacts` (`phone_e164`);--> statement-breakpoint
CREATE INDEX `contacts_leader_idx` ON `contacts` (`leader_id`);--> statement-breakpoint
CREATE INDEX `contacts_status_idx` ON `contacts` (`status`);--> statement-breakpoint
CREATE INDEX `contacts_neighborhood_idx` ON `contacts` (`neighborhood`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'leader' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);