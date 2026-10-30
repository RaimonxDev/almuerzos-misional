import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Idioma } from "@/shared/idiomas";
import type { EdicionInscripcion, NuevaInscripcionPublica } from "@/shared/inscripciones";
import { api, codigoDe, datos, sinCuerpo } from "./api";

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
  admins: (slug: string) => ["admin", "admins", slug],
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

export function useCambiarCodigoMisioneros(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => datos(barrios[":slug"]["codigo-misioneros"].$post({ param: { slug } })),
    onSuccess: ({ codigoMisioneros }) =>
      queryClient.setQueryData(claves.barrio(slug), (actual: { barrio: object } | undefined) =>
        actual && { ...actual, barrio: { ...actual.barrio, codigoMisioneros } },
      ),
  });
}

/**
 * Cambia el enlace público por uno con código; quien la llama lleva al panel con el nuevo. Lo
 * guardado con el enlace viejo no se borra aquí: el panel lo sigue mostrando hasta navegar (si no,
 * se desmontaría antes) y después la caché lo descarta sola.
 */
export function useCambiarEnlace(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (base: string) => datos(barrios[":slug"].enlace.$post({ param: { slug }, json: { slug: base } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "yo"] }),
  });
}

/** Campos editables del barrio; solo se mandan los que cambian. */
export type CambiosBarrio = Partial<{
  nombre: string;
  notaParaCocinar: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  idioma: Idioma;
  zonaHoraria: string;
}>;

export function useEditarBarrio(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: CambiosBarrio) => datos(barrios[":slug"].$patch({ param: { slug }, json })),
    // El formulario muestra lo guardado apenas responde la API, sin esperar a la recarga.
    onSuccess: ({ barrio }) =>
      queryClient.setQueryData(claves.barrio(slug), (actual: { barrio: typeof barrio } | undefined) => actual && { ...actual, barrio }),
    onSettled: (_r, _e, json) => {
      invalidar(queryClient, slug, ["barrio"]);
      // El nombre también sale en el selector de barrios del encabezado.
      if (json.nombre !== undefined) queryClient.invalidateQueries({ queryKey: ["admin", "yo"] });
    },
  });
}

export const useEditarCompanerismo = (slug: string) =>
  useMutacionBarrio(slug, ({ id, activo }: { id: string; activo: boolean }) =>
    datos(barrios[":slug"].companerismos[":id"].$patch({ param: { slug, id }, json: { activo } })),
    // Reactivar genera turnos: cambian también los meses.
    ["barrio", "meses", "mes"],
  );

export type NuevoBarrio = {
  nombre: string;
  slug: string;
  idioma: Idioma;
  zonaHoraria: string;
  companerismos: { tipo: TipoCompanerismo; nombre: string }[];
  presidenta?: { email: string; nombre: string; cargo?: string | null };
};

/** Solo super admin. Al crear, `yo` cambia (el super admin ve todos los barrios). */
export function useCrearBarrio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: NuevoBarrio) => datos(barrios.$post({ json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "yo"] }),
  });
}

export type TipoCompanerismo = "elderes" | "hermanas";

export const useCrearCompanerismo = (slug: string) =>
  useMutacionBarrio(slug, (json: { tipo: TipoCompanerismo; nombre: string }) =>
    datos(barrios[":slug"].companerismos.$post({ param: { slug }, json })),
    // Crear genera sus turnos en los meses vigentes.
    ["barrio", "meses", "mes"],
  );

/** Cambios parciales a la personalización del mes; un texto vacío borra el campo. */
export const useGuardarPersonalizacion = (slug: string, periodo: string) =>
  useMutacionBarrio(
    slug,
    (json: { escritura?: string; escrituraRef?: string; mensaje?: string; plantilla?: "azul" | "dorado" | "cielo" }) =>
      datos(barrios[":slug"].meses[":periodo"].personalizacion.$patch({ param: { slug, periodo }, json })),
    ["mes"],
  );

/** Sube la imagen del mes: el cuerpo es el archivo crudo, con su `Content-Type`. */
export const useSubirImagen = (slug: string, periodo: string) =>
  useMutacionBarrio(
    slug,
    (archivo: File) =>
      datos(
        barrios[":slug"].meses[":periodo"].imagen.$put(
          { param: { slug, periodo } },
          { init: { body: archivo, headers: { "Content-Type": archivo.type } } },
        ),
      ),
    ["mes"],
  );

export const useQuitarImagen = (slug: string, periodo: string) =>
  useMutacionBarrio(
    slug,
    () => sinCuerpo(barrios[":slug"].meses[":periodo"].imagen.$delete({ param: { slug, periodo } })),
    ["mes"],
  );

