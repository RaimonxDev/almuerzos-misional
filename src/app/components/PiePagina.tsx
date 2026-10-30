import { Link } from "react-router";
import { useIdioma } from "@/app/i18n";

/**
 * Pie corto de las pantallas públicas. Es un link interno a `/informacion` y no lleva nada de la
 * URL actual: es igual en todas las pantallas y no filtra nada de donde está la persona.
 */
export function PiePagina() {
  const { t } = useIdioma();
  return (
    <footer className="mx-auto max-w-xl px-4 pt-2 pb-6 text-center text-[13px] text-muted-foreground">
      <Link to="/informacion" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        {t.informacion.pie}
      </Link>
    </footer>
  );
}
