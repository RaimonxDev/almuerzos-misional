import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClient } from "@/app/auth";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { cn } from "@/app/lib/utils";
import type { CodigoError } from "@/shared/errores";
import { Encabezado } from "@/app/components/Encabezado";
import { AlertaError, AvisoAmbar } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { CamposContrasenaNueva, codigoDeErrorAuth, validarContrasenaNueva } from "./contrasena";

/**
 * Mientras la pantalla está abierta, el navegador no manda `Referer` a nadie. El token ya no
 * está en la URL (ver `Restablecer`), pero así tampoco queda en la del primer render.
 */
function useSinReferer() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}

/**
 * El token se saca de la URL al leerlo, pero se guarda en `sessionStorage` (solo esta pestaña) para
 * que recargar, o que el móvil descarte la pestaña mientras se busca el gestor de contraseñas, no
 * lo pierda. Se borra al terminar.
 */
const CLAVE_TOKEN = "restablecer-token";

function leerToken(deLaUrl: string | null) {
  try {
    if (deLaUrl) sessionStorage.setItem(CLAVE_TOKEN, deLaUrl);
    return deLaUrl ?? sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return deLaUrl;
  }
}

function olvidarToken() {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

/**
 * `/admin/restablecer?token=…` — el enlace del correo de "¿Olvidaste tu contraseña?". El token se
 * lee una vez y se saca de la URL (no queda en el historial ni en el título).
 */
export function Restablecer() {
  const { t } = useIdioma();
  const r = t.restablecer;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token] = useState(() => leerToken(params.get("token")));
  const [error, setError] = useState<CodigoError | null>(null);
  const [estado, setEstado] = useState<"formulario" | "invalido" | "lista">(token ? "formulario" : "invalido");
  const [enviando, setEnviando] = useState(false);
  useTitulo(r.titulo);
  useSinReferer();

  useEffect(() => {
    if (params.has("token")) navigate("/admin/restablecer", { replace: true });
  }, [params, navigate]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const validada = validarContrasenaNueva(form);
    if ("error" in validada) return setError(validada.error);
    const { nueva } = validada;
    setError(null);
    setEnviando(true);
    try {
      const { error: fallo } = await authClient.resetPassword({ newPassword: nueva, token: token! });
      if (fallo?.code === "INVALID_TOKEN") {
        olvidarToken();
        return setEstado("invalido");
      }
      if (fallo) return setError(codigoDeErrorAuth(fallo));
      olvidarToken();
      setEstado("lista");
    } catch {
      setError("ERROR_INTERNO");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado antetitulo={t.login.antetitulo} titulo={r.titulo} />
      <main className="mx-auto max-w-xl px-4 pt-[18px] pb-8">
        {estado === "invalido" && (
          <div className="flex flex-col gap-4">
            <AvisoAmbar>{r.invalido}</AvisoAmbar>
            <Link to="/admin/olvide" className={buttonVariants({ variant: "accion", size: "lg" })}>
              {r.pedirOtro}
            </Link>
          </div>
        )}
        {estado === "lista" && (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="rounded-xl border border-exito/20 bg-exito-suave px-3.5 py-3 text-sm leading-snug text-exito"
            >
              {r.lista}
            </p>
            <Link to="/admin/login" className={buttonVariants({ variant: "accion", size: "lg" })}>
              {r.entrar}
            </Link>
          </div>
        )}
        {estado === "formulario" && (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            <p className="text-[15px] leading-normal text-muted-foreground">{r.intro}</p>
            <CamposContrasenaNueva error={error} />
            {error && <AlertaError>{t.errores[error]}</AlertaError>}
            <Button type="submit" variant="accion" size="lg" disabled={enviando}>
              {enviando ? r.guardando : r.guardar}
            </Button>
            <Link to="/admin/login" className={cn(buttonVariants({ variant: "ghost" }), "self-center")}>
              {t.olvide.volver}
            </Link>
          </form>
        )}
      </main>
    </>
  );
}
