# Almuerzo Misional

App web (pensada para móvil) para que las hermanas de un barrio se anoten a dar almuerzo a los misioneros (élderes y hermanas misioneras). Reemplaza la coordinación manual por WhatsApp que hoy hace la presidenta de la Sociedad de Socorro. Proyecto personal, no oficial de la Iglesia: inspirado en su paleta, sin usar su logo ni su nombre.

Pocos usuarios. Prioridad: simple de mantener y gratis de hospedar.

## Stack

- **Un solo Cloudflare Worker**: Hono responde `/api/*` y sirve el build estático de React (Workers Static Assets).
- **Base de datos**: Cloudflare D1 (SQLite) con **Drizzle ORM**. Migraciones con `drizzle-kit generate` + `wrangler d1 migrations apply`.
- **Imágenes del mes**: Cloudflare R2.
- **Frontend**: React + Vite + TypeScript (SPA), React Router, Tailwind 4 + **shadcn/ui**. Sin Next ni Astro: no hay SSR ni SEO que aprovechar.
- **Un solo repo y un solo paquete** (no monorepo): `@cloudflare/vite-plugin` levanta Worker y React juntos con `npm run dev`. El frontend llama a la API con el cliente RPC de Hono (`src/app/api.ts`, tipado desde `AppType`).
- **Auth**: Better Auth **solo para administradores** (presidenta / super admin), con el plugin `admin` para el rol de super admin. Las hermanas y los misioneros NO tienen cuenta.
- Código de dominio en español. La UI es multi-idioma (ver **Idiomas**).

## Acceso y URLs (multi-barrio por ruta)

| Ruta | Quién | Qué ve |
|---|---|---|
| `/:barrio` (ej. `/centro`) | Público (hermanas) | Turnos del mes abierto, **solo nombres** |
| `/:barrio/anotarse/:turnoId` | Público | Formulario de inscripción |
| `/:barrio/m/:token` | Misioneros y presidenta | Calendario con **teléfonos** (solo si hubo consentimiento) y botón a WhatsApp |
| `/admin` | Admins con login | Panel del barrio que administran |
| `/admin/:barrio/:periodo/imprimir` (`periodo` = `2026-11`) | Admins | Vista imprimible del calendario |

- Cada barrio tiene su propio `token_misioneros`; la presidenta puede regenerarlo (el anterior deja de funcionar).
- Un admin solo ve los barrios asignados en `admins_barrio`. El super admin crea barrios.

## Reglas de negocio

- Un **turno** = fecha + compañerismo. Un día normalmente tiene 2 turnos (élderes y hermanas).
- "Tomado" no se guarda: un turno está tomado si tiene inscripción. Cancelar = borrar la inscripción.
- `inscripciones.turno_id` es UNIQUE → si dos personas toman el mismo turno a la vez, la segunda inserción falla; la API responde 409 con `{ error: "TURNO_TOMADO" }` y el frontend muestra un mensaje amable ("alguien se te adelantó").
- Al anotarse se genera un token de edición: el cliente lo guarda en `localStorage`, la BD guarda solo su SHA-256. Con ese token la persona puede editar o cancelar lo suyo.
- Al anotarse hay una casilla de consentimiento para que misioneros y presidenta vean el teléfono. Sin consentimiento, el teléfono no se expone en ningún endpoint.
- La vista pública nunca devuelve teléfono, dirección ni nota: filtrar en la API, no en el frontend.
- Mes con estados `borrador` → `abierto` → `cerrado`. El público solo puede anotarse en meses abiertos.
- Un admin puede bloquear turnos (con motivo, ej. "Conferencia de estaca") y anotar a alguien manualmente (`origen = 'admin'`).
- Fechas como texto `YYYY-MM-DD` en la zona horaria del barrio (`barrios.zona_horaria`, IANA, por defecto `America/Santiago`). "Hoy" se calcula con esa zona, no con la del servidor ni del dispositivo.

## Idiomas

- Español, portugués e inglés. Diccionarios en `src/app/i18n/{es,pt,en}.ts`; `es.ts` es la fuente y los otros se tipan con `Mensajes`, así falta una clave = error de TypeScript. Textos con parámetros o plurales son funciones.
- Uso: `const { t, formatearFecha } = useIdioma()` → `t.publico.libre`. Fechas y números con `Intl` (locales `es-CL`, `pt-BR`, `en-US`).
- El idioma **no va en la URL** (los links se comparten por WhatsApp). Prioridad: elección guardada en `localStorage` → `barrios.idioma` → navegador → español.
- **La API nunca devuelve textos para el usuario**: los errores son `{ error: CodigoError }` (`src/shared/errores.ts`) y el frontend los traduce con `t.errores[codigo]`.
- Lo que escriben los admins (nombre del compañerismo, motivo de bloqueo, escritura, mensaje del mes) se muestra tal cual, sin traducir.

