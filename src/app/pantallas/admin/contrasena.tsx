import { useId } from "react";
import { useIdioma } from "@/app/i18n";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/cuenta";
import type { CodigoError } from "@/shared/errores";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

/** Traduce los errores de Better Auth al cambiar o restablecer la contraseña. */
export function codigoDeErrorAuth(fallo: { status: number; code?: string }): CodigoError {
  if (fallo.status === 429) return "DEMASIADOS_INTENTOS";
  if (fallo.code === "INVALID_PASSWORD") return "CONTRASENA_INCORRECTA";
  if (fallo.code === "PASSWORD_TOO_SHORT") return "CONTRASENA_CORTA";
  return "ERROR_INTERNO";
}

/**
 * Lo que se puede saber antes de llamar a la API (así no gasta intentos): largo mínimo y que la
 * repetida coincida. Lee los campos `nueva` y `repetida` de `CamposContrasenaNueva`.
 */
export function validarContrasenaNueva(form: FormData): { nueva: string } | { error: CodigoError } {
  const nueva = String(form.get("nueva"));
  if (nueva.length < PASSWORD_MIN) return { error: "CONTRASENA_CORTA" };
  if (nueva !== String(form.get("repetida"))) return { error: "CONTRASENAS_DISTINTAS" };
  return { nueva };
}

/** "Contraseña nueva" y "repítela", compartidos por "Mi cuenta" y restablecer. */
export function CamposContrasenaNueva({ error }: { error: CodigoError | null }) {
  const { t } = useIdioma();
  const id = useId();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-nueva`}>{t.cuenta.nueva}</Label>
        <Input
          id={`${id}-nueva`}
          name="nueva"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          required
          aria-describedby={`${id}-ayuda`}
          aria-invalid={error === "CONTRASENA_CORTA" || undefined}
        />
        <p id={`${id}-ayuda`} className="text-[13px] text-muted-foreground">
          {t.cuenta.ayudaNueva}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-repetida`}>{t.cuenta.repetir}</Label>
        <Input
          id={`${id}-repetida`}
          name="repetida"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          required
          aria-invalid={error === "CONTRASENAS_DISTINTAS" || undefined}
        />
      </div>
    </>
  );
}
