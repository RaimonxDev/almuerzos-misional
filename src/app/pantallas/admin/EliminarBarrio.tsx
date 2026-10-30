import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import {
  useEliminarBarrio,
  useResumenEliminacion,
  useRetirarEliminacion,
  useSolicitarEliminacion,
} from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { MOTIVO_ELIMINACION_MAX, nombreConfirmado } from "@/shared/solicitudes";
import { AlertaError, AvisoDestructivo, Cargando } from "@/app/components/Estado";
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
import { Textarea } from "@/app/components/ui/textarea";
import { diaLocal, ESTILO_ACCION_PELIGROSA, FECHA_LARGA } from "./comunes";

/**
 * Final de la barra lateral. La presidenta pide eliminar el barrio y puede retirar el pedido; solo
 * el super admin lo borra. Mientras haya un pedido, los dos lo ven y pueden retirarlo.
 */
export function EliminacionBarrio({
  slug,
  nombre,
  solicitadaEn,
  motivo,
  superAdmin,
}: {
  slug: string;
  nombre: string;
  solicitadaEn: string | null;
  motivo: string | null;
  superAdmin: boolean;
}) {
  const { t, formatearFecha } = useIdioma();
  const retirar = useRetirarEliminacion(slug);
  const [dialogo, setDialogo] = useState(false);

  return (
    <>
      {solicitadaEn ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">
            {t.panel.eliminacionPedida(formatearFecha(diaLocal(solicitadaEn), FECHA_LARGA))}
          </p>
          {motivo && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{motivo}</p>}
          {!superAdmin && <p className="text-sm text-muted-foreground">{t.panel.eliminacionPedidaTexto}</p>}
          {retirar.isError && <AlertaError>{t.errores[codigoDe(retirar.error)]}</AlertaError>}
          <Button
            variant="outline"
            disabled={retirar.isPending}
            onClick={() => retirar.mutate(undefined, { onSuccess: () => toast.success(t.panel.eliminacionRetirada) })}
            className="self-start rounded-[10px] font-bold"
          >
            {t.panel.retirarEliminacion}
          </Button>
        </div>
      ) : (
        !superAdmin && <p className="text-sm text-muted-foreground">{t.panel.dejarDeUsarTexto}</p>
      )}

      {(superAdmin || !solicitadaEn) && (
        <Button
          variant="ghost"
          onClick={() => setDialogo(true)}
          className={ESTILO_ACCION_PELIGROSA}
        >
          {superAdmin ? t.panel.eliminarBarrio : t.panel.solicitarEliminacion}
        </Button>
      )}

      {dialogo &&
        (superAdmin ? (
          <DialogoEliminar slug={slug} nombre={nombre} pedidoVisto={solicitadaEn} alCerrar={() => setDialogo(false)} />
        ) : (
          <DialogoSolicitar slug={slug} nombre={nombre} alCerrar={() => setDialogo(false)} />
        ))}
    </>
  );
}

function DialogoSolicitar({ slug, nombre, alCerrar }: { slug: string; nombre: string; alCerrar: () => void }) {
  const { t } = useIdioma();
  const id = useId();
  const solicitar = useSolicitarEliminacion(slug);
  const [motivo, setMotivo] = useState("");

  const enviar = () =>
    solicitar.mutate(motivo.trim() || undefined, {
      onSuccess: () => {
        toast.success(t.panel.eliminacionEnviada);
        alCerrar();
      },
    });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !solicitar.isPending && alCerrar()}>
      <DialogContent showCloseButton={false} className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-azul-profundo">{t.panel.solicitarEliminacionTitulo(nombre)}</DialogTitle>
          <DialogDescription>{t.panel.solicitarEliminacionTexto}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{t.solicitudes.motivoLabel}</Label>
          <Textarea
            id={id}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MOTIVO_ELIMINACION_MAX}
            rows={3}
            className="rounded-[10px]"
          />
        </div>
        {solicitar.isError && <AlertaError>{t.errores[codigoDe(solicitar.error)]}</AlertaError>}
        <DialogFooter className="gap-2.5">
          <Button variant="accion-outline" disabled={solicitar.isPending} onClick={alCerrar}>
            {t.panel.cancelar}
          </Button>
          <Button variant="destructive" className="rounded-full font-bold" disabled={solicitar.isPending} onClick={enviar}>
            {t.panel.enviarSolicitudEliminacion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hay que escribir el nombre tal cual: evita borrar el barrio equivocado. La API lo revisa de nuevo. */
function DialogoEliminar({
  slug,
  nombre,
  pedidoVisto,
  alCerrar,
}: {
  slug: string;
  nombre: string;
  pedidoVisto: string | null;
  alCerrar: () => void;
}) {
  const { t } = useIdioma();
  const id = useId();
  const navigate = useNavigate();
  const resumen = useResumenEliminacion(slug);
  const eliminar = useEliminarBarrio(slug);
  const [confirmacion, setConfirmacion] = useState("");
  const coincide = nombreConfirmado(confirmacion, nombre);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!coincide) return;
    eliminar.mutate(
      { confirmacion, pedidoVisto },
      {
        onSuccess: () => {
          toast.success(t.panel.barrioEliminado(nombre));
          navigate("/admin", { replace: true });
        },
        onError: (error) => {
          if (codigoDe(error) !== "NO_ENCONTRADO") return;
          toast.warning(t.panel.barrioYaNoEsta);
          navigate("/admin", { replace: true });
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !eliminar.isPending && alCerrar()}>
      <DialogContent showCloseButton={false} className="rounded-2xl">
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-xl text-azul-profundo">{t.panel.eliminarBarrioTitulo(nombre)}</DialogTitle>
          </DialogHeader>
          <AvisoDestructivo titulo={t.panel.noSeDeshace}>
            <DialogDescription className="text-sm text-foreground">{t.panel.eliminarBarrioTexto}</DialogDescription>
          </AvisoDestructivo>
          {resumen.isPending ? (
            <Cargando />
          ) : resumen.isError ? (
            <AlertaError>{t.errores[codigoDe(resumen.error)]}</AlertaError>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              <li>{t.panel.seBorranInscripciones(resumen.data.inscripciones, resumen.data.inscripcionesFuturas)}</li>
              {resumen.data.cuentasQueSeBorran.length > 0 && (
                <li className="break-all">{t.panel.seBorranCuentas(resumen.data.cuentasQueSeBorran.join(", "))}</li>
              )}
            </ul>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{t.panel.escribeNombreBarrio(nombre)}</Label>
            <Input
              id={id}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="rounded-[10px]"
            />
          </div>
          {eliminar.isError && <AlertaError>{t.errores[codigoDe(eliminar.error)]}</AlertaError>}
          <DialogFooter className="gap-2.5">
            <Button type="button" variant="accion-outline" disabled={eliminar.isPending} onClick={alCerrar}>
              {t.panel.cancelar}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="rounded-full font-bold"
              disabled={!coincide || !resumen.data || eliminar.isPending}
            >
              {t.panel.confirmarEliminarBarrio}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
