import { RutaAdmin } from "@/app/components/RutaAdmin";
import { Pendiente } from "@/app/pantallas/Pendiente";

/** `/admin/:barrio/:periodo/imprimir` — calendario imprimible (hito 7). */
export function Imprimir() {
  return (
    <RutaAdmin>
      <Pendiente nombre="Calendario imprimible" />
    </RutaAdmin>
  );
}