## Calendario imprimible / compartir

- PDF generado en el navegador: vista con CSS `@media print` + `@page { size: A4 landscape }` y `window.print()`. Sin Puppeteer ni PDF en el servidor.
- Además, exportar como imagen (PNG) para compartir directo por WhatsApp (ej. `html-to-image` + Web Share API en el móvil).
- Personalización por mes: imagen (R2), escritura + referencia, mensaje opcional y plantilla (`azul` | `dorado` | `cielo`).
- La semana empieza en domingo.

## Diseño

- Tipografías: Lora (títulos, escrituras) y Nunito Sans (UI).
- Paleta: azul profundo `#14304F`, azul medio `#1F5C99`, cielo `#DCEAF6`/`#EAF2F9`, dorado `#C49A3A`/`#E2C27A`, fondo `#F6F8FB`, texto `#1A2633`.
- Botones de al menos 44px de alto; móvil primero; lista vertical de días en móvil (no grilla).
- Componentes base de shadcn en `src/app/components/ui/` (se agregan con `npx shadcn@latest add <componente>`). La paleta está mapeada a sus tokens en `src/app/index.css` (`primary` = azul profundo, `secondary` = cielo…) y hay utilidades propias: `bg-dorado`, `bg-dorado-claro`, `text-azul-medio`, `bg-cielo`, `bg-cielo-claro`. Botón, input, select y tabs ya están ajustados a 44px; al agregar componentes nuevos revisar alturas (shadcn trae `h-9`) y quitar `md:text-sm` de los inputs (16px evita el zoom en iOS).
- Solo tema claro (sin `next-themes`).
- Las maquetas de referencia están en el artifact "Almuerzo Misional — Maquetas" (vista pública, formulario, panel de la presidenta, calendario imprimible).

## Estructura

```
src/worker/   Hono (entrada del Worker, rutas /api)
src/db/       esquema Drizzle y cliente (crearDb)
src/shared/   tipos compartidos Worker ↔ app (idiomas, códigos de error)
src/app/      React: pantallas/, components/ui (shadcn), i18n/, router.tsx
migrations/   SQL generado por drizzle-kit
```

Comandos: `npm run dev`, `npm run typecheck`, `npm run build`, `npm run db:generate`, `npm run db:migrate:local`, `npm run cf-typegen` (tras cambiar `wrangler.jsonc`).

Datos de prueba: `npm run db:seed:local` (mes actual) o `npm run db:seed:local -- 2026-11`. Es idempotente y crea:
- `centro` (es, `America/Santiago`) y `jardim` (pt, `America/Sao_Paulo`), cada uno con élderes y hermanas, el mes en estado `abierto` y el tercer domingo bloqueado.
- Enlaces de misioneros: `/centro/m/dev-misioneros-centro` y `/jardim/m/dev-misioneros-jardim`.
- En `centro`, tres inscripciones: Hna. Pérez (con consentimiento; token de edición `dev-edicion-demo`), Hna. González (teléfono sin consentimiento) y Familia Muñoz (`origen = 'admin'`).
- Fechas: `src/shared/fechas.ts` (`hoyEnZona`, `fechasDelMes`, `diaDeSemana`), compartido con el Worker.

Pendiente para producción: crear la base con `npx wrangler d1 create almuerzo-misional` y el bucket R2, y poner el `database_id` real en `wrangler.jsonc`.

## Esquema

`src/db/schema.ts` (dominio) y `src/db/auth-schema.ts` (Better Auth). Este último se escribió a mano como referencia: regenerarlo con `npx @better-auth/cli generate` tras instalar Better Auth.

## Orden de trabajo sugerido

1. ~~Scaffold: Worker con Hono + Vite/React + D1 + Drizzle; validar que `drizzle-kit generate` funcione con el esquema.~~ Hecho (incluye shadcn e i18n).
2. ~~Seed: un barrio de prueba (`centro`) con sus dos compañerismos y el mes actual con turnos generados.~~ Hecho (`scripts/seed.ts`).
3. API pública: listar turnos del mes, crear inscripción (con manejo del 409), editar/cancelar con token.
4. API de misioneros (`/m/:token`).
5. Better Auth + API de admin.
6. Frontend de las pantallas, siguiendo las maquetas.
7. Vista imprimible y exportar como imagen.
