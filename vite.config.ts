import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command, mode }) => {
  // Sin la clave real, `/solicitar` usaría la de prueba de Turnstile y la API (con el secreto real)
  // rechazaría todas las solicitudes: mejor que el build falle.
  if (command === "build" && !loadEnv(mode, process.cwd(), "VITE_").VITE_TURNSTILE_SITE_KEY) {
    throw new Error("Falta VITE_TURNSTILE_SITE_KEY (clave pública de Turnstile) para el build. Ver .dev.vars.example.");
  }
  return {
    plugins: [react(), tailwindcss(), cloudflare()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
  };
});
