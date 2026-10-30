import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { codigoDe, ErrorApi } from "@/app/api";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { AlertaError, AvisoAmbar } from "@/app/components/Estado";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Textarea } from "@/app/components/ui/textarea";
import { esquemaNuevaInscripcion, type Modalidad } from "@/shared/inscripciones";

type Campo = "nombre" | "telefono" | "consentimientoTelefono";

export type ValoresInscripcion = {
  nombre: string;
  telefono: string;
  consentimientoTelefono: boolean;
  modalidad: Modalidad | null;
  nota: string;
};

/**
 * Campos de una inscripción (maqueta 2). Lo usan "Anotarse" (vacío), "Mi turno" (editar) y el
 * panel (asignar y editar, dentro de un diálogo). Cada pantalla pone su contenedor.
 * Valida con el mismo esquema que la API y marca también los campos que la API rechace.
 */
export function FormularioInscripcion({
  inicial,
  notaParaCocinar,
  textoEnviar,
  enviando,
  errorEnvio,
  onEnviar,
  extra,
  consentimientoSoloQuitar = false,
  className,
}: {
  inicial?: Partial<ValoresInscripcion>;
  notaParaCocinar: string | null;
  textoEnviar: string;
  enviando: boolean;
  errorEnvio: Error | null;
  onEnviar: (datos: ValoresInscripcion) => void;
  /** Acciones bajo el botón principal (ej. "Volver sin guardar"). */
  extra?: ReactNode;
  /** Panel: el consentimiento se puede quitar pero no dar (eso le toca a la persona). */
  consentimientoSoloQuitar?: boolean;
  className?: string;
}) {
  const { t } = useIdioma();
  const id = useId();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [modalidad, setModalidad] = useState<Modalidad | null>(inicial?.modalidad ?? null);
  const [nota, setNota] = useState(inicial?.nota ?? "");
  const [consentimiento, setConsentimiento] = useState(inicial?.consentimientoTelefono ?? false);
  const consentimientoBloqueado = consentimientoSoloQuitar && !inicial?.consentimientoTelefono;
  /** Campos con error. Se guardan las claves, no el texto, para que un cambio de idioma lo traduzca. */
  const [conError, setConError] = useState<Campo[]>([]);

  const mensajes: Record<Campo, string> = {
    nombre: t.formulario.errorNombre,
    telefono: t.formulario.errorTelefono,
    consentimientoTelefono: t.formulario.errorConsentimientoSinTelefono,
  };
  const errores: Partial<Record<Campo, string>> = Object.fromEntries(conError.map((c) => [c, mensajes[c]]));

  // Si la API rechaza campos que el cliente dio por buenos, se marcan igual.
  useEffect(() => {
    if (errorEnvio instanceof ErrorApi && errorEnvio.codigo === "DATOS_INVALIDOS") {
      const campos = errorEnvio.campos.filter((c): c is Campo => c in mensajes);
      setConError(campos);
    }
  }, [errorEnvio]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const datos = { nombre, telefono, consentimientoTelefono: consentimiento, modalidad, nota };
    const resultado = esquemaNuevaInscripcion.safeParse(datos);
    const nuevos = new Set<Campo>();
    for (const issue of resultado.error?.issues ?? []) {
      const campo = issue.path[0] as Campo;
      if (campo in mensajes) nuevos.add(campo);
    }
    if (consentimiento && !telefono.trim() && !nuevos.has("telefono")) nuevos.add("consentimientoTelefono");
    const lista = [...nuevos];
    setConError(lista);
    if (lista.length > 0) {
      document.getElementById(`${id}-${lista[0]}`)?.focus();
      return;
    }
    onEnviar(datos);
  };

  const errorGeneral =
    errorEnvio && !(errorEnvio instanceof ErrorApi && errorEnvio.codigo === "DATOS_INVALIDOS")
      ? t.errores[codigoDe(errorEnvio)]
      : null;

  return (
    <form noValidate onSubmit={enviar} className={cn("flex flex-col gap-4 px-4 pt-[18px] pb-8", className)}>
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
                className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 text-[15px] font-normal has-data-checked:border-azul-medio has-data-checked:bg-cielo-claro"
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
          <AvisoAmbar>
            <strong>{t.formulario.paraTomarEnCuenta}</strong> {notaParaCocinar}
          </AvisoAmbar>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug font-normal">
            <Checkbox
              id={`${id}-consentimientoTelefono`}
              checked={consentimiento}
              onCheckedChange={(v) => setConsentimiento(v === true)}
              disabled={consentimientoBloqueado}
              aria-invalid={!!errores.consentimientoTelefono}
              className="mt-0.5 size-[22px]"
            />
            {t.formulario.consentimiento}
          </Label>
          <Link
            to="/informacion#tus-datos"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-azul-medio underline underline-offset-2"
          >
            {t.informacion.datosEnlace}
          </Link>
          {errores.consentimientoTelefono && <Ayuda error={errores.consentimientoTelefono} />}
          {consentimientoBloqueado && <Ayuda>{t.panel.consentimientoSoloPersona}</Ayuda>}
        </div>

        {errorGeneral && <AlertaError>{errorGeneral}</AlertaError>}

        <Button type="submit" variant="accion" disabled={enviando} className="h-[52px] text-[17px] font-extrabold">
          {enviando ? t.formulario.guardando : textoEnviar}
        </Button>
        {extra}
    </form>
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
