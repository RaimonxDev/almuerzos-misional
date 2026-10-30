import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { FormularioInscripcion } from "@/app/components/FormularioInscripcion";
import { Proveedores, renderizarApp, simularApi } from "./utilidades";

const BARRIO = {
  barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", notaParaCocinar: null },
  mesesAbiertos: [{ anio: 2099, mes: 4 }],
  hoy: "2099-04-01",
};
const MES = {
  mes: { anio: 2099, mes: 4, estado: "abierto" },
  companerismos: [],
  turnos: [],
  hoy: "2099-04-01",
};

function enlacesExternos() {
  return screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("https://"));
}

describe("/informacion", () => {
  it("muestra el aviso de que no es una herramienta oficial de la Iglesia", async () => {
    renderizarApp("/informacion");
    expect(await screen.findByRole("heading", { name: /no es una herramienta oficial/i })).toBeInTheDocument();
    expect(screen.getByText(/no está afiliada, patrocinada ni aprobada/i)).toBeInTheDocument();
    // El pie también nombra a Intellectual Reserve en el crédito de las fotos: se busca en el aviso.
    expect(within(document.getElementById("no-oficial")!).getByText(/Intellectual Reserve, Inc\./)).toBeInTheDocument();
    expect(document.getElementById("tus-datos")).not.toBeNull();
  });

  it("los enlaces a la Iglesia usan lang=spa y cambian a por/eng; todos son externos y seguros", async () => {
    const user = userEvent.setup();
    renderizarApp("/informacion");
    await screen.findByRole("heading", { name: /no es una herramienta oficial/i });

    const revisar = (lang: string) => {
      const iglesia = enlacesExternos().filter((a) => a.getAttribute("href")!.includes("churchofjesuschrist.org"));
      expect(iglesia.length).toBeGreaterThan(0);
      for (const a of iglesia) expect(a.getAttribute("href")).toContain(`lang=${lang}`);
      const externos = enlacesExternos();
      expect(externos.length).toBeGreaterThanOrEqual(2);
      for (const a of externos) {
        expect(a).toHaveAttribute("target", "_blank");
        expect(a.getAttribute("rel")).toContain("noreferrer");
      }
    };
    revisar("spa");

    await user.click(screen.getByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "Português" }));
    await screen.findByRole("heading", { name: /não é uma ferramenta oficial/i });
    revisar("por");

    await user.click(screen.getByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "English" }));
    await screen.findByRole("heading", { name: /not an official tool/i });
    revisar("eng");
  });

  it("enlaza a /solicitar para pedir la app y da el correo de contacto", async () => {
    renderizarApp("/informacion");
    await screen.findByRole("heading", { name: /no es una herramienta oficial/i });
    expect(screen.getByRole("link", { name: "Solicitar acceso" })).toHaveAttribute("href", "/solicitar");
    // Contacto (en la sección y en el pie) por correo.
    const correos = screen.getAllByRole("link", { name: "hi@ramonmartinez.dev" });
    expect(correos).toHaveLength(2);
    for (const c of correos) expect(c).toHaveAttribute("href", "mailto:hi@ramonmartinez.dev");
  });
});

describe("pie de página con enlace a /informacion", () => {
  it("la portada enlaza a /informacion", async () => {
    renderizarApp("/");
    const pie = await screen.findByRole("link", { name: "Información y aviso legal" });
    expect(pie).toHaveAttribute("href", "/informacion");
  });

  it("la vista pública enlaza a /informacion", async () => {
    simularApi({ "/api/barrios/centro/meses": { json: MES }, "/api/barrios/centro": { json: BARRIO } });
    renderizarApp("/centro");
    expect(await screen.findByRole("link", { name: /Herramienta no oficial/ })).toHaveAttribute("href", "/informacion");
  });

  it("la vista de misioneros enlaza a /informacion, también antes de escribir el código", async () => {
    simularApi({
      "/api/barrios/centro/misioneros/meses": { json: MES },
      "/api/barrios/centro/misioneros": {
        json: { barrio: BARRIO.barrio, meses: BARRIO.mesesAbiertos, hoy: BARRIO.hoy },
      },
      "/api/barrios/centro": { json: BARRIO },
    });
    const vista = renderizarApp("/centro/m");
    expect(await screen.findByRole("link", { name: /Herramienta no oficial/ })).toHaveAttribute("href", "/informacion");
    vista.unmount();

    localStorage.setItem("almuerzo-misional:misioneros:centro", "token-de-este-telefono");
    renderizarApp("/centro/m");
    const pie = await screen.findByRole("link", { name: /Herramienta no oficial/ });
    expect(pie).toHaveAttribute("href", "/informacion");
  });

  it("solicitar enlaza a /informacion", async () => {
    renderizarApp("/solicitar");
    expect(await screen.findByRole("link", { name: /Herramienta no oficial/ })).toHaveAttribute("href", "/informacion");
  });

  it("el login enlaza a /informacion", async () => {
    simularApi({ "/api/admin/yo": { status: 401, json: { error: "NO_AUTORIZADO" } } });
    renderizarApp("/admin/login");
    expect(await screen.findByRole("link", { name: /Herramienta no oficial/ })).toHaveAttribute("href", "/informacion");
  });
});

describe("formulario de inscripción", () => {
  it("enlaza a la sección Tus datos junto a la casilla de consentimiento", () => {
    render(
      <MemoryRouter>
        <Proveedores>
          <FormularioInscripcion
            notaParaCocinar={null}
            textoEnviar="Confirmar mi día"
            enviando={false}
            errorEnvio={null}
            onEnviar={() => {}}
          />
        </Proveedores>
      </MemoryRouter>,
    );
    const enlace = screen.getByRole("link", { name: /datos/i });
    expect(enlace).toHaveAttribute("href", "/informacion#tus-datos");
  });
});
