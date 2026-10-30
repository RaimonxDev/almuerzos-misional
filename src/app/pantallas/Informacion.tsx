import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useTitulo } from "@/app/hooks";
import { useIdioma } from "@/app/i18n";
import { Encabezado } from "@/app/components/Encabezado";
import { Aviso } from "@/app/components/Estado";
import { PiePagina } from "@/app/components/PiePagina";
import { buttonVariants } from "@/app/components/ui/button";
import type { Idioma } from "@/shared/idiomas";

/** Código de idioma que usa el sitio de la Iglesia en `?lang=`. */
const LANG_IGLESIA: Record<Idioma, string> = { es: "spa", pt: "por", en: "eng" };

/** `/informacion` — qué es la app, aviso de que no es oficial, datos que guarda y enlaces oficiales. */
export function Informacion() {
  const { t, idioma } = useIdioma();
  const i = t.informacion;
  useTitulo(i.titulo);
  const { hash } = useLocation();

  // La página carga de forma diferida: el navegador no siempre llega solo al ancla.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const sitio = `https://www.churchofjesuschrist.org/?lang=${LANG_IGLESIA[idioma]}`;
  const misioneros = `https://www.churchofjesuschrist.org/comeuntochrist?lang=${LANG_IGLESIA[idioma]}`;

  return (
    <>
      <Encabezado antetitulo={i.antetitulo} titulo={i.titulo} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-5 pb-4">
        <Seccion titulo={i.queEsTitulo}>
          <p>{i.queEs}</p>
        </Seccion>

        <section
          aria-labelledby="no-oficial"
          className="rounded-2xl border border-aviso-borde bg-aviso-suave"
        >
          <h2 id="no-oficial" className="px-5 pt-5 text-xl font-semibold text-aviso-texto">
            {i.noOficialTitulo}
          </h2>
          <Aviso>{i.noOficial}</Aviso>
        </section>

        <Seccion id="tus-datos" titulo={i.datosTitulo}>
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
        </Seccion>

        <Seccion titulo={i.iglesiaTitulo}>
          <p>{i.iglesiaTexto}</p>
          <div className="flex flex-col items-start gap-2">
            <EnlaceExterno href={sitio}>{i.iglesiaSitio}</EnlaceExterno>
            <EnlaceExterno href={misioneros}>{i.iglesiaMisioneros}</EnlaceExterno>
          </div>
        </Seccion>

        <Seccion titulo={i.contactoTitulo}>
          <p>{i.contactoTexto}</p>
          <Link to="/solicitar" className={buttonVariants({ variant: "accion", size: "lg" })}>
            {i.contactoEnlace}
          </Link>
        </Seccion>

        <Link to="/" className={buttonVariants({ variant: "accion-outline", size: "lg" })}>
          {i.volver}
        </Link>
      </main>
      <PiePagina />
    </>
  );
}

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 text-[15px] leading-relaxed">
      <h2 className="text-xl font-semibold text-azul-profundo">{titulo}</h2>
      {children}
    </section>
  );
}

function EnlaceExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-azul-medio underline underline-offset-2"
    >
      {children}
      <ExternalLinkIcon className="size-4" aria-hidden="true" />
    </a>
  );
}
