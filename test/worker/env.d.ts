declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("../../src/worker/index");
  }
  interface Env {
    MIGRACIONES: import("cloudflare:test").D1Migration[];
  }
}
