import type { RouteObject } from "react-router";
import { Inicio } from "./pantallas/Inicio";
import { VistaPublica } from "./pantallas/VistaPublica";
import { Anotarse } from "./pantallas/Anotarse";
import { MiTurnoRuta } from "./pantallas/MiTurno";
import { VistaMisioneros } from "./pantallas/VistaMisioneros";

/**
 * Lo de admin se carga aparte (`lazy`): las hermanas y los misioneros no descargan el panel
 * ni el cliente de Better Auth.
 */
const panel = () => import("./pantallas/admin/Panel").then((m) => ({ Component: m.PanelRuta }));

export const rutas: RouteObject[] = [
  { path: "/", element: <Inicio /> },
  { path: "/admin/login", lazy: () => import("./pantallas/Login").then((m) => ({ Component: m.Login })) },
  { path: "/admin", lazy: panel },
  {
    path: "/admin/nuevo-barrio",
    lazy: () => import("./pantallas/admin/NuevoBarrio").then((m) => ({ Component: m.NuevoBarrioRuta })),
  },
  { path: "/admin/:barrio", lazy: panel },
  {
    path: "/admin/:barrio/:periodo/imprimir",
    lazy: () => import("./pantallas/admin/Imprimir").then((m) => ({ Component: m.Imprimir })),
  },
  { path: "/:barrio", element: <VistaPublica /> },
  { path: "/:barrio/anotarse/:turnoId", element: <Anotarse /> },
  { path: "/:barrio/mi-turno/:inscripcionId", element: <MiTurnoRuta /> },
  { path: "/:barrio/m/:token", element: <VistaMisioneros /> },
];
