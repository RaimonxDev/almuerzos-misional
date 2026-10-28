import { defineConfig } from "drizzle-kit";

// Migraciones para Cloudflare D1:
//   bunx drizzle-kit generate
//   bunx wrangler d1 migrations apply almuerzo-misional --local    (desarrollo)
//   bunx wrangler d1 migrations apply almuerzo-misional --remote   (producción)
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./migrations",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
