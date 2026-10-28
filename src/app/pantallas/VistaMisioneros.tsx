import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { HandPlatterIcon, HouseIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";
import { codigoDe } from "@/app/api";
import { useMesMisioneros, useMisioneros } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useIdiomaDelBarrio, usePeriodoDeLaUrl, useTitulo } from "@/app/hooks";
import { agruparPorDia, diasVisibles } from "@/app/dias";
import { textoPeriodo } from "@/app/periodos";
import { enlaceWhatsApp } from "@/shared/telefonos";
import { Encabezado } from "@/app/components/Encabezado";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { GrupoPildoras } from "@/app/components/GrupoPildoras";
import { SelectorMes } from "@/app/components/SelectorMes";
import { BotonDiasAnteriores, FilaTurno, TarjetaDia } from "@/app/components/TarjetaDia";
import { Button } from "@/app/components/ui/button";

/**
 * Token regenerado o equivocado. Se revisa antes que los datos: si regeneran el enlace con la
 * página abierta, React Query conserva lo último que trajo y hay que dejar de mostrarlo.
 */
const enlaceInvalido = (consulta: { isError: boolean; error: unknown }) =>
  consulta.isError && codigoDe(consulta.error) === "TOKEN_INVALIDO";

/**
 * `/:barrio/m/:token` — calendario para los misioneros (y la presidenta): quién da el almuerzo,
 * cómo y dónde, con WhatsApp solo si la persona compartió su teléfono.
 * El token no se muestra ni va al título de la pestaña: solo viaja en el header a la API.
 */
export function VistaMisioneros() {
  const { barrio: slug = "", token = "" } = useParams();
  const { t } = useIdioma();
  const consulta = useMisioneros(slug, token);
  const barrio = consulta.data?.barrio;
  const meses = consulta.data?.meses ?? [];
  const [periodo, ir] = usePeriodoDeLaUrl(meses, consulta.data?.hoy ?? "");
  useIdiomaDelBarrio(barrio?.idioma);
  useTitulo(barrio?.nombre);

  if (!barrio || enlaceInvalido(consulta)) {
    return (
      <>
        <Encabezado titulo="" />
        {enlaceInvalido(consulta) ? (
          <Aviso>{t.misioneros.enlaceInvalido}</Aviso>
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} reintentar={consulta.refetch} />
        ) : (
          <Cargando />
        )}
      </>
    );
  }

  return (
    <>
      <Encabezado antetitulo={t.misioneros.antetitulo} titulo={barrio.nombre}>
        {periodo && <SelectorMes periodo={periodo} meses={meses} onCambiar={ir} />}
      </Encabezado>
      {periodo ? (
        <TurnosDelMes slug={slug} token={token} periodo={textoPeriodo(periodo)} zonaHoraria={barrio.zonaHoraria} />
      ) : (
        <Aviso>{t.misioneros.sinMeses}</Aviso>
      )}
    </>
  );
}

