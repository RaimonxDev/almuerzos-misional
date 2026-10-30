import { useMemo, type Ref } from "react";
import { UtensilsCrossedIcon } from "lucide-react";
import { mensajesDe } from "@/app/i18n";
import { PALETA } from "@/app/paleta";
import { esOjo, matrizQr } from "@/app/qr";
import type { Idioma } from "@/shared/idiomas";

/** Tamaño fijo en px, como `CalendarioImpreso`: la vista previa lo escala y el PNG sale ×2. */
export const ANCHO_TARJETA_QR = 540;
export const ALTO_TARJETA_QR = 720;

const { azulProfundo: AZUL, azulMedio: AZUL_MEDIO, dorado: DORADO, doradoClaro: DORADO_CLARO } = PALETA;
// Más oscuro que el dorado de la paleta: el centro del ojo tiene que leerse oscuro al escanear.
const DORADO_OSCURO = PALETA.doradoOscuro;
// Margen blanco dentro del SVG, en módulos; con el relleno del recuadro suma más de 4.
const MARGEN = 2;
const SERIF = "'Lora Variable', Lora, Georgia, serif";
const SANS = "'Nunito Sans Variable', 'Nunito Sans', system-ui, sans-serif";

/** QR con la paleta de la app: puntos redondos en azul profundo, ojos con centro dorado y un sello al medio. */
export function CodigoQr({ texto, tamano, etiqueta }: { texto: string; tamano: number; etiqueta: string }) {
  const { n, conSello, radioSello, puntos } = useMemo(() => {
    const { tamano: n, oscuro, alineacionAlCentro } = matrizQr(texto);
    const centro = n / 2;
    // El sello tapa ~5 % del área (la corrección H recupera hasta 30 %), pero no el patrón de
    // alineación del medio de los enlaces largos: la cámara lo usa para enderezar el QR.
    const conSello = !alineacionAlCentro;
    const radioSello = n * 0.11;
    const tapado = (f: number, c: number) =>
      conSello && Math.hypot(f + 0.5 - centro, c + 0.5 - centro) < radioSello + 0.6;
    const puntos: string[] = [];
    oscuro.forEach((fila, f) =>
      fila.forEach((o, c) => {
        if (o && !esOjo(f, c, n) && !tapado(f, c)) puntos.push(`M${c + 0.5} ${f + 0.06}a.44 .44 0 1 1 0 .88a.44 .44 0 1 1 0-.88`);
      }),
    );
    return { n, conSello, radioSello, puntos: puntos.join("") };
  }, [texto]);
  const centro = n / 2;
  const ojos = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  const icono = radioSello * 1.05;

  return (
    <svg role="img" aria-label={etiqueta} width={tamano} height={tamano} viewBox={`${-MARGEN} ${-MARGEN} ${n + 2 * MARGEN} ${n + 2 * MARGEN}`} style={{ display: "block" }}>
      <rect x={-MARGEN} y={-MARGEN} width={n + 2 * MARGEN} height={n + 2 * MARGEN} fill="#FFFFFF" />
      <path d={puntos} fill={AZUL} />
      {ojos.map(([f, c]) => (
        <g key={`${f}-${c}`}>
          <rect x={c + 0.5} y={f + 0.5} width={6} height={6} rx={1.8} fill="none" stroke={AZUL} strokeWidth={1} />
          <rect x={c + 2} y={f + 2} width={3} height={3} rx={0.9} fill={DORADO_OSCURO} />
        </g>
      ))}
      {conSello && (
        <>
          <circle cx={centro} cy={centro} r={radioSello} fill={AZUL} stroke={DORADO} strokeWidth={0.45} />
          <UtensilsCrossedIcon
            x={centro - icono / 2}
            y={centro - icono / 2}
            width={icono}
            height={icono}
            color={DORADO_CLARO}
            strokeWidth={2}
            aria-hidden="true"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Tarjeta para imprimir o mandar por WhatsApp con el QR de un enlace del barrio. El de los misioneros
 * no lleva el código de acceso: QR y código juntos bastarían para ver los teléfonos. Va en el idioma
 * del barrio (es para las hermanas), no en el que eligió quien administra.
 */
export function TarjetaQr({
  barrio,
  idioma,
  url,
  para,
  ref,
}: {
  barrio: string;
  idioma: Idioma;
  url: string;
  para: "hermanas" | "misioneros";
  ref?: Ref<HTMLDivElement>;
}) {
  const t = mensajesDe(idioma);
  const ladoPanel = 360;
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: ANCHO_TARJETA_QR,
        height: ALTO_TARJETA_QR,
        overflow: "hidden",
        background: PALETA.fondo,
        color: PALETA.texto,
        fontFamily: SANS,
      }}
    >
      <div style={{ height: 250, background: AZUL, color: "#FFFFFF", padding: "38px 44px 0", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: DORADO_CLARO }}>
          {t.comun.nombreApp}
        </div>
        {/* Hasta dos líneas: el recuadro del QR empieza en 196 px. */}
        <div
          style={{
            fontFamily: SERIF,
            fontSize: barrio.length > 22 ? 30 : 36,
            fontWeight: 600,
            lineHeight: 1.15,
            marginTop: 12,
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {barrio}
        </div>
        <div style={{ fontSize: 16, marginTop: 8, color: PALETA.cielo }}>
          {para === "hermanas" ? t.qr.subtituloHermanas : t.qr.subtituloMisioneros}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 196,
          left: (ANCHO_TARJETA_QR - ladoPanel) / 2,
          width: ladoPanel,
          height: ladoPanel,
          padding: 24,
          boxSizing: "border-box",
          background: "#FFFFFF",
          borderRadius: 28,
          border: `2px solid ${DORADO_CLARO}`,
          boxShadow: "0 12px 32px rgba(20,48,79,0.18)",
        }}
      >
        <CodigoQr texto={url} tamano={ladoPanel - 52} etiqueta={t.qr.imagenDe(url)} />
      </div>

      <div style={{ position: "absolute", top: 584, left: 32, right: 32, textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: AZUL, lineHeight: 1.25 }}>
          {para === "hermanas" ? t.qr.llamadoHermanas : t.qr.llamadoMisioneros}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: AZUL_MEDIO, marginTop: 10, overflowWrap: "anywhere" }}>
          {url.replace(/^https?:\/\//, "")}
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: DORADO }} />
    </div>
  );
}
