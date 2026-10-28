import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NuevaInscripcionPublica } from "@/shared/inscripciones";
import { api, datos } from "./api";
import { recordarInscripcion } from "./mis-inscripciones";

const barrios = api.api.barrios;

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
