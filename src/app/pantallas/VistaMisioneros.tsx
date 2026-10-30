import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useParams } from "react-router";
import { HandPlatterIcon, HouseIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";
import { useTokenMisioneros } from "@/app/acceso-misioneros";
import { codigoDe } from "@/app/api";
import { useEntrarMisioneros, useMesMisioneros, useMisioneros } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useBarrioConIdioma, useIdiomaDelBarrio, usePeriodoDeLaUrl, useTitulo } from "@/app/hooks";
import { agruparPorDia, diasVisibles } from "@/app/dias";
import { textoPeriodo } from "@/app/periodos";
import { enlaceWhatsApp } from "@/shared/telefonos";
import { LARGO_CODIGO, normalizarCodigo } from "@/shared/codigo-misioneros";
import { Encabezado } from "@/app/components/Encabezado";
import { PiePagina } from "@/app/components/PiePagina";
import { AlertaError, Aviso, AvisoAmbar, Cargando, ErrorCarga } from "@/app/components/Estado";
import { GrupoPildoras } from "@/app/components/GrupoPildoras";
import { SelectorMes } from "@/app/components/SelectorMes";
import { BotonDiasAnteriores, FilaTurno, TarjetaDia } from "@/app/components/TarjetaDia";
import { cn } from "@/app/lib/utils";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/app/components/ui/input-otp";
import { Label } from "@/app/components/ui/label";

/**
 * Código cambiado (o token de otro barrio). Se revisa antes que los datos: si cambian el código con
 * la página abierta, React Query conserva lo último que trajo y hay que dejar de mostrarlo.
 */
const tokenRechazado = (consulta: { isError: boolean; error: unknown }) =>
  consulta.isError && codigoDe(consulta.error) === "TOKEN_INVALIDO";

/** Avisa una sola vez que la API rechazó el token. */
function useAlRechazar(consulta: { isError: boolean; error: unknown }, alRechazar: () => void) {
  const rechazado = tokenRechazado(consulta);
  useEffect(() => {
    if (rechazado) alRechazar();
    // Solo importa el paso a rechazado: `alRechazar` cambia en cada render.
  }, [rechazado]);
  return rechazado;
}

/**
 * `/:barrio/m` — calendario para los misioneros (y la presidenta): quién da el almuerzo,
 * cómo y dónde, con WhatsApp solo si la persona compartió su teléfono.
 * Se entra una vez con el código del barrio; el token queda en este teléfono y solo viaja en el
 * header a la API (nunca en la URL ni en el título de la pestaña).
 */
export function VistaMisioneros() {
  const { barrio: slug = "" } = useParams();
  return <Misioneros key={slug} slug={slug} />;
}

/** `/:barrio/m/:token`: los enlaces de antes del código. El token se descarta y no viaja a ninguna parte. */
export function EnlaceViejoMisioneros() {
  const { barrio = "" } = useParams();
  return <Navigate to={`/${barrio}/m`} replace />;
}

function Misioneros({ slug }: { slug: string }) {
  const { token, guardar, olvidar } = useTokenMisioneros(slug);
  const [codigoCambio, setCodigoCambio] = useState(false);

  if (!token) {
    return (
      <IngresarCodigo
        slug={slug}
        codigoCambio={codigoCambio}
        alEntrar={(nuevo) => {
          setCodigoCambio(false);
          guardar(nuevo);
        }}
      />
    );
  }
  return (
    <Calendario
      slug={slug}
      token={token}
      alRechazar={() => {
        olvidar();
        setCodigoCambio(true);
      }}
      alSalir={olvidar}
    />
  );
}

