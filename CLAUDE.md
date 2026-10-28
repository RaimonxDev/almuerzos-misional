# Almuerzo Misional

App web (pensada para móvil) para que las hermanas de un barrio se anoten a dar almuerzo a los misioneros (élderes y hermanas misioneras). Reemplaza la coordinación manual por WhatsApp que hoy hace la presidenta de la Sociedad de Socorro. Proyecto personal, no oficial de la Iglesia: inspirado en su paleta, sin usar su logo ni su nombre.

Pocos usuarios. Prioridad: simple de mantener y gratis de hospedar.

## Stack

- **Un solo Cloudflare Worker**: Hono responde `/api/*` y sirve el build estático de React (Workers Static Assets).
- **Base de datos**: Cloudflare D1 (SQLite) con **Drizzle ORM**. Migraciones con `drizzle-kit generate` + `wrangler d1 migrations apply`.
- **Imágenes del mes**: Cloudflare R2.
- **Frontend**: React + Vite + TypeScript (SPA), React Router, Tailwind 4 + **shadcn/ui** sobre **Base UI** (`@base-ui/react`, sin Radix). Sin Next ni Astro: no hay SSR ni SEO que aprovechar.
- **Un solo repo y un solo paquete** (no monorepo): `@cloudflare/vite-plugin` levanta Worker y React juntos con `bun run dev`. El frontend llama a la API con el cliente RPC de Hono (`src/app/api.ts`, tipado desde `AppType`).
- **Auth**: Better Auth **solo para administradores** (presidenta / super admin), con el plugin `admin` para el rol de super admin. Las hermanas y los misioneros NO tienen cuenta.
- Código de dominio en español. La UI es multi-idioma (ver **Idiomas**).

## Acceso y URLs (multi-barrio por ruta)

| Ruta | Quién | Qué ve |
|---|---|---|
| `/:barrio` (ej. `/centro`) | Público (hermanas) | Turnos del mes abierto, **solo nombres** |
| `/:barrio/anotarse/:turnoId` | Público | Formulario de inscripción |
| `/:barrio/mi-turno/:inscripcionId` | Quien se anotó, desde el mismo teléfono | Ver, editar o cancelar lo suyo (token desde `localStorage`) |
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
- Componentes base de shadcn en `src/app/components/ui/`, variante Base UI (`components.json` con `style: "base-vega"`; se agregan con `bunx shadcn@latest add <componente>`). Revisar que importen `cn` de `@/app/lib/utils`. La paleta está mapeada a sus tokens en `src/app/index.css` (`primary` = azul profundo, `secondary` = cielo…) y hay utilidades propias: `bg-dorado`, `bg-dorado-claro`, `text-azul-medio`, `bg-cielo`, `bg-cielo-claro`. Botón, input, select y tabs ya están ajustados a 44px; al agregar componentes nuevos revisar alturas (shadcn trae `h-9`) y quitar `md:text-sm` de los inputs (16px evita el zoom en iOS). Los estados de Base UI son atributos sueltos (`data-checked`, `data-open`, `data-active`), no `data-[state=…]`.
- Un link con estilo de botón es un `<Link>` (o `<a>`) con `className={buttonVariants(...)}`, no `<Button render={…}>`: Base UI le pondría `role="button"` al link. `render` queda para cambiar el elemento de componentes que no son links.
- Solo tema claro (sin `next-themes`).
- Variantes de botón propias: `accion` (píldora azul medio, acción principal pública) y `accion-outline`. Colores de estado: `text-exito`/`bg-exito-suave` y `aviso`, `aviso-texto`, `aviso-suave`, `aviso-borde`.
- Componentes compartidos: `Encabezado` (banda azul con selector de idioma), `Cargando`, `Aviso`, `ErrorCarga` (traduce el código de error y ofrece reintentar si fue de red).

## Frontend: datos

