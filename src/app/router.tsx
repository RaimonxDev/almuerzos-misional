import { createBrowserRouter } from "react-router";
import { Inicio } from "./pantallas/Inicio";
import { Pendiente } from "./pantallas/Pendiente";
import { VistaPublica } from "./pantallas/VistaPublica";
import { Anotarse } from "./pantallas/Anotarse";

export const router = createBrowserRouter([
  { path: "/", element: <Inicio /> },
  { path: "/admin", element: <Pendiente nombre="Panel de administración" /> },
  { path: "/admin/:barrio/:periodo/imprimir", element: <Pendiente nombre="Calendario imprimible" /> },
  { path: "/:barrio", element: <VistaPublica /> },
  { path: "/:barrio/anotarse/:turnoId", element: <Anotarse /> },
  { path: "/:barrio/m/:token", element: <Pendiente nombre="Vista de misioneros" /> },
]);
