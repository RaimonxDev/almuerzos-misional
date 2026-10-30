import { useId, useMemo, useState, type FormEvent } from "react";
import { LOCALES, useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { aparecer } from "./marco";
import { useTextosPortada } from "./textos";

type Fila = "elderes" | "hermanas";
/** Índice del nombre de ejemplo, `null` = libre. */
type Ejemplo = [number | null, number | null] | "bloqueado";

/** Una semana de muestra, de domingo a sábado: tomados, libres y un día de conferencia. */
const SEMANA: Ejemplo[] = [[0, 1], [null, 2], [3, null], [null, null], [4, 5], [null, null], "bloqueado"];

/** Domingo de la semana en curso, en la hora del dispositivo (es solo una muestra). */
function domingoDeEstaSemana() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - hoy.getDay());
}

/**
 * La semana de prueba de la portada: la misma idea que el enlace de un barrio, sin API.
 * Tocar "Anotarme" abre el nombre en la misma celda; al confirmar el turno queda "Tuyo".
 */
export function SemanaDemo() {
  const { idioma } = useIdioma();
  const tx = useTextosPortada();
  const d = tx.demo;
  const idTitulo = useId();
  const [propios, setPropios] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [ultimo, setUltimo] = useState<string | null>(null);

  const dias = useMemo(() => {
    const domingo = domingoDeEstaSemana();
    const corto = new Intl.DateTimeFormat(LOCALES[idioma], { weekday: "short" });
    const largo = new Intl.DateTimeFormat(LOCALES[idioma], { weekday: "long" });
    return SEMANA.map((ejemplo, i) => {
      const fecha = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + i);
      return { i, ejemplo, numero: fecha.getDate(), corto: corto.format(fecha).replace(".", ""), largo: largo.format(fecha) };
    });
  }, [idioma]);

  const libres = dias.reduce((n, dia) => {
    if (dia.ejemplo === "bloqueado") return n;
    return n + dia.ejemplo.filter((x, f) => x === null && !propios[`${dia.i}-${f}`]).length;
  }, 0);

  const confirmar = (e: FormEvent, clave: string, dia: string) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (limpio.length < 2) return;
    setPropios((p) => ({ ...p, [clave]: limpio }));
    setEditando(null);
    setNombre("");
    setUltimo(dia);
  };

  const deshacer = (clave: string) => {
    setPropios((p) => {
      const resto = { ...p };
      delete resto[clave];
      return resto;
    });
    setUltimo(null);
  };

  const filas: [Fila, string][] = [
    ["elderes", d.elderes],
    ["hermanas", d.hermanas],
  ];

  return (
    <div className="pt-16 md:pt-24" aria-labelledby={idTitulo} role="group">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h3 id={idTitulo} className="text-[1.75rem] leading-tight font-semibold text-azul-profundo md:text-4xl">
            {d.titulo}
          </h3>
          <p className="mt-3 max-w-[52ch] text-base md:text-lg">{d.intro}</p>
        </div>
        <p className="shrink-0 text-lg font-bold text-azul-medio tabular-nums" aria-live="polite">
          {d.libres(libres)}
        </p>
      </div>

      <ol className="mt-8 grid gap-3 md:grid-cols-7 md:gap-2">
        {dias.map((dia) => (
          <li key={dia.i} {...aparecer(dia.i)} className="flex flex-col gap-2 bg-white p-3 md:p-2.5">
            <p className="flex items-baseline gap-2 text-azul-profundo">
              <span className="font-serif text-2xl leading-none font-semibold tabular-nums">{dia.numero}</span>
              <span className="text-[15px] font-bold first-letter:uppercase">{dia.corto}</span>
            </p>
            {dia.ejemplo === "bloqueado" ? (
              <p className="flex min-h-24 flex-1 items-center bg-aviso-suave p-3 text-[15px] font-semibold text-aviso-texto md:min-h-48">
                {d.conferencia}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                {filas.map(([fila, etiqueta], f) => {
                  const clave = `${dia.i}-${f}`;
                  const ejemplo = (dia.ejemplo as [number | null, number | null])[f];
                  const propio = propios[clave];
                  const comun = "flex min-h-22 flex-col justify-between gap-1.5 p-2.5 text-[15px]";
                  if (ejemplo !== null) {
                    return (
                      <div key={fila} className={cn(comun, "bg-cielo")}>
                        <span className="text-[13px] font-semibold text-muted-foreground">{etiqueta}</span>
                        <span className="font-bold text-azul-profundo">{d.nombres[ejemplo]}</span>
                      </div>
                    );
                  }
                  if (propio) {
                    return (
                      <div key={fila} className={cn(comun, "bg-dorado-claro")}>
                        <span className="text-[13px] font-semibold text-aviso-texto">
                          {etiqueta} · {d.tuyo}
                        </span>
                        <span className="font-bold break-words text-azul-profundo">{propio}</span>
                        <button
                          type="button"
                          onClick={() => deshacer(clave)}
                          className="-mx-1 min-h-11 self-start rounded-md px-1 text-left text-[15px] font-semibold text-azul-profundo underline underline-offset-2 transition-colors hover:text-azul-medio"
                        >
                          {d.deshacer}
                        </button>
                      </div>
                    );
                  }
                  if (editando === clave) {
                    return (
                      <form
                        key={fila}
                        onSubmit={(e) => confirmar(e, clave, dia.largo)}
                        className={cn(comun, "col-span-2 bg-cielo-claro md:col-span-1")}
                      >
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[13px] font-semibold text-azul-profundo">{etiqueta}</span>
                          <input
                            autoFocus
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder={d.tuNombre}
                            aria-label={`${d.tuNombre} · ${dia.largo}, ${etiqueta}`}
                            maxLength={40}
                            className="h-11 w-full min-w-0 rounded-md bg-white px-2.5 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </label>
                        <div className="flex flex-wrap gap-x-3">
                          <button
                            type="submit"
                            className="min-h-11 rounded-full bg-azul-medio px-4 font-bold text-white transition-[background-color,transform] hover:bg-azul-profundo active:scale-95"
                          >
                            {d.confirmar}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditando(null)}
                            className="min-h-11 font-semibold text-azul-profundo underline underline-offset-2"
                          >
                            {d.cancelar}
                          </button>
                        </div>
                      </form>
                    );
                  }
                  return (
                    <div key={fila} className={cn(comun, "bg-cielo-claro")}>
                      <span className="text-[13px] font-semibold text-muted-foreground">
                        {etiqueta} · {d.libre}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(clave);
                          setNombre("");
                        }}
                        aria-label={`${d.anotarme}: ${dia.largo}, ${etiqueta}`}
                        className="min-h-11 rounded-full bg-azul-medio px-3 font-bold text-white transition-[background-color,transform] hover:bg-azul-profundo active:scale-95"
                      >
                        {d.anotarme}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 min-h-7 text-base font-semibold text-exito" aria-live="polite">
        {ultimo && d.listo(ultimo)}
      </p>
    </div>
  );
}
