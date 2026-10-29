/**
 * Crea (o actualiza) un super admin directamente en D1, sin pasar por la API.
 * Sirve para la primera cuenta de producción, cuando todavía no hay nadie que pueda crear usuarios.
 *
 *   bun scripts/super-admin.ts --remote tu@correo.cl "Tu Nombre"
 *   bun scripts/super-admin.ts --local  tu@correo.cl "Tu Nombre"
 *
 * La contraseña se pide oculta en la terminal (o se lee de stdin si no es una terminal), así no
 * queda en el historial. Si el correo ya existe, le da el rol `admin` y le cambia la contraseña.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashPassword } from "../src/shared/password.ts";

const [destino, email, nombre] = process.argv.slice(2);
if ((destino !== "--remote" && destino !== "--local") || !email?.includes("@") || !nombre) {
  console.error('Uso: bun scripts/super-admin.ts --remote|--local <email> "<nombre>"');
  process.exit(1);
}

async function leerOculto(pregunta: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    let texto = "";
    for await (const trozo of stdin) texto += trozo;
    return texto.trim();
  }
  process.stdout.write(pregunta);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolver) => {
    let texto = "";
    const alEscribir = (trozo: string) => {
      for (const c of trozo) {
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", alEscribir);
          process.stdout.write("\n");
          return resolver(texto);
        }
        texto = c === "\u007f" ? texto.slice(0, -1) : texto + c;
      }
    };
    stdin.on("data", alEscribir);
  });
}

const password = await leerOculto("Contraseña (mín. 8): ");
if (password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}
if (process.stdin.isTTY && (await leerOculto("Repítela: ")) !== password) {
  console.error("No coinciden.");
  process.exit(1);
}

const v = (texto: string) => `'${texto.replaceAll("'", "''")}'`;
const correo = email.trim().toLowerCase();
const id = crypto.randomUUID();
const ahora = Date.now(); // timestamp_ms, como Better Auth

// Si el correo ya existe, el INSERT no hace nada y los UPDATE usan el id que ya tenía.
const sql = `
INSERT INTO user (id, name, email, email_verified, role) VALUES (${v(id)}, ${v(nombre)}, ${v(correo)}, 1, 'admin')
  ON CONFLICT (email) DO UPDATE SET role = 'admin', updated_at = ${ahora};
DELETE FROM account WHERE provider_id = 'credential' AND user_id = (SELECT id FROM user WHERE email = ${v(correo)});
INSERT INTO account (id, account_id, provider_id, user_id, password, updated_at)
  SELECT id || '-credencial', id, 'credential', id, ${v(await hashPassword(password))}, ${ahora} FROM user WHERE email = ${v(correo)};
`;

const dir = mkdtempSync(path.join(tmpdir(), "super-admin-"));
const archivo = path.join(dir, "super-admin.sql");
try {
  writeFileSync(archivo, sql);
  execFileSync("bunx", ["wrangler", "d1", "execute", "almuerzo-misional", destino, "--file", archivo], { stdio: "inherit" });
  console.log(`✓ ${correo} es super admin (${destino.slice(2)})`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
