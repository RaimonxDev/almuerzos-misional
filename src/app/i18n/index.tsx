import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { esIdioma, IDIOMAS, type Idioma } from "@/shared/idiomas";
import { es, type Mensajes } from "./es";
import { pt } from "./pt";
import { en } from "./en";

const DICCIONARIOS: Record<Idioma, Mensajes> = { es, pt, en };

/** Para el locale de `Intl` (fechas, números). */
const LOCALES: Record<Idioma, string> = { es: "es-CL", pt: "pt-BR", en: "en-US" };

export const NOMBRES_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  pt: "Português",
  en: "English",
};

const CLAVE_STORAGE = "almuerzo-misional:idioma";

function leerIdiomaGuardado(): Idioma | null {
  try {
    const valor = localStorage.getItem(CLAVE_STORAGE);
    return esIdioma(valor) ? valor : null;
  } catch {
    return null;
  }
}

function idiomaDelNavegador(): Idioma | null {
  const codigo = navigator.language?.slice(0, 2);
  return esIdioma(codigo) ? codigo : null;
}

type ContextoIdioma = {
  idioma: Idioma;
  t: Mensajes;
  cambiarIdioma: (idioma: Idioma) => void;
  /** Formatea una fecha `YYYY-MM-DD` sin pasar por la zona horaria del dispositivo. */
  formatearFecha: (fecha: string, opciones?: Intl.DateTimeFormatOptions) => string;
};

const Contexto = createContext<ContextoIdioma | null>(null);

/**
 * Prioridad: lo que eligió la persona (localStorage) → idioma del barrio → navegador → español.
 * `idiomaBarrio` llega cuando se carga el barrio; mientras tanto se usa el del navegador.
 */
export function ProveedorIdioma({
  idiomaBarrio,
  children,
}: {
  idiomaBarrio?: Idioma;
  children: ReactNode;
}) {
  const [elegido, setElegido] = useState<Idioma | null>(leerIdiomaGuardado);
  const idioma = elegido ?? idiomaBarrio ?? idiomaDelNavegador() ?? "es";

  const valor = useMemo<ContextoIdioma>(() => {
    const locale = LOCALES[idioma];
    return {
      idioma,
      t: DICCIONARIOS[idioma],
      cambiarIdioma: (nuevo) => {
        setElegido(nuevo);
        try {
          localStorage.setItem(CLAVE_STORAGE, nuevo);
        } catch {
          // Sin storage (modo privado): el cambio dura solo esta visita.
        }
      },
      formatearFecha: (fecha, opciones = { weekday: "long", day: "numeric", month: "long" }) => {
        const [anio, mes, dia] = fecha.split("-").map(Number);
        return new Intl.DateTimeFormat(locale, { ...opciones, timeZone: "UTC" }).format(
          new Date(Date.UTC(anio, mes - 1, dia)),
        );
      },
    };
  }, [idioma]);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIdioma() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useIdioma debe usarse dentro de <ProveedorIdioma>");
  return contexto;
}

export { IDIOMAS };
