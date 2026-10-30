import { useRef } from "react";
import { Link, useParams } from "react-router";
import { useYo } from "@/app/consultas";
import { useAprobarSolicitud, useSolicitudes } from "@/app/consultas-admin";
import { useTitulo } from "@/app/hooks";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { Aviso, Cargando, ErrorCarga } from "@/app/components/Estado";
import { buttonVariants } from "@/app/components/ui/button";
import { EncabezadoAdmin } from "./EncabezadoAdmin";
import { FormularioBarrio, type ValoresBarrio } from "./FormularioBarrio";

/** `/admin/solicitudes/:id/aprobar` — el formulario de "Nuevo barrio" ya lleno con la solicitud. */
export function AprobarSolicitudRuta() {
  return (
    <RutaAdmin>
      <AprobarSolicitud />
    </RutaAdmin>
  );
}

function AprobarSolicitud() {
  const { t } = useIdioma();
  const { usuario } = useYo().data!;
  useTitulo(t.solicitudes.aprobarTitulo);

  if (!usuario.superAdmin) {
    return (
      <>
        <EncabezadoAdmin />
        <Aviso>{t.errores.SIN_PERMISO}</Aviso>
      </>
    );
  }
  return <Cargada />;
}

function Cargada() {
  const { t } = useIdioma();
  const { id = "" } = useParams();
  const consulta = useSolicitudes("pendiente");
  // Al aprobar, la lista de pendientes se refresca y la solicitud sale de ella: se conserva la
  // primera que se vio para que el formulario (y el diálogo de la cuenta) no desaparezca.
  const vista = useRef<NonNullable<typeof consulta.data>["solicitudes"][number] | null>(null);
  vista.current ??= consulta.data?.solicitudes.find((s) => s.id === id) ?? null;
  const solicitud = vista.current;
  const aprobar = useAprobarSolicitud(id);

  if (!solicitud) {
    if (consulta.isPending) return <><EncabezadoAdmin /><Cargando /></>;
    return (
      <>
        <EncabezadoAdmin />
        {consulta.isError ? (
          <ErrorCarga error={consulta.error} reintentar={consulta.refetch} />
        ) : (
          <Aviso
            accion={
              <Link to="/admin/solicitudes" className={cn(buttonVariants({ variant: "accion-outline" }))}>
                {t.solicitudes.volverSolicitudes}
              </Link>
            }
          >
            {t.solicitudes.noEncontrada}
          </Aviso>
        )}
      </>
    );
  }

  const valores: Partial<ValoresBarrio> = {
    nombre: solicitud.barrio,
    idioma: solicitud.idioma,
    zonaHoraria: solicitud.zonaHoraria,
    tipos: solicitud.companerismos,
    correoPresidenta: solicitud.email,
    nombrePresidenta: solicitud.nombre,
  };
  return (
    <FormularioBarrio
      titulo={t.solicitudes.aprobarTitulo}
      intro={t.solicitudes.aprobarIntro(solicitud.nombre)}
      valoresIniciales={valores}
      mutacion={aprobar}
      textoEnviar={t.solicitudes.aprobarEnviar}
      rutaVolver="/admin/solicitudes"
      textoVolver={t.solicitudes.volverSolicitudes}
    />
  );
}
