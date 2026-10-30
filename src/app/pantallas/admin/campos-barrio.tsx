import { IDIOMAS, NOMBRES_IDIOMA } from "@/app/i18n";
import type { Idioma } from "@/shared/idiomas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

/** Idioma de un barrio (no el de la pantalla), compartido por "Nuevo barrio" y "Datos del barrio". */
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
