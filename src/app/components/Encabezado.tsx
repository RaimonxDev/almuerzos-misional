import type { ReactNode } from "react";
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
