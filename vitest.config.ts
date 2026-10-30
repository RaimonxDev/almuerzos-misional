import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

const alias = { "@": path.resolve(import.meta.dirname, "./src") };

/**
 * Dos proyectos:
 *  - worker: la API dentro de workerd con una D1 en memoria (aislada por archivo de test).
 *  - app: componentes y lógica de React en jsdom con Testing Library.
 */
export default defineConfig(async () => {
  const migraciones = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    test: {
      projects: [
        {
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: { bindings: { MIGRACIONES: migraciones, BETTER_AUTH_SECRET: "secreto-solo-para-tests-0123456789abcdef",
                BETTER_AUTH_URL: "http://localhost",
                // Vacío a propósito: aunque `.dev.vars` tenga una key, los tests nunca mandan correos reales.
                RESEND_API_KEY: "", CORREO_REMITENTE: "Almuerzo Misional <tests@ejemplo.cl>",
                TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" } },
            }),
          ],
          resolve: { alias },
          test: {
            name: "worker",
            include: ["test/worker/**/*.test.ts"],
            setupFiles: ["./test/worker/aplicar-migraciones.ts"],
          },
        },
        {
          plugins: [react()],
          resolve: { alias },
          test: {
            name: "app",
            environment: "jsdom",
            include: ["test/app/**/*.test.{ts,tsx}"],
            setupFiles: ["./test/app/setup.ts"],
          },
        },
      ],
    },
  };
});
