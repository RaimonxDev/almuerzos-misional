import { hc } from "hono/client";
import type { AppType } from "@/worker";

/** Cliente tipado de la API: `api.api.salud.$get()`. */
export const api = hc<AppType>("/");
