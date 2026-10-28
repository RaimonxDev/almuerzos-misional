/**
 * Hash de contraseñas con PBKDF2-SHA256 vía Web Crypto, en vez del scrypt (JS puro) por defecto de
 * Better Auth, que se pasa del límite de CPU del plan gratis de Workers. 100 000 iteraciones es el
 * máximo que permite Workers. Formato: `pbkdf2$<iteraciones>$<sal hex>$<hash hex>`.
 * Lo usan el Worker y el seed (Node tiene el mismo `crypto.subtle`).
 */
const ITERACIONES = 100_000;

const aHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));

async function derivar(password: string, sal: Uint8Array<ArrayBuffer>, iteraciones: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFKC")), "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones }, base, 256),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERACIONES}$${aHex(sal)}$${aHex(await derivar(password, sal, ITERACIONES))}`;
}

export async function verificarPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  const [esquema, iteraciones, sal, esperado] = hash.split("$");
  if (esquema !== "pbkdf2" || !iteraciones || !sal || !esperado) return false;
  const obtenido = await derivar(password, deHex(sal) as Uint8Array<ArrayBuffer>, Number(iteraciones));
  const objetivo = deHex(esperado);
  if (obtenido.length !== objetivo.length) return false;
  // Comparación sin cortar en el primer byte distinto.
  let diferencia = 0;
  for (let i = 0; i < obtenido.length; i++) diferencia |= obtenido[i] ^ objetivo[i];
  return diferencia === 0;
}