function TurnosDelMes({
  slug,
  token,
  periodo,
  zonaHoraria,
}: {
  slug: string;
  token: string;
  periodo: string;
  zonaHoraria: string;
}) {
  const { t } = useIdioma();
  const consulta = useMesMisioneros(slug, token, periodo);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const dias = useMemo(() => {
    if (!consulta.data) return [];
    const { turnos, companerismos, hoy } = consulta.data;
    const nombres = new Map(companerismos.map((c) => [c.id, c.nombre]));
    return agruparPorDia(
      turnos.map((turno) => ({ ...turno, companerismo: nombres.get(turno.companerismoId) ?? "" })),
      hoy,
    );
  }, [consulta.data]);

  if (enlaceInvalido(consulta)) return <Aviso>{t.misioneros.enlaceInvalido}</Aviso>;
  if (!consulta.data) {
    return consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />;
  }

  const { companerismos } = consulta.data;
  // El filtro elegido puede no existir en otro mes (ej. un compañerismo nuevo): entonces se ven todos.
  const activo = companerismos.some((c) => c.id === filtro) ? filtro : null;
  const { visibles, anteriores } = diasVisibles(
    dias,
    (turno) => !activo || turno.companerismoId === activo,
    verAnteriores,
  );

  return (
    <main className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3 border-b bg-card px-4 pt-3.5 pb-3">
        <p className="text-sm leading-snug text-muted-foreground">{t.misioneros.intro}</p>
        {companerismos.length > 1 && (
          <GrupoPildoras
            className="self-start"
            etiqueta={t.misioneros.companerismo}
            opciones={[
              { valor: null, texto: t.publico.todos },
              ...companerismos.map((c) => ({ valor: c.id, texto: c.nombre })),
            ]}
            valor={activo}
            onCambiar={setFiltro}
          />
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-8">
        <BotonDiasAnteriores cantidad={anteriores} abiertos={verAnteriores} onCambiar={setVerAnteriores} />

        {visibles.length === 0 && <Aviso>{t.misioneros.sinTurnos}</Aviso>}

        {visibles.map((dia) => (
          <TarjetaDia key={dia.fecha} fecha={dia.fecha} pasado={dia.pasado} hoy={dia.esHoy}>
            {dia.turnos.map((turno) => (
              <FilaTurno key={turno.id} className="flex-col gap-1">
                <span className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">
                  {turno.companerismo}
                </span>

                {turno.estado === "tomado" && turno.nombre && (
                  <>
                    <span className="text-base font-bold">{turno.nombre}</span>
                    {turno.modalidad && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {turno.modalidad === "en_casa" ? (
                          <HouseIcon className="size-4 shrink-0 text-azul-medio" aria-hidden="true" />
                        ) : (
                          <HandPlatterIcon className="size-4 shrink-0 text-azul-medio" aria-hidden="true" />
                        )}
                        {turno.modalidad === "en_casa" ? t.misioneros.enCasa : t.misioneros.llevar}
                      </span>
                    )}
                    {turno.nota && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon className="size-4 shrink-0 text-azul-medio" aria-hidden="true" />
                        <span className="min-w-0 break-words">{turno.nota}</span>
                      </span>
                    )}
                    <Telefono telefono={turno.telefono} nombre={turno.nombre} zonaHoraria={zonaHoraria} fecha={turno.fecha} />
                  </>
                )}
                {turno.estado === "libre" && (
                  <span className="text-[15px] text-muted-foreground">{t.misioneros.libre}</span>
                )}
                {turno.estado === "bloqueado" && (
                  <span className="text-[15px] text-muted-foreground italic">
                    {t.misioneros.bloqueado(turno.motivoBloqueo)}
                  </span>
                )}
              </FilaTurno>
            ))}
          </TarjetaDia>
        ))}
      </div>
    </main>
  );
}

/** Teléfono y botón a WhatsApp; sin consentimiento la API no lo manda y se dice que no hay. */
function Telefono({
  telefono,
  nombre,
  zonaHoraria,
  fecha,
}: {
  telefono: string | null;
  nombre: string;
  zonaHoraria: string;
  fecha: string;
}) {
  const { t, formatearFecha } = useIdioma();
  if (!telefono) {
    return <span className="text-[13px] text-muted-foreground italic">{t.misioneros.sinTelefono}</span>;
  }
  // Día de la semana y fecha por separado: cada idioma decide si van con coma.
  const mensaje = t.misioneros.mensajeWhatsApp(
    nombre,
    formatearFecha(fecha, { weekday: "long" }),
    formatearFecha(fecha, { day: "numeric", month: "long" }),
  );
  const enlace = enlaceWhatsApp(telefono, zonaHoraria, mensaje);
  return (
    <div className="mt-0.5 flex items-center justify-between gap-2.5">
      <span className="text-sm font-semibold">{telefono}</span>
      {enlace && (
        <Button asChild variant="accion" className="shrink-0 px-4">
          {/* noreferrer: la URL de esta página lleva el token y no debe llegar a WhatsApp. */}
          <a href={enlace} target="_blank" rel="noreferrer noopener" aria-label={t.misioneros.escribirA(nombre)}>
            <MessageCircleIcon className="size-[18px]" aria-hidden="true" />
            {t.misioneros.whatsapp}
          </a>
        </Button>
      )}
    </div>
  );
}
