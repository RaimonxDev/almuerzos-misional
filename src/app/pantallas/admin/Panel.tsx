import { useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { LockIcon, LockOpenIcon, PlusIcon, PrinterIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import { useYo } from "@/app/consultas";
import {
  type EstadoMes,
  useBarrioAdmin,
  useCambiarEstado,
  useCrearMes,
  useMesAdmin,
  useMesesAdmin,
} from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { useIdiomaDelBarrio, usePeriodoDeLaUrl, useTitulo } from "@/app/hooks";
import { mesInicial, textoPeriodo, type Periodo } from "@/app/periodos";
import { cn } from "@/app/lib/utils";
import { hoyEnZona } from "@/shared/fechas";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { BarraLateral } from "./BarraLateral";
import { EncabezadoAdmin } from "./EncabezadoAdmin";
import { contarTurnos, periodoParaCrear } from "./mes";
import { TablaMes } from "./TablaMes";

/**
 * `/admin` y `/admin/:barrio?mes=2026-11` — panel de la presidenta (maqueta 3).
 * `/admin` lleva al primer barrio que administra.
 */
export function PanelRuta() {
  return (
    <RutaAdmin>
      <Panel />
    </RutaAdmin>
  );
}

function Panel() {
  const { barrio: slug } = useParams();
  const { t } = useIdioma();
  const yo = useYo().data!;

  if (!slug) {
    const primero = yo.barrios[0];
    if (primero) return <Navigate to={`/admin/${primero.slug}`} replace />;
    return (
      <>
        <EncabezadoAdmin />
        <Aviso>{t.panel.sinBarrios}</Aviso>
      </>
    );
  }
  // Con `key`, cambiar de barrio parte de cero (mes creado, nota a medio escribir).
  return <PanelBarrio key={slug} slug={slug} />;
}

function PanelBarrio({ slug }: { slug: string }) {
  const { t, formatearMes } = useIdioma();
  const barrio = useBarrioAdmin(slug);
  const meses = useMesesAdmin(slug);
  const crear = useCrearMes(slug);
  const datosBarrio = barrio.data?.barrio;
  const hoy = datosBarrio ? hoyEnZona(datosBarrio.zonaHoraria) : "";
  const lista = meses.data?.meses ?? [];
  const [periodoUrl, ir] = usePeriodoDeLaUrl(lista, hoy);
  // Un ?mes= que el barrio no tiene (link viejo, otro barrio) se ignora: se muestra el mes inicial.
  const periodo =
    periodoUrl && lista.some((m) => m.periodo === textoPeriodo(periodoUrl)) ? periodoUrl : mesInicial(lista, hoy);
  /** Aviso "creado en borrador" del último mes creado, mientras se esté mirando ese mes. */
  const [creado, setCreado] = useState<{ periodo: string; turnos: number } | null>(null);
  useIdiomaDelBarrio(datosBarrio?.idioma);
  useTitulo(datosBarrio?.nombre);

  const error = barrio.error ?? meses.error;
  if (!barrio.data || !meses.data) {
    return (
      <>
        <EncabezadoAdmin slug={slug} />
        {error ? <ErrorCarga error={error} reintentar={() => (barrio.refetch(), meses.refetch())} /> : <Cargando />}
      </>
    );
  }

  const nuevo = periodoParaCrear(lista, hoy);
  const crearMes = () =>
    crear.mutate(textoPeriodo(nuevo), {
      onSuccess: ({ mes }) => {
        if (mes) setCreado({ periodo: mes.periodo, turnos: mes.turnos });
        ir(nuevo);
      },
      onError: (e) => toast.error(t.errores[codigoDe(e)]),
    });

  return (
    <>
      <EncabezadoAdmin slug={slug} />
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-6 px-4 py-6 md:px-6">
        <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-[18px]">
          <nav aria-label={t.panel.meses} className="flex flex-wrap items-center gap-2">
            {lista.map((m) => {
              const elegido = periodo !== null && textoPeriodo(periodo) === m.periodo;
              return (
                <button
                  key={m.periodo}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => ir(m)}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-full border bg-card pr-2 pl-3.5 text-sm font-extrabold text-azul-profundo",
                    elegido && "border-2 border-azul-medio bg-cielo-claro",
                  )}
                >
                  {formatearMes(m.anio, m.mes)}
                  <InsigniaEstado estado={m.estado} />
                </button>
              );
            })}
            <Button
              variant="outline"
              onClick={crearMes}
              disabled={crear.isPending}
              className="rounded-full border-dashed border-azul-medio font-bold text-azul-medio"
            >
              <PlusIcon aria-hidden="true" />
              {t.panel.crearMes(formatearMes(nuevo.anio, nuevo.mes))}
            </Button>
          </nav>

          {creado && periodo && creado.periodo === textoPeriodo(periodo) && (
            <div role="status" className="rounded-xl border border-exito/20 bg-exito-suave px-3.5 py-3 text-sm leading-snug text-exito">
              {t.panel.mesCreado(formatearMes(periodo.anio, periodo.mes), creado.turnos)}
            </div>
          )}

          {periodo ? (
            <MesDelPanel slug={slug} periodo={periodo} zonaHoraria={barrio.data.barrio.zonaHoraria} hoy={hoy} />
          ) : (
            <Aviso>{t.panel.sinMeses}</Aviso>
          )}
        </main>

        <BarraLateral
          slug={slug}
          barrio={barrio.data.barrio}
          companerismos={barrio.data.companerismos}
          periodo={periodo ? textoPeriodo(periodo) : null}
        />
      </div>
    </>
  );
}

