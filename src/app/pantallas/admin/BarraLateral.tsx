import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import {
  type TipoCompanerismo,
  useCambiarEnlace,
  useCrearCompanerismo,
  useEditarBarrio,
  useAdminsBarrio,
  useEditarCompanerismo,
  useCambiarCodigoMisioneros,
  useCorregirCorreoAdmin,
  useNuevaPasswordTemporal,
  useReenviarInvitacion,
} from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { usePrimerosPasos } from "@/app/primeros-pasos";
import { cn } from "@/app/lib/utils";
import { AlertaError, AvisoDestructivo } from "@/app/components/Estado";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { DatosCuenta } from "./DatosCuenta";
import { DisenoCalendario } from "./DisenoCalendario";
import { enlaceValido, LARGO_ENLACE, sugerirSlug, vistaPreviaEnlace } from "./enlace";
import { formatearCodigo } from "@/shared/codigo-misioneros";
import { Textarea } from "@/app/components/ui/textarea";

type Companerismo = { id: string; nombre: string; activo: boolean };

/** Columna derecha del panel: enlaces del barrio, compañerismos, nota para cocinar y (super admin) administradores. */
export function BarraLateral({
  slug,
  barrio,
  companerismos,
  periodo,
  superAdmin = false,
}: {
  slug: string;
  barrio: {
    nombre: string;
    codigoMisioneros: string;
    notaParaCocinar: string | null;
    contactoNombre: string | null;
    contactoTelefono: string | null;
  };
  companerismos: Companerismo[];
  /** Mes visible (`2026-11`); sin él no hay sección de diseño. */
  periodo: string | null;
  /** Solo el super admin ve la lista de administradores y reenvía invitaciones. */
  superAdmin?: boolean;
}) {
  return (
    <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
      <Enlaces slug={slug} nombre={barrio.nombre} codigo={barrio.codigoMisioneros} />
      {periodo && <DisenoCalendario slug={slug} periodo={periodo} barrio={barrio} />}
      <Misioneros slug={slug} companerismos={companerismos} notaParaCocinar={barrio.notaParaCocinar} />
      {superAdmin && <Administradores slug={slug} />}
    </aside>
  );
}

function Seccion({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-4">
      <h2 className="font-sans text-base font-extrabold text-azul-profundo">{titulo}</h2>
      {children}
    </section>
  );
}

function Enlaces({ slug, nombre, codigo }: { slug: string; nombre: string; codigo: string }) {
  const { t } = useIdioma();
  const cambiarCodigo = useCambiarCodigoMisioneros(slug);
  const copiar = useCopiar();
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);
  const [, marcar] = usePrimerosPasos(slug);
  const base = window.location.origin;

  return (
    <Seccion id="enlaces" titulo={t.panel.enlaces}>
      <div className="flex flex-col gap-1.5">
        <Enlace
          titulo={t.panel.paraHermanas}
          detalle={t.panel.soloNombres}
          url={`${base}/${slug}`}
          etiquetaCopiar={t.panel.copiarEnlace(t.panel.paraLasHermanas)}
          alCopiar={() => marcar({ compartido: true })}
        />
        <CambiarEnlace slug={slug} nombre={nombre} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Enlace
          titulo={t.panel.paraMisioneros}
          detalle={t.panel.conTelefonos}
          url={`${base}/${slug}/m`}
          etiquetaCopiar={t.panel.copiarEnlace(t.panel.paraLosMisioneros)}
          alCopiar={() => marcar({ compartido: true })}
        />
        {/* Lo dictan o se lo mandan aparte: entran a ese enlace y lo escriben una vez. */}
        <div className="flex items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-[10px] bg-muted px-3">
            <span className="text-[13px] text-muted-foreground">{t.panel.codigoMisioneros}</span>
            <span className="font-mono text-lg font-bold tracking-[0.12em] text-azul-profundo">{formatearCodigo(codigo)}</span>
          </div>
          <Button
            variant="outline"
            aria-label={t.panel.copiarCodigo}
            onClick={() => copiar(formatearCodigo(codigo), t.panel.codigoCopiado, () => marcar({ compartido: true }))}
            className="rounded-[10px] font-bold"
          >
            {t.panel.copiar}
          </Button>
        </div>
        <Button
          variant="ghost"
          className={ESTILO_ACCION_PELIGROSA}
          onClick={() => {
            cambiarCodigo.reset();
            setConfirmandoCodigo(true);
          }}
        >
          {t.panel.cambiarCodigo}
        </Button>
      </div>

      <Dialog open={confirmandoCodigo} onOpenChange={(abierto) => !cambiarCodigo.isPending && setConfirmandoCodigo(abierto)}>
        <DialogContent showCloseButton={false} className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-azul-profundo">{t.panel.cambiarCodigoTitulo}</DialogTitle>
          </DialogHeader>
          <AvisoDestructivo titulo={t.panel.noSeDeshace}>
            <DialogDescription className="text-sm text-foreground">{t.panel.cambiarCodigoTexto}</DialogDescription>
          </AvisoDestructivo>
          {cambiarCodigo.isError && <AlertaError>{t.errores[codigoDe(cambiarCodigo.error)]}</AlertaError>}
          <DialogFooter className="gap-2.5">
            <Button variant="accion-outline" disabled={cambiarCodigo.isPending} onClick={() => setConfirmandoCodigo(false)}>
              {t.panel.noCambiar}
            </Button>
            <Button
              variant="destructive"
              className="rounded-full font-bold"
              disabled={cambiarCodigo.isPending}
              onClick={() =>
                cambiarCodigo.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmandoCodigo(false);
                    toast.success(t.panel.codigoCambiado);
                  },
                })
              }
            >
              {t.panel.siCambiarEnlace}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Seccion>
  );
}

