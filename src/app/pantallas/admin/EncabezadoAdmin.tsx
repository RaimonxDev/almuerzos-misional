import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOutIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/app/auth";
import { useYo } from "@/app/consultas";
import { useIdioma } from "@/app/i18n";
import { cn } from "@/app/lib/utils";
import { SelectorIdioma } from "@/app/components/SelectorIdioma";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

/**
 * Banda azul: nombre de la app, barrio (selector si administra más de uno), "Nuevo barrio" para el
 * super admin, "Mi cuenta", idioma y salir.
 */
export function EncabezadoAdmin({ slug }: { slug?: string }) {
  const { t } = useIdioma();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario, barrios } = useYo().data!;
  const actual = barrios.find((b) => b.slug === slug);
  const nombres = Object.fromEntries(barrios.map((b) => [b.slug, b.nombre]));

  async function salir() {
    // Si no se pudo cerrar, la sesión sigue abierta en este teléfono: se avisa y no se sale.
    const { error } = await authClient.signOut().catch(() => ({ error: true }));
    if (error) {
      toast.error(t.errores.ERROR_INTERNO);
      return;
    }
    // Datos de cuenta y teléfonos: no quedan en memoria.
    queryClient.removeQueries({ queryKey: ["admin"] });
    navigate("/admin/login", { replace: true });
  }

  return (
    <header className="bg-azul-profundo text-white">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[22px] font-semibold">{t.comun.nombreApp}</span>
          <span className="text-xs font-extrabold tracking-[0.12em] text-dorado-claro uppercase">
            {t.panel.antetitulo}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {slug && barrios.length > 1 ? (
            <Select items={nombres} value={slug} onValueChange={(v) => v && navigate(`/admin/${v}`)}>
              <SelectTrigger
                aria-label={t.panel.barrio}
                className="w-auto border-white/25 bg-white/10 font-bold text-white hover:bg-white/15 [&_svg]:text-white/80!"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {barrios.map((b) => (
                  <SelectItem key={b.slug} value={b.slug} className="min-h-11">
                    {b.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            actual && <span className="font-bold">{actual.nombre}</span>
          )}
          {actual?.cargo && <span className="text-sm text-[#C9D6E4]">{actual.cargo}</span>}
          {usuario.superAdmin && (
            <Link
              to="/admin/nuevo-barrio"
              className={cn(buttonVariants({ variant: "ghost" }), "text-white hover:bg-white/10 hover:text-white")}
            >
              <PlusIcon aria-hidden="true" />
              {t.panel.nuevoBarrio}
            </Link>
          )}
          <Link
            to="/admin/cuenta"
            className={cn(buttonVariants({ variant: "ghost" }), "text-white hover:bg-white/10 hover:text-white")}
          >
            <UserRoundIcon aria-hidden="true" />
            {t.panel.miCuenta}
          </Link>
          <SelectorIdioma oscuro />
          <Button variant="ghost" onClick={salir} className="text-white hover:bg-white/10 hover:text-white">
            <LogOutIcon aria-hidden="true" />
            {t.panel.salir}
          </Button>
        </div>
      </div>
    </header>
  );
}
