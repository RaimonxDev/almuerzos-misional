import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NuevaSolicitud } from "@/shared/solicitudes";
import type { EdicionInscripcion, NuevaInscripcionPublica } from "@/shared/inscripciones";
import { api, datos, ErrorApi, sinCuerpo } from "./api";
import { olvidarInscripcion, recordarInscripcion } from "./mis-inscripciones";

const barrios = api.api.barrios;
const inscripciones = api.api.inscripciones;

/**
 * Sesión de administración. Sin sesión la API responde 401 `NO_AUTORIZADO` y la consulta falla:
 * las rutas protegidas redirigen al login. No se guarda en caché al salir (datos de cuenta).
 */
export const useYo = () =>
  useQuery({
    queryKey: ["admin", "yo"],
    queryFn: () => datos(api.api.admin.yo.$get()),
    gcTime: 0,
  });

/** El token viaja en el header, nunca en la URL. */
const conToken = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const useBarrio = (slug: string) =>
  useQuery({
    queryKey: ["barrio", slug],
    queryFn: () => datos(barrios[":slug"].$get({ param: { slug } })),
  });

export const useMes = (slug: string, periodo: string | null) =>
  useQuery({
    queryKey: ["mes", slug, periodo],
    queryFn: () => datos(barrios[":slug"].meses[":periodo"].$get({ param: { slug, periodo: periodo! } })),
    enabled: periodo !== null,
  });

export const useTurno = (slug: string, turnoId: string) =>
  useQuery({
    queryKey: ["turno", slug, turnoId],
    queryFn: () => datos(barrios[":slug"].turnos[":turnoId"].$get({ param: { slug, turnoId } })),
  });

/** Calendario de misioneros: el token del enlace va en el header, no en la URL de la API. */
export const useMisioneros = (slug: string, token: string) =>
  useQuery({
    queryKey: ["misioneros", slug, token],
    queryFn: () => datos(barrios[":slug"].misioneros.$get({ param: { slug } }, conToken(token))),
  });

export const useMesMisioneros = (slug: string, token: string, periodo: string) =>
  useQuery({
    queryKey: ["misioneros", slug, token, periodo],
    queryFn: () =>
      datos(barrios[":slug"].misioneros.meses[":periodo"].$get({ param: { slug, periodo } }, conToken(token))),
  });

export function useAnotarse(slug: string, turnoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: NuevaInscripcionPublica) =>
      datos(barrios[":slug"].turnos[":turnoId"].inscripcion.$post({ param: { slug, turnoId }, json })),
    onSuccess: ({ inscripcion, tokenEdicion }) => {
      recordarInscripcion({
        id: inscripcion.id,
        turnoId: inscripcion.turnoId,
        barrio: slug,
        fecha: inscripcion.fecha,
        companerismo: inscripcion.companerismoNombre,
        tokenEdicion,
      });
    },
    // Con éxito o con 409, la lista del mes cambió.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["mes", slug] });
      queryClient.invalidateQueries({ queryKey: ["turno", slug, turnoId] });
    },
  });
}

/**
 * "Mi turno". Un 404 (la inscripción ya no existe, ej. la presidenta la quitó) o un 403
 * (el token guardado no sirve) dejan la entrada de localStorage sin uso: se olvida.
 */
export const useMiInscripcion = (id: string, token: string | undefined) =>
  useQuery({
    queryKey: ["mi-inscripcion", id],
    queryFn: async () => {
      try {
        return await datos(inscripciones[":id"].$get({ param: { id } }, conToken(token!)));
      } catch (error) {
        if (error instanceof ErrorApi && (error.codigo === "NO_ENCONTRADO" || error.codigo === "TOKEN_INVALIDO")) {
          olvidarInscripcion(id);
        }
        throw error;
      }
    },
    enabled: !!token,
    // Trae datos privados (teléfono, nota): no se guardan en caché al salir de la pantalla.
    // También evita mostrar una inscripción ya cancelada si se vuelve a su link.
    gcTime: 0,
  });

export function useEditarInscripcion(id: string, token: string, slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: EdicionInscripcion) =>
      datos(inscripciones[":id"].$patch({ param: { id }, json }, conToken(token))),
    onSuccess: (respuesta) => {
      queryClient.setQueryData(["mi-inscripcion", id], respuesta);
      // El nombre aparece en la vista pública.
      queryClient.invalidateQueries({ queryKey: ["mes", slug] });
    },
  });
}

export function useCancelarInscripcion(id: string, token: string, slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sinCuerpo(inscripciones[":id"].$delete({ param: { id } }, conToken(token))),
    // No se quita la consulta de "Mi turno" aquí: la pantalla sigue montada hasta navegar y la
    // volvería a pedir (404). Con gcTime 0 se descarta sola al salir.
    onSuccess: () => {
      olvidarInscripcion(id);
      queryClient.invalidateQueries({ queryKey: ["mes", slug] });
      queryClient.invalidateQueries({ queryKey: ["turno", slug] });
    },
  });
}

/** Pedir acceso para un barrio (público, con Turnstile). */
export const useSolicitarAcceso = () =>
  useMutation({
    mutationFn: (json: NuevaSolicitud) => datos(api.api.solicitudes.$post({ json })),
  });
