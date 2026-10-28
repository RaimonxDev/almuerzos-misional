import { IDIOMAS, NOMBRES_IDIOMA, useIdioma } from "@/app/i18n";
import { esIdioma } from "@/shared/idiomas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

export function SelectorIdioma() {
  const { idioma, cambiarIdioma, t } = useIdioma();
  return (
    <Select value={idioma} onValueChange={(v) => esIdioma(v) && cambiarIdioma(v)}>
      <SelectTrigger aria-label={t.comun.idioma} className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {IDIOMAS.map((i) => (
          <SelectItem key={i} value={i}>
            {NOMBRES_IDIOMA[i]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
