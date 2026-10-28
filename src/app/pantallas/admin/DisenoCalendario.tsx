import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { EyeIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import {
  useGuardarPersonalizacion,
  useMesAdmin,
  useQuitarImagen,
  useSubirImagen,
} from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { AjustarAlAncho } from "@/app/components/AjustarAlAncho";
import { CalendarioImpreso, TEMAS } from "@/app/components/CalendarioImpreso";
import { AlertaError } from "@/app/components/Estado";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Textarea } from "@/app/components/ui/textarea";
import type { CodigoError } from "@/shared/errores";
import {
  esquemaPersonalizacion,
  MAX_BYTES_IMAGEN,
  MAX_ESCRITURA,
  MAX_ESCRITURA_REF,
  MAX_MENSAJE,
  PLANTILLAS,
  TIPOS_IMAGEN,
  type Plantilla,
} from "@/shared/personalizacion";

type Barrio = { nombre: string; contactoNombre: string | null; contactoTelefono: string | null };

/** Sección "Diseño del calendario" del mes visible: textos, plantilla, imagen y vista previa (maqueta 3). */
export function DisenoCalendario({ slug, periodo, barrio }: { slug: string; periodo: string; barrio: Barrio }) {
  const mes = useMesAdmin(slug, periodo).data;
  if (!mes) return null;
  // Con `key`, cambiar de mes parte de cero (textos a medio escribir del otro mes).
  return <Formulario key={periodo} slug={slug} periodo={periodo} barrio={barrio} datos={mes} />;
}

type DatosMes = NonNullable<ReturnType<typeof useMesAdmin>["data"]>;

