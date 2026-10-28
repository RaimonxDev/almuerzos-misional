import { Link, useParams } from "react-router";
import { CheckIcon } from "lucide-react";
import { ErrorApi } from "@/app/api";
import { useAnotarse, useTurno } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useBarrioConIdioma, useTitulo } from "@/app/hooks";
import { rutaCalendario, rutaMiTurno } from "@/app/rutas";
import { abrirIcs } from "@/app/ics";
import { crearIcs } from "@/shared/ics";
import { useMisInscripciones } from "@/app/mis-inscripciones";
import { Encabezado, LinkVolver } from "@/app/components/Encabezado";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { FormularioInscripcion } from "@/app/components/FormularioInscripcion";
import { Button } from "@/app/components/ui/button";

/** `/:barrio/anotarse/:turnoId` — formulario para tomar un turno. */
export function Anotarse() {
  const { barrio: slug = "", turnoId = "" } = useParams();
  const { t, formatearFecha } = useIdioma();
  useBarrioConIdioma(slug);
  const consulta = useTurno(slug, turnoId);
  const mias = useMisInscripciones(slug);
  const anotarse = useAnotarse(slug, turnoId);

  const datos = consulta.data;
  useTitulo(datos ? formatearFecha(datos.turno.fecha) : undefined);

  const volver = rutaCalendario(slug, datos?.turno.fecha);
  const linkVolver = <LinkVolver to={volver} />;

  if (!datos) {
    return (
      <>
        <Encabezado arriba={linkVolver} titulo="" />
        {consulta.isError ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />}
      </>
    );
  }

  const { turno, companerismo, mes, hoy } = datos;
  const fechaLarga = formatearFecha(turno.fecha);
  const encabezado = (
    <Encabezado arriba={linkVolver} antetitulo={`${datos.barrio.nombre} · ${companerismo.nombre}`} titulo={fechaLarga} />
  );

  // Recién anotada, o vuelve a abrir el link desde el mismo teléfono (y la inscripción sigue siendo la suya).
  const idPropio = anotarse.data?.inscripcion.id ?? turno.inscripcionId;
  const mia = mias.find((m) => m.id === idPropio);
  if (anotarse.isSuccess || mia) {
    return (
      <>
        {encabezado}
        <Exito
          fecha={turno.fecha}
          companerismo={companerismo.nombre}
          volver={volver}
          // Solo si el token quedó guardado (en modo privado puede fallar y el link no serviría).
          miTurno={mia && rutaMiTurno(slug, mia.id)}
        />
      </>
    );
  }

  if (anotarse.error instanceof ErrorApi && anotarse.error.codigo === "TURNO_TOMADO") {
    return (
      <>
        {encabezado}
        <NoDisponible mensaje={t.errores.TURNO_TOMADO} volver={volver} />
      </>
    );
  }

  const motivo =
    turno.estado === "tomado"
      ? t.formulario.tomadoPor(turno.nombre ?? "")
      : turno.estado === "bloqueado"
        ? t.formulario.bloqueadoPor(turno.motivoBloqueo)
        : mes.estado !== "abierto"
          ? t.publico.mesCerrado
          : turno.fecha < hoy
            ? t.errores.TURNO_PASADO
            : null;
  if (motivo) {
    return (
      <>
        {encabezado}
        <NoDisponible mensaje={motivo} volver={volver} />
      </>
    );
  }

  return (
    <>
      {encabezado}
      <FormularioInscripcion
        notaParaCocinar={datos.barrio.notaParaCocinar}
        textoEnviar={t.formulario.confirmar}
        enviando={anotarse.isPending}
        errorEnvio={anotarse.error}
        onEnviar={(json) => anotarse.mutate(json)}
      />
    </>
  );
}

function NoDisponible({ mensaje, volver }: { mensaje: string; volver: string }) {
  const { t } = useIdioma();
  return (
    <main className="mx-auto max-w-xl">
      <Aviso
        accion={
          <Button asChild variant="accion" size="lg">
            <Link to={volver}>{t.formulario.elegirOtro}</Link>
          </Button>
        }
      >
        {mensaje}
      </Aviso>
    </main>
  );
}

function Exito({
  fecha,
  companerismo,
  volver,
  miTurno,
}: {
  fecha: string;
  companerismo: string;
  volver: string;
  miTurno: string | undefined;
}) {
  const { t, formatearFecha } = useIdioma();
  const agregar = () =>
    abrirIcs(
      crearIcs({ fecha, titulo: t.exito.eventoTitulo(companerismo) }),
      `almuerzo-misional-${fecha}.ics`,
    );

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-3.5 px-6 pt-10 pb-8 text-center">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-exito-suave">
        <CheckIcon className="size-9 text-exito" strokeWidth={2.4} aria-hidden="true" />
      </div>
      <h2 className="text-[26px] font-semibold text-azul-profundo">{t.exito.titulo}</h2>
      <p className="text-base leading-normal text-[#3D4C5C]" role="status">
        {t.exito.texto(formatearFecha(fecha), companerismo)}
      </p>
      {miTurno && <p className="text-sm leading-normal text-muted-foreground">{t.exito.recordar}</p>}
      <div className="mt-3 flex w-full flex-col gap-2.5">
        <Button variant="accion-outline" className="h-[50px]" onClick={agregar}>
          {t.exito.agregarCalendario}
        </Button>
        <Button asChild variant="accion" className="h-[50px]">
          <Link to={volver}>{t.formulario.volver}</Link>
        </Button>
        {miTurno && (
          <Button asChild variant="ghost" className="text-azul-medio">
            <Link to={miTurno}>{t.publico.verMiTurno}</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
