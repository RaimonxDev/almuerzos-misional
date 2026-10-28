import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EdicionInscripcion, NuevaInscripcionPublica } from "@/shared/inscripciones";
import { api, datos, sinCuerpo } from "./api";

/**
 * Consultas del panel de la presidenta. Viven aparte de `consultas.ts` para que solo las cargue
 * el panel. Todas las claves empiezan con "admin": al salir se borran juntas.
 */
const barrios = api.api.admin.barrios;

export type EstadoMes = "borrador" | "abierto" | "cerrado";

const claves = {
  barrio: (slug: string) => ["admin", "barrio", slug],
  meses: (slug: string) => ["admin", "meses", slug],
  mes: (slug: string, periodo: string) => ["admin", "mes", slug, periodo],
};

/** Datos del barrio, con el token de misioneros y todos los compañerismos. */
export const useBarrioAdmin = (slug: string) =>
  useQuery({
    queryKey: claves.barrio(slug),
    queryFn: () => datos(barrios[":slug"].$get({ param: { slug } })),
  });

/** Meses del barrio en cualquier estado, con conteos. */
export const useMesesAdmin = (slug: string) =>
  useQuery({
    queryKey: claves.meses(slug),
    queryFn: () => datos(barrios[":slug"].meses.$get({ param: { slug } })),
  });

/** Mes completo: turnos con su inscripción (teléfono solo con consentimiento). */
export const useMesAdmin = (slug: string, periodo: string | null) =>
  useQuery({
    queryKey: claves.mes(slug, periodo ?? ""),
    queryFn: () => datos(barrios[":slug"].meses[":periodo"].$get({ param: { slug, periodo: periodo! } })),
    enabled: periodo !== null,
  });

type Consulta = keyof typeof claves;

/** Lo que cambian los turnos: el mes y los conteos de la lista de meses. */
const TURNOS: Consulta[] = ["meses", "mes"];

/** Vuelve a pedir esas consultas del barrio (`mes`: todos los meses que estén en caché). */
const invalidar = (queryClient: QueryClient, slug: string, consultas: Consulta[]) =>
  queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === "admin" && queryKey[2] === slug && consultas.includes(queryKey[1] as Consulta),
  });

/** Una mutación del panel que, con éxito o error, refresca solo las consultas que afecta. */
function useMutacionBarrio<V, R>(
  slug: string,
  mutationFn: (variables: V) => Promise<R>,
  consultas: Consulta[] = TURNOS,
) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => invalidar(queryClient, slug, consultas) });
}

export function useCrearMes(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (periodo: string) => datos(barrios[":slug"].meses.$post({ param: { slug }, json: { periodo } })),
    // El mes nuevo entra a la lista antes de navegar a él (el panel ignora un ?mes= que no está).
    onSuccess: ({ mes }) => {
      if (!mes) return;
      queryClient.setQueryData(claves.meses(slug), (actual: { meses: (typeof mes)[] } | undefined) =>
        actual && { meses: [...actual.meses, mes] },
      );
    },
    onSettled: () => invalidar(queryClient, slug, ["meses"]),
  });
}

export function useCambiarEstado(slug: string, periodo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (estado: EstadoMes) =>
      datos(barrios[":slug"].meses[":periodo"].$patch({ param: { slug, periodo }, json: { estado } })),
    // El estado nuevo se ve al instante; el resto se vuelve a pedir.
    onSuccess: ({ mes }) => {
      if (!mes) return;
      queryClient.setQueryData(claves.mes(slug, periodo), (actual: { mes: object } | undefined) =>
        actual && { ...actual, mes: { ...actual.mes, estado: mes.estado } },
      );
    },
    onSettled: () => invalidar(queryClient, slug, TURNOS),
  });
}

type Bloqueo = { bloqueado: boolean; motivo?: string };

export const useBloquearTurno = (slug: string) =>
  useMutacionBarrio(slug, ({ turnoId, ...json }: Bloqueo & { turnoId: string }) =>
    datos(barrios[":slug"].turnos[":turnoId"].$patch({ param: { slug, turnoId }, json })),
  );

export const useBloquearDia = (slug: string) =>
  useMutacionBarrio(slug, ({ fecha, ...json }: Bloqueo & { fecha: string }) =>
    datos(barrios[":slug"].dias[":fecha"].$patch({ param: { slug, fecha }, json })),
  );

export const useAsignar = (slug: string) =>
  useMutacionBarrio(slug, ({ turnoId, ...json }: NuevaInscripcionPublica & { turnoId: string }) =>
    datos(barrios[":slug"].turnos[":turnoId"].inscripcion.$post({ param: { slug, turnoId }, json })),
  );

export const useEditarInscripcionAdmin = (slug: string) =>
  useMutacionBarrio(
    slug,
    ({ id, ...json }: Omit<EdicionInscripcion, "consentimientoTelefono"> & { id: string; consentimientoTelefono?: false }) =>
      datos(barrios[":slug"].inscripciones[":id"].$patch({ param: { slug, id }, json })),
  );

export const useQuitarInscripcion = (slug: string) =>
  useMutacionBarrio(slug, (id: string) => sinCuerpo(barrios[":slug"].inscripciones[":id"].$delete({ param: { slug, id } })));

export function useRegenerarToken(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => datos(barrios[":slug"]["token-misioneros"].$post({ param: { slug } })),
    onSuccess: ({ tokenMisioneros }) =>
      queryClient.setQueryData(claves.barrio(slug), (actual: { barrio: object } | undefined) =>
        actual && { ...actual, barrio: { ...actual.barrio, tokenMisioneros } },
      ),
  });
}

export const useEditarBarrio = (slug: string) =>
  useMutacionBarrio(
    slug,
    (json: { notaParaCocinar: string | null }) => datos(barrios[":slug"].$patch({ param: { slug }, json })),
    ["barrio"],
  );

export const useEditarCompanerismo = (slug: string) =>
  useMutacionBarrio(slug, ({ id, activo }: { id: string; activo: boolean }) =>
    datos(barrios[":slug"].companerismos[":id"].$patch({ param: { slug, id }, json: { activo } })),
    // Reactivar genera turnos: cambian también los meses.
    ["barrio", "meses", "mes"],
  );
