import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/app/auth";
import { useYo } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import type { CodigoError } from "@/shared/errores";
import { Encabezado } from "@/app/components/Encabezado";
import { PiePagina } from "@/app/components/PiePagina";
import { AlertaError } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

/** `/admin/login` — correo y contraseña de los administradores (Better Auth). */
export function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useIdioma();
  const sesion = useYo();
  const [error, setError] = useState<CodigoError | null>(null);
  const [enviando, setEnviando] = useState(false);
  useTitulo(t.login.titulo);

  // Con sesión abierta no hay nada que hacer aquí.
  if (sesion.data) return <Navigate to="/admin" replace />;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setEnviando(true);
    try {
      const { error: fallo } = await authClient.signIn.email({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (fallo) {
        setError(
          fallo.status === 429
            ? "DEMASIADOS_INTENTOS"
            : fallo.code === "BANNED_USER"
              ? "CUENTA_BLOQUEADA"
              : fallo.code === "INVALID_EMAIL_OR_PASSWORD"
                ? "CREDENCIALES_INVALIDAS"
                : "ERROR_INTERNO",
        );
        return;
      }
      // Que `/admin` pida la sesión de nuevo en vez de usar un 401 viejo.
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      navigate("/admin", { replace: true });
    } catch {
      setError("ERROR_INTERNO");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado antetitulo={t.login.antetitulo} titulo={t.login.titulo} />
      <main className="mx-auto max-w-xl px-4 pt-[18px] pb-8">
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <p className="text-[15px] leading-normal text-muted-foreground">{t.login.intro}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">{t.login.correo}</Label>
            <Input id="login-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">{t.login.contrasena}</Label>
            <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && <AlertaError>{t.errores[error]}</AlertaError>}
          <Button type="submit" variant="accion" size="lg" disabled={enviando}>
            {enviando ? t.login.entrando : t.login.entrar}
          </Button>
          <Link to="/admin/olvide" className={cn(buttonVariants({ variant: "link" }), "self-center text-azul-medio")}>
            {t.login.olvido}
          </Link>
        </form>
      </main>
      <PiePagina />
    </>
  );
}
