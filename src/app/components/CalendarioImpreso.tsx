import type { CSSProperties, Ref } from "react";
import { grillaDelMes } from "@/app/calendario";
import { LOCALES, useIdioma } from "@/app/i18n";

export type Plantilla = "azul" | "dorado" | "cielo";

type Tema = {
  fondo: string;
  texto: string;
  acento: string;
  titulo: string;
  suave: string;
  chipElderes: string;
  chipHermanas: string;
  bordeImagen: string;
  fondoImagen: string;
};

/** Colores de las plantillas (maqueta 4): azul sereno, dorado cálido y cielo claro. */
export const TEMAS: Record<Plantilla, Tema> = {
  azul: { fondo: "#14304F", texto: "#FFFFFF", acento: "#E2C27A", titulo: "#14304F", suave: "#EAF2F9", chipElderes: "#14304F", chipHermanas: "#8A6516", bordeImagen: "rgba(255,255,255,0.35)", fondoImagen: "rgba(255,255,255,0.06)" },
  dorado: { fondo: "#F6EEDC", texto: "#3A2E14", acento: "#7A5912", titulo: "#6B4E12", suave: "#FBF6EA", chipElderes: "#6B4E12", chipHermanas: "#1F5C99", bordeImagen: "#D9C493", fondoImagen: "#FBF6EA" },
  cielo: { fondo: "#DCEAF6", texto: "#14304F", acento: "#1F5C99", titulo: "#14304F", suave: "#F2F7FC", chipElderes: "#14304F", chipHermanas: "#8A6516", bordeImagen: "#A9C3DD", fondoImagen: "#EEF5FB" },
};

/** Tamaño fijo en px (A4 apaisado a 96 dpi). Para una vista previa, envolver con `transform: scale()`. */
export const ANCHO_CALENDARIO = 1123;
export const ALTO_CALENDARIO = 794;

export type DatosCalendario = {
  barrio: { nombre: string; contactoNombre?: string | null; contactoTelefono?: string | null };
  mes: {
    periodo: string;
    imagenKey: string | null;
    escritura: string | null;
    escrituraRef: string | null;
    mensaje: string | null;
    plantilla: Plantilla;
  };
  /** Una fila por compañerismo dentro de cada día, en este orden. */
  companerismos: { id: string; tipo: "elderes" | "hermanas"; nombre: string }[];
  turnos: {
    fecha: string;
    companerismoId: string;
    bloqueado: boolean;
    motivoBloqueo: string | null;
    inscripcion: { nombre: string } | null;
  }[];
};

type Props = DatosCalendario & {
  /** Para ver una imagen aún no guardada (el editor). Por defecto `/api/imagenes/<imagenKey>`. */
  imagenUrl?: string | null;
  /** Muestra el recuadro "Imagen del mes" cuando no hay imagen (en el editor; al imprimir no). */
  marcadorImagen?: boolean;
  ref?: Ref<HTMLDivElement>;
};

const SERIF = "Lora, Georgia, serif";
const BORDE = "#C9D5E1";

/**
 * Calendario mensual de 1123×794 px (maqueta 4). No depende del viewport: se imprime tal cual
 * y se exporta a PNG. Un compañerismo por fila dentro de cada día.
 */
