import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

// Los tests corren dentro de workerd con una D1 en memoria (aislada por archivo de test).
export default defineConfig(async () => {
  const migraciones = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { MIGRACIONES: migraciones } },
      }),
    ],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    test: { setupFiles: ["./test/aplicar-migraciones.ts"] },
  };
});
