import { useYo } from "@/app/consultas";
import { useCrearBarrio } from "@/app/consultas-admin";
import { useIdioma } from "@/app/i18n";
import { useTitulo } from "@/app/hooks";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { Aviso } from "@/app/components/Estado";
import { EncabezadoAdmin } from "./EncabezadoAdmin";
import { FormularioBarrio } from "./FormularioBarrio";

export { sugerirSlug } from "./FormularioBarrio";

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
  const crear = useCrearBarrio();
  useTitulo(nb.titulo);

  if (!usuario.superAdmin) {
    return (
      <>
        <EncabezadoAdmin />
        <Aviso>{t.errores.SIN_PERMISO}</Aviso>
      </>
    );
  }
  return (
    <FormularioBarrio
      titulo={nb.titulo}
      intro={nb.intro}
      mutacion={crear}
      textoEnviar={nb.crear}
      rutaVolver="/admin"
      textoVolver={nb.volver}
    />
  );
}
