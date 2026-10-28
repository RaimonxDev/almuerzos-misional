import { GlobeIcon } from "lucide-react";
import { IDIOMAS, NOMBRES_IDIOMA, useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { esIdioma } from "@/shared/idiomas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

/** `oscuro`: para el encabezado azul. */
export function SelectorIdioma({ oscuro = false }: { oscuro?: boolean }) {
  const { idioma, cambiarIdioma, t } = useIdioma();
  return (
    // `items`: así el trigger muestra "Português" y no el valor "pt".
    <Select items={NOMBRES_IDIOMA} value={idioma} onValueChange={(v) => esIdioma(v) && cambiarIdioma(v)}>
      <SelectTrigger
        aria-label={t.comun.idioma}
        className={cn(
          "w-auto gap-1.5 font-semibold",
          oscuro && "border-white/25 bg-white/10 text-white [&_svg]:text-white/80! hover:bg-white/15",
        )}
      >
        <GlobeIcon aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {IDIOMAS.map((i) => (
          <SelectItem key={i} value={i} className="min-h-11">
            {NOMBRES_IDIOMA[i]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
