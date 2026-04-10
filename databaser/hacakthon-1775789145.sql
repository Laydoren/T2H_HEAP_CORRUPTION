CREATE TABLE IF NOT EXISTS `Users` (
	`id` integer primary key NOT NULL UNIQUE,
	`login` TEXT NOT NULL UNIQUE,
	`password` TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS `Employees` (
	`login` TEXT NOT NULL UNIQUE,
	`first_name` TEXT NOT NULL,
	`last_name` TEXT NOT NULL,
	`patronymic` TEXT NOT NULL,
	`role` TEXT NOT NULL,
	'group' TEXT NOT NULL,
FOREIGN KEY(`login`) REFERENCES `Users`(`login`)
);
CREATE TABLE IF NOT EXISTS `Schedule` (
	`login` TEXT NOT NULL UNIQUE,
	'date' TEXT NOT NULL,
	`time_start` TEXT NOT NULL,
	`time_end` TEXT NOT NULL,
FOREIGN KEY(`login`) REFERENCES `Users`(`login`)
);