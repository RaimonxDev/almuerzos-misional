import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon } from "lucide-react";
import { useIdioma } from "@/app/i18n";
import { SelectorIdioma } from "./SelectorIdioma";

/** Banda azul de las pantallas públicas: antetítulo dorado, título en Lora y selector de idioma. */
export function Encabezado({
  antetitulo,
  titulo,
  arriba,
  children,
}: {
  antetitulo?: string;
  titulo: string;
  /** Va a la izquierda del selector de idioma (ej. el link "Volver"). */
  arriba?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useIdioma();
  return (
    <header className="bg-azul-profundo text-white">
      <div className="mx-auto flex max-w-xl flex-col gap-1.5 px-4 pt-3 pb-4">
        <div className="flex min-h-11 items-center justify-between gap-2">
          {arriba ?? (
            <span className="text-xs font-extrabold tracking-[0.12em] text-dorado-claro uppercase">
              {t.comun.nombreApp}
            </span>
          )}
          <SelectorIdioma oscuro />
        </div>
        {antetitulo && (
          <div className="text-xs font-extrabold tracking-[0.12em] text-dorado-claro uppercase">{antetitulo}</div>
        )}
        <h1 className="text-[1.75rem] leading-tight font-semibold first-letter:uppercase">{titulo}</h1>
        {children}
      </div>
    </header>
  );
}

/** "‹ Volver al calendario" para la fila superior del encabezado. */
export function LinkVolver({ to }: { to: string }) {
  const { t } = useIdioma();
  return (
    <Link
      to={to}
      className="-ml-1 flex h-11 items-center gap-1 rounded-lg pr-2.5 text-[15px] font-bold text-white hover:bg-white/10"
    >
      <ChevronLeftIcon className="size-5" aria-hidden="true" />
      {t.formulario.volver}
    </Link>
  );
}
