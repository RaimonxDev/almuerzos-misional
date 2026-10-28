import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EdicionInscripcion, NuevaInscripcionPublica } from "@/shared/inscripciones";
import { api, datos, ErrorApi } from "./api";
import { olvidarInscripcion, recordarInscripcion } from "./mis-inscripciones";

const barrios = api.api.barrios;
const inscripciones = api.api.inscripciones;

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
 * "Mi turno". Un 404 significa que la inscripción ya no existe (ej. la presidenta la quitó):
 * se olvida el token guardado para no seguir mostrándola.
 */
export const useMiInscripcion = (id: string, token: string | undefined) =>
  useQuery({
    queryKey: ["mi-inscripcion", id],
    queryFn: async () => {
      try {
        return await datos(inscripciones[":id"].$get({ param: { id } }, conToken(token!)));
      } catch (error) {
        if (error instanceof ErrorApi && error.codigo === "NO_ENCONTRADO") olvidarInscripcion(id);
        throw error;
      }
    },
    enabled: !!token,
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
    mutationFn: async () => {
      const res = await inscripciones[":id"].$delete({ param: { id } }, conToken(token));
      // 204 no trae cuerpo: solo los errores pasan por datos().
      if (!res.ok) await datos(Promise.resolve(res));
    },
    onSuccess: () => {
      olvidarInscripcion(id);
      queryClient.removeQueries({ queryKey: ["mi-inscripcion", id] });
      queryClient.invalidateQueries({ queryKey: ["mes", slug] });
      queryClient.invalidateQueries({ queryKey: ["turno", slug] });
    },
  });
}
