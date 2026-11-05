ALTER TABLE `admins_barrio` ADD `rol` text DEFAULT 'equipo' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `admins_barrio_presidenta_uq` ON `admins_barrio` (`barrio_id`) WHERE "admins_barrio"."rol" = 'presidenta';--> statement-breakpoint
-- Admins que ya existían: con uno solo en el barrio, es la presidenta.
UPDATE `admins_barrio` SET `rol` = 'presidenta'
WHERE (SELECT count(*) FROM `admins_barrio` a WHERE a.`barrio_id` = `admins_barrio`.`barrio_id`) = 1;--> statement-breakpoint
-- Con varios, solo si el cargo decide: exactamente uno dice "presidenta" (sin vice ni consejera).
UPDATE `admins_barrio` SET `rol` = 'presidenta'
WHERE `rol` = 'equipo'
  AND lower(coalesce(`cargo`, '')) LIKE '%presidenta%'
  AND lower(`cargo`) NOT LIKE '%vice%'
  AND lower(`cargo`) NOT LIKE '%consejera%'
  AND (SELECT count(*) FROM `admins_barrio` a
       WHERE a.`barrio_id` = `admins_barrio`.`barrio_id`
         AND lower(coalesce(a.`cargo`, '')) LIKE '%presidenta%'
         AND lower(a.`cargo`) NOT LIKE '%vice%'
         AND lower(a.`cargo`) NOT LIKE '%consejera%') = 1
  AND NOT EXISTS (SELECT 1 FROM `admins_barrio` a
                  WHERE a.`barrio_id` = `admins_barrio`.`barrio_id` AND a.`rol` = 'presidenta');
