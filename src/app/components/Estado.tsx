import { InfoIcon, LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { codigoDe } from "@/app/api";
import { useIdioma } from "@/app/i18n";
import { Button } from "./ui/button";

export function Cargando() {
  const { t } = useIdioma();
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <LoaderCircleIcon className="size-5 animate-spin" aria-hidden="true" />
      {t.comun.cargando}
    </div>
  );
}

/** Mensaje centrado para estados vacíos o errores, con una acción opcional. */
export function Aviso({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center text-[15px] leading-relaxed text-muted-foreground">
      <p className="max-w-sm">{children}</p>
      {accion}
    </div>
  );
}

export function ErrorCarga({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const { t } = useIdioma();
  const codigo = codigoDe(error);
  return (
    <Aviso
      accion={
        reintentar &&
        codigo === "ERROR_INTERNO" && (
          <Button variant="accion-outline" onClick={reintentar}>
            {t.comun.reintentar}
          </Button>
        )
      }
    >
      {t.errores[codigo]}
    </Aviso>
  );
}

/** Recuadro ámbar con ícono, para notas que hay que tener en cuenta. */
export function AvisoAmbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-aviso-borde bg-aviso-suave px-3.5 py-3">
      <InfoIcon className="mt-px size-5 shrink-0 text-aviso" aria-hidden="true" />
      <p className="text-[13px] leading-snug text-aviso-texto">{children}</p>
    </div>
  );
}

/** Error de una acción (guardar, cancelar), anunciado a lectores de pantalla. */
export function AlertaError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold text-destructive">
      {children}
    </p>
  );
}
