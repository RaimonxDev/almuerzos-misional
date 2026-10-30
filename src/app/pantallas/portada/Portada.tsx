import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useTitulo } from "@/app/hooks";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { buttonVariants } from "@/app/components/ui/button";
import { ANCHO, aparecer, BarraSuperior, Carpetas, Cuadro, MARGEN, PieTarjeta, useAparecer } from "./marco";
import { SemanaDemo } from "./SemanaDemo";
import { useTextosPortada, type TextosPortada } from "./textos";

/**
 * `/` — la entrada al sitio, armada como la papelería del almuerzo: carpetas con pestañas,
 * el comprobante de cómo funciona, hojas que se apilan, la tarjeta de respuesta y su reverso.
 * No lista barrios a propósito: cada barrio comparte su propio enlace.
 */
export function Portada() {
  const { t } = useIdioma();
  const tx = useTextosPortada();
  useTitulo(undefined);
  useAparecer();

  const carpetas = [
    { id: "como-funciona", nombre: tx.hero.pestanas.comoFunciona, fondo: "bg-cielo", texto: "text-azul-profundo" },
    { id: "lo-que-cambia", nombre: tx.hero.pestanas.loQueCambia, fondo: "bg-dorado-claro", texto: "text-azul-profundo" },
    { id: "preguntas", nombre: tx.hero.pestanas.preguntas, fondo: "bg-azul-medio", texto: "text-white" },
    { id: "solicitar", nombre: tx.hero.pestanas.solicitar, fondo: "bg-dorado", texto: "text-azul-profundo" },
  ];

  return (
    <div className="bg-azul-profundo">
      <header className="text-white">
        <BarraSuperior />
        <div className={cn(ANCHO, MARGEN, "pt-14 text-center md:pt-20")}>
          <h1
            {...aparecer(0)}
            className="font-serif text-[14vw] leading-[0.95] font-semibold tracking-[-0.03em] sm:text-[11vw] lg:text-[8.2vw] 2xl:text-[118px]"
          >
            {t.comun.nombreApp}
          </h1>
          <p {...aparecer(1)} className="mx-auto mt-8 max-w-[46ch] text-lg leading-relaxed md:mt-10 md:text-xl">
            {tx.hero.sub}
          </p>
        </div>
        <div className={cn(ANCHO, MARGEN)}>
          <Carpetas carpetas={carpetas} frente={tx.hero.pestanas.probar}>
            <div className="px-4 pt-8 pb-12 md:px-8 md:pb-16">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
                <Link
                  to="/solicitar"
                  className={cn(buttonVariants({ variant: "accion", size: "lg" }), "h-14 px-8 text-lg active:scale-[0.98]")}
                >
                  {tx.hero.accion}
                </Link>
                <p className="max-w-[48ch] text-base">{tx.hero.hermana}</p>
              </div>
              <SemanaDemo />
            </div>
          </Carpetas>
        </div>
      </header>

      <main>
        <ComoFunciona tx={tx} />
        <LoQueCambia tx={tx} />
        <PreguntasDestacadas tx={tx} />
        <Solicitar tx={tx} />
      </main>
      <PieTarjeta />
    </div>
  );
}

const TITULO_SECCION = "text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.02em] md:text-[clamp(2.5rem,4.4vw,4.25rem)]";

