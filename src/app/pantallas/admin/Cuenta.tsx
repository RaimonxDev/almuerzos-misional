import { useId, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/app/auth";
import { useYo } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { cn } from "@/app/lib/utils";
import { PASSWORD_MAX } from "@/shared/cuenta";
import type { CodigoError } from "@/shared/errores";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { AlertaError } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { CamposContrasenaNueva, codigoDeErrorAuth, validarContrasenaNueva } from "./contrasena";
import { EncabezadoAdmin } from "./EncabezadoAdmin";

/** `/admin/cuenta` — cambiar la contraseña; obligatorio si se entró con una temporal. */
export function CuentaRuta() {
  return (
    <RutaAdmin>
      <Cuenta />
    </RutaAdmin>
  );
}

function Cuenta() {
  const { t } = useIdioma();
  const c = t.cuenta;
  const id = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const obligado = useYo().data!.usuario.debeCambiarPassword;
  const formulario = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<CodigoError | null>(null);
  const [cambiada, setCambiada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  useTitulo(c.titulo);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const actual = String(form.get("actual"));
    setCambiada(false);
    const validada = validarContrasenaNueva(form);
    if ("error" in validada) return setError(validada.error);
    const { nueva } = validada;
    setError(null);
    setEnviando(true);
    try {
      const { error: fallo } = await authClient.changePassword({
        currentPassword: actual,
        newPassword: nueva,
        revokeOtherSessions: true,
      });
      if (fallo) return setError(codigoDeErrorAuth(fallo));
      formulario.current?.reset();
      // La marca se apagó en el servidor: `yo` tiene que saberlo antes de volver al panel.
      await queryClient.invalidateQueries({ queryKey: ["admin", "yo"] });
      if (obligado) navigate("/admin", { replace: true });
      else setCambiada(true);
    } catch {
      setError("ERROR_INTERNO");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <EncabezadoAdmin />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-6 pb-8">
        <h1 className="font-serif text-[26px] font-semibold text-azul-profundo">{c.titulo}</h1>
        <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <p className="text-[15px] leading-normal text-muted-foreground">{obligado ? c.obligado : c.intro}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-actual`}>{c.actual}</Label>
            <Input
              id={`${id}-actual`}
              name="actual"
              type="password"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
              required
              aria-invalid={error === "CONTRASENA_INCORRECTA" || undefined}
            />
          </div>
          <CamposContrasenaNueva error={error} />
          {error && <AlertaError>{t.errores[error]}</AlertaError>}
          {cambiada && (
            <p
              role="status"
              className="rounded-xl border border-exito/20 bg-exito-suave px-3.5 py-3 text-sm leading-snug text-exito"
            >
              {c.cambiada}
            </p>
          )}
          <Button type="submit" variant="accion" size="lg" disabled={enviando}>
            {enviando ? c.cambiando : c.cambiar}
          </Button>
          {!obligado && (
            <Link to="/admin" className={cn(buttonVariants({ variant: "ghost" }), "self-center")}>
              {c.volver}
            </Link>
          )}
        </form>
      </main>
    </>
  );
}
