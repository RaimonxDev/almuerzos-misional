import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeftIcon, ImageIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { compartirPng, nombreArchivoCalendario } from "@/app/compartir-imagen";
import { useBarrioAdmin, useMesAdmin } from "@/app/consultas-admin";
import { useIdiomaDelBarrio, useTitulo } from "@/app/hooks";
import { useIdioma } from "@/app/i18n";
import { leerPeriodo } from "@/app/periodos";
import { AjustarAlAncho } from "@/app/components/AjustarAlAncho";
import { CalendarioImpreso } from "@/app/components/CalendarioImpreso";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";

/** Hoja A4 apaisada sin márgenes; solo se imprime el calendario. */
const CSS_IMPRESION = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0 !important; background: #fff !important; }
  .no-imprimir { display: none !important; }
  .hoja-calendario { width: 297mm !important; height: 210mm !important; overflow: hidden; margin: 0 !important; padding: 0 !important; background: #fff; }
  .hoja-calendario > * { transform: none !important; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`;

/** `/admin/:barrio/:periodo/imprimir` — calendario imprimible y para compartir como imagen (maqueta 4). */
export function Imprimir() {
  return (
    <RutaAdmin>
      <VistaImprimir />
    </RutaAdmin>
  );
}

function VistaImprimir() {
  const { barrio: slug = "", periodo = "" } = useParams();
  const { t } = useIdioma();
  const barrio = useBarrioAdmin(slug);
  const mes = useMesAdmin(slug, leerPeriodo(periodo) ? periodo : null);
  const calendario = useRef<HTMLDivElement>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  useIdiomaDelBarrio(barrio.data?.barrio.idioma);
  useTitulo(barrio.data?.barrio.nombre);

  const volver = `/admin/${slug}?mes=${periodo}`;
  const error = barrio.error ?? mes.error;

  async function compartir() {
    if (!calendario.current) return;
    setCompartiendo(true);
    try {
      const resultado = await compartirPng(calendario.current, nombreArchivoCalendario(slug, periodo));
      if (resultado === "descargado") toast.success(t.calendario.imagenLista);
    } catch {
      toast.error(t.calendario.imagenError);
    } finally {
      setCompartiendo(false);
    }
  }

  const listo = barrio.data && mes.data;

  return (
    <div className="min-h-screen bg-[#E9EEF4] print:min-h-0 print:bg-white">
      <style>{CSS_IMPRESION}</style>
      <div className="no-imprimir sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-2 px-4 py-2.5 md:px-6">
          <Link to={volver} className={cn(buttonVariants({ variant: "ghost" }), "mr-auto px-3 font-bold")}>
            <ArrowLeftIcon aria-hidden="true" />
            {t.calendario.volver}
          </Link>
          <Button variant="outline" onClick={() => window.print()} disabled={!listo} className="rounded-[10px] px-4 font-bold">
            <PrinterIcon aria-hidden="true" />
            {t.calendario.imprimirPdf}
          </Button>
          <Button variant="accion" onClick={compartir} disabled={!listo || compartiendo} className="px-4">
            <ImageIcon aria-hidden="true" />
            {compartiendo ? t.calendario.compartiendo : t.calendario.compartirImagen}
          </Button>
        </div>
      </div>

      {!leerPeriodo(periodo) ? (
        <Aviso>{t.errores.NO_ENCONTRADO}</Aviso>
      ) : !listo ? (
        error ? (
          <ErrorCarga error={error} reintentar={() => (barrio.refetch(), mes.refetch())} />
        ) : (
          <Cargando />
        )
      ) : (
        <AjustarAlAncho>
          <CalendarioImpreso
            ref={calendario}
            barrio={barrio.data!.barrio}
            mes={mes.data!.mes}
            companerismos={mes.data!.companerismos}
            turnos={mes.data!.turnos}
          />
        </AjustarAlAncho>
      )}
    </div>
  );
}
