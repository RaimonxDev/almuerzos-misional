import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useTitulo } from "@/app/hooks";
import { cn } from "@/app/lib/utils";
import { buttonVariants } from "@/app/components/ui/button";
import { ANCHO, aparecer, BarraSuperior, Carpetas, EnlaceCorreo, MARGEN, PieTarjeta, SeccionHoja, useAparecer, type NombreCuadro } from "./marco";
import { useTextosPortada } from "./textos";

/** Color de la pestaña de cada grupo, en el mismo orden que la portada. */
const COLORES = [
  { fondo: "bg-cielo", texto: "text-azul-profundo" },
  { fondo: "bg-dorado-claro", texto: "text-azul-profundo" },
  { fondo: "bg-azul-medio", texto: "text-white" },
  { fondo: "bg-dorado", texto: "text-azul-profundo" },
];

/** Pintura de cada grupo, en orden. */
const CUADROS: NombreCuadro[] = ["ministrantes", "cena", "caminando", "bendecir"];

/** `/preguntas` — todas las preguntas frecuentes, agrupadas por quién pregunta, con las respuestas a la vista. */
export function Preguntas() {
  const tx = useTextosPortada();
  const p = tx.paginaPreguntas;
  useTitulo(p.titulo);
  useAparecer();
  const { hash } = useLocation();

  // La página carga de forma diferida: el navegador no siempre llega solo al ancla.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  // El primer grupo es la carpeta abierta; los demás, las pestañas de atrás.
  const [primero, ...resto] = tx.grupos;
  const carpetas = resto.map((g, i) => ({ id: `grupo-${i + 2}`, nombre: g.titulo, ...COLORES[i % COLORES.length] }));

  return (
    <div className="bg-azul-profundo">
      <header className="text-white">
        <BarraSuperior />
        {/* Alineado con el contenido de las carpetas, que ocupan el 86% del ancho. */}
        <div className={cn(ANCHO, MARGEN, "pt-12 md:pt-20")}>
          <div className="mx-auto md:w-[86%] md:px-8">
            <h1
              {...aparecer(0)}
              className="font-serif text-[2.75rem] leading-[1] font-semibold tracking-[-0.03em] md:text-[clamp(3.5rem,6.4vw,6.5rem)]"
            >
              {p.titulo}
            </h1>
            <p {...aparecer(1)} className="mt-6 max-w-[52ch] text-lg leading-relaxed md:text-xl">
              {p.intro} <EnlaceCorreo className="hover:text-dorado-claro" />.
            </p>
          </div>
        </div>
      </header>
      <main className={cn(ANCHO, MARGEN)}>
        <Carpetas carpetas={carpetas} frente={primero.titulo}>
          <div className="px-4 pb-16 md:px-8 md:pb-24">
            {tx.grupos.map((g, i) => (
              <SeccionHoja key={g.titulo} id={`grupo-${i + 1}`} titulo={i === 0 ? undefined : g.titulo} cuadro={CUADROS[i]}>
                {g.preguntas.map((q) => (
                  <article key={q.id} id={q.id} className="scroll-mt-4">
                    <h3 className="font-sans text-xl leading-snug font-bold text-azul-profundo">{q.p}</h3>
                    <p className="mt-2">{q.r}</p>
                  </article>
                ))}
              </SeccionHoja>
            ))}
            <div className="mt-20 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8 lg:ml-[33.33%]">
              <Link to="/solicitar" className={cn(buttonVariants({ variant: "accion", size: "lg" }), "h-14 px-8 text-lg")}>
                {tx.solicitar.accion}
              </Link>
              <Link
                to="/informacion"
                className="inline-flex min-h-11 items-center text-lg font-bold text-azul-profundo underline decoration-2 underline-offset-4 transition-colors hover:text-azul-medio"
              >
                {tx.pie.informacion}
              </Link>
            </div>
          </div>
        </Carpetas>
      </main>
      <PieTarjeta />
    </div>
  );
}
