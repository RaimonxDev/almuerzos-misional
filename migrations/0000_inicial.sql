CREATE TABLE `admins_barrio` (
	`user_id` text NOT NULL,
	`barrio_id` text NOT NULL,
	`cargo` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `barrio_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`barrio_id`) REFERENCES `barrios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admins_barrio_barrio_idx` ON `admins_barrio` (`barrio_id`);--> statement-breakpoint
CREATE TABLE `barrios` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`nombre` text NOT NULL,
	`idioma` text DEFAULT 'es' NOT NULL,
	`zona_horaria` text DEFAULT 'America/Santiago' NOT NULL,
	`token_misioneros` text NOT NULL,
	`nota_para_cocinar` text,
	`contacto_nombre` text,
	`contacto_telefono` text,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barrios_slug_unique` ON `barrios` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `barrios_token_misioneros_unique` ON `barrios` (`token_misioneros`);--> statement-breakpoint
CREATE TABLE `companerismos` (
	`id` text PRIMARY KEY NOT NULL,
	`barrio_id` text NOT NULL,
	`tipo` text NOT NULL,
	`nombre` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`barrio_id`) REFERENCES `barrios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `companerismos_barrio_idx` ON `companerismos` (`barrio_id`);--> statement-breakpoint
CREATE TABLE `inscripciones` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text,
	`consentimiento_telefono` integer DEFAULT false NOT NULL,
	`modalidad` text,
	`nota` text,
	`origen` text NOT NULL,
	`creado_por_user_id` text,
	`token_edicion_hash` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	`actualizado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inscripciones_turno_id_unique` ON `inscripciones` (`turno_id`);--> statement-breakpoint
CREATE INDEX `inscripciones_token_idx` ON `inscripciones` (`token_edicion_hash`);--> statement-breakpoint
CREATE TABLE `meses` (
	`id` text PRIMARY KEY NOT NULL,
	`barrio_id` text NOT NULL,
	`anio` integer NOT NULL,
	`mes` integer NOT NULL,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`imagen_key` text,
	`escritura` text,
	`escritura_ref` text,
	`mensaje` text,
	`plantilla` text DEFAULT 'azul' NOT NULL,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	`actualizado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`barrio_id`) REFERENCES `barrios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meses_barrio_periodo_uq` ON `meses` (`barrio_id`,`anio`,`mes`);--> statement-breakpoint
CREATE TABLE `turnos` (
	`id` text PRIMARY KEY NOT NULL,
	`mes_id` text NOT NULL,
	`companerismo_id` text NOT NULL,
	`fecha` text NOT NULL,
	`bloqueado` integer DEFAULT false NOT NULL,
	`motivo_bloqueo` text,
	FOREIGN KEY (`mes_id`) REFERENCES `meses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`companerismo_id`) REFERENCES `companerismos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turnos_companerismo_fecha_uq` ON `turnos` (`companerismo_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `turnos_mes_idx` ON `turnos` (`mes_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
