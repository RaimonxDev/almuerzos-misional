import { createBrowserRouter } from "react-router";
import { Inicio } from "./pantallas/Inicio";
import { Pendiente } from "./pantallas/Pendiente";
import { VistaPublica } from "./pantallas/VistaPublica";
import { Login } from "./pantallas/Login";
import { RutaAdmin } from "./components/RutaAdmin";
import { Anotarse } from "./pantallas/Anotarse";
import { MiTurnoRuta } from "./pantallas/MiTurno";
import { VistaMisioneros } from "./pantallas/VistaMisioneros";

export const router = createBrowserRouter([
  { path: "/", element: <Inicio /> },
  { path: "/admin/login", element: <Login /> },
  {
    path: "/admin",
    element: (
      <RutaAdmin>
        <Pendiente nombre="Panel de administración" />
      </RutaAdmin>
    ),
  },
  {
    path: "/admin/:barrio/:periodo/imprimir",
    element: (
      <RutaAdmin>
        <Pendiente nombre="Calendario imprimible" />
      </RutaAdmin>
    ),
  },
  { path: "/:barrio", element: <VistaPublica /> },
  { path: "/:barrio/anotarse/:turnoId", element: <Anotarse /> },
  { path: "/:barrio/mi-turno/:inscripcionId", element: <MiTurnoRuta /> },
  { path: "/:barrio/m/:token", element: <VistaMisioneros /> },
]);
