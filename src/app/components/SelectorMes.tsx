import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useIdioma } from "@/app/i18n";
import { textoPeriodo, type Periodo } from "@/app/periodos";
import { Button } from "./ui/button";

/** "‹ Noviembre 2026 ›" para el encabezado azul. Las flechas solo recorren `meses`. */
export function SelectorMes({
  periodo,
  meses,
  onCambiar,
}: {
  periodo: Periodo;
  meses: Periodo[];
  onCambiar: (periodo: Periodo) => void;
}) {
  const { t, formatearMes } = useIdioma();
  const actual = textoPeriodo(periodo);
  const anterior = meses.filter((p) => textoPeriodo(p) < actual).at(-1);
  const siguiente = meses.find((p) => textoPeriodo(p) > actual);
  const clases = "text-white hover:bg-white/10 hover:text-white disabled:opacity-30";

  return (
    <nav className="mt-2.5 flex items-center justify-between rounded-xl bg-white/10 p-0.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.publico.mesAnterior}
        disabled={!anterior}
        onClick={() => anterior && onCambiar(anterior)}
        className={clases}
      >
        <ChevronLeftIcon className="size-5" />
      </Button>
      <div className="font-bold" aria-live="polite">
        {formatearMes(periodo.anio, periodo.mes)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.publico.mesSiguiente}
        disabled={!siguiente}
        onClick={() => siguiente && onCambiar(siguiente)}
        className={clases}
      >
        <ChevronRightIcon className="size-5" />
      </Button>
    </nav>
  );
}
