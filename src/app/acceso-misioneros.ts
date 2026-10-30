import { useState } from "react";
import { borrarLocal, guardarLocal, leerLocal } from "./almacen";

/**
 * El token de misioneros de este teléfono, por barrio: se consigue una vez con el código y la API
 * lo rechaza (404) cuando la presidenta cambia el código. Nunca va en la URL.
 */
const clave = (slug: string) => `almuerzo-misional:misioneros:${slug}`;

export function useTokenMisioneros(slug: string) {
  const [token, setToken] = useState(() => leerLocal(clave(slug)));
  const guardar = (nuevo: string) => {
    guardarLocal(clave(slug), nuevo);
    setToken(nuevo);
  };
  const olvidar = () => {
    borrarLocal(clave(slug));
    setToken(null);
  };
  return { token, guardar, olvidar };
}
