import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { CheckIcon, ChevronLeftIcon, InfoIcon } from "lucide-react";
import { codigoDe, ErrorApi } from "@/app/api";
import { useAnotarse, useBarrio, useTurno } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { abrirIcs } from "@/app/ics";
import { crearIcs } from "@/shared/ics";
import { useMisInscripciones } from "@/app/mis-inscripciones";
import { Encabezado } from "@/app/components/Encabezado";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Textarea } from "@/app/components/ui/textarea";
import { esquemaNuevaInscripcion, type Modalidad } from "@/shared/inscripciones";

/** `/:barrio/anotarse/:turnoId` — formulario para tomar un turno. */
export function Anotarse() {
  const { barrio: slug = "", turnoId = "" } = useParams();
  const { t, formatearFecha, usarIdiomaDelBarrio } = useIdioma();
  const barrio = useBarrio(slug);
  const consulta = useTurno(slug, turnoId);
  const mias = useMisInscripciones(slug);
  const anotarse = useAnotarse(slug, turnoId);

  useEffect(() => usarIdiomaDelBarrio(barrio.data?.barrio.idioma), [barrio.data?.barrio.idioma, usarIdiomaDelBarrio]);
  const datos = consulta.data;
  useTitulo(datos ? formatearFecha(datos.turno.fecha) : undefined);

  const volver = `/${slug}${datos ? `?mes=${datos.turno.fecha.slice(0, 7)}` : ""}`;
  const linkVolver = (
    <Link
      to={volver}
      className="-ml-1 flex h-11 items-center gap-1 rounded-lg pr-2.5 text-[15px] font-bold text-white hover:bg-white/10"
    >
      <ChevronLeftIcon className="size-5" aria-hidden="true" />
      {t.formulario.volver}
    </Link>
  );

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

  // Recién anotada, o vuelve a abrir el link desde el mismo teléfono.
  const mia = mias.find((m) => m.turnoId === turno.id);
  if (anotarse.isSuccess || (turno.estado === "tomado" && mia)) {
    return (
      <>
        {encabezado}
        <Exito fecha={turno.fecha} companerismo={companerismo.nombre} volver={volver} />
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
      <Formulario
        notaParaCocinar={datos.barrio.notaParaCocinar}
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

type Campo = "nombre" | "telefono" | "consentimientoTelefono";

function Formulario({
  notaParaCocinar,
  enviando,
  errorEnvio,
  onEnviar,
}: {
  notaParaCocinar: string | null;
  enviando: boolean;
  errorEnvio: Error | null;
  onEnviar: (datos: {
    nombre: string;
    telefono: string;
    consentimientoTelefono: boolean;
    modalidad: Modalidad | null;
    nota: string;
  }) => void;
}) {
  const { t } = useIdioma();
  const id = useId();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [modalidad, setModalidad] = useState<Modalidad | null>(null);
  const [nota, setNota] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});

  const mensajes: Record<Campo, string> = {
    nombre: t.formulario.errorNombre,
    telefono: t.formulario.errorTelefono,
    consentimientoTelefono: t.formulario.errorConsentimientoSinTelefono,
  };

  // Si la API rechaza campos que el cliente dio por buenos, se marcan igual.
  useEffect(() => {
    if (errorEnvio instanceof ErrorApi && errorEnvio.codigo === "DATOS_INVALIDOS") {
      const campos = errorEnvio.campos.filter((c): c is Campo => c in mensajes);
      setErrores(Object.fromEntries(campos.map((c) => [c, mensajes[c]])));
    }
  }, [errorEnvio]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const datos = { nombre, telefono, consentimientoTelefono: consentimiento, modalidad, nota };
    const resultado = esquemaNuevaInscripcion.safeParse(datos);
    const nuevos: Partial<Record<Campo, string>> = {};
    for (const issue of resultado.error?.issues ?? []) {
      const campo = issue.path[0] as Campo;
      if (campo in mensajes) nuevos[campo] = mensajes[campo];
    }
    if (consentimiento && !telefono.trim() && !nuevos.telefono) {
      nuevos.consentimientoTelefono = mensajes.consentimientoTelefono;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) {
      document.getElementById(`${id}-${Object.keys(nuevos)[0]}`)?.focus();
      return;
    }
    onEnviar(datos);
  };

  const errorGeneral =
    errorEnvio && !(errorEnvio instanceof ErrorApi && errorEnvio.codigo === "DATOS_INVALIDOS")
      ? t.errores[codigoDe(errorEnvio)]
      : null;

  return (
    <main className="mx-auto max-w-xl">
      <form noValidate onSubmit={enviar} className="flex flex-col gap-4 px-4 pt-[18px] pb-8">
        <Grupo>
          <Label htmlFor={`${id}-nombre`}>{t.formulario.nombre}</Label>
          <Input
            id={`${id}-nombre`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t.formulario.nombrePlaceholder}
            autoComplete="name"
            maxLength={60}
            aria-invalid={!!errores.nombre}
            aria-describedby={`${id}-nombre-ayuda`}
            className={campoClase}
          />
          <Ayuda id={`${id}-nombre-ayuda`} error={errores.nombre}>
            {t.formulario.nombreAyuda}
          </Ayuda>
        </Grupo>

        <Grupo>
          <Label htmlFor={`${id}-telefono`}>{t.formulario.telefono}</Label>
          <Input
            id={`${id}-telefono`}
            type="tel"
            inputMode="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder={t.formulario.telefonoPlaceholder}
            autoComplete="tel"
            maxLength={30}
            aria-invalid={!!errores.telefono}
            aria-describedby={errores.telefono ? `${id}-telefono-error` : undefined}
            className={campoClase}
          />
          {errores.telefono && <Ayuda id={`${id}-telefono-error`} error={errores.telefono} />}
        </Grupo>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-bold">{t.formulario.modalidad}</legend>
          <RadioGroup value={modalidad ?? ""} onValueChange={(v) => setModalidad(v as Modalidad)} className="gap-2">
            {(
              [
                ["en_casa", t.formulario.enCasa],
                ["llevar", t.formulario.llevar],
              ] as const
            ).map(([valor, texto]) => (
              <Label
                key={valor}
                className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 text-[15px] font-normal has-data-[state=checked]:border-azul-medio has-data-[state=checked]:bg-cielo-claro"
              >
                <RadioGroupItem value={valor} className="size-5" />
                {texto}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <Grupo>
          <Label htmlFor={`${id}-nota`}>
            {t.formulario.nota} <span className="font-normal text-muted-foreground">{t.comun.opcional}</span>
          </Label>
          <Textarea
            id={`${id}-nota`}
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={t.formulario.notaPlaceholder}
            maxLength={200}
            className="resize-none rounded-xl border-input bg-card px-3.5 py-3"
          />
        </Grupo>

        {notaParaCocinar && (
          <div className="flex gap-2.5 rounded-xl border border-aviso-borde bg-aviso-suave px-3.5 py-3">
            <InfoIcon className="mt-px size-5 shrink-0 text-aviso" aria-hidden="true" />
            <p className="text-[13px] leading-snug text-aviso-texto">
              <strong>{t.formulario.paraTomarEnCuenta}</strong> {notaParaCocinar}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug font-normal">
            <Checkbox
              id={`${id}-consentimientoTelefono`}
              checked={consentimiento}
              onCheckedChange={(v) => setConsentimiento(v === true)}
              aria-invalid={!!errores.consentimientoTelefono}
              className="mt-0.5 size-[22px]"
            />
            {t.formulario.consentimiento}
          </Label>
          {errores.consentimientoTelefono && <Ayuda error={errores.consentimientoTelefono} />}
        </div>

        {errorGeneral && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold text-destructive">
            {errorGeneral}
          </p>
        )}

        <Button type="submit" variant="accion" disabled={enviando} className="h-[52px] text-[17px] font-extrabold">
          {enviando ? t.formulario.guardando : t.formulario.confirmar}
        </Button>
      </form>
    </main>
  );
}

const campoClase = "h-12 rounded-xl bg-card px-3.5";

const Grupo = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-1.5">{children}</div>;

function Ayuda({ id, error, children }: { id?: string; error?: string; children?: ReactNode }) {
  return (
    <span id={id} className={error ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"}>
      {error ?? children}
    </span>
  );
}

function Exito({ fecha, companerismo, volver }: { fecha: string; companerismo: string; volver: string }) {
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
      <p className="text-sm leading-normal text-muted-foreground">{t.exito.recordar}</p>
      <div className="mt-3 flex w-full flex-col gap-2.5">
        <Button variant="accion-outline" className="h-[50px]" onClick={agregar}>
          {t.exito.agregarCalendario}
        </Button>
        <Button asChild variant="accion" className="h-[50px]">
          <Link to={volver}>{t.formulario.volver}</Link>
        </Button>
      </div>
    </main>
  );
}
