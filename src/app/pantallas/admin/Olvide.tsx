import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { authClient } from "@/app/auth";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { cn } from "@/app/lib/utils";
import type { CodigoError } from "@/shared/errores";
import { Encabezado } from "@/app/components/Encabezado";
import { AlertaError } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

/**
 * `/admin/olvide` — pide el enlace para restablecer la contraseña. La respuesta es la misma
 * exista o no la cuenta (Better Auth no lo revela), así que la pantalla tampoco.
 */
export function Olvide() {
  const { t } = useIdioma();
  const o = t.olvide;
  const [error, setError] = useState<CodigoError | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  useTitulo(o.titulo);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setEnviando(true);
    try {
      const { error: fallo } = await authClient.requestPasswordReset({ email: String(form.get("email")).trim() });
      if (fallo) return setError(fallo.status === 429 ? "DEMASIADOS_INTENTOS" : "ERROR_INTERNO");
      setEnviado(true);
    } catch {
      setError("ERROR_INTERNO");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado antetitulo={t.login.antetitulo} titulo={o.titulo} />
      <main className="mx-auto max-w-xl px-4 pt-[18px] pb-8">
        {enviado ? (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="rounded-xl border border-exito/20 bg-exito-suave px-3.5 py-3 text-sm leading-snug text-exito"
            >
              {o.enviado}
            </p>
            <Link to="/admin/login" className={buttonVariants({ variant: "accion-outline", size: "lg" })}>
              {o.volver}
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <p className="text-[15px] leading-normal text-muted-foreground">{o.intro}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="olvide-email">{t.login.correo}</Label>
              <Input id="olvide-email" name="email" type="email" autoComplete="email" required />
            </div>
            {error && <AlertaError>{t.errores[error]}</AlertaError>}
            <Button type="submit" variant="accion" size="lg" disabled={enviando}>
              {enviando ? o.enviando : o.enviar}
            </Button>
            <Link to="/admin/login" className={cn(buttonVariants({ variant: "ghost" }), "self-center")}>
              {o.volver}
            </Link>
          </form>
        )}
      </main>
    </>
  );
}
