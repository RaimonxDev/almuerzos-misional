import type { ReactNode } from "react";
import { grillaDelMes } from "@/app/calendario";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";

export type EstadoChip = "libre" | "tomado" | "tuyo" | "bloqueado";

/** Un día de la grilla: un chip por turno y cuántos se pueden tomar todavía. */
export type DiaCalendario = {
  fecha: string;
  chips: { estado: EstadoChip; companerismoId: string }[];
  libres: number;
};

// La semana del domingo 1 de enero de 2023, para nombrar los días con `Intl`.
const SEMANA = Array.from({ length: 7 }, (_, i) => `2023-01-0${i + 1}`);

/** "Élderes" → "E": sin acento, que en un chip de 16 px no se lee. */
const letra = (texto: string) => texto.charAt(0).normalize("NFD").replace(/\p{M}/gu, "").toLocaleUpperCase();

/**
 * Lo que va en el chip de cada compañerismo: su inicial ("E", "H"). Si dos empiezan igual,
 * se suma la inicial de la última palabra ("Élderes Norte" → "EN") y, si aun así chocan, un número.
 */
export function abreviaturas(companerismos: { id: string; nombre: string }[]): Map<string, string> {
  const nombres = companerismos.map((c) => c.nombre);
  const repetidas = (lista: string[]) => (a: string) => lista.filter((b) => b === a).length > 1;
  const iniciales = nombres.map((n) => letra(n.trim()));
  const dos = nombres.map((n, i) => {
    if (!repetidas(iniciales)(iniciales[i])) return iniciales[i];
    const palabras = n.trim().split(/\s+/);
    return iniciales[i] + letra(palabras.length > 1 ? palabras[palabras.length - 1] : palabras[0].slice(1));
  });
  return new Map(
    companerismos.map(({ id }, i) => {
      if (!repetidas(dos)(dos[i])) return [id, dos[i]];
      const numero = dos.slice(0, i).filter((d) => d === dos[i]).length + 1;
      return [id, `${iniciales[i]}${numero}`];
    }),
  );
}

/**
 * Grilla del mes (semana desde el domingo) con un botón por día. Con un solo compañerismo
 * los chips son barras sin inicial. Los días pasados se atenúan y sus turnos libres se ven tomados;
 * con `soloLibres` también los días sin turnos libres (la grilla no pierde su forma).
 */
export function CalendarioMes({
  periodo,
  hoy,
  dias,
  companerismos,
  soloLibres = false,
  seleccionada,
  onElegir,
}: {
  periodo: string;
  hoy: string;
  dias: DiaCalendario[];
  /** Compañerismos del mes, para las iniciales de los chips y su leyenda. */
  companerismos: { id: string; nombre: string }[];
  soloLibres?: boolean;
  seleccionada: string | null;
  onElegir: (fecha: string) => void;
}) {
  const { t, formatearFecha } = useIdioma();
  const { celdas } = grillaDelMes(periodo);
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  const conIniciales = companerismos.length > 1;
  const abreviatura = abreviaturas(companerismos);

  const etiqueta = (fecha: string, dia: DiaCalendario | undefined) => {
    const partes = [formatearFecha(fecha)];
    if (fecha === hoy) partes.push(t.vistaCalendario.hoy);
    const chips = dia?.chips ?? [];
    if (chips.some((c) => c.estado === "tuyo")) partes.push(t.vistaCalendario.tienesTurno);
    if (chips.length > 0 && chips.every((c) => c.estado === "bloqueado")) partes.push(t.vistaCalendario.diaBloqueado);
    else partes.push(t.vistaCalendario.libres(dia?.libres ?? 0));
    return partes.join(", ");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1">
        <div aria-hidden="true" className="col-span-7 grid grid-cols-7 gap-1">
          {SEMANA.map((fecha) => (
            <div
              key={fecha}
              className="pb-0.5 text-center text-[11px] font-extrabold tracking-[0.06em] text-muted-foreground uppercase"
            >
              {formatearFecha(fecha, { weekday: "short" }).replace(".", "")}
            </div>
          ))}
        </div>
        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`vacia-${i}`} aria-hidden="true" />;
          const dia = porFecha.get(fecha);
          const pasado = fecha < hoy;
          const elegida = fecha === seleccionada;
          return (
            <button
              key={fecha}
              type="button"
              aria-label={etiqueta(fecha, dia)}
              aria-pressed={elegida}
              onClick={() => onElegir(fecha)}
              className={cn(
                "flex min-h-[58px] min-w-0 flex-col items-center justify-between gap-1 rounded-[10px] border bg-card px-0.5 py-[5px]",
                elegida && "border-2 border-azul-profundo bg-cielo-claro",
                (pasado || (soloLibres && !dia?.libres)) && "opacity-45",
              )}
            >
              <span
                className={cn(
                  "min-w-5 rounded-full px-1 text-sm leading-5 font-extrabold text-azul-profundo",
                  fecha === hoy && "bg-dorado text-white",
                )}
              >
                {Number(fecha.slice(8))}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {dia?.chips.map((chip, j) => (
                  <Chip key={j} estado={pasado && chip.estado === "libre" ? "tomado" : chip.estado} conInicial={conIniciales}>
                    {conIniciales && abreviatura.get(chip.companerismoId)}
                  </Chip>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <ul
        aria-label={t.vistaCalendario.leyenda}
        className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-0.5 text-xs text-muted-foreground"
      >
        {(["libre", "tomado", "tuyo", "bloqueado"] as const).map((estado) => (
          <li key={estado} className="flex items-center gap-[5px]">
            <Chip estado={estado} conInicial muestra />
            {t.vistaCalendario[estado]}
          </li>
        ))}
        {conIniciales && (
          <li>
            {companerismos.map(({ id, nombre }, i) => (
              <span key={id}>
                {i > 0 && " · "}
                <span className="font-extrabold text-azul-profundo">{abreviatura.get(id)}</span> {nombre}
              </span>
            ))}
          </li>
        )}
      </ul>
    </div>
  );
}

/** Libre resalta (azul relleno), tomado es gris claro, tuyo dorado y bloqueado solo un borde punteado. */
function Chip({
  estado,
  conInicial,
  muestra = false,
  children,
}: {
  estado: EstadoChip;
  conInicial: boolean;
  /** El cuadrado de la leyenda. */
  muestra?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "box-border flex items-center justify-center text-[10px] leading-none font-extrabold",
        muestra ? "size-3.5 rounded-[4px]" : conInicial ? "h-4 min-w-4 rounded-[5px] px-px" : "h-3 w-[30px] max-w-full rounded-full",
        estado === "libre" && "bg-azul-medio text-white",
        estado === "tomado" && "bg-[#E3E9F0] text-[#6B7A89]",
        estado === "tuyo" && "bg-dorado text-white",
        estado === "bloqueado" && "border border-dashed border-[#8A98A7] text-[#6B7A89]",
      )}
    >
      {children}
    </span>
  );
}
