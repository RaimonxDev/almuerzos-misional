import { ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { useMarcarPresidenciaRevisada } from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { irA } from "./comunes";

/** Cada paso lleva a su sección: administradores, enlaces (donde está "Cambiar código") y datos del barrio. */
const PASOS = [
  { id: "equipo", destino: ["administradores"] },
  { id: "codigo", destino: ["enlaces"] },
  { id: "contacto", destino: ["datos-barrio"] },
] as const;

/**
 * Tarjeta "Revisa tu presidencia" arriba del panel tras un traspaso: el equipo anterior conserva el
 * acceso a los teléfonos hasta que la nueva presidenta lo revisa. Quien la dibuja decide cuándo
 * (`revisionPresidenciaPendiente` de la API); desaparece al marcarla, para todos sus teléfonos.
 */
export function RevisaPresidencia({ slug }: { slug: string }) {
  const { t } = useIdioma();
  const marcar = useMarcarPresidenciaRevisada(slug);
  const textos = t.revisaPresidencia;

  return (
    <Card aria-labelledby="revisa-presidencia-titulo" role="region" className="gap-3 rounded-[14px] border border-dorado/60 bg-cielo-claro py-4 ring-0">
      <CardHeader className="flex flex-col gap-0.5 px-4">
        <CardTitle id="revisa-presidencia-titulo" className="font-sans text-base font-extrabold text-azul-profundo">
          {textos.titulo}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{textos.intro}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <ol className="flex flex-col">
          {PASOS.map((p) => (
            <li key={p.id} className="flex items-center gap-1 border-t border-border/60 first:border-t-0">
              <Button
                variant="ghost"
                onClick={() => irA([...p.destino])}
                className="h-auto min-h-11 flex-1 justify-start px-1 py-2 text-left text-[15px] font-bold whitespace-normal text-azul-profundo hover:bg-transparent hover:underline"
              >
                {textos.pasos[p.id]}
              </Button>
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ol>
        <Button
          variant="accion"
          disabled={marcar.isPending}
          onClick={() => marcar.mutate(undefined, { onError: (e) => toast.error(t.errores[codigoDe(e)]) })}
          className="self-start"
        >
          {textos.marcar}
        </Button>
      </CardContent>
    </Card>
  );
}
