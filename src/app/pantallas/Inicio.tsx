import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/app/api";
import { useIdioma } from "@/app/i18n";
import { SelectorIdioma } from "@/app/components/SelectorIdioma";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

/** Página temporal para comprobar el scaffold: tema, i18n y conexión con la API. */
export function Inicio() {
  const { t, formatearFecha } = useIdioma();
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    api.api.salud
      .$get()
      .then((r) => r.json())
      .then((d) => setApiOk(d.ok))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl text-primary">{t.comun.nombreApp}</h1>
        <SelectorIdioma />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg first-letter:uppercase">{formatearFecha("2026-11-01")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span>Élderes</span>
            <Badge className="bg-dorado-claro text-azul-profundo">{t.publico.libre}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Hermanas</span>
            <Badge variant="secondary">{t.publico.tomado}</Badge>
          </div>
          <Button onClick={() => toast.error(t.errores.TURNO_TOMADO)}>{t.publico.anotarme}</Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        API: {apiOk === null ? t.comun.cargando : apiOk ? "OK" : "sin conexión"}
      </p>
    </main>
  );
}
