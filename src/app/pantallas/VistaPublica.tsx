import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useBarrio, useMes } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { useMisInscripciones } from "@/app/mis-inscripciones";
import { leerPeriodo, mesInicial, textoPeriodo, type Periodo } from "@/app/periodos";
import { cn } from "@/app/lib/utils";
import { Encabezado } from "@/app/components/Encabezado";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";

/** `/:barrio` — turnos del mes con solo nombres, para que las hermanas elijan un día. */
export function VistaPublica() {
  const { barrio: slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, formatearMes, usarIdiomaDelBarrio } = useIdioma();
  const consulta = useBarrio(slug);
  const barrio = consulta.data?.barrio;

  useEffect(() => usarIdiomaDelBarrio(barrio?.idioma), [barrio?.idioma, usarIdiomaDelBarrio]);
  useTitulo(barrio?.nombre);

  if (!consulta.data) {
    return (
      <>
        <Encabezado titulo={barrio?.nombre ?? ""} />
        {consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />}
      </>
    );
  }

  const { mesesAbiertos, hoy } = consulta.data;
  // El mes puede venir en la URL (?mes=2026-11); si no, el que corresponde a hoy.
  const periodo = leerPeriodo(params.get("mes")) ?? mesInicial(mesesAbiertos, hoy);
  const actual = periodo ? textoPeriodo(periodo) : null;
  const anterior = mesesAbiertos.filter((p) => actual && textoPeriodo(p) < actual).at(-1);
  const siguiente = mesesAbiertos.find((p) => actual && textoPeriodo(p) > actual);
  const ir = (p: Periodo) => setParams({ mes: textoPeriodo(p) }, { replace: true });

  return (
    <>
      <Encabezado titulo={consulta.data.barrio.nombre}>
        {periodo && (
          <nav className="mt-2.5 flex items-center justify-between rounded-xl bg-white/10 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.publico.mesAnterior}
              disabled={!anterior}
              onClick={() => anterior && ir(anterior)}
              className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30"
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
              onClick={() => siguiente && ir(siguiente)}
              className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronRightIcon className="size-5" />
            </Button>
          </nav>
        )}
      </Encabezado>
      {actual ? <TurnosDelMes slug={slug} periodo={actual} /> : <Aviso>{t.publico.sinMesAbierto}</Aviso>}
    </>
  );
}

function TurnosDelMes({ slug, periodo }: { slug: string; periodo: string }) {
  const { t, formatearFecha } = useIdioma();
  const consulta = useMes(slug, periodo);
  const mias = useMisInscripciones(slug);
  const [soloLibres, setSoloLibres] = useState(false);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const dias = useMemo(() => {
    if (!consulta.data) return [];
    const { turnos, companerismos, hoy, mes } = consulta.data;
    const nombres = new Map(companerismos.map((c) => [c.id, c.nombre]));
    const misTurnos = new Set(mias.map((m) => m.turnoId));
    const porFecha = new Map<string, typeof filas>();
    const filas = turnos.map((turno) => ({
      ...turno,
      companerismo: nombres.get(turno.companerismoId) ?? "",
      mio: turno.estado === "tomado" && misTurnos.has(turno.id),
      // Solo se ofrece "Anotarme" en meses abiertos y para hoy en adelante.
      anotable: turno.estado === "libre" && mes.estado === "abierto" && turno.fecha >= hoy,
    }));
    for (const fila of filas) porFecha.set(fila.fecha, [...(porFecha.get(fila.fecha) ?? []), fila]);
    return [...porFecha].map(([fecha, turnosDelDia]) => ({ fecha, pasado: fecha < hoy, turnos: turnosDelDia }));
  }, [consulta.data, mias]);

  if (!consulta.data) {
    return consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />;
  }

  const libres = dias.reduce((n, d) => n + d.turnos.filter((x) => x.anotable).length, 0);
  const anteriores = dias.filter((d) => d.pasado).length;
  const visibles = dias
    .filter((d) => verAnteriores || !d.pasado)
    .map((d) => (soloLibres ? { ...d, turnos: d.turnos.filter((x) => x.anotable) } : d))
    .filter((d) => d.turnos.length > 0);
  const cerrado = consulta.data.mes.estado !== "abierto";

  return (
    <main className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3 border-b bg-card px-4 pt-3.5 pb-3">
        <p className="text-sm leading-snug text-muted-foreground">{cerrado ? t.publico.mesCerrado : t.publico.intro}</p>
        {!cerrado && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded-full bg-cielo-claro p-[3px]" role="group">
              {[
                { activo: !soloLibres, texto: t.publico.todos, valor: false },
                { activo: soloLibres, texto: t.publico.soloLibres, valor: true },
              ].map((op) => (
                <button
                  key={op.texto}
                  type="button"
                  aria-pressed={op.activo}
                  onClick={() => setSoloLibres(op.valor)}
                  className={cn(
                    "h-11 rounded-full px-4 text-sm font-bold text-azul-profundo transition-colors",
                    op.activo && "bg-azul-profundo text-white",
                  )}
                >
                  {op.texto}
                </button>
              ))}
            </div>
            <div className="text-sm font-bold text-azul-medio">{t.publico.turnosLibres(libres)}</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-8">
        {anteriores > 0 && !soloLibres && (
          <Button variant="ghost" className="self-center text-azul-medio" onClick={() => setVerAnteriores((v) => !v)}>
            {verAnteriores ? t.publico.ocultarAnteriores : t.publico.verAnteriores(anteriores)}
          </Button>
        )}

        {visibles.length === 0 && <Aviso>{t.publico.sinLibres}</Aviso>}

        {visibles.map((dia) => (
          <section
            key={dia.fecha}
            aria-label={formatearFecha(dia.fecha)}
            className={cn("flex flex-col gap-2 rounded-[14px] border bg-card px-3.5 py-3", dia.pasado && "opacity-60")}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] leading-none font-extrabold text-azul-profundo">
                {Number(dia.fecha.slice(8))}
              </span>
              <span className="inline-block text-sm font-bold text-muted-foreground first-letter:uppercase">
                {formatearFecha(dia.fecha, { weekday: "long" })}
              </span>
            </div>

            {dia.turnos.map((turno) => (
              <div key={turno.id} className="flex min-h-11 items-center justify-between gap-2.5 border-t border-[#EEF2F6] pt-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">
                    {turno.companerismo}
                  </span>
                  {turno.estado === "tomado" && (
                    <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                      <CheckIcon className="size-4 shrink-0 text-exito" strokeWidth={2.4} aria-hidden="true" />
                      <span className="truncate">{turno.nombre}</span>
                      {turno.mio && <Badge className="bg-dorado-claro text-azul-profundo">{t.publico.tuTurno}</Badge>}
                    </span>
                  )}
                  {turno.estado === "libre" && (
                    <span className="text-[15px] text-muted-foreground">{t.publico.disponible}</span>
                  )}
                  {turno.estado === "bloqueado" && (
                    <span className="text-[15px] text-muted-foreground italic">
                      {turno.motivoBloqueo ?? t.errores.TURNO_BLOQUEADO}
                    </span>
                  )}
                </div>
                {turno.anotable && (
                  <Button asChild variant="accion" className="shrink-0 px-[18px]">
                    <Link to={`/${slug}/anotarse/${turno.id}`}>{t.publico.anotarme}</Link>
                  </Button>
                )}
              </div>
            ))}
          </section>
        ))}

        {mias.length > 0 || !cerrado ? (
          <p className="mx-1 mt-2 text-center text-[13px] leading-snug text-muted-foreground">{t.publico.cambiarDia}</p>
        ) : null}
      </div>
    </main>
  );
}
