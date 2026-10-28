/** Evento de día completo en formato iCalendar, generado en el navegador (sin servidor). */
export function crearIcs({ fecha, titulo, descripcion }: { fecha: string; titulo: string; descripcion?: string }) {
  const escapar = (texto: string) =>
    texto.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replace(/\r?\n/g, "\\n");
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
  const sello = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Almuerzo Misional//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@almuerzo-misional`,
    `DTSTAMP:${sello}`,
    `DTSTART;VALUE=DATE:${fecha.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${siguiente.replaceAll("-", "")}`,
    `SUMMARY:${escapar(titulo)}`,
    ...(descripcion ? [`DESCRIPTION:${escapar(descripcion)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
