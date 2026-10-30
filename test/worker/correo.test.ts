import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarCorreo } from "@/worker/correo";
import { armarCorreo, correos } from "@/worker/correos";
import { IDIOMAS } from "@/shared/idiomas";

const correo = { para: "presidenta@ejemplo.cl", asunto: "Hola", html: "<p>Hola</p>", texto: "Hola" };
const conKey = { RESEND_API_KEY: "re_test_123", CORREO_REMITENTE: "Almuerzo Misional <hola@ejemplo.cl>" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enviarCorreo", () => {
  it("con RESEND_API_KEY llama a la API de Resend con remitente, destinatario, asunto, HTML y texto", async () => {
    const fetchSimulado = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "abc" }, { status: 200 }));

    const resultado = await enviarCorreo(conKey, correo);

    expect(resultado).toEqual({ ok: true });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSimulado.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer re_test_123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      from: "Almuerzo Misional <hola@ejemplo.cl>",
      to: ["presidenta@ejemplo.cl"],
      subject: "Hola",
      html: "<p>Hola</p>",
      text: "Hola",
    });
  });

  it("sin RESEND_API_KEY no llama a fetch y escribe el correo en la consola", async () => {
    const fetchSimulado = vi.spyOn(globalThis, "fetch");
    const consola = vi.spyOn(console, "log").mockImplementation(() => {});

    const resultado = await enviarCorreo({}, correo);

    expect(resultado).toEqual({ ok: true });
    expect(fetchSimulado).not.toHaveBeenCalled();
    const escrito = consola.mock.calls.flat().join("\n");
    expect(escrito).toContain("presidenta@ejemplo.cl");
    expect(escrito).toContain("Hola");
  });

  it.each([422, 500])("un %i de Resend no lanza: devuelve un resultado fallido y lo registra", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ name: "validation_error", message: "malo" }, { status }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await enviarCorreo(conKey, correo);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain(String(status));
    expect(error).toHaveBeenCalled();
  });

  it("un error de red no lanza: devuelve un resultado fallido", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await enviarCorreo(conKey, correo);

    expect(resultado.ok).toBe(false);
    expect(error).toHaveBeenCalled();
  });
});

describe("plantillas de correo", () => {
  const datos = {
    restablecerPassword: { nombre: "Ana", enlace: "https://ejemplo.cl/r?t=1&u=2", minutos: 60 },
    bienvenidaPresidenta: { nombre: "Ana", barrio: "Centro", enlace: "https://ejemplo.cl/b?t=1", panel: "https://ejemplo.cl/admin/centro", dias: 7 },
    barrioAsignado: { nombre: "Ana", barrio: "Centro", enlace: "https://ejemplo.cl/admin/centro" },
    solicitudNueva: { nombre: "Ana", email: "ana@ejemplo.cl", barrio: "Centro", ciudad: "Lima", pais: "Perú", mensaje: "Hola", enlace: "https://ejemplo.cl/admin/solicitudes" },
    // Sin botón: avisos que no piden nada.
    solicitudRecibida: { nombre: "Ana", barrio: "Centro" },
    solicitudRechazada: { nombre: "Ana", barrio: "Centro", motivo: "Porque sí" },
  } as const;
  const plantillas = Object.keys(datos) as (keyof typeof datos)[];

  it("cada plantilla existe en es, pt y en", () => {
    const delDiccionario = (idioma: (typeof IDIOMAS)[number]) =>
      Object.keys(correos[idioma]).filter((clave) => clave !== "comun").sort();
    expect(delDiccionario("es")).toEqual([...plantillas].sort());
    for (const idioma of IDIOMAS) {
      expect(delDiccionario(idioma)).toEqual([...plantillas].sort());
      for (const plantilla of plantillas) {
        const armado = armarCorreo(idioma, plantilla, datos[plantilla] as never);
        expect(armado.asunto.length).toBeGreaterThan(0);
        const { enlace } = datos[plantilla] as { enlace?: string };
        if (enlace) {
          expect(armado.html).toContain(enlace.replaceAll("&", "&amp;"));
          expect(armado.texto).toContain(enlace);
        } else {
          expect(armado.html).not.toContain("<a href");
        }
        expect(armado.texto).toContain("Ana");
      }
    }
  });

  it("los textos cambian según el idioma", () => {
    for (const plantilla of plantillas) {
      const asuntos = IDIOMAS.map((i) => armarCorreo(i, plantilla, datos[plantilla] as never).asunto);
      expect(new Set(asuntos).size).toBe(IDIOMAS.length);
    }
  });

  it("escapa en el HTML lo que viene del usuario, pero no en el texto plano", () => {
    const armado = armarCorreo("es", "bienvenidaPresidenta", {
      nombre: '<script>alert("x")</script>',
      barrio: "Barrio & <b>Centro</b>",
      enlace: 'https://ejemplo.cl/b?t=1&x="2"',
      panel: "https://ejemplo.cl/admin/centro",
      dias: 7,
    });
    expect(armado.html).not.toContain("<script>");
    expect(armado.html).not.toContain("<b>Centro</b>");
    expect(armado.html).toContain("&lt;script&gt;");
    expect(armado.html).toContain("Barrio &amp; &lt;b&gt;Centro&lt;/b&gt;");
    expect(armado.html).toContain('href="https://ejemplo.cl/b?t=1&amp;x=&quot;2&quot;"');
    expect(armado.texto).toContain("Barrio & <b>Centro</b>");
  });

  it("usa la paleta en el HTML", () => {
    const { html } = armarCorreo("es", "barrioAsignado", datos.barrioAsignado);
    expect(html).toContain("#14304F");
    expect(html).toContain("#C49A3A");
    expect(html).toContain("#F6F8FB");
  });
});
