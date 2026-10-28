import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { codigoDe, ErrorApi } from "@/app/api";
import { useYo } from "@/app/consultas";
import { type TipoCompanerismo, useCrearBarrio } from "@/app/consultas-admin";
import { IDIOMAS, mensajesDe, NOMBRES_IDIOMA, useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { cn } from "@/app/lib/utils";
import type { Idioma } from "@/shared/idiomas";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { AlertaError, Aviso } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { EncabezadoAdmin } from "./EncabezadoAdmin";

/** Mismas reglas que la API (`rutas/admin/cuenta.ts`). */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TIPOS: TipoCompanerismo[] = ["elderes", "hermanas"];

/** "Barrio Ñuñoa 2" → "barrio-nunoa-2" */
export const sugerirSlug = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

const zonaDelNavegador = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Santiago";

type Campo = "nombre" | "slug" | "zonaHoraria" | "companerismos";

/** `/admin/nuevo-barrio` — solo el super admin crea barrios. */
export function NuevoBarrioRuta() {
  return (
    <RutaAdmin>
      <NuevoBarrio />
    </RutaAdmin>
  );
}

function NuevoBarrio() {
  const { t } = useIdioma();
  const nb = t.nuevoBarrio;
  const { usuario } = useYo().data!;
  const navigate = useNavigate();
  const crear = useCrearBarrio();
  const id = useId();
  useTitulo(nb.titulo);

  const [nombre, setNombre] = useState("");
  /** `null` mientras el enlace siga la sugerencia del nombre. */
  const [slugEscrito, setSlugEscrito] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [zonaHoraria, setZonaHoraria] = useState(zonaDelNavegador);
  const [tipos, setTipos] = useState<TipoCompanerismo[]>(TIPOS);
  const [errores, setErrores] = useState<Campo[]>([]);
  const slug = slugEscrito ?? sugerirSlug(nombre);

  if (!usuario.superAdmin) {
    return (
      <>
        <EncabezadoAdmin />
        <Aviso>{t.errores.SIN_PERMISO}</Aviso>
      </>
    );
  }

  // Nombres por defecto en el idioma del barrio: es lo que verán las hermanas.
  const nombreTipo = (tipo: TipoCompanerismo) =>
    tipo === "elderes" ? mensajesDe(idioma).panel.tipoElderes : mensajesDe(idioma).panel.tipoHermanas;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const malos: Campo[] = [];
    if (nombre.trim().length < 2) malos.push("nombre");
    if (slug.length < 2 || !SLUG.test(slug)) malos.push("slug");
    if (!zonaValida(zonaHoraria.trim())) malos.push("zonaHoraria");
    if (tipos.length === 0) malos.push("companerismos");
    setErrores(malos);
    if (malos.length > 0) return;

    crear.mutate(
      {
        nombre: nombre.trim(),
        slug,
        idioma,
        zonaHoraria: zonaHoraria.trim(),
        // En el orden de TIPOS, no en el que se marcaron.
        companerismos: TIPOS.filter((tipo) => tipos.includes(tipo)).map((tipo) => ({ tipo, nombre: nombreTipo(tipo) })),
      },
      {
        onSuccess: ({ barrio }) => {
          toast.success(nb.creado(barrio.nombre));
          navigate(`/admin/${barrio.slug}`);
        },
        onError: (err) => {
          if (err instanceof ErrorApi && err.campos) setErrores(err.campos as Campo[]);
        },
      },
    );
  };

  const errorDe = (campo: Campo, texto: string) =>
    errores.includes(campo) && (
      <p id={`${id}-${campo}-error`} className="text-sm font-semibold text-destructive">
        {texto}
      </p>
    );
  const invalido = (campo: Campo) => ({
    "aria-invalid": errores.includes(campo) || undefined,
    "aria-describedby": errores.includes(campo) ? `${id}-${campo}-error` : undefined,
  });
  const codigo = crear.isError ? codigoDe(crear.error) : null;

  return (
    <>
      <EncabezadoAdmin />
      <main className="mx-auto flex max-w-[560px] flex-col gap-5 px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[26px] font-semibold text-azul-profundo">{nb.titulo}</h1>
          <p className="text-muted-foreground">{nb.intro}</p>
        </div>

        <form onSubmit={enviar} noValidate className="flex flex-col gap-4 rounded-[14px] border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-nombre`}>{nb.nombre}</Label>
            <Input
              id={`${id}-nombre`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              autoComplete="off"
              className="rounded-[10px]"
              {...invalido("nombre")}
            />
            {errorDe("nombre", nb.errorNombre)}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-slug`}>{nb.enlace}</Label>
            <Input
              id={`${id}-slug`}
              value={slug}
              onChange={(e) => setSlugEscrito(e.target.value.toLowerCase())}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="rounded-[10px]"
              {...invalido("slug")}
            />
            {errorDe("slug", nb.errorEnlace)}
            <p className="text-sm text-muted-foreground">{nb.ayudaEnlace(`${location.host}/${slug || "…"}`)}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-idioma`}>{nb.idioma}</Label>
            <Select items={NOMBRES_IDIOMA} value={idioma} onValueChange={(v) => v && setIdioma(v as Idioma)}>
              <SelectTrigger id={`${id}-idioma`} className="w-full rounded-[10px]">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-zona`}>{nb.zonaHoraria}</Label>
            <Input
              id={`${id}-zona`}
              value={zonaHoraria}
              onChange={(e) => setZonaHoraria(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="rounded-[10px]"
              {...invalido("zonaHoraria")}
            />
            {errorDe("zonaHoraria", nb.errorZona)}
            <p className="text-sm text-muted-foreground">{nb.ayudaZona}</p>
          </div>

          <fieldset className="flex flex-col gap-2" {...invalido("companerismos")}>
            <legend className="mb-1.5 text-sm font-bold">{nb.companerismos}</legend>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((tipo) => (
                <label
                  key={tipo}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 font-bold text-azul-profundo",
                    tipos.includes(tipo) && "border-2 border-azul-medio bg-cielo-claro",
                  )}
                >
                  <Checkbox
                    checked={tipos.includes(tipo)}
                    onCheckedChange={(v) => setTipos((ts) => (v ? [...ts, tipo] : ts.filter((x) => x !== tipo)))}
                  />
                  {nombreTipo(tipo)}
                </label>
              ))}
            </div>
            {errorDe("companerismos", nb.errorCompanerismos)}
            <p className="text-sm text-muted-foreground">{nb.ayudaCompanerismos}</p>
          </fieldset>

          {codigo && codigo !== "DATOS_INVALIDOS" && <AlertaError>{t.errores[codigo]}</AlertaError>}

          <div className="flex flex-wrap justify-end gap-2">
            <Link to="/admin" className={cn(buttonVariants({ variant: "ghost" }), "rounded-[10px] font-bold")}>
              {nb.volver}
            </Link>
            <Button type="submit" disabled={crear.isPending} className="rounded-[10px] font-bold">
              {nb.crear}
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}
