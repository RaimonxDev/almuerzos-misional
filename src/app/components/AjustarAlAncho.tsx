import { useEffect, useRef, useState } from "react";
import { ALTO_CALENDARIO, ANCHO_CALENDARIO } from "./CalendarioImpreso";

/**
 * Escala contenido de tamaño fijo (por defecto el calendario, 1123×794) para que quepa a lo ancho
 * (móvil); en pantalla grande, a tamaño real.
 */
export function AjustarAlAncho({
  children,
  ancho = ANCHO_CALENDARIO,
  alto = ALTO_CALENDARIO,
}: {
  children: React.ReactNode;
  ancho?: number;
  alto?: number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => {
      // clientWidth incluye el padding del contenedor.
      const estilo = getComputedStyle(el);
      const disponible = el.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
      setEscala(Math.min(1, disponible / ancho));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [ancho]);

  return (
    <div
      ref={contenedor}
      className="mx-auto w-full max-w-(--ancho-maximo) min-w-0 p-4 print:max-w-none print:p-0"
      style={{ "--ancho-maximo": `${ancho + 32}px` } as React.CSSProperties}
    >
      <div
        className="hoja-calendario mx-auto shadow-lg print:shadow-none"
        style={{ width: ancho * escala, height: alto * escala }}
      >
        <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: ancho, height: alto }}>
          {children}
        </div>
      </div>
    </div>
  );
}
