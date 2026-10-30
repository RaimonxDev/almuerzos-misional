import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CalendarDaysIcon, CheckIcon, ChevronRightIcon, ListIcon } from "lucide-react";
import { useMes } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useBarrioConIdioma, usePeriodoDeLaUrl, useTitulo } from "@/app/hooks";
import { useMisInscripciones, type MiInscripcion } from "@/app/mis-inscripciones";
import { guardarLocal, leerLocal } from "@/app/almacen";
import { textoPeriodo } from "@/app/periodos";
import { agruparPorDia, diasVisibles, type Dia } from "@/app/dias";
import { rutaAnotarse, rutaMiTurno } from "@/app/rutas";
import { Encabezado } from "@/app/components/Encabezado";
import { PiePagina } from "@/app/components/PiePagina";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { SelectorMes } from "@/app/components/SelectorMes";
import { BotonDiasAnteriores, FilaTurno, TarjetaDia } from "@/app/components/TarjetaDia";
import { GrupoPildoras } from "@/app/components/GrupoPildoras";
import { CalendarioMes, type DiaCalendario } from "@/app/components/CalendarioMes";
import { cn } from "@/app/lib/utils";
import { buttonVariants } from "@/app/components/ui/button";

/** `/:barrio` — turnos del mes con solo nombres, para que las hermanas elijan un día. */
export function VistaPublica() {
  const { barrio: slug = "" } = useParams();
  const { t } = useIdioma();
  const consulta = useBarrioConIdioma(slug);
  const barrio = consulta.data?.barrio;
  const mesesAbiertos = consulta.data?.mesesAbiertos ?? [];
  const [periodo, ir] = usePeriodoDeLaUrl(mesesAbiertos, consulta.data?.hoy ?? "");
  useTitulo(barrio?.nombre);

  if (!barrio) {
    return (
      <>
        <Encabezado titulo="" />
        {consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />}
      </>
    );
  }

  return (
    <>
      <Encabezado titulo={barrio.nombre}>
        {periodo && <SelectorMes periodo={periodo} meses={mesesAbiertos} onCambiar={ir} />}
      </Encabezado>
      {periodo ? (
        <TurnosDelMes slug={slug} periodo={textoPeriodo(periodo)} />
      ) : (
        <Aviso>{t.publico.sinMesAbierto}</Aviso>
      )}
    </>
  );
}

type Vista = "lista" | "calendario";

const CLAVE_VISTA = "almuerzo-misional:vista-publica";

/** Lista o calendario, recordado en este navegador. Es una comodidad: si falla, se ve la lista. */
function useVista() {
  const [vista, setVista] = useState<Vista>(() => (leerLocal(CLAVE_VISTA) === "calendario" ? "calendario" : "lista"));
  const cambiar = (nueva: Vista) => {
    setVista(nueva);
    guardarLocal(CLAVE_VISTA, nueva);
  };
  return [vista, cambiar] as const;
}

type MesPublico = NonNullable<ReturnType<typeof useMes>["data"]>;

/** Los turnos del mes con su compañerismo, si son míos y si se pueden tomar. */
function filasPublicas({ turnos, companerismos, hoy, mes }: MesPublico, mias: MiInscripcion[]) {
  const nombres = new Map(companerismos.map((c) => [c.id, c.nombre]));
  const misIds = new Set(mias.map((m) => m.id));
  return turnos.map((turno) => ({
    ...turno,
    companerismo: nombres.get(turno.companerismoId) ?? "",
    /**
     * Lo tomé yo desde este teléfono: se compara la inscripción actual del turno con las guardadas.
     * (Por turnoId no basta: si la presidenta borró la mía y otra se anotó, el turno sería de ella.)
     */
    mia: turno.inscripcionId && misIds.has(turno.inscripcionId) ? turno.inscripcionId : undefined,
    // Solo se ofrece "Anotarme" en meses abiertos y para hoy en adelante.
    anotable: turno.estado === "libre" && mes.estado === "abierto" && turno.fecha >= hoy,
  }));
}

type TurnoPublico = ReturnType<typeof filasPublicas>[number];

