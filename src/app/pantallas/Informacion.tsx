import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useTitulo } from "@/app/hooks";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { buttonVariants } from "@/app/components/ui/button";
import type { Idioma } from "@/shared/idiomas";
import { ANCHO, aparecer, BarraSuperior, Carpetas, EnlaceCorreo, MARGEN, PieTarjeta, SeccionHoja, useAparecer } from "./portada/marco";

/** Código de idioma que usa el sitio de la Iglesia en `?lang=`. */
const LANG_IGLESIA: Record<Idioma, string> = { es: "spa", pt: "por", en: "eng" };

/**
 * `/informacion` — qué es la app, aviso de que no es oficial, datos que guarda y enlaces oficiales.
 * Usa el marco de la portada: carpetas con una pestaña por sección.
 */
export function Informacion() {
  const { t, idioma } = useIdioma();
  const i = t.informacion;
  useTitulo(i.titulo);
  useAparecer();
  const { hash } = useLocation();

  // La página carga de forma diferida: el navegador no siempre llega solo al ancla.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const sitio = `https://www.churchofjesuschrist.org/?lang=${LANG_IGLESIA[idioma]}`;
  const misioneros = `https://www.churchofjesuschrist.org/comeuntochrist?lang=${LANG_IGLESIA[idioma]}`;

  const carpetas = [
    { id: "tus-datos", nombre: i.datosTitulo, fondo: "bg-cielo", texto: "text-azul-profundo" },
    { id: "sitio-oficial", nombre: i.iglesiaTitulo, fondo: "bg-dorado-claro", texto: "text-azul-profundo" },
    { id: "contacto", nombre: i.contactoTitulo, fondo: "bg-azul-medio", texto: "text-white" },
  ];

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
              {i.titulo}
            </h1>
            <p {...aparecer(1)} className="mt-6 max-w-[52ch] text-lg leading-relaxed md:text-xl">
              {i.queEs}
            </p>
          </div>
        </div>
      </header>
      <main className={cn(ANCHO, MARGEN)}>
        {/* El aviso de que no es oficial es la carpeta abierta: su pestaña es el título. */}
        <Carpetas carpetas={carpetas} frente={i.noOficialTitulo} idFrente="no-oficial">
          <div className="px-4 pb-16 md:px-8 md:pb-24">
            <SeccionHoja id="aviso" cuadro="elderes">
              <p className="text-xl leading-snug text-azul-profundo md:text-2xl">{i.noOficial}</p>
            </SeccionHoja>

            <SeccionHoja id="tus-datos" titulo={i.datosTitulo} cuadro="visita">
              <p>{i.datosIntro}</p>
              <ul className="list-disc space-y-1 pl-5">
                {i.datosLista.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p>{i.datosPublico}</p>
              <p>{i.datosTelefono}</p>
              <p>{i.datosToken}</p>
              <p>{i.datosBorrar}</p>
              <p>{i.datosEliminarBarrio}</p>
            </SeccionHoja>

            <SeccionHoja id="sitio-oficial" titulo={i.iglesiaTitulo} cuadro="misioneras">
              <p>{i.iglesiaTexto}</p>
              <div className="flex flex-col items-start gap-1">
                <EnlaceExterno href={sitio}>{i.iglesiaSitio}</EnlaceExterno>
                <EnlaceExterno href={misioneros}>{i.iglesiaMisioneros}</EnlaceExterno>
              </div>
            </SeccionHoja>

            <SeccionHoja id="contacto" titulo={i.contactoTitulo} cuadro="cena">
              <p>
                {i.contactoTexto} <EnlaceCorreo className="text-azul-medio hover:text-azul-profundo" />.
              </p>
              <Link
                to="/solicitar"
                className={cn(buttonVariants({ variant: "accion", size: "lg" }), "h-14 px-8 text-lg")}
              >
                {i.contactoEnlace}
              </Link>
            </SeccionHoja>
          </div>
        </Carpetas>
      </main>
      <PieTarjeta />
    </div>
  );
}

function EnlaceExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 font-bold text-azul-medio underline decoration-2 underline-offset-4 transition-colors hover:text-azul-profundo"
    >
      {children}
      <ExternalLinkIcon className="size-4" aria-hidden="true" />
    </a>
  );
}