function ComoFunciona({ tx }: { tx: TextosPortada }) {
  const c = tx.comoFunciona;
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-4 bg-cielo text-azul-profundo">
      <div className={cn(ANCHO, MARGEN, "grid gap-12 py-24 md:py-40 lg:grid-cols-12 lg:gap-8")}>
        <div className="lg:col-span-5">
          <h2 id="como-funciona-titulo" {...aparecer(0)} className={TITULO_SECCION}>
            {c.titulo}
          </h2>
          <p {...aparecer(1)} className="mt-6 max-w-[34ch] text-lg leading-relaxed text-foreground md:text-xl">
            {c.texto}
          </p>
        </div>
        <div {...aparecer(2)} className="w-full max-w-[520px] lg:col-span-6 lg:col-start-7 lg:justify-self-end">
          <div className="bg-white px-5 pt-3 pb-8 text-base text-foreground md:px-8">
            {c.grupos.map((g, n) => (
              <div key={g.titulo} {...aparecer(n + 3)}>
                <h3 className="pt-7 pb-2 font-sans text-base font-extrabold text-azul-profundo">{g.titulo}</h3>
                <ul>
                  {g.pasos.map(([que, quien]) => (
                    <li key={que} className="flex items-end gap-2 py-1.5">
                      <span className="min-w-0">{que}</span>
                      <span aria-hidden="true" className="puntos-guia mb-1.5 min-w-6 flex-1" />
                      <span className="shrink-0 text-right font-semibold whitespace-nowrap text-azul-medio">{quien}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-8 -mx-5 flex min-h-11 items-center justify-between gap-4 bg-azul-profundo px-5 py-2 font-bold text-white md:-mx-8 md:px-8">
              <span>{c.resultado[0]}</span>
              <span className="text-dorado-claro">{c.resultado[1]}</span>
            </p>
          </div>
          <Dientes />
        </div>
      </div>
    </section>
  );
}

/** Borde dentado inferior del comprobante, del color del papel. */
function Dientes() {
  return (
    <svg aria-hidden="true" className="block h-3 w-full" preserveAspectRatio="none">
      <defs>
        <pattern id="dientes" width="18" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 0 H18 L9 12 Z" fill="#ffffff" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dientes)" />
    </svg>
  );
}

/** Colores de las hojas apiladas, en orden, con su tinta. */
const HOJAS = [
  { fondo: "bg-azul-profundo", texto: "text-white" },
  { fondo: "bg-cielo", texto: "text-azul-profundo" },
  { fondo: "bg-dorado-claro", texto: "text-azul-profundo" },
  { fondo: "bg-azul-medio", texto: "text-white" },
];

function LoQueCambia({ tx }: { tx: TextosPortada }) {
  const { idioma } = useIdioma();
  const l = tx.loQueCambia;
  const figuras = [
    <Cuadro key="cena" nombre="cena" className="h-full w-full" />,
    <Cuadro key="visita" nombre="visita" className="h-full w-full object-[60%_50%]" />,
    // El calendario imprimible de la app, capturado con un mes de muestra en cada idioma.
    <img
      key="calendario"
      src={`/portada/calendario-${idioma}.jpg`}
      alt={l.calendarioAlt}
      width={1600}
      height={1131}
      loading="lazy"
      className="h-full w-full object-contain object-top p-4 md:p-0 md:pt-6"
    />,
    <Cuadro key="misioneras" nombre="misioneras" className="h-full w-full" />,
  ];
  return (
    <section id="lo-que-cambia" aria-labelledby="lo-que-cambia-titulo" className="scroll-mt-4 bg-background text-foreground">
      <div className={cn(ANCHO, MARGEN, "pt-24 pb-12 md:pt-40")}>
        <h2 id="lo-que-cambia-titulo" {...aparecer(0)} className={cn(TITULO_SECCION, "text-azul-profundo md:text-[clamp(2.5rem,5vw,5rem)]")}>
          {l.titulo}
        </h2>
      </div>
      <div>
        {l.hojas.map((h, i) => (
          <article
            key={h.titulo}
            style={{ "--i": i } as CSSProperties}
            className={cn(
              "sticky top-[calc(var(--i)*52px)] flex min-h-[70svh] md:top-[calc(var(--i)*72px)] md:min-h-[78svh]",
              HOJAS[i].fondo,
              HOJAS[i].texto,
            )}
          >
            <div
              className={cn(
                ANCHO,
                MARGEN,
                "grid flex-1 grid-rows-[auto_auto_1fr] md:grid-cols-2 md:grid-rows-[72px_1fr] md:gap-x-8",
              )}
            >
              <h3 {...aparecer(0)} className="flex h-13 items-center text-[1.375rem] leading-none font-semibold md:h-18 md:text-[clamp(1.75rem,3vw,2.75rem)]">
                {h.titulo}
              </h3>
              <div {...aparecer(2)} className="-mx-4 aspect-4/3 overflow-hidden sm:-mx-6 md:col-start-2 md:row-start-2 md:mx-0 md:aspect-auto">
                {figuras[i]}
              </div>
              <p {...aparecer(1)} className="mt-6 mb-10 max-w-[30ch] text-lg leading-relaxed md:col-start-1 md:row-start-2 md:mt-4 md:self-start md:text-lg">
                {h.texto}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PreguntasDestacadas({ tx }: { tx: TextosPortada }) {
  const p = tx.preguntas;
  const todas = tx.grupos.flatMap((g) => g.preguntas);
  const destacadas = p.destacadas.flatMap((id) => todas.filter((q) => q.id === id));
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" className="scroll-mt-4 bg-azul-medio text-white">
      <div className={cn(ANCHO, MARGEN, "grid gap-16 pb-24 lg:grid-cols-12 lg:gap-8")}>
        <div className="relative order-first pt-24 md:pt-40 lg:order-last lg:col-span-6 lg:col-start-7 lg:pt-0 lg:pb-20">
          <div className="relative mx-auto max-w-[560px] lg:max-w-none">
            <div className="aspect-4/5 overflow-hidden lg:aspect-3/4">
              <Cuadro nombre="elderes" className="deriva h-full w-full object-[58%_50%]" />
            </div>
            <div className="absolute right-[-12px] bottom-[-40px] w-[38%] bg-azul-medio p-2 lg:right-auto lg:left-[-40px] lg:w-1/3">
              <Cuadro nombre="bendecir" className="aspect-square w-full object-[42%_60%]" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 lg:pt-40">
          <h2 id="preguntas-titulo" {...aparecer(0)} className="text-[1.875rem] leading-tight font-semibold md:text-[2.75rem]">
            {p.titulo}
          </h2>
          <ul {...aparecer(1)} className="mt-6 flex flex-col gap-1 text-[17px] font-semibold md:text-lg">
            {p.hechos.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-3">
            {destacadas.map((q, n) => (
              <details key={q.id} className="group" {...aparecer(n + 2)}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-1 text-lg font-semibold transition-colors hover:text-dorado-claro md:text-xl">
                  {q.p}
                  <span className="chevron" aria-hidden="true" />
                </summary>
                <p className="pt-2 pb-4 text-[17px] leading-relaxed">{q.r}</p>
              </details>
            ))}
          </div>
          <div {...aparecer(3)} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Link
              to="/solicitar"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full bg-white px-7 font-bold text-azul-profundo hover:bg-cielo active:scale-[0.98]")}
            >
              {tx.solicitar.accion}
            </Link>
            <Link
              to="/preguntas"
              className="inline-flex min-h-11 items-center text-lg font-bold underline decoration-2 underline-offset-4 transition-colors hover:text-dorado-claro"
            >
              {p.verTodas}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Solicitar({ tx }: { tx: TextosPortada }) {
  const s = tx.solicitar;
  return (
    <section id="solicitar" aria-labelledby="solicitar-titulo" className="scroll-mt-4 overflow-hidden bg-dorado text-azul-profundo">
      <div className={cn(ANCHO, MARGEN, "grid gap-12 pt-20 md:pt-24 lg:grid-cols-12 lg:gap-8")}>
        <p {...aparecer(0)} className="max-w-[26ch] self-end text-xl leading-snug font-semibold md:text-2xl lg:col-span-4 lg:mb-16">
          {s.aparte}
        </p>
        <div className="self-end lg:col-span-7 lg:col-start-6">
          <div
            {...aparecer(1)}
            className="mx-auto w-[90%] translate-y-[60px] md:w-full md:max-w-[640px]"
          >
            <div className="tarjeta-respuesta flex min-h-[340px] md:aspect-7/5 flex-col items-center justify-center gap-4 bg-background px-6 pt-10 pb-24 text-center md:px-12">
              <h2 id="solicitar-titulo" className="text-2xl leading-tight font-semibold md:text-[2rem]">
                {s.titulo}
              </h2>
              <p className="max-w-[40ch] text-base leading-relaxed text-foreground md:text-[17px]">{s.texto}</p>
              <Link
                to="/solicitar"
                className="mt-4 flex h-13 w-full items-center justify-center rounded-full bg-azul-profundo px-6 text-lg font-bold text-white transition-[background-color,transform] hover:bg-azul-medio active:scale-[0.98] md:h-14"
              >
                {s.accion}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
