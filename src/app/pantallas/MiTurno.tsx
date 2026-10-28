import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { codigoDe } from "@/app/api";
import { useCancelarInscripcion, useEditarInscripcion, useMiInscripcion } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { useBarrioConIdioma, useTitulo } from "@/app/hooks";
import { useMisInscripciones } from "@/app/mis-inscripciones";
import { rutaCalendario } from "@/app/rutas";
import { Encabezado, LinkVolver } from "@/app/components/Encabezado";
import { AlertaError, Aviso, AvisoAmbar, Cargando, ErrorCarga } from "@/app/components/Estado";
import { FormularioInscripcion } from "@/app/components/FormularioInscripcion";
import { Button, buttonVariants } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

/**
 * `/:barrio/mi-turno/:inscripcionId` — ver, editar o cancelar la propia inscripción.
 * El token sale del localStorage de este teléfono; nunca va en la URL.
 *
 * Con `key` por id, cambiar de inscripción sin desmontar la ruta parte de cero
 * (token, edición y diálogo no se arrastran de una a otra).
 */
export function MiTurnoRuta() {
  const { barrio: slug = "", inscripcionId = "" } = useParams();
  return <MiTurno key={`${slug}/${inscripcionId}`} slug={slug} inscripcionId={inscripcionId} />;
}

function MiTurno({ slug, inscripcionId }: { slug: string; inscripcionId: string }) {
  const navigate = useNavigate();
  const { t, formatearFecha } = useIdioma();
  const barrio = useBarrioConIdioma(slug);
  const guardada = useMisInscripciones(slug).find((m) => m.id === inscripcionId);
  // Se fija al entrar: al cancelar, la inscripción desaparece del storage pero la pantalla sigue montada.
  const [token] = useState(guardada?.tokenEdicion);
  const consulta = useMiInscripcion(inscripcionId, token);
  const editar = useEditarInscripcion(inscripcionId, token ?? "", slug);
  const cancelar = useCancelarInscripcion(inscripcionId, token ?? "", slug);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const inscripcion = consulta.data?.inscripcion;
  useTitulo(inscripcion ? formatearFecha(inscripcion.fecha) : undefined);

  const fecha = inscripcion?.fecha ?? guardada?.fecha;
  const volver = rutaCalendario(slug, fecha);
  const botonVolver = (
    <Link to={volver} className={buttonVariants({ variant: "accion", size: "lg" })}>
      {t.formulario.volver}
    </Link>
  );

  if (!inscripcion) {
    const codigo = consulta.isError ? codigoDe(consulta.error) : null;
    return (
      <>
        <Encabezado arriba={<LinkVolver to={volver} />} titulo={fecha ? formatearFecha(fecha) : ""} />
        <main className="mx-auto max-w-xl">
          {!token || codigo === "TOKEN_INVALIDO" ? (
            <Aviso accion={botonVolver}>{t.miTurno.noEsDeEsteTelefono}</Aviso>
          ) : codigo === "NO_ENCONTRADO" ? (
            <Aviso accion={botonVolver}>{t.miTurno.yaNoExiste}</Aviso>
          ) : consulta.isError ? (
            <ErrorCarga error={consulta.error} reintentar={consulta.refetch} />
          ) : (
            <Cargando />
          )}
        </main>
      </>
    );
  }

  const fechaLarga = formatearFecha(inscripcion.fecha);
  const modalidades = { en_casa: t.formulario.enCasa, llevar: t.formulario.llevar };

  return (
    <>
      <Encabezado
        arriba={<LinkVolver to={volver} />}
        antetitulo={`${inscripcion.barrio.nombre} · ${inscripcion.companerismoNombre}`}
        titulo={fechaLarga}
      />

      {editando ? (
        <FormularioInscripcion
          inicial={{
            nombre: inscripcion.nombre,
            telefono: inscripcion.telefono ?? "",
            consentimientoTelefono: inscripcion.consentimientoTelefono,
            modalidad: inscripcion.modalidad,
            nota: inscripcion.nota ?? "",
          }}
          notaParaCocinar={barrio.data?.barrio.notaParaCocinar ?? null}
          textoEnviar={t.miTurno.guardarCambios}
          enviando={editar.isPending}
          errorEnvio={editar.error}
          onEnviar={(datos) =>
            editar.mutate(datos, {
              onSuccess: () => {
                setEditando(false);
                toast.success(t.miTurno.guardado);
              },
            })
          }
          extra={
            <Button
              type="button"
              variant="ghost"
              className="text-azul-medio"
              onClick={() => {
                editar.reset();
                setEditando(false);
              }}
            >
              {t.miTurno.descartar}
            </Button>
          }
        />
      ) : (
        <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-[18px] pb-8">
          <dl className="flex flex-col rounded-[14px] border bg-card px-4">
            <Dato titulo={t.miTurno.aNombreDe}>
              <span className="font-semibold">{inscripcion.nombre}</span>
            </Dato>
            <Dato titulo={t.miTurno.telefono}>
              {inscripcion.telefono ? (
                <>
                  {inscripcion.telefono}
                  <span className="block text-[13px] text-muted-foreground">
                    {inscripcion.consentimientoTelefono ? t.miTurno.telefonoCompartido : t.miTurno.telefonoNoCompartido}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{t.miTurno.sinTelefono}</span>
              )}
            </Dato>
            <Dato titulo={t.miTurno.modalidad}>
              {inscripcion.modalidad ? (
                modalidades[inscripcion.modalidad]
              ) : (
                <span className="text-muted-foreground">{t.miTurno.sinModalidad}</span>
              )}
            </Dato>
            {inscripcion.nota && <Dato titulo={t.miTurno.nota}>{inscripcion.nota}</Dato>}
          </dl>

          {inscripcion.editable ? (
            <div className="flex flex-col gap-2.5">
              <Button variant="accion" className="h-[50px]" onClick={() => setEditando(true)}>
                {t.miTurno.cambiar}
              </Button>
              <Button
                variant="outline"
                className="h-[50px] rounded-full border-destructive/40 font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => {
                  cancelar.reset();
                  setConfirmando(true);
                }}
              >
                {t.miTurno.cancelarTurno}
              </Button>
            </div>
          ) : (
            <AvisoAmbar>{t.miTurno.noEditable}</AvisoAmbar>
          )}
        </main>
      )}

      <Dialog open={confirmando} onOpenChange={(abierto) => !cancelar.isPending && setConfirmando(abierto)}>
        <DialogContent showCloseButton={false} className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-azul-profundo">{t.miTurno.confirmarTitulo}</DialogTitle>
            <DialogDescription className="text-[15px]">{t.miTurno.confirmarTexto(fechaLarga)}</DialogDescription>
          </DialogHeader>
          {cancelar.isError && <AlertaError>{t.errores[codigoDe(cancelar.error)]}</AlertaError>}
          <DialogFooter className="gap-2.5">
            <Button
              variant="accion-outline"
              disabled={cancelar.isPending}
              onClick={() => setConfirmando(false)}
            >
              {t.miTurno.noCancelar}
            </Button>
            <Button
              variant="destructive"
              className="rounded-full font-bold"
              disabled={cancelar.isPending}
              onClick={() =>
                cancelar.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t.miTurno.cancelado);
                    navigate(volver, { replace: true });
                  },
                })
              }
            >
              {cancelar.isPending ? t.miTurno.cancelando : t.miTurno.siCancelar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-[#EEF2F6] py-3 first:border-t-0">
      <dt className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">{titulo}</dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  );
}
