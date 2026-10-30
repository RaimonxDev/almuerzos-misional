import { useEffect, useRef } from "react";
import { useIdioma } from "@/app/i18n";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/**
 * Clave pública del sitio. La de prueba de Cloudflare (siempre pasa) solo en desarrollo: el build
 * de producción exige `VITE_TURNSTILE_SITE_KEY` (ver `vite.config.ts`).
 */
const CLAVE = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

type ApiTurnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

let cargando: Promise<void> | null = null;
/** Carga el script solo la primera vez y solo en las pantallas que usan el widget. */
function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  cargando ??= new Promise<void>((resolver, rechazar) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolver();
    s.onerror = () => {
      cargando = null;
      rechazar(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

const IDIOMA_TURNSTILE = { es: "es", pt: "pt-br", en: "en" } as const;

/**
 * Widget de Cloudflare Turnstile. `onToken(token)` al verificar; `onToken("")` si el token expira
 * o falla. Cambiar `reinicio` pide un token nuevo (los tokens sirven una sola vez).
 */
export function Turnstile({ onToken, reinicio = 0 }: { onToken: (token: string) => void; reinicio?: number }) {
  const { idioma } = useIdioma();
  const contenedor = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const alToken = useRef(onToken);
  alToken.current = onToken;

  useEffect(() => {
    let vivo = true;
    cargarScript()
      .then(() => {
        if (!vivo || !contenedor.current || !window.turnstile) return;
        widget.current = window.turnstile.render(contenedor.current, {
          sitekey: CLAVE,
          language: IDIOMA_TURNSTILE[idioma],
          callback: (token: string) => alToken.current(token),
          "expired-callback": () => alToken.current(""),
          "error-callback": () => alToken.current(""),
        });
      })
      .catch(() => alToken.current(""));
    return () => {
      vivo = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [idioma]);

  useEffect(() => {
    if (reinicio > 0 && widget.current) window.turnstile?.reset(widget.current);
  }, [reinicio]);

  return <div ref={contenedor} />;
}
