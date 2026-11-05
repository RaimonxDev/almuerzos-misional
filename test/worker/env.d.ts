declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("../../src/worker/index");
  }
  interface Env {
    MIGRACIONES: import("cloudflare:test").D1Migration[];
  }
}

declare module "*.sql?raw" {
  const sql: string;
  export default sql;
}
