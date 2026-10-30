import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { SelectorIdioma } from "@/app/components/SelectorIdioma";
import { useTextosPortada } from "./textos";
import "./portada.css";

/** Correo de contacto del sitio (pie, preguntas e información). */
export const CORREO_CONTACTO = "hi@ramonmartinez.dev";

/** `hi@ramonmartinez.dev` como enlace `mailto:`, para ir al final de una frase. */
export function EnlaceCorreo({ className }: { className?: string }) {
  return (
    <a
      href={`mailto:${CORREO_CONTACTO}`}
      className={cn("font-bold underline decoration-2 underline-offset-4 transition-colors", className)}
    >
      {CORREO_CONTACTO}
    </a>
  );
}

/** Márgenes de la página: los mismos a ambos lados en todo el sitio público. */
export const MARGEN = "px-4 sm:px-6 lg:px-8";
/** Ancho máximo del contenido, centrado. */
export const ANCHO = "mx-auto w-full max-w-[1440px]";

/**
 * Hace aparecer, al entrar en pantalla, cada elemento con `data-aparecer` (una sola vez).
 * Marca la raíz con `.con-movimiento` recién aquí: sin script nada queda escondido.
 */
export function useAparecer() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const raiz = document.documentElement;
    raiz.classList.add("con-movimiento");
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-visible", "");
          observador.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const observar = () =>
      document.querySelectorAll("[data-aparecer]:not([data-visible])").forEach((el) => observador.observe(el));
    observar();
    // Las secciones cambian al cambiar de idioma o al cargar: se vuelve a mirar.
    const mutaciones = new MutationObserver(observar);
    mutaciones.observe(document.body, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      mutaciones.disconnect();
      raiz.classList.remove("con-movimiento");
    };
  }, []);
}

/** Atributos para escalonar la entrada: `{...aparecer(1)}` entra 80ms después que `aparecer(0)`. */
export function aparecer(orden = 0) {
  return { "data-aparecer": "", style: { "--retraso": `${orden * 80}ms` } as CSSProperties };
}

/** Barra superior sobre el azul profundo: nombre, idioma y "Entrar". */
export function BarraSuperior() {
  const { t } = useIdioma();
  const tx = useTextosPortada();
  return (
    <div className={cn(ANCHO, MARGEN, "flex min-h-18 items-center justify-between gap-3 text-white")}>
      <Link
        to="/"
        className="-mx-2 flex min-h-11 items-center rounded-md px-2 font-serif text-xl font-semibold transition-colors hover:text-dorado-claro"
      >
        {t.comun.nombreApp}
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <SelectorIdioma oscuro />
        <Link
          to="/admin/login"
          aria-label={tx.menu.entrarAyuda}
          className="flex min-h-11 items-center rounded-md px-2 text-[15px] font-bold underline-offset-4 transition-colors hover:text-dorado-claro hover:underline"
        >
          {tx.menu.entrar}
        </Link>
      </div>
    </div>
  );
}

/**
 * Fotos e ilustración de la galería de la Iglesia (Gospel Media, © Intellectual Reserve, Inc.),
 * con su tamaño real. El texto alternativo va por idioma.
 */
const CUADROS = {
  cena: { src: "/portada/cena-con-misioneros.jpg", width: 1400, height: 934 },
  elderes: { src: "/portada/elderes-orando.jpg", width: 1400, height: 932 },
  visita: { src: "/portada/visita-a-casa.jpg", width: 1400, height: 933 },
  misioneras: { src: "/portada/hermanas-misioneras.jpg", width: 1400, height: 933 },
  caminando: { src: "/portada/hermanas-caminando.jpg", width: 1400, height: 933 },
  ministrantes: { src: "/portada/hermanas-ministrantes.jpg", width: 1400, height: 933 },
  bendecir: { src: "/portada/bendecir-alimentos.jpg", width: 1200, height: 685 },
};

export type NombreCuadro = keyof typeof CUADROS;

/** Una de las imágenes de la portada; recorta con `className` (object-cover, aspecto). */
export function Cuadro({ nombre, className }: { nombre: NombreCuadro; className?: string }) {
  const tx = useTextosPortada();
  return <img {...CUADROS[nombre]} alt={tx.cuadros[nombre]} loading="lazy" className={cn("object-cover", className)} />;
}

/**
 * Una sección de una página de texto (preguntas, información): título y pintura a la izquierda,
 * el texto en dos columnas a la derecha. Sin `titulo`, la sección se nombra con la pestaña de
 * la carpeta del frente.
 */
export function SeccionHoja({
  id,
  titulo,
  cuadro,
  children,
}: {
  id: string;
  titulo?: string;
  cuadro: NombreCuadro;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={titulo ? `${id}-titulo` : undefined}
      className="grid scroll-mt-4 gap-8 pt-14 first:pt-10 md:pt-24 md:first:pt-14 lg:grid-cols-12 lg:gap-x-8"
    >
      <div className="flex flex-col gap-6 lg:col-span-4">
        {titulo && (
          <h2
            id={`${id}-titulo`}
            {...aparecer(0)}
            className="text-[2rem] leading-tight font-semibold text-azul-profundo md:text-[2.5rem]"
          >
            {titulo}
          </h2>
        )}
        <div {...aparecer(1)} className="aspect-4/3 overflow-hidden">
          <Cuadro nombre={cuadro} className="h-full w-full" />
        </div>
      </div>
      <div
        {...aparecer(2)}
        className="text-[17px] leading-relaxed lg:col-span-8 lg:col-start-5 lg:columns-2 lg:gap-10 [&>*]:mb-5 [&>*]:break-inside-avoid"
      >
        {children}
      </div>
    </section>
  );
}

