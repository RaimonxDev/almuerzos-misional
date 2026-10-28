import { cn } from "@/app/lib/utils";

export type OpcionPildora<V> = { valor: V; texto: string };

/** Botones tipo píldora para elegir un filtro (ej. "Todos / Solo libres"). */
export function GrupoPildoras<V>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  className,
}: {
  opciones: OpcionPildora<V>[];
  valor: V;
  onCambiar: (valor: V) => void;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex max-w-full overflow-x-auto rounded-full bg-cielo-claro p-[3px]", className)}
      role="group"
      aria-label={etiqueta}
    >
      {opciones.map((op) => (
        <button
          key={op.texto}
          type="button"
          aria-pressed={op.valor === valor}
          onClick={() => onCambiar(op.valor)}
          className={cn(
            "h-11 shrink-0 rounded-full px-4 text-sm font-bold text-azul-profundo transition-colors",
            op.valor === valor && "bg-azul-profundo text-white",
          )}
        >
          {op.texto}
        </button>
      ))}
    </div>
  );
}
