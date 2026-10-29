import { toast } from "sonner";
import { useIdioma } from "@/app/i18n";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

/**
 * Datos para entrar de una cuenta con contraseña temporal, que se copian para mandarlos por
 * WhatsApp (la contraseña se ve solo aquí). Sin `password` (le llegó la bienvenida por correo)
 * solo muestra el texto. Lo usan "Nuevo barrio" y "Nueva contraseña temporal" del panel.
 */
export function DatosCuenta({
  email,
  password,
  titulo,
  texto,
  textoCerrar,
  alCerrar,
}: {
  email: string;
  password: string | null;
  titulo: string;
  texto: string;
  textoCerrar: string;
  alCerrar: () => void;
}) {
  const { t } = useIdioma();
  const nb = t.nuevoBarrio;
  const url = `${location.origin}/admin/login`;

  const copiar = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(nb.mensajeCuenta(url, email, password));
      toast.success(nb.datosCopiados);
    } catch {
      toast.error(t.errores.ERROR_INTERNO);
    }
  };

  const fila = (etiqueta: string, valor: string) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-bold text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="font-mono text-[15px] break-all text-azul-profundo">{valor}</dd>
    </div>
  );

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent showCloseButton={false} className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-azul-profundo">{titulo}</DialogTitle>
          <DialogDescription className="text-[15px]">{texto}</DialogDescription>
        </DialogHeader>
        {password && (
          <dl className="flex flex-col gap-3 rounded-[10px] bg-cielo-claro p-3">
            {fila(nb.entrarEn, url)}
            {fila(nb.correo, email)}
            {fila(nb.contrasena, password)}
          </dl>
        )}
        <DialogFooter className="gap-2.5">
          {password && (
            <Button variant="outline" onClick={copiar} className="rounded-[10px] font-bold">
              {nb.copiarDatos}
            </Button>
          )}
          <Button onClick={alCerrar} className="rounded-[10px] font-bold">
            {textoCerrar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
