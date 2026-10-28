import { createBrowserRouter } from "react-router";
import { Inicio } from "./pantallas/Inicio";
import { Pendiente } from "./pantallas/Pendiente";

export const router = createBrowserRouter([
  { path: "/", element: <Inicio /> },
  { path: "/admin", element: <Pendiente nombre="Panel de administración" /> },
  { path: "/admin/:barrio/:periodo/imprimir", element: <Pendiente nombre="Calendario imprimible" /> },
  { path: "/:barrio", element: <Pendiente nombre="Vista pública" /> },
  { path: "/:barrio/anotarse/:turnoId", element: <Pendiente nombre="Formulario de inscripción" /> },
  { path: "/:barrio/m/:token", element: <Pendiente nombre="Vista de misioneros" /> },
]);