function TurnosDelMes({ slug, periodo }: { slug: string; periodo: string }) {
  const { t, formatearFecha } = useIdioma();
  const consulta = useMes(slug, periodo);
  const mias = useMisInscripciones(slug);
  const [vista, setVista] = useVista();
  const [soloLibres, setSoloLibres] = useState(false);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const dias = useMemo(
    () => (consulta.data ? agruparPorDia(filasPublicas(consulta.data, mias), consulta.data.hoy) : []),
    [consulta.data, mias],
  );

  if (!consulta.data) {
    return consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />;
  }

  const libres = dias.reduce((n, d) => n + d.turnos.filter((x) => x.anotable).length, 0);
  const { visibles, anteriores } = diasVisibles(dias, (x) => !soloLibres || x.anotable, verAnteriores);
  const cerrado = consulta.data.mes.estado !== "abierto";
  const { hoy, companerismos } = consulta.data;
  const proximas = mias.filter((m) => m.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <main className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3 border-b bg-card px-4 pt-3.5 pb-3">
        <p className="text-sm leading-snug text-muted-foreground">{cerrado ? t.publico.mesCerrado : t.publico.intro}</p>
        <GrupoPildoras
          variante="segmento"
          etiqueta={t.vistaCalendario.verComo}
          opciones={[
            { valor: "lista", texto: t.vistaCalendario.lista, icono: ListIcon },
            { valor: "calendario", texto: t.vistaCalendario.calendario, icono: CalendarDaysIcon },
          ]}
          valor={vista}
          onCambiar={setVista}
        />
        {!cerrado && (
          <div className="flex items-center justify-between gap-2">
            <GrupoPildoras
              opciones={[
                { valor: false, texto: t.publico.todos },
                { valor: true, texto: t.publico.soloLibres },
              ]}
              valor={soloLibres}
              onCambiar={setSoloLibres}
            />
            <div className="text-sm font-bold text-azul-medio">{t.publico.turnosLibres(libres)}</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-8">
        {proximas.length > 0 && (
          <nav
            aria-labelledby="tus-proximos"
            className="flex flex-col rounded-[14px] border border-aviso-borde bg-aviso-suave px-3.5 pt-3 pb-1"
          >
            <h2 id="tus-proximos" className="font-sans text-xs font-extrabold tracking-[0.06em] text-aviso-texto uppercase">
              {t.publico.tusProximos}
            </h2>
            {proximas.map((m) => (
              <Link
                key={m.id}
                to={rutaMiTurno(slug, m.id)}
                className="flex min-h-11 items-center justify-between gap-2 border-t border-aviso-borde/60 text-[15px] font-semibold text-azul-profundo first-of-type:border-t-0"
              >
                <span className="first-letter:uppercase">
                  {formatearFecha(m.fecha)}
                  {m.companerismo && <span className="font-normal text-muted-foreground"> · {m.companerismo}</span>}
                </span>
                <ChevronRightIcon className="size-5 shrink-0 text-aviso" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        )}

        {vista === "calendario" ? (
          <CalendarioPublico
            slug={slug}
            periodo={periodo}
            hoy={hoy}
            dias={dias}
            companerismos={companerismos}
            soloLibres={soloLibres}
          />
        ) : (
          <>
            <BotonDiasAnteriores cantidad={anteriores} abiertos={verAnteriores} onCambiar={setVerAnteriores} />

            {visibles.length === 0 && <Aviso>{t.publico.sinLibres}</Aviso>}

            {visibles.map((dia) => (
              <TarjetaDia key={dia.fecha} fecha={dia.fecha} pasado={dia.pasado}>
                {dia.turnos.map((turno) => (
                  <FilaPublica key={turno.id} slug={slug} turno={turno} />
                ))}
              </TarjetaDia>
            ))}
          </>
        )}

        {mias.length > 0 || !cerrado ? (
          <p className="mx-1 mt-2 text-center text-[13px] leading-snug text-muted-foreground">{t.publico.cambiarDia}</p>
        ) : null}
      </div>
      <PiePagina />
    </main>
  );
}

/** Grilla del mes y, debajo, la tarjeta del día elegido con las mismas filas de la lista. */
function CalendarioPublico({
  slug,
  periodo,
  hoy,
  dias,
  companerismos,
  soloLibres,
}: {
  slug: string;
  periodo: string;
  hoy: string;
  dias: Dia<TurnoPublico>[];
  companerismos: { id: string; nombre: string }[];
  soloLibres: boolean;
}) {
  const [elegida, setElegida] = useState<string | null>(null);
  const tarjeta = useRef<HTMLDivElement>(null);

  // En el teléfono la tarjeta queda bajo la grilla: al tocar un día se trae a la vista.
  useEffect(() => {
    if (!elegida) return;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    tarjeta.current?.scrollIntoView?.({ block: "nearest", behavior: reducido ? "auto" : "smooth" });
  }, [elegida]);

  // Al abrir: hoy, o el primer día con turno libre si el mes no es el actual.
  const seleccionada =
    elegida?.startsWith(periodo) ? elegida
    : hoy.startsWith(periodo) ? hoy
    : (dias.find((d) => d.turnos.some((x) => x.anotable)) ?? dias[0])?.fecha ?? `${periodo}-01`;
  const diaSeleccionado = dias.find((d) => d.fecha === seleccionada);
  const diasCalendario: DiaCalendario[] = dias.map((d) => ({
    fecha: d.fecha,
    libres: d.turnos.filter((x) => x.anotable).length,
    chips: d.turnos.map((x) => ({
      companerismoId: x.companerismoId,
      estado: x.mia ? "tuyo" : x.estado,
    })),
  }));

  return (
    <>
      <CalendarioMes
        periodo={periodo}
        hoy={hoy}
        dias={diasCalendario}
        companerismos={companerismos}
        soloLibres={soloLibres}
        seleccionada={seleccionada}
        onElegir={setElegida}
      />
      <div ref={tarjeta} className="scroll-mb-4">
        <TarjetaDia fecha={seleccionada} pasado={seleccionada < hoy} hoy={seleccionada === hoy}>
          {diaSeleccionado?.turnos.map((turno) => <FilaPublica key={turno.id} slug={slug} turno={turno} />)}
        </TarjetaDia>
      </div>
    </>
  );
}

/** Un turno con el nombre si está tomado, "Ver mi turno" si es propio y "Anotarme" si se puede tomar. */
function FilaPublica({ slug, turno }: { slug: string; turno: TurnoPublico }) {
  const { t } = useIdioma();
  return (
    <FilaTurno className="items-center justify-between gap-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">
          {turno.companerismo}
        </span>
        {turno.estado === "tomado" && (
          <span className="flex items-center gap-1.5 text-[15px] font-semibold">
            <CheckIcon className="size-4 shrink-0 text-exito" strokeWidth={2.4} aria-hidden="true" />
            <span className="truncate">{turno.nombre}</span>
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
      {turno.mia && (
        <Link to={rutaMiTurno(slug, turno.mia)} className={cn(buttonVariants({ variant: "accion-outline" }), "shrink-0 px-4")}>
          {t.publico.verMiTurno}
        </Link>
      )}
      {turno.anotable && (
        <Link to={rutaAnotarse(slug, turno.id)} className={cn(buttonVariants({ variant: "accion" }), "shrink-0 px-[18px]")}>
          {t.publico.anotarme}
        </Link>
      )}
    </FilaTurno>
  );
}
