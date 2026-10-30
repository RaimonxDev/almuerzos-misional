import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { barrioEnMarcha, calcularPasos, usePrimerosPasos, type IdPaso } from "@/app/primeros-pasos";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

/** A qué parte del panel lleva cada paso (los `id` están en Panel y BarraLateral). */
const DESTINO: Record<IdPaso, string[]> = {
  misioneros: ["misioneros"],
  nota: ["nota-para-cocinar"],
  crearMes: ["crear-mes"],
  abrirMes: ["estado-mes", "crear-mes"],
  compartir: ["enlaces"],
};

function irA(ids: string[]) {
  const el = ids.map((id) => document.getElementById(id)).find((e) => e !== null);
  if (!el) return;
  el.scrollIntoView?.({ behavior: "smooth", block: "center" });
  if (el.matches("a, button, input, textarea, select")) el.focus({ preventScroll: true });
}

/**
 * Tarjeta "Primeros pasos" arriba del panel: qué falta para dejar el barrio funcionando.
 * Desaparece cuando todo está hecho, cuando se oculta o si el barrio ya está en marcha.
 */
export function PrimerosPasos({
  slug,
  notaParaCocinar,
  meses,
}: {
  slug: string;
  notaParaCocinar: string | null;
  meses: { estado: string; tomados: number }[];
}) {
  const { t } = useIdioma();
  const [guardado, marcar] = usePrimerosPasos(slug);
  const pasos = calcularPasos({ notaParaCocinar, meses }, guardado);
  const hechos = pasos.filter((p) => p.hecho).length;
  if (guardado.oculto || hechos === pasos.length || barrioEnMarcha(meses)) return null;

  return (
    <Card aria-labelledby="primeros-pasos-titulo" role="region" className="gap-3 rounded-[14px] border bg-cielo-claro py-4 ring-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4">
        <div className="flex flex-col gap-0.5">
          <CardTitle id="primeros-pasos-titulo" className="font-sans text-base font-extrabold text-azul-profundo">
            {t.primerosPasos.titulo}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.primerosPasos.avance(hechos, pasos.length)}</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => marcar({ oculto: true })}
          className="rounded-[10px] text-[13px] font-bold text-azul-medio"
        >
          {t.primerosPasos.ocultar}
        </Button>
      </CardHeader>
      <CardContent className="px-4">
        <ol className="flex flex-col">
          {pasos.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 border-t border-border/60 first:border-t-0">
              {p.hecho ? (
                <CheckCircle2Icon aria-hidden="true" className="size-5 shrink-0 text-exito" />
              ) : (
                <CircleIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  if (p.id === "misioneros") marcar({ misioneros: true });
                  irA(DESTINO[p.id]);
                }}
                className={cn(
                  "h-auto min-h-11 flex-1 justify-start px-1 py-2 text-left text-[15px] font-bold whitespace-normal hover:bg-transparent hover:underline",
                  p.hecho ? "text-muted-foreground" : "text-azul-profundo",
                )}
              >
                {t.primerosPasos.pasos[p.id]}
                <span className="sr-only">
                  {" — "}
                  {p.hecho ? t.primerosPasos.hecho : t.primerosPasos.pendiente}
                </span>
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