- TanStack Query (`src/app/consultas.ts`) sobre el cliente RPC. `datos(peticion)` (`src/app/api.ts`) devuelve el JSON tipado del caso exitoso o lanza `ErrorApi` con `codigo`, `status` y `campos`. No se reintentan los 4xx.
- Cada pantalla de barrio llama `usarIdiomaDelBarrio(barrio.idioma)` al cargar el barrio.
- Inscripciones propias en `localStorage` (`src/app/mis-inscripciones.ts`, hook `useMisInscripciones`): `{ id, turnoId, barrio, fecha, companerismo?, tokenEdicion }`. Con eso la vista pública muestra "Tus próximos turnos" y "Ver mi turno" en la fila, y se reconoce la pantalla de éxito al volver al link.
- "Mi turno": el token va en `Authorization: Bearer`, nunca en la URL. Un 404 de la API borra la entrada de `localStorage` (la inscripción ya no existe); un 403 o no tener token muestra "no se hizo desde este teléfono". Si `editable` es falso (mes cerrado o día pasado) solo se muestran los datos.
- `FormularioInscripcion` (`src/app/components/`) es el mismo formulario para anotarse y para editar.
- El mes visible va en la URL (`/centro?mes=2026-11`); sin parámetro se elige con `mesInicial` (`src/app/periodos.ts`). Las flechas solo recorren meses abiertos.
- En la vista pública, los días pasados se ocultan detrás de "Ver los N días anteriores" y "Anotarme" solo aparece en turnos libres de hoy en adelante de un mes abierto.
- Misioneros (`pantallas/VistaMisioneros.tsx`): el token de la URL de la página va a la API solo en `Authorization: Bearer`, nunca en la URL de la API ni en `document.title`. WhatsApp con `enlaceWhatsApp` (`src/shared/telefonos.ts`: deja los dígitos y agrega el código del país deducido de la zona del barrio si el número es local) y `rel="noreferrer"` para que el token no viaje como referer.
- Compartidos entre pantallas de calendario: `SelectorMes` (flechas del encabezado), `TarjetaDia`/`FilaTurno` y el hook `usePeriodoDeLaUrl`.
- "Agregar a mi calendario": `crearIcs` (`src/shared/ics.ts`, evento de día completo) y `abrirIcs` (hoja de compartir del móvil o descarga).
- Las maquetas de referencia están en el artifact "Almuerzo Misional — Maquetas" (vista pública, formulario, panel de la presidenta, calendario imprimible, misioneros).

## Estructura

```
src/worker/   Hono (entrada del Worker, rutas /api)
src/db/       esquema Drizzle y cliente (crearDb)
src/shared/   tipos compartidos Worker ↔ app (idiomas, códigos de error)
src/app/      React: pantallas/, components/ui (shadcn), i18n/, router.tsx
migrations/   SQL generado por drizzle-kit
```

Comandos: `bun run dev`, `bun run typecheck`, `bun run build`, `bun run db:generate`, `bun run db:migrate:local`, `bun run cf-typegen` (tras cambiar `wrangler.jsonc`).

Datos de prueba: `bun run db:seed:local` (mes actual y el siguiente) o `bun run db:seed:local -- 2026-11` (solo ese mes). Es idempotente y crea:
- `centro` (es, `America/Santiago`) y `jardim` (pt, `America/Sao_Paulo`), cada uno con élderes y hermanas, los meses en estado `abierto` y el tercer domingo bloqueado.
- Enlaces de misioneros: `/centro/m/dev-misioneros-centro` y `/jardim/m/dev-misioneros-jardim`.
- En `centro`, en el último mes sembrado, tres inscripciones: Hna. Pérez (con consentimiento; token de edición `dev-edicion-demo`), Hna. González (teléfono sin consentimiento) y Familia Muñoz (`origen = 'admin'`).
- Fechas: `src/shared/fechas.ts` (`hoyEnZona`, `fechasDelMes`, `diaDeSemana`), compartido con el Worker.

Pendiente para producción: crear la base con `bunx wrangler d1 create almuerzo-misional` y el bucket R2, y poner el `database_id` real en `wrangler.jsonc`.

## Esquema

`src/db/schema.ts` (dominio) y `src/db/auth-schema.ts` (Better Auth). Este último se escribió a mano como referencia: regenerarlo con `bunx @better-auth/cli generate` tras instalar Better Auth.

## API pública

Sin login. Nunca devuelve teléfono, dirección ni nota de otra persona: cada `select` nombra sus columnas (`src/worker/rutas/barrios.ts`).

| Método y ruta | Qué hace |
|---|---|
| `GET /api/barrios/:slug` | Barrio (nombre, idioma, zona, nota para cocinar), `mesesAbiertos` y `hoy` |
| `GET /api/barrios/:slug/meses/:periodo` | Compañerismos activos y turnos (`libre`/`tomado`/`bloqueado`, nombre si está tomado). Meses `abierto` y `cerrado`; `borrador` → 404 |
| `GET /api/barrios/:slug/turnos/:turnoId` | Un turno, para el encabezado del formulario |
| `POST /api/barrios/:slug/turnos/:turnoId/inscripcion` | Anotarse → 201 con `tokenEdicion` (se entrega una sola vez). 409 `TURNO_TOMADO`, 422 `TURNO_BLOQUEADO`/`TURNO_PASADO`/`MES_NO_ABIERTO` |
| `GET /api/barrios/:slug/misioneros` | Misioneros, con `Authorization: Bearer <token_misioneros>`: barrio, `meses` (abiertos y cerrados) y `hoy`. Sin token, token de otro barrio o regenerado, o barrio inexistente → el mismo 404 `TOKEN_INVALIDO` |
| `GET /api/barrios/:slug/misioneros/meses/:periodo` | Turnos con nombre, modalidad, nota y teléfono (solo con consentimiento). Borrador → 404 |
| `GET/PATCH/DELETE /api/inscripciones/:id` | "Mi turno" con `Authorization: Bearer <tokenEdicion>`. 403 `TOKEN_INVALIDO`; 404 = ya no existe (el cliente puede olvidar el token). Editar/cancelar solo en mes abierto y día no pasado |