function IngresarCodigo({
  slug,
  codigoCambio,
  alEntrar,
}: {
  slug: string;
  /** La API rechazó el token guardado: la presidenta cambió el código. */
  codigoCambio: boolean;
  alEntrar: (token: string) => void;
}) {
  const { t } = useIdioma();
  const id = useId();
  const barrio = useBarrioConIdioma(slug);
  const entrar = useEntrarMisioneros(slug);
  const [codigo, setCodigo] = useState("");
  useTitulo(barrio.data?.barrio.nombre);

  if (!barrio.data) {
    return (
      <>
        <Encabezado titulo="" />
        {barrio.isError ? <ErrorCarga error={barrio.error} reintentar={barrio.refetch} /> : <Cargando />}
      </>
    );
  }

  const entrarCon = (valor: string) => {
    if (entrar.isPending) return;
    entrar.mutate(valor, { onSuccess: ({ token }) => alEntrar(token) });
  };
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    entrarCon(codigo);
  };
  const casilla = "size-12 font-mono text-2xl font-semibold";

  return (
    <>
      <Encabezado antetitulo={t.misioneros.antetitulo} titulo={barrio.data.barrio.nombre} />
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-8">
        {codigoCambio && <AvisoAmbar>{t.misioneros.codigoCambio}</AvisoAmbar>}
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <Label htmlFor={id}>{t.misioneros.codigo}</Label>
          {/* Se entra solo al completar las 6 casillas; pegar "K7P-M2X" o "k7p m2x" también sirve. */}
          <InputOTP
            id={id}
            maxLength={LARGO_CODIGO}
            value={codigo}
            onChange={(valor) => setCodigo(valor.toUpperCase())}
            onComplete={(valor: string) => entrarCon(valor.toUpperCase())}
            pattern="^[A-Za-z0-9]+$"
            pasteTransformer={normalizarCodigo}
            pushPasswordManagerStrategy="none"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            aria-describedby={`${id}-ayuda`}
            aria-invalid={entrar.isError || undefined}
            containerClassName="justify-center gap-2"
          >
            <InputOTPGroup>
              {[0, 1, 2].map((i) => <InputOTPSlot key={i} index={i} className={casilla} />)}
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              {[3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className={casilla} />)}
            </InputOTPGroup>
          </InputOTP>
          <p id={`${id}-ayuda`} className="text-sm leading-snug text-muted-foreground">
            {t.misioneros.codigoAyuda}
          </p>
          {entrar.isError && <AlertaError>{t.errores[codigoDe(entrar.error)]}</AlertaError>}
          <Button type="submit" variant="accion" disabled={entrar.isPending || codigo.length < LARGO_CODIGO}>
            {entrar.isPending ? t.misioneros.entrando : t.misioneros.entrar}
          </Button>
        </form>
      </main>
      <PiePagina />
    </>
  );
}

function Calendario({
  slug,
  token,
  alRechazar,
  alSalir,
}: {
  slug: string;
  token: string;
  alRechazar: () => void;
  alSalir: () => void;
}) {
  const { t } = useIdioma();
  const consulta = useMisioneros(slug, token);
  const rechazado = useAlRechazar(consulta, alRechazar);
  const barrio = consulta.data?.barrio;
  const meses = consulta.data?.meses ?? [];
  const [periodo, ir] = usePeriodoDeLaUrl(meses, consulta.data?.hoy ?? "");
  useIdiomaDelBarrio(barrio?.idioma);
  useTitulo(barrio?.nombre);

  if (!barrio || rechazado) {
    return (
      <>
        <Encabezado titulo="" />
        {consulta.isError && !rechazado ? <ErrorCarga error={consulta.error} reintentar={consulta.refetch} /> : <Cargando />}
      </>
    );
  }

  const salir = (
    <Button variant="ghost" className="mx-auto mb-2 flex font-bold text-azul-medio" onClick={alSalir}>
      {t.misioneros.salir}
    </Button>
  );

  return (
    <>
      <Encabezado antetitulo={t.misioneros.antetitulo} titulo={barrio.nombre}>
        {periodo && <SelectorMes periodo={periodo} meses={meses} onCambiar={ir} />}
      </Encabezado>
      {periodo ? (
        <TurnosDelMes
          slug={slug}
          token={token}
          periodo={textoPeriodo(periodo)}
          zonaHoraria={barrio.zonaHoraria}
          alRechazar={alRechazar}
          salir={salir}
        />
      ) : (
        <>
          <Aviso>{t.misioneros.sinMeses}</Aviso>
          {salir}
          <PiePagina />
        </>
      )}
    </>
  );
}

function TurnosDelMes({
  slug,
  token,
  periodo,
  zonaHoraria,
  alRechazar,
  salir,
}: {
  slug: string;
  token: string;
  periodo: string;
  zonaHoraria: string;
  alRechazar: () => void;
  /** El botón "Salir", al final de la lista. */
  salir: ReactNode;
}) {
  const { t } = useIdioma();
  const consulta = useMesMisioneros(slug, token, periodo);
  const rechazado = useAlRechazar(consulta, alRechazar);
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

  if (rechazado) return <Cargando />;
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
      {salir}
      <PiePagina />
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
        // noreferrer: lo que diga la URL de esta página no tiene por qué llegar a WhatsApp.
        <a
          href={enlace}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t.misioneros.escribirA(nombre)}
          className={cn(buttonVariants({ variant: "accion" }), "shrink-0 px-4")}
        >
          <MessageCircleIcon className="size-[18px]" aria-hidden="true" />
          {t.misioneros.whatsapp}
        </a>
      )}
    </div>
  );
}
