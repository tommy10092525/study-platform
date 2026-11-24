CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`question_group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`question_group_id`) REFERENCES `question_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `answers_group_id_idx` ON `answers` (`question_group_id`);--> statement-breakpoint
CREATE INDEX `answers_user_id_idx` ON `answers` (`user_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`markdown` text DEFAULT '' NOT NULL,
	`course_id` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `documents_course_id_idx` ON `documents` (`course_id`);--> statement-breakpoint
CREATE TABLE `each_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`answer_id` text NOT NULL,
	`question_id` text NOT NULL,
	`response` text NOT NULL,
	`is_correct` integer NOT NULL,
	FOREIGN KEY (`answer_id`) REFERENCES `answers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `each_answers_answer_question_idx` ON `each_answers` (`answer_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`course_id` text NOT NULL,
	`filename` text NOT NULL,
	`format` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_key_unique` ON `files` (`key`);--> statement-breakpoint
CREATE INDEX `files_course_id_idx` ON `files` (`course_id`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_key_unique` ON `images` (`key`);--> statement-breakpoint
CREATE TABLE `question_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`course_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_groups_course_id_idx` ON `question_groups` (`course_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`question_group_id` text NOT NULL,
	`prompt` text NOT NULL,
	`accepted_answers` text NOT NULL,
	`case_sensitive` integer DEFAULT false NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`question_group_id`) REFERENCES `question_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_group_id_idx` ON `questions` (`question_group_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);