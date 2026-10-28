import type { ReactNode } from "react";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { Button } from "./ui/button";

/** Tarjeta de un día en la lista vertical del mes: número, día de la semana y sus turnos. */
export function TarjetaDia({
  fecha,
  pasado = false,
  hoy = false,
  children,
}: {
  fecha: string;
  pasado?: boolean;
  /** Borde dorado y etiqueta "Hoy". */
  hoy?: boolean;
  children: ReactNode;
}) {
  const { t, formatearFecha } = useIdioma();
  return (
    <section
      aria-label={formatearFecha(fecha)}
      className={cn(
        "flex flex-col gap-2 rounded-[14px] border bg-card px-3.5 py-3",
        pasado && "opacity-60",
        hoy && "border-2 border-dorado-claro px-[13px] py-[11px]",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] leading-none font-extrabold text-azul-profundo">{Number(fecha.slice(8))}</span>
        <span className="inline-block text-sm font-bold text-muted-foreground first-letter:uppercase">
          {formatearFecha(fecha, { weekday: "long" })}
        </span>
        {hoy && (
          <span className="ml-auto self-center rounded-full border border-aviso-borde bg-aviso-suave px-2.5 py-0.5 text-xs font-extrabold tracking-[0.06em] text-aviso-texto uppercase">
            {t.misioneros.hoy}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Una fila de turno dentro de `TarjetaDia`, con el separador superior. */
export function FilaTurno({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex min-h-11 border-t border-[#EEF2F6] pt-2", className)}>{children}</div>;
}

/** "Ver los N días anteriores" / "Ocultar días anteriores"; no aparece si no hay días pasados. */
export function BotonDiasAnteriores({
  cantidad,
  abiertos,
  onCambiar,
}: {
  cantidad: number;
  abiertos: boolean;
  onCambiar: (abiertos: boolean) => void;
}) {
  const { t } = useIdioma();
  if (cantidad === 0) return null;
  return (
    <Button variant="ghost" className="self-center text-azul-medio" onClick={() => onCambiar(!abiertos)}>
      {abiertos ? t.publico.ocultarAnteriores : t.publico.verAnteriores(cantidad)}
    </Button>
  );
}
