/**
 * `localStorage` sin lanzar: en modo privado o con el storage bloqueado se lee `null`
 * y escribir no hace nada. Para preferencias de este navegador, que son una comodidad.
 */
export function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function borrarLocal(clave: string) {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Sin storage no había nada guardado.
  }
}

export function guardarLocal(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin storage: el cambio dura solo esta visita.
  }
}
