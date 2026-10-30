import type { ComponentType } from "react";
import { cn } from "@/app/lib/utils";

export type OpcionPildora<V> = { valor: V; texto: string; icono?: ComponentType<{ className?: string }> };

/**
 * Botones para elegir una opción: píldoras (ej. "Todos / Solo libres") o, con `variante="segmento"`,
 * un control a todo el ancho con la opción elegida en blanco (ej. "Lista / Calendario").
 */
export function GrupoPildoras<V>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  variante = "pildora",
  className,
}: {
  opciones: OpcionPildora<V>[];
  valor: V;
  onCambiar: (valor: V) => void;
  etiqueta?: string;
  variante?: "pildora" | "segmento";
  className?: string;
}) {
  const segmento = variante === "segmento";
  return (
    <div
      className={cn(
        "bg-cielo-claro p-[3px]",
        segmento ? "grid auto-cols-fr grid-flow-col rounded-xl" : "flex max-w-full overflow-x-auto rounded-full",
        className,
      )}
      role="group"
      aria-label={etiqueta}
    >
      {opciones.map(({ valor: v, texto, icono: Icono }) => {
        const elegida = v === valor;
        return (
          <button
            key={texto}
            type="button"
            aria-pressed={elegida}
            onClick={() => onCambiar(v)}
            className={cn(
              "h-11 shrink-0 text-sm font-bold transition-colors",
              segmento
                ? "flex items-center justify-center gap-[7px] rounded-[10px] text-[#3D4C5C]"
                : "rounded-full px-4 text-azul-profundo",
              elegida &&
                (segmento
                  ? "bg-card font-extrabold text-azul-profundo shadow-[0_1px_2px_rgba(20,48,79,0.18)]"
                  : "bg-azul-profundo text-white"),
            )}
          >
            {Icono && <Icono className="size-[18px]" aria-hidden="true" />}
            {texto}
          </button>
        );
      })}
    </div>
  );
}