const ESTILO_ESTADO: Record<EstadoMes, string> = {
  borrador: "bg-[#EEF2F6] text-[#3D4C5C]",
  abierto: "bg-exito-suave text-exito",
  cerrado: "bg-aviso-suave text-aviso-texto",
};

function InsigniaEstado({ estado, className }: { estado: EstadoMes; className?: string }) {
  const { t } = useIdioma();
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-extrabold", ESTILO_ESTADO[estado], className)}>
      {t.panel.estados[estado]}
    </span>
  );
}

function MesDelPanel({
  slug,
  periodo,
  zonaHoraria,
  hoy,
}: {
  slug: string;
  periodo: Periodo;
  zonaHoraria: string;
  hoy: string;
}) {
  const { t, formatearMes } = useIdioma();
  const texto = textoPeriodo(periodo);
  const consulta = useMesAdmin(slug, texto);
  const cambiar = useCambiarEstado(slug, texto);

  const titulo = (
    <h1 className="text-[30px] leading-tight font-semibold text-azul-profundo">{formatearMes(periodo.anio, periodo.mes)}</h1>
  );
  if (!consulta.data) {
    return (
      <>
        {titulo}
        {consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />}
      </>
    );
  }

  const { mes, companerismos, turnos } = consulta.data;
  const cuenta = contarTurnos(turnos);
  const pasarA = (estado: EstadoMes) =>
    cambiar.mutate(estado, { onError: (e) => toast.error(t.errores[codigoDe(e)]) });

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {titulo}
            <InsigniaEstado estado={mes.estado} className="text-[13px]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/admin/${slug}/${texto}/imprimir`}
              className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px] px-4 font-bold")}
            >
              <PrinterIcon aria-hidden="true" />
              {t.calendario.imprimirPdf}
            </Link>
            {mes.estado === "borrador" && (
              <Button
                onClick={() => pasarA("abierto")}
                disabled={cambiar.isPending}
                className="rounded-[10px] bg-exito px-4 font-bold text-white hover:bg-exito/90"
              >
                <LockOpenIcon aria-hidden="true" />
                {t.panel.abrir}
              </Button>
            )}
            {mes.estado === "abierto" && (
              <Button variant="outline" onClick={() => pasarA("cerrado")} disabled={cambiar.isPending} className="rounded-[10px] px-4 font-bold">
                <LockIcon aria-hidden="true" />
                {t.panel.cerrar}
              </Button>
            )}
            {mes.estado === "cerrado" && (
              <Button variant="outline" onClick={() => pasarA("abierto")} disabled={cambiar.isPending} className="rounded-[10px] px-4 font-bold">
                <RotateCcwIcon aria-hidden="true" />
                {t.panel.reabrir}
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm leading-snug text-muted-foreground">{t.panel.ayudaEstado[mes.estado]}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Contador etiqueta={t.panel.tomados} valor={cuenta.tomados} detalle={t.panel.deTotal(cuenta.total)} />
        <Contador etiqueta={t.panel.libres} valor={cuenta.libres} className="text-azul-medio" />
        <Contador etiqueta={t.panel.diasBloqueados} valor={cuenta.diasBloqueados} />
      </div>

      <TablaMes
        slug={slug}
        periodo={periodo}
        companerismos={companerismos}
        turnos={turnos}
        zonaHoraria={zonaHoraria}
        hoy={hoy}
      />
    </>
  );
}

function Contador({
  etiqueta,
  valor,
  detalle,
  className,
}: {
  etiqueta: string;
  valor: number;
  detalle?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="rounded-[14px] border bg-card px-3 py-3 md:px-4 md:py-3.5">
      <div className="text-xs font-bold text-muted-foreground md:text-[13px]">{etiqueta}</div>
      <div className={cn("text-2xl font-extrabold text-azul-profundo md:text-[28px]", className)}>
        {valor} {detalle && <span className="text-[15px] font-semibold text-muted-foreground">{detalle}</span>}
      </div>
    </div>
  );
}
