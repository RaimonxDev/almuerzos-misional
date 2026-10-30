import { useState } from "react";
import { Link } from "react-router";
import { MailIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import { useYo } from "@/app/consultas";
import { type EstadoSolicitud, useRechazarSolicitud, useSolicitudes } from "@/app/consultas-admin";
import { useTitulo } from "@/app/hooks";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { hoyEnZona, zonaDelNavegador } from "@/shared/fechas";
import { enlaceWhatsApp } from "@/shared/telefonos";
import { MOTIVO_RECHAZO_MAX } from "@/shared/solicitudes";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { AlertaError, Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Label } from "@/app/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Textarea } from "@/app/components/ui/textarea";
import { EncabezadoAdmin } from "./EncabezadoAdmin";

const ESTADOS: EstadoSolicitud[] = ["pendiente", "aprobada", "rechazada"];

/** `/admin/solicitudes` — solo el super admin revisa las solicitudes de acceso. */
export function SolicitudesRuta() {
  return (
    <RutaAdmin>
      <Solicitudes />
    </RutaAdmin>
  );
}

function Solicitudes() {
  const { t } = useIdioma();
  const { usuario } = useYo().data!;
  useTitulo(t.solicitudes.titulo);

  if (!usuario.superAdmin) {
    return (
      <>
        <EncabezadoAdmin />
        <Aviso>{t.errores.SIN_PERMISO}</Aviso>
      </>
    );
  }
  return <Pantalla />;
}

function Pantalla() {
  const { t } = useIdioma();
  const s = t.solicitudes;
  const [estado, setEstado] = useState<EstadoSolicitud>("pendiente");
  const consulta = useSolicitudes(estado);
  // La cantidad pendiente sale siempre de la consulta de pendientes (la del encabezado).
  const pendientes = useSolicitudes("pendiente").data?.pendientes ?? 0;
  const [aRechazar, setARechazar] = useState<Solicitud | null>(null);
  const nombres = { pendiente: s.pendientes, aprobada: s.aprobadas, rechazada: s.rechazadas };
  const vacio = { pendiente: s.vacioPendientes, aprobada: s.vacioAprobadas, rechazada: s.vacioRechazadas };

  return (
    <>
      <EncabezadoAdmin />
      <main className="mx-auto flex max-w-[860px] flex-col gap-5 px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[26px] font-semibold text-azul-profundo">{s.titulo}</h1>
          <p className="text-muted-foreground">{s.intro}</p>
        </div>

        <Tabs value={estado} onValueChange={(v) => setEstado(v as EstadoSolicitud)}>
          <TabsList className="w-full sm:w-fit">
            {ESTADOS.map((e) => (
              <TabsTrigger key={e} value={e} className="px-4">
                {nombres[e]}
                {e === "pendiente" && pendientes > 0 ? ` (${pendientes})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} reintentar={consulta.refetch} />
        ) : consulta.data.solicitudes.length === 0 ? (
          <Aviso>{vacio[estado]}</Aviso>
        ) : (
          <ul className="flex flex-col gap-3">
            {consulta.data.solicitudes.map((sol) => (
              <li key={sol.id}>
                <TarjetaSolicitud solicitud={sol} alRechazar={() => setARechazar(sol)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {aRechazar && <DialogoRechazo solicitud={aRechazar} alCerrar={() => setARechazar(null)} />}
    </>
  );
}

type Solicitud = NonNullable<ReturnType<typeof useSolicitudes>["data"]>["solicitudes"][number];

/** Día en que llegó, en la zona de quien mira (no en UTC: de noche en América sería el día siguiente). */
const fechaIso = (v: string | number) => hoyEnZona(zonaDelNavegador(), new Date(v));

/** Una solicitud: en móvil y escritorio es una tarjeta apilada (pocas solicitudes, mucho texto). */
function TarjetaSolicitud({ solicitud: sol, alRechazar }: { solicitud: Solicitud; alRechazar: () => void }) {
  const { t, formatearFecha } = useIdioma();
  const s = t.solicitudes;
  const whatsapp = enlaceWhatsApp(sol.telefono, sol.zonaHoraria);
  const enlace = "inline-flex min-h-11 items-center gap-1.5 font-semibold text-azul-medio underline-offset-2 hover:underline";

  return (
    <article className="flex flex-col gap-3 rounded-[14px] border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-serif text-xl font-semibold text-azul-profundo">{sol.barrio}</h2>
        <p className="text-sm text-muted-foreground">
          {[sol.estaca ? s.estaca(sol.estaca) : null, s.ubicacion(sol.ciudad, sol.pais)].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm text-muted-foreground">
          {s.solicitadaEl(formatearFecha(fechaIso(sol.creadoEn), { day: "numeric", month: "long", year: "numeric" }))}
        </p>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="font-bold">{sol.nombre}</p>
        <div className="flex flex-wrap gap-x-4">
          <a href={`mailto:${sol.email}`} className={enlace}>
            <MailIcon className="size-4" aria-hidden="true" />
            {sol.email}
          </a>
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className={enlace} aria-label={`${s.escribirWhatsApp}: ${sol.telefono}`}>
              <MessageCircleIcon className="size-4" aria-hidden="true" />
              {sol.telefono}
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center">{sol.telefono}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {sol.companerismos.map((c) => (c === "elderes" ? t.panel.tipoElderes : t.panel.tipoHermanas)).join(" · ")}
        </p>
      </div>

      {sol.mensaje && (
        <div className="rounded-[10px] bg-cielo-claro px-3 py-2.5">
          <p className="text-xs font-extrabold tracking-wide text-azul-medio uppercase">{s.mensaje}</p>
          <p className="whitespace-pre-wrap">{sol.mensaje}</p>
        </div>
      )}

      {sol.estado === "pendiente" && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={alRechazar} className="rounded-[10px] font-bold">
            {s.rechazar}
          </Button>
          <Link
            to={`/admin/solicitudes/${sol.id}/aprobar`}
            className={cn(buttonVariants(), "rounded-[10px] font-bold")}
          >
            {s.aprobar}
          </Link>
        </div>
      )}
      {sol.estado === "aprobada" && sol.barrioSlug && (
        <Link to={`/admin/${sol.barrioSlug}`} className={cn(enlace, "self-start")}>
          {s.verPanel}
        </Link>
      )}
      {sol.estado === "rechazada" && (
        <p className="text-sm">
          <span className="font-bold">{s.motivo}: </span>
          {sol.motivoRechazo ?? s.sinMotivo}
        </p>
      )}
    </article>
  );
}

function DialogoRechazo({ solicitud, alCerrar }: { solicitud: Solicitud; alCerrar: () => void }) {
  const { t } = useIdioma();
  const s = t.solicitudes;
  const rechazar = useRechazarSolicitud();
  const [motivo, setMotivo] = useState("");

  const enviar = () =>
    rechazar.mutate(
      { id: solicitud.id, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(s.rechazada);
          alCerrar();
        },
      },
    );

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{s.rechazarTitulo(solicitud.barrio)}</DialogTitle>
          <DialogDescription>{s.rechazarTexto}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motivo-rechazo">{s.motivoLabel}</Label>
          <Textarea
            id="motivo-rechazo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MOTIVO_RECHAZO_MAX}
            rows={4}
            className="rounded-[10px]"
          />
        </div>
        {rechazar.isError && <AlertaError>{t.errores[codigoDe(rechazar.error)]}</AlertaError>}
        <DialogFooter>
          <Button variant="ghost" onClick={alCerrar}>
            {s.cancelar}
          </Button>
          <Button onClick={enviar} disabled={rechazar.isPending}>
            {s.confirmarRechazo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
