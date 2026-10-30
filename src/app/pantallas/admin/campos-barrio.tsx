import { type ReactNode, useId, useState } from "react";
import { IDIOMAS, NOMBRES_IDIOMA, useIdioma } from "@/app/i18n";
import type { Idioma } from "@/shared/idiomas";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

/** Campos compartidos por "Nuevo barrio" (`FormularioBarrio`) y "Datos del barrio" (`BarraLateral`). */

/** Idioma de un barrio (no el de la pantalla). */
export function SelectIdiomaBarrio({ id, value, onChange }: { id: string; value: Idioma; onChange: (idioma: Idioma) => void }) {
  return (
    // `items`: así el trigger muestra "Português" y no el valor "pt".
    <Select items={NOMBRES_IDIOMA} value={value} onValueChange={(v) => v && onChange(v as Idioma)}>
      <SelectTrigger id={id} className="w-full rounded-[10px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {IDIOMAS.map((i) => (
          <SelectItem key={i} value={i} className="min-h-11">
            {NOMBRES_IDIOMA[i]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Errores por campo de un formulario: `errorDe` pinta el mensaje y `invalido` lo enlaza al input.
 * `quitar` saca el error de un campo cuando la persona lo corrige.
 */
export function useErroresCampos<C extends string>() {
  const id = useId();
  const [errores, setErrores] = useState<C[]>([]);
  const errorDe = (campo: C, texto: string) =>
    errores.includes(campo) && (
      <p id={`${id}-${campo}-error`} className="text-sm font-semibold text-destructive">
        {texto}
      </p>
    );
  const invalido = (campo: C) => ({
    "aria-invalid": errores.includes(campo) || undefined,
    "aria-describedby": errores.includes(campo) ? `${id}-${campo}-error` : undefined,
  });
  const quitar = (campo: C) => setErrores((es) => (es.includes(campo) ? es.filter((c) => c !== campo) : es));
  return { errores, setErrores, errorDe, invalido, quitar };
}

/** Zona horaria IANA, con su ayuda y el error si `invalida`. */
export function CampoZona({
  id,
  value,
  onChange,
  error,
  invalido,
}: {
  id: string;
  value: string;
  onChange: (zona: string) => void;
  error: ReactNode;
  invalido: { "aria-invalid"?: true; "aria-describedby"?: string };
}) {
  const { t } = useIdioma();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t.nuevoBarrio.zonaHoraria}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="rounded-[10px]"
        {...invalido}
      />
      {error}
      <p className="text-sm text-muted-foreground">{t.nuevoBarrio.ayudaZona}</p>
    </div>
  );
}
