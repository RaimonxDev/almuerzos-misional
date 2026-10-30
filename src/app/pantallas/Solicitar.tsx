import { useCallback, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { CheckIcon } from "lucide-react";
import { codigoDe, ErrorApi } from "@/app/api";
import { useSolicitarAcceso } from "@/app/consultas";
import { useTitulo } from "@/app/hooks";
import { IDIOMAS, NOMBRES_IDIOMA, useIdioma } from "@/app/i18n";
import { Encabezado } from "@/app/components/Encabezado";
import { PiePagina } from "@/app/components/PiePagina";
import { AlertaError } from "@/app/components/Estado";
import { GrupoPildoras } from "@/app/components/GrupoPildoras";
import { Turnstile } from "@/app/components/Turnstile";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { zonaDelNavegador } from "@/shared/fechas";
import type { Idioma } from "@/shared/idiomas";
import {
  esquemaNuevaSolicitud,
  MENSAJE_SOLICITUD_MAX,
  TIPOS_COMPANERISMO,
  type TipoCompanerismo,
} from "@/shared/solicitudes";

type Campo =
  | "nombre"
  | "email"
  | "telefono"
  | "barrio"
  | "ciudad"
  | "pais"
  | "zonaHoraria"
  | "companerismos"
  | "turnstileToken";

/** Zonas más comunes donde hay barrios; se suma la del navegador si no está. */
const ZONAS_COMUNES = [
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Asuncion",
  "America/La_Paz",
  "America/Lima",
  "America/Bogota",
  "America/Guayaquil",
  "America/Caracas",
  "America/Panama",
  "America/Costa_Rica",
  "America/Guatemala",
  "America/El_Salvador",
  "America/Tegucigalpa",
  "America/Managua",
  "America/Mexico_City",
  "America/Santo_Domingo",
  "America/Puerto_Rico",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/Lisbon",
];

/** `/solicitar` — pantalla pública para pedir usar la app en un barrio. */
export function Solicitar() {
  const { t, idioma } = useIdioma();
  const s = t.solicitar;
  useTitulo(s.titulo);
  const id = useId();
  const enviar = useSolicitarAcceso();

  const detectada = useMemo(zonaDelNavegador, []);
  const zonas = useMemo(() => {
    const lista = ZONAS_COMUNES.includes(detectada) ? ZONAS_COMUNES : [detectada, ...ZONAS_COMUNES];
    return Object.fromEntries(lista.map((z) => [z, z.replace(/_/g, " ")]));
  }, [detectada]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [barrio, setBarrio] = useState("");
  const [estaca, setEstaca] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [pais, setPais] = useState("");
  // Sigue al idioma de la pantalla hasta que la persona elige uno.
  const [idiomaElegido, setIdiomaBarrio] = useState<Idioma | null>(null);
  const idiomaBarrio = idiomaElegido ?? idioma;
  const [zonaHoraria, setZonaHoraria] = useState(detectada);
  const [companerismos, setCompanerismos] = useState<TipoCompanerismo[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [token, setToken] = useState("");
  const [reinicio, setReinicio] = useState(0);
  const [conError, setConError] = useState<Campo[]>([]);
  const [enviado, setEnviado] = useState<string | null>(null);

  const alToken = useCallback((v: string) => setToken(v), []);

  const mensajes: Record<Campo, string> = {
    nombre: s.errorNombre,
    email: s.errorEmail,
    telefono: s.errorTelefono,
    barrio: s.errorBarrio,
    ciudad: s.errorCiudad,
    pais: s.errorPais,
    zonaHoraria: s.errorZona,
    companerismos: s.errorMisioneros,
    turnstileToken: s.errorVerificacion,
  };
  const error = (c: Campo) => (conError.includes(c) ? mensajes[c] : undefined);

  const alternar = (tipo: TipoCompanerismo, marcado: boolean) =>
    setCompanerismos(TIPOS_COMPANERISMO.filter((x) => (x === tipo ? marcado : companerismos.includes(x))));

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    const datos = {
      nombre,
      email,
      telefono,
      barrio,
      estaca,
      ciudad,
      pais,
      idioma: idiomaBarrio,
      zonaHoraria,
      companerismos,
      mensaje,
      turnstileToken: token,
    };
    const resultado = esquemaNuevaSolicitud.safeParse(datos);
    const campos = new Set<Campo>();
    for (const issue of resultado.error?.issues ?? []) {
      const campo = issue.path[0] as Campo;
      if (campo in mensajes) campos.add(campo);
    }
    const lista = [...campos];
    setConError(lista);
    if (lista.length > 0) {
      document.getElementById(`${id}-${lista[0]}`)?.focus();
      return;
    }
    enviar.mutate(datos, {
      onSuccess: () => setEnviado(resultado.data!.email),
      onSettled: () => {
        // El token sirve una sola vez.
        setToken("");
        setReinicio((n) => n + 1);
      },
      onError: (err) => {
        if (err instanceof ErrorApi && err.codigo === "DATOS_INVALIDOS") {
          setConError(err.campos.filter((c): c is Campo => c in mensajes));
        }
      },
    });
  };

  if (enviado) {
    return (
      <>
        <Encabezado antetitulo={s.antetitulo} titulo={s.titulo} />
        <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-exito-suave text-exito">
            <CheckIcon aria-hidden="true" className="size-7" />
          </span>
          <h2 className="text-2xl font-semibold">{s.exitoTitulo}</h2>
          <p className="text-muted-foreground">{s.exitoTexto(enviado)}</p>
          <Link to="/" className={buttonVariants({ variant: "accion-outline" })}>
            {s.volver}
          </Link>
        </main>
      </>
    );
  }

  const errorGeneral =
    enviar.error && !(enviar.error instanceof ErrorApi && enviar.error.codigo === "DATOS_INVALIDOS")
      ? t.errores[codigoDe(enviar.error)]
      : null;

  const texto = (
    campo: Campo,
    etiqueta: string,
    valor: string,
    cambiar: (v: string) => void,
    extra: { type?: string; autoComplete?: string; maxLength?: number; ayuda?: string } = {},
  ) => (
    <Grupo>
      <Label htmlFor={`${id}-${campo}`}>{etiqueta}</Label>
      <Input
        id={`${id}-${campo}`}
        type={extra.type}
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        autoComplete={extra.autoComplete}
        maxLength={extra.maxLength}
        aria-invalid={!!error(campo)}
        aria-describedby={`${id}-${campo}-ayuda`}
        className="h-12 rounded-xl bg-card px-3.5"
      />
      <Ayuda id={`${id}-${campo}-ayuda`} error={error(campo)}>
        {extra.ayuda}
      </Ayuda>
    </Grupo>
  );

  return (
    <>
      <Encabezado antetitulo={s.antetitulo} titulo={s.titulo} />
      <main className="mx-auto max-w-xl">
        <form noValidate onSubmit={alEnviar} className="flex flex-col gap-4 px-4 pt-[18px] pb-8">
          <p className="text-sm text-muted-foreground">{s.intro}</p>

          {texto("nombre", s.nombre, nombre, setNombre, { autoComplete: "name", maxLength: 80 })}
          {texto("email", s.email, email, setEmail, { type: "email", autoComplete: "email", ayuda: s.emailAyuda })}
          {texto("telefono", s.telefono, telefono, setTelefono, { type: "tel", autoComplete: "tel", maxLength: 30 })}
          {texto("barrio", s.barrio, barrio, setBarrio, { maxLength: 80 })}
          <Grupo>
            <Label htmlFor={`${id}-estaca`}>
              {s.estaca} <span className="font-normal text-muted-foreground">{t.comun.opcional}</span>
            </Label>
            <Input
              id={`${id}-estaca`}
              value={estaca}
              onChange={(e) => setEstaca(e.target.value)}
              maxLength={80}
              className="h-12 rounded-xl bg-card px-3.5"
            />
          </Grupo>
          {texto("ciudad", s.ciudad, ciudad, setCiudad, { autoComplete: "address-level2", maxLength: 80 })}
          {texto("pais", s.pais, pais, setPais, { autoComplete: "country-name", maxLength: 80 })}

          <Grupo>
            <span className="text-sm font-bold">{s.idioma}</span>
            <GrupoPildoras
              etiqueta={s.idioma}
              valor={idiomaBarrio}
              onCambiar={setIdiomaBarrio}
              opciones={IDIOMAS.map((i) => ({ valor: i, texto: NOMBRES_IDIOMA[i] }))}
            />
          </Grupo>

          <Grupo>
            <Label htmlFor={`${id}-zonaHoraria`}>{s.zonaHoraria}</Label>
            <Select items={zonas} value={zonaHoraria} onValueChange={(v) => v && setZonaHoraria(v)}>
              <SelectTrigger id={`${id}-zonaHoraria`} className="w-full rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(zonas).map(([valor, etiqueta]) => (
                  <SelectItem key={valor} value={valor} className="min-h-11">
                    {etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Ayuda error={error("zonaHoraria")} />
          </Grupo>

          <fieldset className="flex flex-col gap-2" id={`${id}-companerismos`} tabIndex={-1}>
            <legend className="mb-1.5 text-sm font-bold">{s.misioneros}</legend>
            {(
              [
                ["elderes", s.elderes],
                ["hermanas", s.hermanas],
              ] as const
            ).map(([tipo, etiqueta]) => (
              <Label
                key={tipo}
                className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 text-[15px] font-normal has-data-checked:border-azul-medio has-data-checked:bg-cielo-claro"
              >
                <Checkbox
                  checked={companerismos.includes(tipo)}
                  onCheckedChange={(v) => alternar(tipo, v === true)}
                  className="size-[22px]"
                />
                {etiqueta}
              </Label>
            ))}
            <Ayuda error={error("companerismos")} />
          </fieldset>

          <Grupo>
            <Label htmlFor={`${id}-mensaje`}>
              {s.mensaje} <span className="font-normal text-muted-foreground">{t.comun.opcional}</span>
            </Label>
            <Textarea
              id={`${id}-mensaje`}
              rows={3}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={s.mensajePlaceholder}
              maxLength={MENSAJE_SOLICITUD_MAX}
              className="resize-none rounded-xl border-input bg-card px-3.5 py-3"
            />
          </Grupo>

          <div className="rounded-xl bg-cielo-claro p-3.5 text-sm">
            <strong>{s.despuesTitulo}</strong> {s.despues}
          </div>

          <Grupo>
            <Turnstile onToken={alToken} reinicio={reinicio} />
            <Ayuda error={error("turnstileToken")} />
          </Grupo>

          {errorGeneral && <AlertaError>{errorGeneral}</AlertaError>}

          <Button
            type="submit"
            variant="accion"
            disabled={enviar.isPending}
            className="h-[52px] text-[17px] font-extrabold"
          >
            {enviar.isPending ? s.enviando : s.enviar}
          </Button>
        </form>
      </main>
      <PiePagina />
    </>
  );
}

const Grupo = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-1.5">{children}</div>;

function Ayuda({ id, error, children }: { id?: string; error?: string; children?: ReactNode }) {
  if (!error && !children) return null;
  return (
    <span id={id} className={error ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"}>
      {error ?? children}
    </span>
  );
}
