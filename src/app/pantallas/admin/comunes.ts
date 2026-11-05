import { hoyEnZona, zonaDelNavegador } from "@/shared/fechas";

export const ESTILO_ACCION_PELIGROSA =
  "h-11 self-start px-0 text-[13px] font-bold whitespace-normal text-destructive hover:bg-transparent hover:text-destructive hover:underline";

/** Día de un instante en la zona de quien mira (no en UTC: de noche en América sería el día siguiente). */
export const diaLocal = (v: string | number) => hoyEnZona(zonaDelNavegador(), new Date(v));

export const FECHA_LARGA = { day: "numeric", month: "long", year: "numeric" } as const;

/** Lleva a la primera sección que exista entre `ids` (scroll suave y foco si es un control). */
export function irA(ids: string[]) {
  const el = ids.map((id) => document.getElementById(id)).find((e) => e !== null);
  if (!el) return;
  el.scrollIntoView?.({ behavior: "smooth", block: "center" });
  if (el.matches("a, button, input, textarea, select")) el.focus({ preventScroll: true });
}
