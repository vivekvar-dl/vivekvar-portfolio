CREATE TABLE `guestbook` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`signature` text NOT NULL,
	`view_box` text NOT NULL,
	`ip_hash` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
