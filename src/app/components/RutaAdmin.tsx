import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useYo } from "@/app/consultas";
import { codigoDe } from "@/app/api";
import { Cargando, ErrorCarga } from "./Estado";

export const RUTA_CUENTA = "/admin/cuenta";

/**
 * Protege las rutas de admin: sin sesión (401) redirige al login; mientras resuelve, "Cargando".
 * Quien entró con una contraseña temporal (`debeCambiarPassword`) va a `/admin/cuenta` hasta cambiarla.
 */
export function RutaAdmin({ children }: { children: ReactNode }) {
  const yo = useYo();
  const { pathname } = useLocation();
  if (yo.isError) {
    return codigoDe(yo.error) === "NO_AUTORIZADO" ? (
      <Navigate to="/admin/login" replace />
    ) : (
      <ErrorCarga error={yo.error} reintentar={yo.refetch} />
    );
  }
  if (!yo.data) return <Cargando />;
  if (yo.data.usuario.debeCambiarPassword && pathname !== RUTA_CUENTA) return <Navigate to={RUTA_CUENTA} replace />;
  return children;
}
