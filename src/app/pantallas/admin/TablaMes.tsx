import { useState, type FormEvent, type ReactNode } from "react";
import { BanIcon, EllipsisVerticalIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import {
  useAsignar,
  useBloquearDia,
  useBloquearTurno,
  useEditarInscripcionAdmin,
  useQuitarInscripcion,
} from "@/app/consultas-admin";
import { agruparPorDia, diasVisibles } from "@/app/dias";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import type { Periodo } from "@/app/periodos";
import type { Modalidad } from "@/shared/inscripciones";
import { enlaceWhatsApp } from "@/shared/telefonos";
import { AlertaError } from "@/app/components/Estado";
import { FormularioInscripcion, type ValoresInscripcion } from "@/app/components/FormularioInscripcion";
import { BotonDiasAnteriores } from "@/app/components/TarjetaDia";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { hoyParaElMes } from "./mes";

type Companerismo = { id: string; nombre: string; activo: boolean };

type Inscripcion = {
  id: string;
  nombre: string;
  telefono: string | null;
  consentimientoTelefono: boolean;
  modalidad: Modalidad | null;
  nota: string | null;
  origen: "publico" | "admin";
};

type Turno = {
  id: string;
  fecha: string;
  companerismoId: string;
  bloqueado: boolean;
  motivoBloqueo: string | null;
  inscripcion: Inscripcion | null;
};

/** Turno con el nombre de su compañerismo, para los títulos de los diálogos. */
type TurnoConNombre = Turno & { companerismo: string };

type Dialogo =
  | { tipo: "asignar" | "editar" | "quitar" | "bloquearTurno"; turno: TurnoConNombre }
  | { tipo: "bloquearDia"; fecha: string };

/**
 * Tabla del mes: una fila por día y una columna por compañerismo (los que trae el mes: activos
 * y los inactivos que todavía tienen turnos). En el teléfono cada fila se apila como tarjeta.
 */
export function TablaMes({
  slug,
  periodo,
  companerismos,
  turnos,
  zonaHoraria,
  hoy,
}: {
  slug: string;
  periodo: Periodo;
  companerismos: Companerismo[];
  turnos: Turno[];
  zonaHoraria: string;
  hoy: string;
}) {
  const { t, formatearFecha } = useIdioma();
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const bloquearDia = useBloquearDia(slug);
  const bloquearTurno = useBloquearTurno(slug);

  const nombres = new Map(companerismos.map((c) => [c.id, c.nombre]));
  const dias = agruparPorDia(
    turnos.map((turno) => ({ ...turno, companerismo: nombres.get(turno.companerismoId) ?? "" })),
    hoyParaElMes(periodo, hoy),
  );
  const { visibles, anteriores } = diasVisibles(dias, () => true, verAnteriores);
  const alFallar = (e: Error) => toast.error(t.errores[codigoDe(e)]);
  const cerrar = () => setDialogo(null);
  /** Los diálogos de bloqueo muestran el error de su mutación: se limpia el de un intento anterior. */
  const abrirDialogo = (nuevo: Dialogo) => {
    bloquearDia.reset();
    bloquearTurno.reset();
    setDialogo(nuevo);
  };

  return (
    <>
      <BotonDiasAnteriores cantidad={anteriores} abiertos={verAnteriores} onCambiar={setVerAnteriores} />

      <div className="overflow-x-auto rounded-[14px] border bg-card">
        <table className="w-full border-collapse text-sm max-md:block md:min-w-[640px]">
          <thead className="max-md:sr-only">
            <tr className="bg-cielo-claro text-left">
              <Columna className="w-[120px]">{t.panel.dia}</Columna>
              {companerismos.map((c) => (
                <Columna key={c.id}>
                  {c.nombre}
                  {!c.activo && <span className="font-semibold normal-case"> ({t.panel.inactivo})</span>}
                </Columna>
              ))}
              <Columna className="w-14">
                <span className="sr-only">{t.panel.acciones}</span>
              </Columna>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {visibles.map((dia) => {
              const fechaLarga = formatearFecha(dia.fecha);
              const todoBloqueado = dia.turnos.every((turno) => turno.bloqueado);
              return (
                <tr
                  key={dia.fecha}
                  className={cn(
                    "border-t border-[#E3EAF1] max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-3 max-md:px-4 max-md:py-2",
                    dia.pasado && "opacity-60",
                    dia.esHoy && "bg-aviso-suave/40",
                  )}
                >
                  <td className="px-4 py-2.5 align-top max-md:px-0">
                    <div className="text-lg font-extrabold text-azul-profundo">{Number(dia.fecha.slice(8))}</div>
                    <div className="text-[13px] text-muted-foreground first-letter:uppercase">
                      {formatearFecha(dia.fecha, { weekday: "long" })}
                    </div>
                  </td>
                  {companerismos.map((c) => {
                    const turno = dia.turnos.find((x) => x.companerismoId === c.id);
                    return (
                      <td key={c.id} className="px-4 py-2.5 align-top max-md:col-span-2 max-md:px-0">
                        <span className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase md:hidden">
                          {c.nombre}
                        </span>
                        {turno && (
                          <CeldaTurno
                            turno={turno}
                            fechaLarga={fechaLarga}
                            zonaHoraria={zonaHoraria}
                            onDialogo={abrirDialogo}
                            onDesbloquear={() =>
                              bloquearTurno.mutate({ turnoId: turno.id, bloqueado: false }, { onError: alFallar })
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 align-top max-md:col-start-2 max-md:row-start-1 max-md:px-0">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={todoBloqueado ? t.panel.desbloquearDia(fechaLarga) : t.panel.bloquearDia(fechaLarga)}
                      aria-pressed={todoBloqueado}
                      className={cn("rounded-[10px] text-muted-foreground", todoBloqueado && "bg-muted text-azul-profundo")}
                      disabled={bloquearDia.isPending}
                      onClick={() =>
                        todoBloqueado
                          ? bloquearDia.mutate({ fecha: dia.fecha, bloqueado: false }, { onError: alFallar })
                          : abrirDialogo({ tipo: "bloquearDia", fecha: dia.fecha })
                      }
                    >
                      <BanIcon aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialogo?.tipo === "bloquearDia" && (
        <DialogoBloqueo
          que={formatearFecha(dialogo.fecha)}
          enviando={bloquearDia.isPending}
          error={bloquearDia.error}
          onCerrar={cerrar}
          onBloquear={(motivo) =>
            bloquearDia.mutate({ fecha: dialogo.fecha, bloqueado: true, motivo }, { onSuccess: cerrar })
          }
        />
      )}
      {dialogo?.tipo === "bloquearTurno" && (
        <DialogoBloqueo
          que={`${dialogo.turno.companerismo}, ${formatearFecha(dialogo.turno.fecha)}`}
          enviando={bloquearTurno.isPending}
          error={bloquearTurno.error}
          onCerrar={cerrar}
          onBloquear={(motivo) =>
            bloquearTurno.mutate({ turnoId: dialogo.turno.id, bloqueado: true, motivo }, { onSuccess: cerrar })
          }
        />
      )}
      {(dialogo?.tipo === "asignar" || dialogo?.tipo === "editar") && (
        <DialogoInscripcion slug={slug} tipo={dialogo.tipo} turno={dialogo.turno} onCerrar={cerrar} />
      )}
      {dialogo?.tipo === "quitar" && dialogo.turno.inscripcion && (
        <DialogoQuitar slug={slug} turno={dialogo.turno} inscripcion={dialogo.turno.inscripcion} onCerrar={cerrar} />
      )}
    </>
  );
}

function Columna({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-3 text-xs font-extrabold tracking-[0.06em] text-[#3D4C5C] uppercase", className)}
    >
      {children}
    </th>
  );
}

function CeldaTurno({
  turno,
  fechaLarga,
  zonaHoraria,
  onDialogo,
  onDesbloquear,
}: {
  turno: TurnoConNombre;
  fechaLarga: string;
  zonaHoraria: string;
  onDialogo: (dialogo: Dialogo) => void;
  onDesbloquear: () => void;
}) {
  const { t } = useIdioma();
  const { inscripcion } = turno;
  const abrir = (tipo: "asignar" | "editar" | "quitar" | "bloquearTurno") => () => onDialogo({ tipo, turno });

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.panel.opciones(turno.companerismo, fechaLarga)}
        className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted"
      >
        <EllipsisVerticalIcon className="size-[18px]" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {inscripcion && (
          <>
            <DropdownMenuItem className="min-h-11" onClick={abrir("editar")}>
              {t.panel.editar}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" variant="destructive" onClick={abrir("quitar")}>
              {t.panel.quitar}
            </DropdownMenuItem>
          </>
        )}
        {turno.bloqueado ? (
          <DropdownMenuItem className="min-h-11" onClick={onDesbloquear}>
            {t.panel.desbloquearTurno}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-11" onClick={abrir("bloquearTurno")}>
            {t.panel.bloquearTurno}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (turno.bloqueado) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 py-1">
          <div className="text-muted-foreground italic">{t.panel.bloqueado(turno.motivoBloqueo)}</div>
          {inscripcion && <div className="text-[13px] text-muted-foreground">{t.panel.anotada(inscripcion.nombre)}</div>}
        </div>
        {menu}
      </div>
    );
  }

  if (!inscripcion) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t.panel.libre}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            aria-label={t.panel.asignarEn(turno.companerismo, fechaLarga)}
            onClick={abrir("asignar")}
            className="rounded-[10px] border-dashed border-azul-medio px-3 font-bold text-azul-medio"
          >
            {t.panel.asignar}
          </Button>
          {menu}
        </div>
      </div>
    );
  }

  // Sin consentimiento no se muestra aunque llegara (la API ya no lo manda).
  const telefono = inscripcion.consentimientoTelefono ? inscripcion.telefono : null;
  const whatsapp = telefono && enlaceWhatsApp(telefono, zonaHoraria);
  const modalidades = { en_casa: t.formulario.enCasa, llevar: t.formulario.llevar };
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 py-1">
        <div className="font-bold">{inscripcion.nombre}</div>
        {telefono && <div className="text-[13px] text-muted-foreground">{telefono}</div>}
        {(inscripcion.modalidad || inscripcion.nota) && (
          <div className="text-[13px] break-words text-muted-foreground">
            {[inscripcion.modalidad && modalidades[inscripcion.modalidad], inscripcion.nota].filter(Boolean).join(" · ")}
          </div>
        )}
        {inscripcion.origen === "admin" && (
          <div className="text-xs text-muted-foreground italic">{t.panel.porLaPresidenta}</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t.misioneros.escribirA(inscripcion.nombre)}
            className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-exito/25 text-exito hover:bg-exito-suave"
          >
            <MessageCircleIcon className="size-[18px]" aria-hidden="true" />
          </a>
        )}
        {menu}
      </div>
    </div>
  );
}

function DialogoBloqueo({
  que,
  enviando,
  error,
  onCerrar,
  onBloquear,
}: {
  que: string;
  enviando: boolean;
  error: Error | null;
  onCerrar: () => void;
  onBloquear: (motivo: string) => void;
}) {
  const { t } = useIdioma();
  const [motivo, setMotivo] = useState("");
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    onBloquear(motivo.trim());
  };
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}>
      <DialogContent className="rounded-2xl">
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-xl text-azul-profundo first-letter:uppercase">{t.panel.bloquearTitulo(que)}</DialogTitle>
            <DialogDescription className="text-[15px]">{t.panel.bloquearTexto}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-bloqueo">
              {t.panel.motivo} <span className="font-normal text-muted-foreground">{t.comun.opcional}</span>
            </Label>
            <Input
              id="motivo-bloqueo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={t.panel.motivoPlaceholder}
              maxLength={200}
            />
          </div>
          {error && <AlertaError>{t.errores[codigoDe(error)]}</AlertaError>}
          <DialogFooter className="gap-2.5">
            <Button type="button" variant="accion-outline" disabled={enviando} onClick={onCerrar}>
              {t.panel.cancelar}
            </Button>
            <Button type="submit" variant="accion" disabled={enviando}>
              {t.panel.bloquear}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Asignar a mano o editar. Al editar solo se mandan los campos que cambiaron: el panel no conoce
 * el teléfono de quien no dio consentimiento, y mandarlo vacío lo borraría.
 */
function DialogoInscripcion({
  slug,
  tipo,
  turno,
  onCerrar,
}: {
  slug: string;
  tipo: "asignar" | "editar";
  turno: TurnoConNombre;
  onCerrar: () => void;
}) {
  const { t, formatearFecha } = useIdioma();
  const asignar = useAsignar(slug);
  const editar = useEditarInscripcionAdmin(slug);
  const mutacion = tipo === "asignar" ? asignar : editar;
  const { inscripcion } = turno;

  const inicial: ValoresInscripcion | undefined = inscripcion
    ? {
        nombre: inscripcion.nombre,
        telefono: (inscripcion.consentimientoTelefono && inscripcion.telefono) || "",
        consentimientoTelefono: inscripcion.consentimientoTelefono,
        modalidad: inscripcion.modalidad,
        nota: inscripcion.nota ?? "",
      }
    : undefined;

  const listo = {
    onSuccess: () => {
      toast.success(t.panel.guardado);
      onCerrar();
    },
  };

  function enviar(datos: ValoresInscripcion) {
    if (tipo === "asignar" || !inscripcion || !inicial) {
      asignar.mutate({ turnoId: turno.id, ...datos }, listo);
      return;
    }
    const { consentimientoTelefono, ...resto } = datos;
    const cambios = Object.fromEntries(
      Object.entries(resto).filter(([campo, valor]) => valor !== inicial[campo as keyof typeof resto]),
    );
    editar.mutate(
      {
        id: inscripcion.id,
        ...cambios,
        ...(inicial.consentimientoTelefono && !consentimientoTelefono && { consentimientoTelefono: false as const }),
      },
      listo,
    );
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !mutacion.isPending && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-azul-profundo first-letter:uppercase">
            {t.panel.asignarTitulo(turno.companerismo, formatearFecha(turno.fecha))}
          </DialogTitle>
        </DialogHeader>
        <FormularioInscripcion
          className="p-0"
          inicial={inicial}
          notaParaCocinar={null}
          textoEnviar={t.panel.guardar}
          enviando={mutacion.isPending}
          errorEnvio={mutacion.error}
          onEnviar={enviar}
          // Ni al asignar ni al editar: el consentimiento solo lo da la persona.
          consentimientoSoloQuitar
        />
      </DialogContent>
    </Dialog>
  );
}

function DialogoQuitar({
  slug,
  turno,
  inscripcion,
  onCerrar,
}: {
  slug: string;
  turno: TurnoConNombre;
  inscripcion: Inscripcion;
  onCerrar: () => void;
}) {
  const { t, formatearFecha } = useIdioma();
  const quitar = useQuitarInscripcion(slug);
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !quitar.isPending && onCerrar()}>
      <DialogContent showCloseButton={false} className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-azul-profundo">{t.panel.quitarTitulo(inscripcion.nombre)}</DialogTitle>
          <DialogDescription className="text-[15px]">{t.panel.quitarTexto(formatearFecha(turno.fecha))}</DialogDescription>
        </DialogHeader>
        {quitar.isError && <AlertaError>{t.errores[codigoDe(quitar.error)]}</AlertaError>}
        <DialogFooter className="gap-2.5">
          <Button variant="accion-outline" disabled={quitar.isPending} onClick={onCerrar}>
            {t.panel.cancelar}
          </Button>
          <Button
            variant="destructive"
            className="rounded-full font-bold"
            disabled={quitar.isPending}
            onClick={() => quitar.mutate(inscripcion.id, { onSuccess: onCerrar })}
          >
            {quitar.isPending ? t.panel.quitando : t.panel.siQuitar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
