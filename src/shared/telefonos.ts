/**
 * Teléfonos para wa.me, que exige el número internacional solo con dígitos.
 * Las hermanas escriben el teléfono como les sale ("9 1234 5678", "(11) 91234-5678"):
 * a un número local se le agrega el código del país del barrio, deducido de su zona horaria.
 */

type Pais = { codigo: string; largosLocales: number[]; zonas: string[] };

const PAISES: Pais[] = [
  { codigo: "56", largosLocales: [9], zonas: ["America/Santiago", "America/Punta_Arenas", "Pacific/Easter"] },
  {
    codigo: "55",
    // DDD + número: 10 dígitos los fijos, 11 los celulares.
    largosLocales: [10, 11],
    zonas: [
      "America/Sao_Paulo",
      "America/Bahia",
      "America/Fortaleza",
      "America/Recife",
      "America/Belem",
      "America/Maceio",
      "America/Araguaina",
      "America/Santarem",
      "America/Manaus",
      "America/Cuiaba",
      "America/Campo_Grande",
      "America/Porto_Velho",
      "America/Boa_Vista",
      "America/Rio_Branco",
      "America/Eirunepe",
      "America/Noronha",
    ],
  },
];

/** Dígitos para wa.me, o null si no parece un teléfono. */
export function numeroWhatsApp(telefono: string, zonaHoraria?: string): string | null {
  const texto = telefono.trim();
  let digitos = texto.replace(/\D/g, "");
  if (texto.startsWith("+")) {
    // Ya es internacional.
  } else if (digitos.startsWith("00")) {
    digitos = digitos.slice(2);
  } else {
    // Sin prefijo: si tiene el largo de un número local del país, se le agrega el código
    // (sin el 0 de larga distancia). Si no, se asume que ya venía con el código.
    // Antes se descarta que sea un número completo de otro país conocido escrito sin + (ej. un
    // chileno "56912345678" en un barrio de Brasil, que tiene el largo de un celular local).
    const pais = PAISES.find((p) => zonaHoraria && p.zonas.includes(zonaHoraria));
    const local = digitos.replace(/^0+/, "");
    const deOtroPais = PAISES.some(
      (p) => p !== pais && digitos.startsWith(p.codigo) && p.largosLocales.includes(digitos.length - p.codigo.length),
    );
    if (pais?.largosLocales.includes(local.length) && !deOtroPais) digitos = pais.codigo + local;
  }
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

/** `https://wa.me/<número>?text=<mensaje>`, o null si el teléfono no sirve. */
export function enlaceWhatsApp(telefono: string, zonaHoraria?: string, mensaje?: string): string | null {
  const numero = numeroWhatsApp(telefono, zonaHoraria);
  if (!numero) return null;
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}
