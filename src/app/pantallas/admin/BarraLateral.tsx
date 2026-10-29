import { useState, type FormEvent, type ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import {
  type TipoCompanerismo,
  useCrearCompanerismo,
  useEditarBarrio,
  useAdminsBarrio,
  useEditarCompanerismo,
  useRegenerarToken,
  useReenviarInvitacion,
} from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { AlertaError } from "@/app/components/Estado";
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
import { DisenoCalendario } from "./DisenoCalendario";
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
    tokenMisioneros: string;
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
      <Enlaces slug={slug} token={barrio.tokenMisioneros} />
      {periodo && <DisenoCalendario slug={slug} periodo={periodo} barrio={barrio} />}
      <Misioneros slug={slug} companerismos={companerismos} notaParaCocinar={barrio.notaParaCocinar} />
      {superAdmin && <Administradores slug={slug} />}
    </aside>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-4">
      <h2 className="font-sans text-base font-extrabold text-azul-profundo">{titulo}</h2>
      {children}
    </section>
  );
}

function Enlaces({ slug, token }: { slug: string; token: string }) {
  const { t } = useIdioma();
  const regenerar = useRegenerarToken(slug);
  const [confirmando, setConfirmando] = useState(false);
  const base = window.location.origin;

  return (
    <Seccion titulo={t.panel.enlaces}>
      <Enlace
        titulo={t.panel.paraHermanas}
        detalle={t.panel.soloNombres}
        url={`${base}/${slug}`}
        etiquetaCopiar={t.panel.copiarEnlace(t.panel.paraLasHermanas)}
      />
      <div className="flex flex-col gap-1.5">
        <Enlace
          titulo={t.panel.paraMisioneros}
          detalle={t.panel.conTelefonos}
          url={`${base}/${slug}/m/${token}`}
          etiquetaCopiar={t.panel.copiarEnlace(t.panel.paraLosMisioneros)}
        />
        <Button
          variant="ghost"
          className="h-11 self-start px-0 text-[13px] font-bold whitespace-normal text-destructive hover:bg-transparent hover:text-destructive hover:underline"
          onClick={() => {
            regenerar.reset();
            setConfirmando(true);
          }}
        >
          {t.panel.regenerar}
        </Button>
      </div>

      <Dialog open={confirmando} onOpenChange={(abierto) => !regenerar.isPending && setConfirmando(abierto)}>
        <DialogContent showCloseButton={false} className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-azul-profundo">{t.panel.regenerarTitulo}</DialogTitle>
            <DialogDescription className="text-[15px]">{t.panel.regenerarTexto}</DialogDescription>
          </DialogHeader>
          {regenerar.isError && <AlertaError>{t.errores[codigoDe(regenerar.error)]}</AlertaError>}
          <DialogFooter className="gap-2.5">
            <Button variant="accion-outline" disabled={regenerar.isPending} onClick={() => setConfirmando(false)}>
              {t.panel.noRegenerar}
            </Button>
            <Button
              variant="destructive"
              className="rounded-full font-bold"
              disabled={regenerar.isPending}
              onClick={() =>
                regenerar.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmando(false);
                    toast.success(t.panel.regenerado);
                  },
                })
              }
            >
              {t.panel.siRegenerar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Seccion>
  );
}

function Enlace({
  titulo,
  detalle,
  url,
  etiquetaCopiar,
}: {
  titulo: string;
  detalle: string;
  url: string;
  etiquetaCopiar: string;
}) {
  const { t } = useIdioma();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.panel.copiado);
    } catch {
      toast.error(t.errores.ERROR_INTERNO);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[13px] font-bold">
        {titulo} <span className="font-normal text-muted-foreground">{detalle}</span>
      </div>
      <div className="flex gap-2">
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-[10px] bg-muted px-3 text-[13px] text-[#3D4C5C]">
          <span className="truncate">{url}</span>
        </div>
        <Button variant="outline" aria-label={etiquetaCopiar} onClick={copiar} className="rounded-[10px] font-bold">
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
    <Seccion titulo={t.panel.misioneros}>
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
 * la bienvenida con un enlace nuevo si aún no crean su contraseña, o el aviso de asignación.
 */
function Administradores({ slug }: { slug: string }) {
  const { t } = useIdioma();
  const admins = useAdminsBarrio(slug, true);
  const reenviar = useReenviarInvitacion(slug);

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
                className="self-start px-0 text-[13px] font-bold text-azul-medio hover:bg-transparent hover:underline"
              >
                {t.panel.reenviarInvitacion}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