export function CalendarioImpreso({ barrio, mes, companerismos, turnos, imagenUrl, marcadorImagen, ref }: Props) {
  const { t, idioma, formatearMes } = useIdioma();
  const tema = TEMAS[mes.plantilla] ?? TEMAS.azul;
  const [anio, numeroMes] = mes.periodo.split("-").map(Number);
  const { filas, celdas } = grillaDelMes(mes.periodo);
  const imagen = imagenUrl === undefined ? (mes.imagenKey ? `/api/imagenes/${mes.imagenKey}` : null) : imagenUrl;
  const contacto = t.calendario.coordina(barrio.contactoNombre ?? "", barrio.contactoTelefono ?? "");

  // Días de la semana en el idioma, empezando en domingo (2023-01-01 fue domingo).
  const semana = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(LOCALES[idioma], { weekday: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2023, 0, 1 + i)))
      .replace(".", ""),
  );

  const colorChip = (tipo: "elderes" | "hermanas") => (tipo === "elderes" ? tema.chipElderes : tema.chipHermanas);
  const porClave = new Map(turnos.map((x) => [`${x.fecha}|${x.companerismoId}`, x]));
  const turnoDe = (fecha: string, companerismoId: string) => porClave.get(`${fecha}|${companerismoId}`);

  const chip = (c: DatosCalendario["companerismos"][number]): CSSProperties => ({
    width: 16,
    height: 16,
    flexShrink: 0,
    borderRadius: 4,
    background: colorChip(c.tipo),
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });
  const inicial = (c: { nombre: string }) => c.nombre.trim().charAt(0).toLocaleUpperCase(idioma) || "·";

  return (
    <div
      ref={ref}
      lang={idioma}
      style={{
        width: ANCHO_CALENDARIO,
        height: ALTO_CALENDARIO,
        boxSizing: "border-box",
        display: "flex",
        background: "#FFFFFF",
        color: "#1A2633",
        fontFamily: "'Nunito Sans', system-ui, sans-serif",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          boxSizing: "border-box",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          background: tema.fondo,
          color: tema.texto,
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: tema.acento }}>
            {t.comun.nombreApp}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, lineHeight: 1.1 }}>{barrio.nombre}</div>
          <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.85 }}>{formatearMes(anio, numeroMes)}</div>
        </div>

        {imagen ? (
          <img
            src={imagen}
            alt=""
            style={{ height: 250, width: "100%", objectFit: "cover", borderRadius: 14, display: "block", flexShrink: 0 }}
          />
        ) : (
          marcadorImagen && (
            <div
              style={{
                height: 250,
                flexShrink: 0,
                borderRadius: 14,
                border: `2px dashed ${tema.bordeImagen}`,
                background: tema.fondoImagen,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.calendario.imagenDelMes}
            </div>
          )
        )}

        {mes.escritura && (
          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <blockquote style={{ margin: 0, fontFamily: SERIF, fontStyle: "italic", fontSize: 17, lineHeight: 1.45 }}>
              {mes.escritura}
            </blockquote>
            {mes.escrituraRef && (
              <figcaption style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", color: tema.acento }}>
                {mes.escrituraRef}
              </figcaption>
            )}
          </figure>
        )}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {mes.mensaje && <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{mes.mensaje}</div>}
          {contacto && <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>{contacto}</div>}
        </div>
      </aside>

      <main
        style={{
          flexGrow: 1,
          minWidth: 0,
          padding: "36px 40px 40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: tema.titulo }}>
            {t.calendario.titulo}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "4px 14px", fontSize: 12, color: "#3D4C5C", paddingBottom: 4 }}>
            {companerismos.map((c) => (
              <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={chip(c)}>{inicial(c)}</span> {c.nombre}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {semana.map((s, i) => (
            <div
              key={i}
              style={{
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#3D4C5C",
                background: tema.suave,
              }}
            >
              {s}
            </div>
          ))}
        </div>

        <div
          data-testid="grilla-calendario"
          style={{
            flexGrow: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))`,
            borderTop: `1px solid ${BORDE}`,
            borderLeft: `1px solid ${BORDE}`,
          }}
        >
          {celdas.map((fecha, i) => {
            const base: CSSProperties = {
              boxSizing: "border-box",
              padding: "6px 8px 4px",
              borderRight: `1px solid ${BORDE}`,
              borderBottom: `1px solid ${BORDE}`,
              overflow: "hidden",
              minWidth: 0,
            };
            if (!fecha) return <div key={i} style={{ ...base, background: "#F6F8FB" }} />;

            const delDia = companerismos.map((c) => ({ c, turno: turnoDe(fecha, c.id) }));
            const existentes = delDia.filter((x) => x.turno);
            const diaBloqueado = existentes.length > 0 && existentes.every((x) => x.turno!.bloqueado);
            const motivo = existentes.find((x) => x.turno!.motivoBloqueo)?.turno!.motivoBloqueo;

            return (
              <div key={i} style={{ ...base, background: diaBloqueado ? tema.suave : "#FFFFFF" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#14304F", lineHeight: 1 }}>
                  {Number(fecha.slice(8))}
                </div>
                {diaBloqueado ? (
                  motivo && (
                    <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", lineHeight: 1.3, color: "#3D4C5C" }}>{motivo}</div>
                  )
                ) : (
                  <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 3 }}>
                    {delDia.map(({ c, turno }) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <span style={chip(c)}>{inicial(c)}</span>
                        {turno?.bloqueado ? (
                          <span style={{ ...textoFila, fontStyle: "italic", color: "#3D4C5C" }}>{turno.motivoBloqueo ?? "—"}</span>
                        ) : turno?.inscripcion ? (
                          <span style={{ ...textoFila, fontWeight: 600, color: "#1A2633" }}>{turno.inscripcion.nombre}</span>
                        ) : (
                          <span style={{ ...textoFila, color: "#9AA6B2" }}>________</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

const textoFila: CSSProperties = {
  fontSize: 12,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};
