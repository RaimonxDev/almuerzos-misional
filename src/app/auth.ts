import { createAuthClient } from "better-auth/react";

/**
 * Cliente de Better Auth (solo administradores). La sesión viaja en una cookie del mismo origen.
 * `customFetchImpl` resuelve `fetch` en cada llamada (Better Auth lo captura al crear el cliente),
 * así los tests pueden reemplazarlo con `vi.stubGlobal`.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: { customFetchImpl: (...args) => fetch(...args) },
});