const ESTILO_ACCION_PELIGROSA =
  "h-11 self-start px-0 text-[13px] font-bold whitespace-normal text-destructive hover:bg-transparent hover:text-destructive hover:underline";

/** Cambia el enlace público por uno con código al azar: cierra uno fácil de adivinar o que circuló de más. */
function CambiarEnlace({ slug, nombre }: { slug: string; nombre: string }) {
  const { t } = useIdioma();
  const id = useId();
  const navigate = useNavigate();
  const cambiar = useCambiarEnlace(slug);
  const [abierto, setAbierto] = useState(false);
  const [base, setBase] = useState("");
  const [invalido, setInvalido] = useState(false);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!enlaceValido(base)) return setInvalido(true);
    cambiar.mutate(base, {
      onSuccess: ({ slug: nuevo }) => {
        toast.success(t.panel.enlaceCambiado);
        navigate(`/admin/${nuevo}${location.search}`, { replace: true });
      },
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        className={ESTILO_ACCION_PELIGROSA}
        onClick={() => {
          cambiar.reset();
          setBase(sugerirSlug(nombre));
          setInvalido(false);
          setAbierto(true);
        }}
      >
        {t.panel.cambiarEnlace}
      </Button>

      <Dialog open={abierto} onOpenChange={(a) => !cambiar.isPending && setAbierto(a)}>
        <DialogContent showCloseButton={false} className="rounded-2xl">
          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="text-xl text-azul-profundo">{t.panel.cambiarEnlaceTitulo}</DialogTitle>
            </DialogHeader>
            <AvisoDestructivo titulo={t.panel.noSeDeshace}>
              <DialogDescription className="text-sm text-foreground">{t.panel.cambiarEnlaceTexto}</DialogDescription>
            </AvisoDestructivo>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-enlace`}>{t.nuevoBarrio.enlace}</Label>
              <Input
                id={`${id}-enlace`}
                value={base}
                onChange={(e) => {
                  setBase(e.target.value.toLowerCase());
                  setInvalido(false);
                }}
                maxLength={LARGO_ENLACE}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="rounded-[10px]"
                aria-invalid={invalido || undefined}
                aria-describedby={`${id}-ayuda`}
              />
              {invalido && <p className="text-sm text-destructive">{t.nuevoBarrio.errorEnlace}</p>}
              <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
                {t.panel.ayudaCambiarEnlace(vistaPreviaEnlace(base))}
              </p>
            </div>
            {cambiar.isError && <AlertaError>{t.errores[codigoDe(cambiar.error)]}</AlertaError>}
            <DialogFooter className="gap-2.5">
              <Button type="button" variant="accion-outline" disabled={cambiar.isPending} onClick={() => setAbierto(false)}>
                {t.panel.noCambiar}
              </Button>
              <Button type="submit" variant="destructive" className="rounded-full font-bold" disabled={cambiar.isPending}>
                {t.panel.siCambiarEnlace}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Copia al portapapeles y lo confirma con un toast. */
function useCopiar() {
  const { t } = useIdioma();
  return async (texto: string, aviso: string, alCopiar?: () => void) => {
    try {
      await navigator.clipboard.writeText(texto);
      alCopiar?.();
      toast.success(aviso);
    } catch {
      toast.error(t.errores.ERROR_INTERNO);
    }
  };
}

function Enlace({
  titulo,
  detalle,
  url,
  etiquetaCopiar,
  alCopiar,
}: {
  titulo: string;
  detalle: string;
  url: string;
  etiquetaCopiar: string;
  alCopiar?: () => void;
}) {
  const { t } = useIdioma();
  const copiar = useCopiar();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[13px] font-bold">
        {titulo} <span className="font-normal text-muted-foreground">{detalle}</span>
      </div>
      <div className="flex gap-2">
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-[10px] bg-muted px-3 text-[13px] text-[#3D4C5C]">
          <span className="truncate">{url}</span>
        </div>
        <Button
          variant="outline"
          aria-label={etiquetaCopiar}
          onClick={() => copiar(url, t.panel.copiado, alCopiar)}
          className="rounded-[10px] font-bold"
        >
          {t.panel.copiar}
        </Button>
      </div>
    </div>
  );
}

function Misioneros({
  slug,
  companerismos,
  notaParaCocinar,
}: {
  slug: string;
  companerismos: Companerismo[];
  notaParaCocinar: string | null;
}) {
  const { t } = useIdioma();
  const editar = useEditarCompanerismo(slug);
  const editarBarrio = useEditarBarrio(slug);
  const [nota, setNota] = useState(notaParaCocinar ?? "");

  const guardarNota = (e: FormEvent) => {
    e.preventDefault();
    editarBarrio.mutate(
      { notaParaCocinar: nota.trim() || null },
      { onSuccess: () => toast.success(t.panel.notaGuardada) },
    );
  };

  return (
    <Seccion id="misioneros" titulo={t.panel.misioneros}>
      <ul className="flex flex-col">
        {companerismos.map((c) => (
          <li key={c.id} className="flex min-h-11 items-center gap-2 border-t border-[#EEF2F6] py-1 first:border-t-0">
            <span className={cn("flex-1 font-bold", !c.activo && "text-muted-foreground")}>{c.nombre}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                c.activo ? "bg-exito-suave text-exito" : "bg-muted text-muted-foreground",
              )}
            >
              {c.activo ? t.panel.activo : t.panel.inactivoInsignia}
            </span>
            <Button
              variant="ghost"
              aria-label={c.activo ? t.panel.desactivar(c.nombre) : t.panel.activar(c.nombre)}
              disabled={editar.isPending}
              onClick={() =>
                editar.mutate(
                  { id: c.id, activo: !c.activo },
                  { onError: (e) => toast.error(t.errores[codigoDe(e)]) },
                )
              }
              className="px-2.5 text-[13px] font-bold text-azul-medio"
            >
              {c.activo ? t.panel.textoDesactivar : t.panel.textoActivar}
            </Button>
          </li>
        ))}
      </ul>

      <AgregarCompanerismo slug={slug} />

      <form onSubmit={guardarNota} className="flex flex-col gap-1.5">
        <Label htmlFor="nota-para-cocinar">{t.panel.notaParaCocinar}</Label>
        <Textarea
          id="nota-para-cocinar"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder={t.panel.notaPlaceholder}
          maxLength={500}
          className="resize-y rounded-[10px]"
        />
        {editarBarrio.isError && <AlertaError>{t.errores[codigoDe(editarBarrio.error)]}</AlertaError>}
        <Button
          type="submit"
          variant="outline"
          disabled={editarBarrio.isPending || nota.trim() === (notaParaCocinar ?? "")}
          className="self-end rounded-[10px] font-bold"
        >
          {t.panel.guardarNota}
        </Button>
      </form>
    </Seccion>
  );
}

/**
 * Agrega un compañerismo (no todos los barrios tienen élderes y hermanas). La API le genera los
 * turnos en los meses borrador y abiertos vigentes. Sin nombre, se usa el del tipo.
 */
function AgregarCompanerismo({ slug }: { slug: string }) {
  const { t } = useIdioma();
  const crear = useCrearCompanerismo(slug);
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoCompanerismo>("elderes");
  const [nombre, setNombre] = useState("");
  const etiquetaTipo = tipo === "elderes" ? t.panel.tipoElderes : t.panel.tipoHermanas;

  const cerrar = () => {
    setAbierto(false);
    setTipo("elderes");
    setNombre("");
    crear.reset();
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    crear.mutate(
      { tipo, nombre: nombre.trim() || etiquetaTipo },
      {
        onSuccess: ({ companerismo }) => {
          toast.success(t.panel.companerismoAgregado(companerismo?.nombre ?? etiquetaTipo));
          cerrar();
        },
      },
    );
  };

  if (!abierto) {
    return (
      <Button variant="outline" onClick={() => setAbierto(true)} className="self-start rounded-[10px] font-bold">
        <PlusIcon aria-hidden="true" />
        {t.panel.agregarCompanerismo}
      </Button>
    );
  }

  return (
    <form
      onSubmit={enviar}
      aria-label={t.panel.agregarCompanerismo}
      className="flex flex-col gap-3 rounded-[10px] border bg-cielo-claro p-3"
    >
      <RadioGroup
        aria-label={t.panel.tipoCompanerismo}
        value={tipo}
        onValueChange={(v) => setTipo(v as TipoCompanerismo)}
        className="grid-cols-2 gap-2"
      >
        {(["elderes", "hermanas"] as const).map((v) => (
          <label
            key={v}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border bg-card px-3 font-bold text-azul-profundo",
              tipo === v && "border-2 border-azul-medio",
            )}
          >
            <RadioGroupItem value={v} />
            {v === "elderes" ? t.panel.tipoElderes : t.panel.tipoHermanas}
          </label>
        ))}
      </RadioGroup>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre-companerismo">{t.panel.nombreCompanerismo}</Label>
        <Input
          id="nombre-companerismo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t.panel.nombreCompanerismoAyuda}
          maxLength={60}
          className="rounded-[10px] bg-card"
        />
      </div>
      {crear.isError && <AlertaError>{t.errores[codigoDe(crear.error)]}</AlertaError>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={cerrar} className="rounded-[10px] font-bold">
          {t.panel.cancelar}
        </Button>
        <Button type="submit" disabled={crear.isPending} className="rounded-[10px] font-bold">
          {t.panel.agregar}
        </Button>
      </div>
    </form>
  );
}

/**
 * Administradores del barrio (solo super admin) con "Reenviar invitación" si no les llegó el correo:
 * la bienvenida con un enlace nuevo si aún no crean su contraseña, o el aviso de asignación. A quien
 * aún no la crea también se le puede corregir el correo o dar otra contraseña temporal.
 */
function Administradores({ slug }: { slug: string }) {
  const { t } = useIdioma();
  const admins = useAdminsBarrio(slug);
  const reenviar = useReenviarInvitacion(slug);
  const temporal = useNuevaPasswordTemporal(slug);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [datos, setDatos] = useState<{ email: string; passwordTemporal: string } | null>(null);

  const accion = "self-start px-0 text-[13px] font-bold text-azul-medio hover:bg-transparent hover:underline";

  return (
    <Seccion titulo={t.panel.administradores}>
      {admins.isError && <AlertaError>{t.errores[codigoDe(admins.error)]}</AlertaError>}
      {admins.data && admins.data.admins.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.panel.sinAdministradores}</p>
      )}
      {admins.data && admins.data.admins.length > 0 && (
        <ul className="flex flex-col">
          {admins.data.admins.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 border-t border-[#EEF2F6] py-2 first:border-t-0">
              <span className="font-bold">{a.nombre}</span>
              <span className="text-[13px] break-all text-muted-foreground">
                {[a.cargo, a.email].filter(Boolean).join(" · ")}
              </span>
              {a.debeCambiarPassword && (
                <span className="self-start rounded-full bg-aviso-suave px-2.5 py-0.5 text-xs font-extrabold text-aviso-texto">
                  {t.panel.faltaContrasena}
                </span>
              )}
              {corrigiendo === a.id ? (
                <CorregirCorreo slug={slug} admin={a} alTerminar={() => setCorrigiendo(null)} />
              ) : (
                <div className="flex flex-wrap gap-x-4">
                  <Button
                    variant="ghost"
                    aria-label={t.panel.reenviarInvitacionA(a.nombre)}
                    disabled={reenviar.isPending}
                    onClick={() =>
                      reenviar.mutate(a.id, {
                        onSuccess: ({ correoEnviado }) =>
                          correoEnviado
                            ? toast.success(t.panel.invitacionReenviada(a.email))
                            : toast.error(t.panel.invitacionNoSalio),
                        onError: (e) => toast.error(t.errores[codigoDe(e)]),
                      })
                    }
                    className={accion}
                  >
                    {t.panel.reenviarInvitacion}
                  </Button>
                  {a.debeCambiarPassword && (
                    <>
                      <Button
                        variant="ghost"
                        aria-label={t.panel.corregirCorreoA(a.nombre)}
                        onClick={() => setCorrigiendo(a.id)}
                        className={accion}
                      >
                        {t.panel.corregirCorreo}
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={t.panel.nuevaTemporalA(a.nombre)}
                        disabled={temporal.isPending}
                        onClick={() =>
                          temporal.mutate(a.id, {
                            onSuccess: setDatos,
                            onError: (e) => toast.error(t.errores[codigoDe(e)]),
                          })
                        }
                        className={accion}
                      >
                        {t.panel.nuevaTemporal}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {datos && (
        <DatosCuenta
          email={datos.email}
          password={datos.passwordTemporal}
          titulo={t.panel.nuevaTemporalTitulo}
          texto={t.panel.nuevaTemporalTexto}
          textoCerrar={t.panel.listo}
          alCerrar={() => setDatos(null)}
        />
      )}
    </Seccion>
  );
}

/** Formulario en la fila: el correo bien escrito; al guardar se le manda la invitación ahí. */
function CorregirCorreo({
  slug,
  admin,
  alTerminar,
}: {
  slug: string;
  admin: { id: string; nombre: string; email: string };
  alTerminar: () => void;
}) {
  const { t } = useIdioma();
  const corregir = useCorregirCorreoAdmin(slug);
  const [email, setEmail] = useState(admin.email);
  const id = `correo-admin-${admin.id}`;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    corregir.mutate(
      { userId: admin.id, email: email.trim() },
      {
        onSuccess: ({ admin: corregido, correoEnviado }) => {
          if (correoEnviado) toast.success(t.panel.correoCorregido(corregido.email));
          else toast.warning(t.panel.correoCorregidoSinEnvio);
          alTerminar();
        },
      },
    );
  };

  return (
    <form
      onSubmit={enviar}
      aria-label={t.panel.corregirCorreoA(admin.nombre)}
      className="flex flex-col gap-3 rounded-[10px] border bg-cielo-claro p-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{t.panel.correoCorrecto}</Label>
        <Input
          id={id}
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-[10px] bg-card"
        />
      </div>
      {corregir.isError && <AlertaError>{t.errores[codigoDe(corregir.error)]}</AlertaError>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={alTerminar} className="rounded-[10px] font-bold">
          {t.panel.cancelar}
        </Button>
        <Button type="submit" disabled={corregir.isPending} className="rounded-[10px] font-bold">
          {t.panel.guardar}
        </Button>
      </div>
    </form>
  );
}
