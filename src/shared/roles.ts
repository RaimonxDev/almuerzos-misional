/** Rol de un admin en su barrio: la presidenta (una por barrio) o el equipo que la ayuda. */
export const ROLES_BARRIO = ["presidenta", "equipo"] as const;
export type RolBarrio = (typeof ROLES_BARRIO)[number];