export type Carpeta = { id: string; nombre: string; fondo: string; texto: string };

/** Posición de cada pestaña: escalonadas, como carpetas en un cajón. */
const POSICIONES = [
  { movil: "0%", ancho: "2%" },
  { movil: "22%", ancho: "21%" },
  { movil: "4%", ancho: "40%" },
  { movil: "36%", ancho: "59%" },
  { movil: "12%", ancho: "78%" },
];

/**
 * Pila de carpetas: cada pestaña lleva a una sección y la carpeta del frente, abierta,
 * sigue hacia abajo con el contenido (`children`).
 */
export function Carpetas({
  carpetas,
  frente,
  idFrente,
  children,
}: {
  carpetas: Carpeta[];
  /** La pestaña de la carpeta abierta: es el título (h2) de lo que va dentro. */
  frente: string;
  /** Para enlazar la carpeta abierta con `#…`. */
  idFrente?: string;
  children: ReactNode;
}) {
  const tx = useTextosPortada();
  const idPropio = useId();
  const idTitulo = `${idFrente ?? idPropio}-titulo`;
  const pestana = (i: number) =>
    ({
      "--x-movil": POSICIONES[i % POSICIONES.length].movil,
      "--x": POSICIONES[i % POSICIONES.length].ancho,
    }) as CSSProperties;
  return (
    <div className="mx-auto mt-12 w-full sm:mt-16 md:w-[86%]">
      <nav aria-label={tx.menu.secciones}>
        <ul>
          {carpetas.map((c, i) => (
            <li key={c.id} className={cn("relative", i > 0 && "-mt-8 md:-mt-10")}>
              <a
                href={`#${c.id}`}
                style={pestana(i)}
                className={cn(
                  "carpeta-pestana ml-(--x-movil) inline-flex h-8 items-center px-6 text-[15px] font-bold transition-transform duration-200 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:ml-(--x) md:h-10 md:px-8 md:text-lg",
                  c.fondo,
                  c.texto,
                )}
              >
                {c.nombre}
              </a>
              <div className={cn("h-13 md:h-16", c.fondo)} />
            </li>
          ))}
        </ul>
      </nav>
      <section id={idFrente} aria-labelledby={idTitulo} className="relative scroll-mt-4 -mt-8 md:-mt-10">
        <h2
          id={idTitulo}
          style={pestana(carpetas.length)}
          className="carpeta-pestana ml-(--x-movil) inline-flex h-8 items-center bg-background px-6 font-sans text-[15px] font-bold text-azul-profundo md:ml-(--x) md:h-10 md:px-8 md:text-lg"
        >
          {frente}
        </h2>
        <div className="bg-background text-foreground">{children}</div>
      </section>
    </div>
  );
}

/** Festones del borde superior del pie: una fila de semicírculos del color del papel. */
function Festones() {
  const id = useId();
  return (
    <svg aria-hidden="true" className="block h-8 w-full md:h-12" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="64" height="32" patternUnits="userSpaceOnUse" className="md:hidden">
          <circle cx="32" cy="32" r="32" fill="var(--background)" />
        </pattern>
        <pattern id={`${id}-g`} width="96" height="48" patternUnits="userSpaceOnUse">
          <circle cx="48" cy="48" r="48" fill="var(--background)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} className="md:hidden" />
      <rect width="100%" height="100%" fill={`url(#${id}-g)`} className="hidden md:block" />
    </svg>
  );
}

/** El pie es el reverso de la tarjeta: despedida a la izquierda, direcciones y estampilla a la derecha. */
export function PieTarjeta() {
  const { t } = useIdioma();
  const tx = useTextosPortada();
  const enlace =
    "inline-flex min-h-11 items-center text-[17px] font-semibold text-azul-profundo underline-offset-4 decoration-2 transition-colors hover:text-azul-medio hover:underline md:text-lg";
  return (
    <footer className={cn("bg-azul-profundo pt-24 pb-16 md:pt-40 md:pb-24", MARGEN)}>
      <div className={cn(ANCHO, "lg:px-[8.33%]")}>
        <Festones />
        <div className="bg-background px-6 pt-8 pb-8 text-foreground md:px-12 md:pt-10">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div {...aparecer(0)}>
              <h2 className="text-[1.75rem] leading-tight font-semibold text-azul-profundo md:text-[2rem]">
                {tx.pie.despedida}
              </h2>
              <p className="mt-4 max-w-[46ch] text-base leading-relaxed">{tx.pie.mensaje}</p>
            </div>
            <div className="flex items-start justify-between gap-6" {...aparecer(1)}>
              <ul className="flex flex-col gap-1">
                <li>
                  <Link to="/preguntas" className={enlace}>
                    {tx.pie.preguntas}
                  </Link>
                </li>
                <li>
                  <Link to="/informacion" className={enlace}>
                    {tx.pie.informacion}
                  </Link>
                </li>
                <li>
                  <Link to="/admin/login" className={enlace}>
                    {tx.pie.entrar}
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${CORREO_CONTACTO}`} className={enlace}>
                    {CORREO_CONTACTO}
                  </a>
                </li>
              </ul>
              <figure className="w-16 shrink-0 bg-white p-1.5 md:w-22">
                <Cuadro nombre="bendecir" className="aspect-3/4 w-full object-[34%_50%]" />
              </figure>
            </div>
          </div>
          <p className="mt-12 text-center text-[13px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()} {t.comun.nombreApp} · {tx.pie.creditos}
          </p>
        </div>
      </div>
    </footer>
  );
}