function Formulario({ slug, periodo, barrio, datos }: { slug: string; periodo: string; barrio: Barrio; datos: DatosMes }) {
  const { t } = useIdioma();
  const d = t.calendario.diseno;
  const guardado = {
    escritura: datos.mes.escritura ?? "",
    escrituraRef: datos.mes.escrituraRef ?? "",
    mensaje: datos.mes.mensaje ?? "",
    plantilla: datos.mes.plantilla as Plantilla,
  };
  const [valores, setValores] = useState(guardado);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [errorLocal, setErrorLocal] = useState<CodigoError | null>(null);
  const guardar = useGuardarPersonalizacion(slug, periodo);
  const subir = useSubirImagen(slug, periodo);
  const quitar = useQuitarImagen(slug, periodo);
  const archivo = useRef<HTMLInputElement>(null);

  const cambios = Object.fromEntries(
    (Object.keys(guardado) as (keyof typeof guardado)[])
      .filter((k) => valores[k] !== guardado[k])
      .map((k) => [k, valores[k]]),
  );
  const hayCambios = Object.keys(cambios).length > 0;
  const poner = <K extends keyof typeof valores>(campo: K, valor: (typeof valores)[K]) =>
    setValores((v) => ({ ...v, [campo]: valor }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!hayCambios) return;
    guardar.reset();
    if (!esquemaPersonalizacion.safeParse(cambios).success) return setErrorLocal("DATOS_INVALIDOS");
    setErrorLocal(null);
    guardar.mutate(cambios, { onSuccess: () => toast.success(d.guardado) });
  };

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!elegido) return;
    subir.reset();
    if (!(TIPOS_IMAGEN as readonly string[]).includes(elegido.type)) return setErrorLocal("IMAGEN_INVALIDA");
    if (elegido.size > MAX_BYTES_IMAGEN) return setErrorLocal("IMAGEN_MUY_GRANDE");
    setErrorLocal(null);
    subir.mutate(elegido, { onSuccess: () => toast.success(d.imagenSubida) });
  };

  const quitarImagen = () => {
    setErrorLocal(null);
    quitar.mutate(undefined, { onSuccess: () => toast.success(d.imagenQuitada) });
  };

  const imagenKey = datos.mes.imagenKey;
  const codigoError =
    errorLocal ?? (guardar.isError ? codigoDe(guardar.error) : subir.isError ? codigoDe(subir.error) : quitar.isError ? codigoDe(quitar.error) : null);
  const ocupado = subir.isPending || quitar.isPending;

  return (
    <section aria-labelledby="diseno-titulo" className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-4">
      <h2 id="diseno-titulo" className="font-sans text-base font-extrabold text-azul-profundo">
        {d.titulo}
      </h2>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{d.imagen}</span>
        <input
          ref={archivo}
          type="file"
          accept={TIPOS_IMAGEN.join(",")}
          aria-label={d.subirImagen}
          className="sr-only"
          tabIndex={-1}
          onChange={elegirArchivo}
        />
        {imagenKey ? (
          <div className="flex items-center gap-3">
            <img
              src={`/api/imagenes/${imagenKey}`}
              alt={d.imagen}
              className="h-16 w-24 shrink-0 rounded-[10px] border object-cover"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={ocupado} onClick={() => archivo.current?.click()} className="rounded-[10px] font-bold">
                {subir.isPending ? d.subiendo : d.cambiar}
              </Button>
              <Button type="button" variant="ghost" disabled={ocupado} onClick={quitarImagen} className="font-bold text-destructive hover:text-destructive">
                {d.quitar}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => archivo.current?.click()}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed border-azul-medio/40 bg-cielo-claro px-3 py-3 text-azul-profundo disabled:opacity-60"
          >
            <ImageIcon aria-hidden="true" className="size-6 text-azul-medio" />
            <span className="text-sm font-bold">{subir.isPending ? d.subiendo : d.subirImagen}</span>
            <span className="text-xs text-muted-foreground">{d.imagenAyuda}</span>
          </button>
        )}
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="diseno-escritura">{d.escritura}</Label>
          <Textarea
            id="diseno-escritura"
            rows={3}
            maxLength={MAX_ESCRITURA}
            value={valores.escritura}
            onChange={(e) => poner("escritura", e.target.value)}
            placeholder={d.escrituraPlaceholder}
            className="resize-y rounded-[10px] font-serif italic"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="diseno-referencia">{d.referencia}</Label>
          <Input
            id="diseno-referencia"
            maxLength={MAX_ESCRITURA_REF}
            value={valores.escrituraRef}
            onChange={(e) => poner("escrituraRef", e.target.value)}
            placeholder={d.referenciaPlaceholder}
            className="rounded-[10px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="diseno-mensaje">{d.mensaje}</Label>
          <Input
            id="diseno-mensaje"
            maxLength={MAX_MENSAJE}
            value={valores.mensaje}
            onChange={(e) => poner("mensaje", e.target.value)}
            placeholder={d.mensajePlaceholder}
            className="rounded-[10px]"
          />
        </div>

        <RadioGroup
          aria-label={d.plantilla}
          value={valores.plantilla}
          onValueChange={(v) => poner("plantilla", v as Plantilla)}
          className="grid-cols-3 gap-2"
        >
          {PLANTILLAS.map((p) => (
            <label
              key={p}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border p-2 text-center text-xs font-bold text-azul-profundo",
                valores.plantilla === p && "border-2 border-azul-medio bg-cielo-claro",
              )}
            >
              <span aria-hidden="true" className="h-6 w-full rounded-md border" style={{ background: TEMAS[p].fondo }} />
              <span className="flex items-center gap-1.5">
                <RadioGroupItem value={p} />
                {d[p]}
              </span>
            </label>
          ))}
        </RadioGroup>

        {codigoError && <AlertaError>{t.errores[codigoError]}</AlertaError>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setVistaPrevia(true)} className="rounded-[10px] font-bold">
            <EyeIcon aria-hidden="true" />
            {d.vistaPreviaBoton}
          </Button>
          <Button type="submit" disabled={!hayCambios || guardar.isPending} className="rounded-[10px] font-bold">
            {d.guardar}
          </Button>
        </div>
      </form>

      <Dialog open={vistaPrevia} onOpenChange={setVistaPrevia}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-[1200px]">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-xl text-azul-profundo">{t.calendario.vistaPrevia}</DialogTitle>
          </DialogHeader>
          <AjustarAlAncho>
            <CalendarioImpreso
              barrio={barrio}
              mes={{
                ...datos.mes,
                plantilla: valores.plantilla,
                escritura: valores.escritura.trim() || null,
                escrituraRef: valores.escrituraRef.trim() || null,
                mensaje: valores.mensaje.trim() || null,
              }}
              companerismos={datos.companerismos}
              turnos={datos.turnos}
            />
          </AjustarAlAncho>
          <div className="flex justify-end">
            <Link to={`/admin/${slug}/${periodo}/imprimir`} className={cn(buttonVariants({ variant: "accion" }), "px-5")}>
              {d.irAlImprimible}
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
