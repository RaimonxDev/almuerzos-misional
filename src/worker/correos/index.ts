import type { Idioma } from "@/shared/idiomas";
import type { Correo } from "../correo";
import { en } from "./en";
import { es, type ContenidoCorreo, type DatosCorreo, type MensajesCorreo, type PlantillaCorreo } from "./es";
import { pt } from "./pt";

export type { ContenidoCorreo, DatosCorreo, MensajesCorreo, PlantillaCorreo } from "./es";

export const correos: Record<Idioma, MensajesCorreo> = { es, pt, en };

/**
 * Arma asunto, HTML y texto de una plantilla en un idioma. Lo que llega en `datos`
 * (nombres de barrio y de personas) se escapa en el HTML.
 *
 *   const correo = armarCorreo(barrio.idioma, "restablecerPassword", { nombre, enlace, minutos: 60 });
 *   await enviarCorreo(env, { para: email, ...correo });
 */
export function armarCorreo<P extends PlantillaCorreo>(
  idioma: Idioma,
  plantilla: P,
  datos: DatosCorreo[P],
): Omit<Correo, "para"> {
  const mensajes = correos[idioma];
  const contenido = (mensajes[plantilla] as (datos: DatosCorreo[P]) => ContenidoCorreo)(datos);
  return {
    asunto: contenido.asunto,
    html: htmlDelCorreo(contenido, mensajes.comun, idioma),
    texto: textoDelCorreo(contenido, mensajes.comun),
  };
}

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const COLORES = {
  azulProfundo: "#14304F",
  dorado: "#C49A3A",
  fondo: "#F6F8FB",
  texto: "#1A2633",
  suave: "#5B6B7C",
  blanco: "#FFFFFF",
};
const FUENTE = "'Nunito Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const FUENTE_TITULO = "Lora, Georgia, 'Times New Roman', serif";

function htmlDelCorreo(c: ContenidoCorreo, comun: MensajesCorreo["comun"], idioma: Idioma): string {
  const e = escaparHtml;
  const enlace = e(c.boton.enlace);
  const parrafos = c.parrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${COLORES.texto};">${e(p)}</p>`)
    .join("");
  const nota = c.nota
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${COLORES.suave};">${e(c.nota)}</p>`
    : "";

  return `<!doctype html>
<html lang="${idioma}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(c.asunto)}</title></head>
<body style="margin:0;padding:0;background:${COLORES.fondo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORES.fondo};padding:24px 12px;font-family:${FUENTE};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORES.blanco};border-radius:12px;overflow:hidden;">
<tr><td style="background:${COLORES.azulProfundo};padding:24px 28px;border-bottom:4px solid ${COLORES.dorado};">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORES.dorado};font-family:${FUENTE};">${e(comun.nombreApp)}</p>
<h1 style="margin:0;font-size:24px;font-weight:600;color:${COLORES.blanco};font-family:${FUENTE_TITULO};">${e(c.titulo)}</h1>
</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${COLORES.texto};">${e(c.saludo)}</p>
${parrafos}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:${COLORES.azulProfundo};">
<a href="${enlace}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:${COLORES.blanco};text-decoration:none;border-radius:999px;font-family:${FUENTE};">${e(c.boton.texto)}</a>
</td></tr></table>
${nota}
<p style="margin:0;font-size:13px;line-height:1.5;color:${COLORES.suave};">${e(comun.enlaceAlternativo)}<br><a href="${enlace}" style="color:${COLORES.azulProfundo};word-break:break-all;">${enlace}</a></p>
</td></tr>
<tr><td style="padding:16px 28px;background:${COLORES.fondo};font-size:12px;line-height:1.5;color:${COLORES.suave};">${e(comun.pie)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function textoDelCorreo(c: ContenidoCorreo, comun: MensajesCorreo["comun"]): string {
  return [
    c.saludo,
    "",
    ...c.parrafos.flatMap((p) => [p, ""]),
    `${c.boton.texto}: ${c.boton.enlace}`,
    "",
    ...(c.nota ? [c.nota, ""] : []),
    "--",
    comun.nombreApp,
    comun.pie,
  ].join("\n");
}
