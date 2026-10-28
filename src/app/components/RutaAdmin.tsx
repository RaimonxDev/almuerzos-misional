import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useYo } from "@/app/consultas";
import { codigoDe } from "@/app/api";
import { Cargando, ErrorCarga } from "./Estado";

/** Protege las rutas de admin: sin sesión (401) redirige al login; mientras resuelve, "Cargando". */
export function RutaAdmin({ children }: { children: ReactNode }) {
  const yo = useYo();
  if (yo.isError) {
    return codigoDe(yo.error) === "NO_AUTORIZADO" ? (
      <Navigate to="/admin/login" replace />
    ) : (
      <ErrorCarga error={yo.error} reintentar={yo.refetch} />
    );
  }
  if (!yo.data) return <Cargando />;
  return children;
}