- Validación con zod; los esquemas del formulario están en `src/shared/inscripciones.ts` y los usa también el frontend. Datos inválidos → 400 `{ error: "DATOS_INVALIDOS", campos: [...] }`.
- Un bloqueo manda sobre una inscripción existente: el turno se muestra `bloqueado` y sin nombre.
- Tests de la API en `test/worker/` (ver **Tests**). Usan fechas en 2000 y 2099 para no depender del día.

## Tests

**Tests primero**: cada issue trae una sección "Tests primero"; se escriben antes de implementar y el issue se cierra con todos en verde.

`bun run test` corre dos proyectos de Vitest (`vitest.config.ts`) sobre Node; `--project worker` o `--project app` corre uno solo. Ojo: `bun test` (sin `run`) es el runner de Bun, no Vitest.

- **worker** (`test/worker/`): la API real dentro de workerd con una D1 en memoria y las migraciones aplicadas. `datos.ts` siembra datos fijos y `pedir()` llama al Worker como el navegador.
- **app** (`test/app/`): React en jsdom con Testing Library. `utilidades.tsx` trae `Proveedores` (React Query sin reintentos + idioma), `renderizarRuta`, `simularApi` (reemplaza `fetch` por URL) y `guardarInscripciones`. El setup fija el navegador en `es-CL` y limpia `localStorage`.
- El Select de idioma funciona en jsdom (se abre con clic y se elige la opción por rol: `test/app/Encabezado.test.tsx`). Para tests que solo necesitan otro idioma, basta `useIdioma().cambiarIdioma` desde un componente auxiliar.
- Base UI pone un input oculto junto al checkbox y al radio dentro del mismo `<label>`: buscarlos con `getByRole("radio", { name })`, no con `getByLabelText` (encuentra dos).
- Buscar por rol y texto visible (`getByRole`, `getByLabelText`), como lo usaría una persona. Los textos con mayúscula inicial por CSS (`first-letter:uppercase`) están en minúscula en el DOM.
- `bun run typecheck` también revisa los tests (`tsconfig.test.json` y `tsconfig.test-app.json`).

## Hitos

Se siguen en GitHub: un milestone por hito e issues con criterios de aceptación y tests en [RaimonxDev/almuerzos-misional](https://github.com/RaimonxDev/almuerzos-misional/milestones). Etiquetas: `api`, `frontend`, `diseño`, `infra`, `tests`. Los commits que completan un issue llevan `Closes #N`. Resumen:


1. **Base** ✅ — scaffold, seed y API pública con tests.
2. **Flujo público** ✅ — vista pública y formulario según las maquetas 1 y 2, con selector de idioma, "Tu turno", éxito con `.ics` y 409 amable.
3. **Mi turno** ✅ — ver, editar y cancelar con el token guardado (sin maqueta: sigue el estilo de las pantallas 1 y 2).
4. **Misioneros** ✅ — API y pantalla de `/:barrio/m/:token` (maqueta 5): calendario con teléfonos solo si hubo consentimiento y botón a WhatsApp.
5. **Admin: auth y API** — Better Auth (regenerar `auth-schema.ts`), login (*falta maqueta*), `admins_barrio`, super admin crea barrios. API: crear el mes siguiente generando turnos, cambiar estado `borrador`/`abierto`/`cerrado` (*falta en la maqueta del panel*), bloquear/desbloquear, asignar a mano, editar/borrar inscripciones, regenerar enlace de misioneros, nota para cocinar, activar/desactivar compañerismos.
6. **Panel de la presidenta** — frontend según la maqueta 3, con columnas desde los compañerismos del barrio y teléfonos solo con consentimiento.
7. **Calendario imprimible y compartir** — personalización (imagen en R2, escritura, mensaje, plantilla), vista A4 según la maqueta 4 calculando el día en que parte el mes y 5 o 6 filas, PNG con `html-to-image` + Web Share API.
8. **Producción** — crear D1 y R2 reales, `database_id`, migraciones `--remote`, deploy y dominio; protección básica contra abuso del formulario público (ej. Turnstile o rate limiting).
