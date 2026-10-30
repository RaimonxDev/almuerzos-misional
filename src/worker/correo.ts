/**
 * Envío de correos con Resend (`POST https://api.resend.com/emails`), sin SDK.
 *
 * El correo es un aviso, no parte de la transacción: `enviarCorreo` nunca lanza.
 * Si Resend falla (4xx/5xx o red) registra el error y devuelve `{ ok: false }`.
 * Sin `RESEND_API_KEY` (desarrollo) el correo se escribe en la consola.
 */

export interface Correo {
  /** Correo del destinatario. */
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export type ResultadoCorreo = { ok: true } | { ok: false; error: string };

export type EnvCorreo = Partial<Pick<Env, "RESEND_API_KEY" | "CORREO_REMITENTE">>;

const URL_RESEND = "https://api.resend.com/emails";
/** Sin dominio verificado, Resend solo deja mandar desde aquí (y solo al correo de la cuenta). */
const REMITENTE_POR_DEFECTO = "Almuerzo Misional <onboarding@resend.dev>";
/** Si Resend no responde, se abandona: un aviso no puede retener una request. */
const ESPERA_MAXIMA_MS = 10_000;

export async function enviarCorreo(env: EnvCorreo, correo: Correo): Promise<ResultadoCorreo> {
  const remitente = env.CORREO_REMITENTE || REMITENTE_POR_DEFECTO;

  if (!env.RESEND_API_KEY) {
    console.log(
      [
        "[correo] Sin RESEND_API_KEY: el correo no se manda.",
        `De: ${remitente}`,
        `Para: ${correo.para}`,
        `Asunto: ${correo.asunto}`,
        "",
        correo.texto,
      ].join("\n"),
    );
    return { ok: true };
  }

  try {
    const respuesta = await fetch(URL_RESEND, {
      method: "POST",
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [correo.para],
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      }),
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      const error = `Resend respondió ${respuesta.status}${detalle ? `: ${detalle}` : ""}`;
      console.error("[correo]", error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    const error = `Error de red con Resend: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[correo]", error);
    return { ok: false, error };
  }
}
