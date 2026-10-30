import { Link } from "react-router";
import { buttonVariants } from "@/app/components/ui/button";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { Encabezado } from "@/app/components/Encabezado";
import { Aviso } from "@/app/components/Estado";

/** La raíz no lista barrios a propósito: cada barrio comparte su propio enlace. */
export function Inicio() {
  const { t } = useIdioma();
  useTitulo(undefined);
  return (
    <>
      <Encabezado titulo={t.comun.nombreApp} />
      <main className="mx-auto max-w-xl">
        <Aviso>{t.inicio.texto}</Aviso>
        <div className="flex flex-col items-center gap-2 px-4 pb-8 text-center">
          <p className="text-sm text-muted-foreground">{t.inicio.quieresUsar}</p>
          <Link to="/solicitar" className={buttonVariants({ variant: "accion-outline" })}>
            {t.inicio.solicitar}
          </Link>
        </div>
      </main>
    </>
  );
}
