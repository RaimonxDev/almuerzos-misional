CREATE TABLE `solicitudes` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`email` text NOT NULL,
	`telefono` text NOT NULL,
	`barrio` text NOT NULL,
	`estaca` text,
	`ciudad` text NOT NULL,
	`pais` text NOT NULL,
	`idioma` text NOT NULL,
	`zona_horaria` text NOT NULL,
	`tiene_elderes` integer NOT NULL,
	`tiene_hermanas` integer NOT NULL,
	`mensaje` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`motivo_rechazo` text,
	`resuelta_en` integer,
	`resuelta_por_user_id` text,
	`barrio_id` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`resuelta_por_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`barrio_id`) REFERENCES `barrios`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `solicitudes_estado_idx` ON `solicitudes` (`estado`);--> statement-breakpoint
CREATE UNIQUE INDEX `solicitudes_email_pendiente_uq` ON `solicitudes` (`email`) WHERE "solicitudes"."estado" = 'pendiente';