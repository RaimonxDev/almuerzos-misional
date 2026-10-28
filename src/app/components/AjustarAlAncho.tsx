import { useEffect, useRef, useState } from "react";
import { ALTO_CALENDARIO, ANCHO_CALENDARIO } from "./CalendarioImpreso";

/** Escala el contenido de 1123×794 para que quepa a lo ancho (móvil); en pantalla grande, a tamaño real. */
export function AjustarAlAncho({ children }: { children: React.ReactNode }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => {
      // clientWidth incluye el padding del contenedor.
      const estilo = getComputedStyle(el);
      const ancho = el.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
      setEscala(Math.min(1, ancho / ANCHO_CALENDARIO));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={contenedor} className="mx-auto w-full min-w-0 max-w-[1155px] p-4 print:max-w-none print:p-0">
      <div
        className="hoja-calendario mx-auto shadow-lg print:shadow-none"
        style={{ width: ANCHO_CALENDARIO * escala, height: ALTO_CALENDARIO * escala }}
      >
        <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: ANCHO_CALENDARIO, height: ALTO_CALENDARIO }}>
          {children}
        </div>
      </div>
    </div>
  );
}
