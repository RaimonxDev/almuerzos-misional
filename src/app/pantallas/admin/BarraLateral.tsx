import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import { useEditarBarrio, useEditarCompanerismo, useRegenerarToken } from "@/app/consultas-admin";
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
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";

type Companerismo = { id: string; nombre: string; activo: boolean };

/** Columna derecha del panel: enlaces del barrio, compañerismos y nota para cocinar. */
export function BarraLateral({
  slug,
  barrio,
  companerismos,
}: {
  slug: string;
  barrio: { tokenMisioneros: string; notaParaCocinar: string | null };
  companerismos: Companerismo[];
}) {
  return (
    <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
      <Enlaces slug={slug} token={barrio.tokenMisioneros} />
      <Misioneros slug={slug} companerismos={companerismos} notaParaCocinar={barrio.notaParaCocinar} />
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
