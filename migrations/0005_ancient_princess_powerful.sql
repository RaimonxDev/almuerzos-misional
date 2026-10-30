-- Código de acceso de los misioneros (reemplaza el enlace con token). SQLite no agrega una columna
-- NOT NULL sin default: entra con '' y cada barrio existente recibe su código al azar (el mismo
-- alfabeto que `src/shared/codigo-misioneros.ts`; los nuevos lo generan en el Worker).
ALTER TABLE `barrios` ADD `codigo_misioneros` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `barrios` SET `codigo_misioneros` = substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (abs(random()) % 31) + 1, 1) || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (abs(random()) % 31) + 1, 1) || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (abs(random()) % 31) + 1, 1) || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (abs(random()) % 31) + 1, 1) || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (abs(random()) % 31) + 1, 1) || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (abs(random()) % 31) + 1, 1);