/** Admins del barrio, con si les falta crear la contraseña. Solo para el super admin. */
export const useAdminsBarrio = (slug: string) =>
  useQuery({
    queryKey: claves.admins(slug),
    queryFn: () => datos(barrios[":slug"].admins.$get({ param: { slug } })),
  });

/** Reenvía la bienvenida (o el aviso de asignación) → `{ correoEnviado }`. */
export const useReenviarInvitacion = (slug: string) =>
  useMutacionBarrio(
    slug,
    (userId: string) => datos(barrios[":slug"].admins[":userId"].invitacion.$post({ param: { slug, userId } })),
    ["admins"],
  );

/** Corrige el correo de quien aún no crea su contraseña y le reenvía la invitación → `{ admin, correoEnviado }`. */
export const useCorregirCorreoAdmin = (slug: string) =>
  useMutacionBarrio(
    slug,
    ({ userId, email }: { userId: string; email: string }) =>
      datos(barrios[":slug"].admins[":userId"].$patch({ param: { slug, userId }, json: { email } })),
    ["admins"],
  );

/** Otra contraseña temporal para quien aún no crea la suya → `{ email, passwordTemporal }` (solo esta vez). */
export const useNuevaPasswordTemporal = (slug: string) =>
  useMutacionBarrio(
    slug,
    (userId: string) => datos(barrios[":slug"].admins[":userId"]["password-temporal"].$post({ param: { slug, userId } })),
    ["admins"],
  );

/** La eliminación pedida se ve en el panel y en la lista del super admin. */
function useMutacionEliminacion<V, R>(slug: string, mutationFn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      invalidar(queryClient, slug, ["barrio"]);
      return queryClient.invalidateQueries({ queryKey: ["admin", "solicitudes"] });
    },
  });
}

export const useSolicitarEliminacion = (slug: string) =>
  useMutacionEliminacion(slug, (motivo: string | undefined) =>
    datos(barrios[":slug"]["solicitud-eliminacion"].$post({ param: { slug }, json: { motivo } })),
  );

export const useRetirarEliminacion = (slug: string) =>
  useMutacionEliminacion(slug, () => datos(barrios[":slug"]["solicitud-eliminacion"].$delete({ param: { slug } })));

/** Lo que se pierde al borrar el barrio. Solo super admin. */
export const useResumenEliminacion = (slug: string) =>
  useQuery({
    queryKey: ["admin", "resumenEliminacion", slug],
    queryFn: () => datos(barrios[":slug"]["resumen-eliminacion"].$get({ param: { slug } })),
    gcTime: 0,
  });

/**
 * Borra el barrio. Lo saca de `yo` antes de que quien la llama navegue a `/admin`, que lleva al
 * primero de la lista; las consultas del barrio no se refrescan porque ya darían 404. Un 404 también
 * lo saca: el borrado anterior llegó aunque se perdiera la respuesta, o cambió de enlace (`yo` se
 * vuelve a pedir). `PEDIDO_CAMBIO` trae el pedido vigente al panel.
 */
export function useEliminarBarrio(slug: string) {
  const queryClient = useQueryClient();
  const sacarDeLaLista = () => {
    queryClient.setQueryData(["admin", "yo"], (yo: { barrios: { slug: string }[] } | undefined) =>
      yo && { ...yo, barrios: yo.barrios.filter((b) => b.slug !== slug) },
    );
    queryClient.invalidateQueries({ queryKey: ["admin", "solicitudes"] });
  };
  return useMutation({
    mutationFn: (json: { confirmacion: string; pedidoVisto: string | null }) =>
      datos(barrios[":slug"].$delete({ param: { slug }, json })),
    onSuccess: sacarDeLaLista,
    onError: (error) => {
      if (codigoDe(error) === "NO_ENCONTRADO") sacarDeLaLista();
      if (codigoDe(error) === "PEDIDO_CAMBIO") invalidar(queryClient, slug, ["barrio"]);
    },
  });
}

const solicitudes = api.api.admin.solicitudes;

export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

/** Solicitudes de acceso por estado, con la cantidad de pendientes. Solo super admin. */
export const useSolicitudes = (estado: EstadoSolicitud, habilitada = true) =>
  useQuery({
    queryKey: ["admin", "solicitudes", estado],
    queryFn: () => datos(solicitudes.$get({ query: { estado } })),
    enabled: habilitada,
  });

/** Aprobar crea el barrio: cambian las solicitudes y `yo` (el super admin ve todos los barrios). */
export function useAprobarSolicitud(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: NuevoBarrio) => datos(solicitudes[":id"].aprobar.$post({ param: { id }, json })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "yo"] });
      return queryClient.invalidateQueries({ queryKey: ["admin", "solicitudes"] });
    },
  });
}

export function useRechazarSolicitud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      datos(solicitudes[":id"].rechazar.$post({ param: { id }, json: { motivo } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "solicitudes"] }),
  });
}
