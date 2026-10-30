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
| `/:barrio/m` | Misioneros y presidenta, con el código de acceso | Calendario con **teléfonos** (solo si hubo consentimiento) y botón a WhatsApp. `/:barrio/m/:token` (enlaces de antes del código) redirige aquí |
| `/admin` → `/admin/:barrio?mes=2026-11` | Admins con login | Panel del barrio (`/admin` lleva al primero que administran) |
| `/admin/nuevo-barrio` | Super admin | Crear un barrio (nombre, enlace, idioma, zona, qué compañerismos tiene y su presidenta) |
| `/admin/:barrio/:periodo/imprimir` (`periodo` = `2026-11`) | Admins | Vista imprimible del calendario |
| `/solicitar` | Público | Pedir usar la app en un barrio (enlazado desde la portada `/`) |
| `/informacion` | Público | Qué es la app, aviso de que no es oficial de la Iglesia, qué datos guarda (ancla `#tus-datos`) y enlaces oficiales |
| `/admin/solicitudes` → `/admin/solicitudes/:id/aprobar` | Super admin | Revisar, aprobar (formulario de barrio prellenado) o rechazar solicitudes |

- El enlace de un barrio nuevo es lo que escribe el super admin más un código al azar de 5 caracteres (`centro-k7m2x`, `enlaceConCodigo` en `src/worker/barrios.ts`): saber el nombre no basta para entrar y el mismo nombre en otra estaca o país no choca. Los barrios creados antes (y los del seed) conservan el suyo hasta que un admin use "Cambiar enlace" en `BarraLateral` (`POST /enlace`; ayudas del campo en `pantallas/admin/enlace.ts`, compartidas con `FormularioBarrio`).
- `barrios.token_misioneros` (el enlace con token de antes) ya no se usa pero sigue en el esquema: borrarla en la misma versión rompería al Worker viejo entre `db:migrate:remote` y `deploy`. Se borra en la primera migración después de que esta versión esté en producción.
- Cada barrio tiene su `codigo_misioneros`: 6 caracteres sin ambiguos (`src/shared/codigo-misioneros.ts`: `nuevoCodigo`, `normalizarCodigo`, `formatearCodigo` → `K7P-M2X`). Los misioneros lo escriben una vez en `/:barrio/m`; la presidenta lo cambia con "Cambiar código" y los teléfonos que entraron con el anterior quedan afuera.
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
- Implementación: `grillaDelMes` (`src/app/calendario.ts`: celdas con la fecha o `null`, 5 o 6 filas, día 1 en su columna); `CalendarioImpreso` (`components/`, 1123×794 px fijos, inline styles, props `barrio`, `mes` con plantilla, `companerismos`, `turnos`, más `imagenUrl?` y `marcadorImagen?` para el editor; una fila por compañerismo, chip con su inicial; imagen en `/api/imagenes/<imagenKey>`; `TEMAS` con los colores); pantalla `pantallas/admin/Imprimir.tsx` (escala el calendario al ancho con `transform: scale`; CSS `@page` A4 apaisado solo en esa pantalla, `.no-imprimir` oculta la barra); `compartirPng` (`src/app/compartir-imagen.ts`: `html-to-image` a PNG ×2, Web Share API con archivos o descarga; cancelar no es error). El panel enlaza a la vista imprimible desde los botones del mes.
- QR de los enlaces: botón "QR" junto a cada enlace de `BarraLateral` abre `DialogoQr` con `TarjetaQr` (`components/`, 540×720 px fijos, inline styles; `CodigoQr` dibuja la matriz de `matrizQr` en `src/app/qr.ts` —`uqr`, corrección `H`— con puntos azul profundo, ojos de centro dorado oscuro `#8A6516` para que se lean oscuros y un sello con cubiertos al medio, salvo en enlaces largos —versión 7+, `alineacionAlCentro`— para no tapar el patrón de alineación). Va en el idioma del barrio (`mensajesDe`), no en el de la interfaz. Se arma con el enlace vigente: "Cambiar enlace" lo regenera. El de misioneros no lleva el código de acceso. Se comparte con `useCompartirPng` (`src/app/usar-compartir-png.ts`, también del imprimible; `qr-<slug>.png` / `qr-<slug>-misioneros.png`, `nombreArchivoQr`); `AjustarAlAncho` recibe `ancho`/`alto` (por defecto los del calendario). Colores para estilos en línea en `PALETA` (`src/app/paleta.ts`).

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
- Misioneros (`pantallas/VistaMisioneros.tsx`): sin token pide el código (`useEntrarMisioneros`) con `InputOTP` (`components/ui/input-otp.tsx`, paquete `input-otp`: 6 casillas en dos grupos de 3, pasa a mayúsculas, pegar `K7P-M2X` se normaliza con `normalizarCodigo` y entra solo al completar; `pushPasswordManagerStrategy="none"`, que además evita `elementFromPoint` en jsdom) y guarda el token que devuelve la API con `useTokenMisioneros` (`src/app/acceso-misioneros.ts`, `localStorage` por slug). El token va solo en `Authorization: Bearer`, nunca en una URL ni en `document.title`. Un `TOKEN_INVALIDO` (cambiaron el código) lo olvida y vuelve a pedir el código con un aviso; "Salir" lo olvida. WhatsApp con `enlaceWhatsApp` (`src/shared/telefonos.ts`: deja los dígitos y agrega el código del país deducido de la zona del barrio si el número es local) y `rel="noreferrer"`.
- Compartidos entre pantallas de calendario: `SelectorMes` (flechas del encabezado), `TarjetaDia`/`FilaTurno` y el hook `usePeriodoDeLaUrl`.
- Vista pública **Lista / Calendario** (`GrupoPildoras` con `variante="segmento"`; `localStorage` `almuerzo-misional:vista-publica` vía `leerLocal`/`guardarLocal` de `src/app/almacen.ts`, no en la URL; por defecto lista). `CalendarioMes` (`components/`, textos en `t.vistaCalendario`) es la grilla reutilizable: recibe `DiaCalendario[]` (chips `libre`/`tomado`/`tuyo`/`bloqueado` con su `companerismoId`, y `libres`), `companerismos` (`{ id, nombre }`) y `soloLibres` (atenúa los días sin turnos libres, también los que no tienen turnos); arma el `aria-label` de cada celda, pinta en gris los libres de días pasados, abrevia con `abreviaturas` (inicial sin acento; si dos chocan, "EN"/"ES" o un número), quita la inicial con un solo compañerismo y trae la leyenda (`list` "Leyenda"). En la vista pública, `CalendarioPublico` elige hoy (o el primer día con turno libre si el mes no es el actual), muestra debajo su `TarjetaDia` con las mismas `FilaPublica` de la lista y la trae a la vista al tocar un día. Pensado para sumarlo después a la vista de misioneros.
- "Agregar a mi calendario": `crearIcs` (`src/shared/ics.ts`, evento de día completo) y `abrirIcs` (hoja de compartir del móvil o descarga).
- Todo lo de admin (login, panel, imprimible) se carga aparte con `lazy` en `rutas` (`src/app/router.tsx`; `main.tsx` arma el router): la vista pública no descarga el panel ni Better Auth. Pantallas nuevas de admin van en `pantallas/admin/` y sus consultas en `src/app/consultas-admin.ts` (claves `["admin", tipo, slug, …]`; las mutaciones refrescan todo lo del barrio).
- Panel (`pantallas/admin/`): `Panel.tsx` (`EncabezadoAdmin` aparte, con selector de barrio y "Nuevo barrio" para el super admin, meses con estado y "Crear <mes>", contadores), `TablaMes.tsx` (columnas = compañerismos que trae el mes; en móvil la tabla se apila como tarjetas; acciones en diálogos), `BarraLateral.tsx` (enlaces, compañerismos —agregar, activar y desactivar: no todos los barrios tienen élderes y hermanas—, nota para cocinar y "Datos del barrio" (`#datos-barrio`: nombre, contacto del calendario impreso, idioma y zona; guarda solo lo que la persona tocó —lo demás sigue a la consulta, así una recarga trae lo que cambió otro admin—, manda y valida solo lo que cambió y avisa con `AvisoAmbar` al cambiar idioma o zona; `SelectIdiomaBarrio`, `CampoZona` y `useErroresCampos` de `campos-barrio.tsx`, compartidos con `FormularioBarrio`)), `NuevoBarrio.tsx` (sugiere el enlace desde el nombre; nombres de compañerismo en el idioma del barrio con `mensajesDe`), `mes.ts` (`contarTurnos`: los bloqueados no cuentan como tomados ni libres). `DisenoCalendario.tsx` (en la barra lateral, para el mes visible): escritura/referencia/mensaje con `maxLength` de `src/shared/personalizacion.ts`, plantilla como `RadioGroup`, imagen con input file oculto (valida tipo y tamaño en el cliente con los mismos códigos `IMAGEN_*`), "Guardar diseño" manda solo lo que cambió y "Vista previa" abre un diálogo con `CalendarioImpreso` (escalado con `AjustarAlAncho`, compartido con el imprimible) usando los valores sin guardar. Al editar una inscripción solo se mandan los campos que cambiaron (el panel no conoce el teléfono sin consentimiento y mandarlo vacío lo borraría); `FormularioInscripcion` con `consentimientoSoloQuitar`.
- Admin: `authClient` (`src/app/auth.ts`, `better-auth/react`) para entrar y salir; `useYo()` (`GET /api/admin/yo`) dice si hay sesión. Las rutas de `/admin` van envueltas en `RutaAdmin`, que redirige a `/admin/login` con un 401. Better Auth informa credenciales malas como `code: "INVALID_EMAIL_OR_PASSWORD"`, que el login traduce con `t.errores.CREDENCIALES_INVALIDAS`.
- Cuentas: `/admin/cuenta` (`pantallas/admin/Cuenta.tsx`, "Mi cuenta" en `EncabezadoAdmin`) cambia la contraseña con `authClient.changePassword({ revokeOtherSessions: true })`; `RutaAdmin` lleva ahí mientras `yo.usuario.debeCambiarPassword` sea verdadero. Largo con `PASSWORD_MIN` (10) y `PASSWORD_MAX` de `src/shared/cuenta.ts` (Better Auth, pantallas y script). Los campos de contraseña nueva, su validación y la traducción de errores de Better Auth están en `pantallas/admin/contrasena.tsx` (`CamposContrasenaNueva`, `validarContrasenaNueva`, `codigoDeErrorAuth`), compartidos por "Mi cuenta" y restablecer. Errores: `INVALID_PASSWORD` → `CONTRASENA_INCORRECTA`, `PASSWORD_TOO_SHORT` → `CONTRASENA_CORTA`; `CONTRASENAS_DISTINTAS` es solo del cliente.
- "¿Olvidaste tu contraseña?" (login) → `/admin/olvide` (misma respuesta exista o no el correo) y `/admin/restablecer?token=…` (`Restablecer.tsx`): lee el token una vez, lo saca de la URL con `navigate(…, { replace: true })` y lo guarda en `sessionStorage` para que recargar no lo pierda (se borra al terminar) y pone `<meta name="referrer" content="no-referrer">` mientras está montada; `INVALID_TOKEN` ofrece pedir otro enlace. Ambas fuera de `RutaAdmin`.
- "Primeros pasos" (`pantallas/admin/PrimerosPasos.tsx`, lógica en `src/app/primeros-pasos.ts`): tarjeta arriba del panel mientras queden pasos y el barrio no esté en marcha (`barrioEnMarcha`: un mes cerrado o con inscripciones). Nota para cocinar, crear mes y abrir mes salen de los datos; "revisar misioneros", "compartir enlaces" (al copiar cualquiera de los dos en `BarraLateral`) y "ocultar" van en `localStorage` por slug. Cada paso hace scroll a su ancla (`#misioneros`, `#nota-para-cocinar`, `#crear-mes`, `#estado-mes`, `#enlaces`).
- Información legal: `/informacion` (`pantallas/Informacion.tsx`, carga diferida, textos en `t.informacion`) dice que la app no es oficial de la Iglesia, qué datos guarda (ancla `#tus-datos`, enlazada desde la casilla de consentimiento de `FormularioInscripcion`) y enlaza al sitio oficial y a `churchofjesuschrist.org/comeuntochrist`, ambos con `?lang=spa|por|eng`. Los enlaces externos llevan `target="_blank"` y `rel="noreferrer"`. `PiePagina` (`components/`) es el `<Link>` interno "Herramienta no oficial · Información" que va al final de las pantallas públicas, el login y `/solicitar`; no lleva nada de la URL actual.
- Solicitudes: `/solicitar` (`pantallas/Solicitar.tsx`, carga diferida) valida con `esquemaNuevaSolicitud` y usa `components/Turnstile.tsx` (carga el script solo ahí; clave `VITE_TURNSTILE_SITE_KEY`, obligatoria en `vite build` (`vite.config.ts` falla sin ella); en desarrollo, sin ella, la de prueba `1x00000000000000000000AA`; el token se reinicia tras cada envío). El panel (`pantallas/admin/Solicitudes.tsx`, `AprobarSolicitud.tsx`) reutiliza `FormularioBarrio.tsx`, el formulario que también usa `NuevoBarrio`; `EncabezadoAdmin` muestra "Solicitudes" con la cantidad pendiente solo al super admin.
- Las maquetas de referencia están en el artifact "Almuerzo Misional — Maquetas" (vista pública, formulario, panel de la presidenta con estados del mes y "crear mes siguiente", calendario imprimible, misioneros, login móvil y escritorio).

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
- Misioneros: `/centro/m` con el código `CENT23` y `/jardim/m` con `JARD23`.
- Cuentas de admin: `super@ejemplo.cl` / `super-dev-123` (super admin) y `presidenta@ejemplo.cl` / `presidenta-dev-123` (admin de `centro`). Requiere `.dev.vars` (copiar `.dev.vars.example`) para iniciar sesión.
- Dos solicitudes de ejemplo: una pendiente (`carolina@ejemplo.cl`) y una rechazada.
- En `centro`, en el último mes sembrado, tres inscripciones: Hna. Pérez (con consentimiento; token de edición `dev-edicion-demo`), Hna. González (teléfono sin consentimiento) y Familia Muñoz (`origen = 'admin'`).
- Fechas: `src/shared/fechas.ts` (`hoyEnZona`, `fechasDelMes`, `diaDeSemana`, `zonaValida`, `zonaDelNavegador` —solo para sugerir la zona de un barrio nuevo—), compartido con el Worker.

## Producción

- En `https://almuerzo.ramonmartinez.dev` (dominio temporal, `routes` con `custom_domain` en `wrangler.jsonc`; sin `*.workers.dev`). Al pasar al dominio definitivo, dejar el viejo con un redirect 301 que conserve la ruta: los links de `/:barrio` y `/:barrio/m` circulan por WhatsApp. El token de misioneros guardado en `localStorage` tampoco se mueve: tendrán que volver a escribir el código. Lo que está en `localStorage` ("Mi turno") y la sesión de admin no se mueven de dominio.
- Recursos: D1 `almuerzo-misional` (`database_id` en `wrangler.jsonc`), R2 `almuerzo-misional-imagenes`, rate limits `LIMITE_INSCRIPCIONES`, `LIMITE_SOLICITUDES` y `LIMITE_ACCESO_MISIONEROS` y los secretos `BETTER_AUTH_SECRET` (`openssl rand -base64 32 | bunx wrangler secret put BETTER_AUTH_SECRET`), `SECRETO_MISIONEROS` (igual, con otro valor; sin él la vista de misioneros falla), `RESEND_API_KEY` y `CORREO_REMITENTE` (`bunx wrangler secret put …`) y `TURNSTILE_SECRET_KEY` (con `VITE_TURNSTILE_SITE_KEY` al hacer el build, si no `bun run deploy` falla; opcional `CORREO_SUPER_ADMIN`). Sin dominio verificado en Resend solo se puede mandar desde `onboarding@resend.dev` al correo de la cuenta. `BETTER_AUTH_URL` no se usa: Better Auth la deduce de la request.
- Deploy: `bun run db:migrate:remote` si hay migraciones nuevas (antes del código que las usa) y luego `bun run deploy` (typecheck + build + `wrangler deploy`). Comprobar con `curl https://almuerzo.ramonmartinez.dev/api/salud`.
- Primer super admin (o recuperar el acceso): `bun scripts/super-admin.ts --remote <email> "<nombre>"`, que pide la contraseña oculta y escribe directo en D1; con un correo existente actualiza el nombre, lo desbloquea y cierra sus sesiones. Los demás admins se crean desde el panel.
- El `database_id` real también define la base local (`.wrangler/state`): tras cambiarlo hay que volver a correr `db:migrate:local` y `db:seed:local`.

## Esquema

`src/db/schema.ts` (dominio) y `src/db/auth-schema.ts` (Better Auth). Este último lo genera el CLI de Better Auth (`bunx auth@latest generate --config <archivo con betterAuth({ plugins: [admin()] })> --output src/db/auth-schema.ts`; el paquete `@better-auth/cli` está obsoleto): regenerarlo y correr `bun run db:generate` si se cambian sus plugins. Los timestamps de Better Auth son `timestamp_ms`.

## API pública

Sin login. Nunca devuelve teléfono, dirección ni nota de otra persona: cada `select` nombra sus columnas (`src/worker/rutas/barrios.ts`).

| Método y ruta | Qué hace |
|---|---|
| `GET /api/barrios/:slug` | Barrio (nombre, idioma, zona, nota para cocinar), `mesesAbiertos` y `hoy` |
| `GET /api/barrios/:slug/meses/:periodo` | Compañerismos activos y turnos (`libre`/`tomado`/`bloqueado`, nombre si está tomado). Meses `abierto` y `cerrado`; `borrador` → 404 |
| `GET /api/barrios/:slug/turnos/:turnoId` | Un turno, para el encabezado del formulario |
| `POST /api/barrios/:slug/turnos/:turnoId/inscripcion` | Anotarse → 201 con `tokenEdicion` (se entrega una sola vez). 409 `TURNO_TOMADO`, 422 `TURNO_BLOQUEADO`/`TURNO_PASADO`/`MES_NO_ABIERTO` |
| `POST /api/barrios/:slug/misioneros/acceso` | `{ codigo }` (sin importar mayúsculas, espacios ni guiones) → `{ token }` = HMAC-SHA256 con `SECRETO_MISIONEROS` (propio, no el de Better Auth; clave en caché por isolate) de `misioneros:<barrioId>:<código>`: cambiar el código (o el secreto) invalida todos los tokens, sin tabla de sesiones. Código de otro largo (también vacío), malo o barrio inexistente → el mismo 404 `CODIGO_INVALIDO`. Límite `LIMITE_ACCESO_MISIONEROS` (10 por minuto por IP **y barrio**: `limitarPorIp(…, alcance)`, antes de validar) → 429 `DEMASIADOS_INTENTOS`; nunca se bloquea el barrio |
| `GET /api/barrios/:slug/misioneros` | Misioneros, con `Authorization: Bearer <token>`: barrio, `meses` (abiertos y cerrados) y `hoy`. Sin token, token de otro barrio o de un código anterior, o barrio inexistente → el mismo 404 `TOKEN_INVALIDO` |
| `GET /api/barrios/:slug/misioneros/meses/:periodo` | Turnos con nombre, modalidad, nota y teléfono (solo con consentimiento). Borrador → 404 |
| `GET/PATCH/DELETE /api/inscripciones/:id` | "Mi turno" con `Authorization: Bearer <tokenEdicion>`. 403 `TOKEN_INVALIDO`; 404 = ya no existe (el cliente puede olvidar el token). Editar/cancelar solo en mes abierto y día no pasado |

- Anotarse tiene un límite por IP: binding `LIMITE_INSCRIPCIONES` de `wrangler.jsonc` (30 por minuto, holgado por el CGNAT de las compañías móviles) con `limitarPorIp` (`src/worker/http.ts`, clave `claveDeIp(cf-connecting-ip)`: IPv4 tal cual, IPv6 por su /64; sin ese header no limita) → 429 `DEMASIADOS_INTENTOS`. Va antes de validar, así cuenta también los intentos inválidos.
- Validación con zod; los esquemas del formulario están en `src/shared/inscripciones.ts` y los usa también el frontend. Datos inválidos → 400 `{ error: "DATOS_INVALIDOS", campos: [...] }`.
- Un bloqueo manda sobre una inscripción existente: el turno se muestra `bloqueado` y sin nombre.
- Tests de la API en `test/worker/` (ver **Tests**). Usan fechas en 2000 y 2099 para no depender del día.

## API de admin y auth

- Better Auth se arma una vez por isolate (`obtenerAuth(env)` en `src/worker/auth.ts`) y vive en `/api/auth/*` (login `POST /api/auth/sign-in/email`, cookie de sesión). `disableSignUp: true`: las cuentas las crea el super admin con `/api/auth/admin/create-user` del plugin. Contraseñas con PBKDF2-SHA256 de Web Crypto (`src/shared/password.ts`, 100 000 iteraciones), no el scrypt por defecto, que excede la CPU del plan gratis.
- Límite de intentos de Better Auth guardado en D1 (tabla `rate_limit`; en memoria no serviría entre isolates): login 5 por minuto por IP (`cf-connecting-ip`). El login traduce el 429 como `DEMASIADOS_INTENTOS` y un usuario bloqueado (`BANNED_USER`) como `CUENTA_BLOQUEADA`. `/request-password-reset`: 3 por minuto por IP. `sembrar()` limpia la tabla (y `verification`) en los tests.
- `user.debeCambiarPassword` (`additionalFields`, `input: false`): se prende al crear una presidenta con contraseña temporal y se apaga con `contrasenaElegida(db, userId)` (`src/worker/auth.ts`, que además borra con `borrarEnlacesRestablecer` los enlaces de restablecer y bienvenida que le queden: Better Auth solo consume el usado) desde el hook `after` de `/change-password` y `emailAndPassword.onPasswordReset`; `scripts/super-admin.ts` la deja en 0. Restablecer cierra todas las sesiones.
- Restablecer: `sendResetPassword` manda `enlaceRestablecer(origen, token)` (origen de la request) con token de 1 hora (`MINUTOS_RESTABLECER`), como máximo `MAX_RESTABLECER_POR_HORA` (3) por persona (los demás no se mandan; la respuesta es la misma), en el idioma del primer barrio que administra (`idiomaDelUsuario`, si no `es`). Las tareas en segundo plano de Better Auth usan `waitUntil` (`advanced.backgroundTasks`), así el correo no demora la respuesta.
- `conSesion` reenvía al navegador la cookie que Better Auth renueva al leer la sesión; sin eso la sesión se cerraría a los 7 días aunque se use.
- Secretos: `BETTER_AUTH_SECRET` (y `BETTER_AUTH_URL`, `RESEND_API_KEY`, `CORREO_REMITENTE` opcionales, estos dos tipados en `src/worker/env.d.ts`) en `.dev.vars` (ver `.dev.vars.example`); en producción `bunx wrangler secret put BETTER_AUTH_SECRET`. En los tests son bindings de `vitest.config.ts`.
- Super admin = `user.role === "admin"`; admins de barrio = rol `user` + filas en `admins_barrio`.
- Todo cuelga de `/api/admin` (`rutas/admin/index.ts`), con `conSesion` (401 `NO_AUTORIZADO`, deja `c.var.usuario`). Lo de `/api/admin/barrios/:slug/*` pasa además por `conBarrioAdmin` (403 `SIN_PERMISO`, también si el barrio no existe; super admin con slug inexistente → 404; deja `c.var.barrio`). Tipos de contexto: `AppEnvAdmin` y `AppEnvBarrioAdmin` (`src/worker/contexto.ts`); middlewares en `src/worker/permisos.ts`. Para agregar rutas de un barrio se encadenan en `rutas/admin/{meses,turnos,barrio}.ts`.
- `GET /api/admin/yo` (usuario y sus barrios; super admin: todos), `POST /api/admin/barrios` (solo super admin: parte legible del enlace —se le agrega un código al azar—, compañerismos; 409 `SLUG_EXISTENTE`; `presidenta?: { email, nombre, cargo? }` opcional en el mismo batch: si el correo no tiene cuenta se crea con rol `user` y una contraseña temporal y `debeCambiarPassword`; después del batch se espera el correo de `avisarAdmin` y se responde `presidenta.correoEnviado`, y `presidenta.passwordTemporal` solo si el correo no salió, como respaldo para "Copiar datos"), `POST /api/admin/barrios/:slug/admins` (solo super admin: asigna por email un usuario existente; idempotente, solo avisa por correo si la asignación es nueva; 404 si no existe), `GET /api/admin/barrios/:slug/admins` y `POST /api/admin/barrios/:slug/admins/:userId/invitacion` (solo super admin: lista y reenvío → `{ correoEnviado }`, sección "Administradores" de `BarraLateral`). Para quien todavía `debeCambiarPassword` (si no, 422 `CUENTA_EN_USO`): `PATCH /api/admin/barrios/:slug/admins/:userId` `{ email }` corrige un correo mal escrito (409 `CORREO_EXISTENTE`; borra los enlaces viejos y manda la bienvenida al nuevo) y `POST …/admins/:userId/password-temporal` da otra temporal (cierra sus sesiones; se muestra con `DatosCuenta`, el mismo diálogo de "Nuevo barrio").
- Solicitudes de acceso (tabla `solicitudes`, esquemas en `src/shared/solicitudes.ts`): `POST /api/solicitudes` público (`rutas/solicitudes.ts`) con límite `LIMITE_SOLICITUDES` (5 por minuto por IP), zod, Turnstile (`verificarTurnstile` en `src/worker/turnstile.ts`, secreto `TURNSTILE_SECRET_KEY`; cualquier fallo → 400 `VERIFICACION_FALLIDA`) y una sola pendiente por correo (índice único parcial `solicitudes_email_pendiente_uq`; 409 `SOLICITUD_PENDIENTE`). `/api/admin/solicitudes` solo super admin (`rutas/admin/solicitudes.ts`): `GET ?estado=` → `{ solicitudes, pendientes }` (`companerismos` como lista y `barrioSlug` de las aprobadas), `POST /:id/aprobar` con el mismo cuerpo que `POST /barrios` (409 `SOLICITUD_RESUELTA` o `SLUG_EXISTENTE`) y `POST /:id/rechazar` `{ motivo? }`. Crear barrio está en `crearBarrio` (`src/worker/barrios.ts`), compartido con `POST /barrios`; aprobar y rechazar toman la solicitud con un UPDATE condicionado a `pendiente` (dos a la vez no pasan); si el barrio no se crea, vuelve a `pendiente`. Correos (`src/worker/avisos-solicitudes.ts`, nunca lanzan): `solicitudNueva` al super admin (`CORREO_SUPER_ADMIN`, separados por coma, o los usuarios con rol `admin`), `solicitudRecibida` y `solicitudRechazada` en el idioma de quien pidió; al aprobar, la bienvenida de siempre (`avisarAdmin`, con primeros pasos). No hay slugs reservados: el código al azar del final evita que un enlace choque con una ruta de la app.
- Correos: `enviarCorreo(env, { para, asunto, html, texto })` (`src/worker/correo.ts`, `fetch` a Resend sin SDK) nunca lanza: devuelve `{ ok }` y registra el error; el correo es un aviso, no parte de la transacción. Sin `RESEND_API_KEY` se escribe en la consola. Textos en `src/worker/correos/{es,pt,en}.ts` (`es` es la fuente, tipados con `MensajesCorreo`; cada plantilla es una función de sus `DatosCorreo`), armados con `armarCorreo(idioma, plantilla, datos)` → `{ asunto, html, texto }`, que escapa en el HTML lo que viene del usuario.
- Invitaciones (`src/worker/invitaciones.ts`): `avisarAdmin` manda `bienvenidaPresidenta` con un enlace de restablecer de 7 días (`tokenDeInvitacion`, guardado como `reset-password:<token>` igual que Better Auth) si la persona aún `debeCambiarPassword`, si no `barrioAsignado` con enlace a `/admin/<slug>`, en el idioma del barrio. `correoEnviado` es falso sin `RESEND_API_KEY`, así en desarrollo el diálogo muestra la contraseña. Nunca lanza (si falla el token también es falso): va después de crear el barrio o asignar.
- Rutas de un barrio (todas bajo `/api/admin/barrios/:slug`):

| Método y ruta | Qué hace |
|---|---|
| `GET /` · `PATCH /` | Datos del barrio (con `codigoMisioneros`) y compañerismos; editar nombre, nota para cocinar, contacto, idioma y zona (zona IANA inválida → 400 `campos: ["zonaHoraria"]`) |
| `POST /codigo-misioneros` | Código de misioneros nuevo → `{ codigoMisioneros }`; el anterior no entra y sus tokens dan 404 |
| `POST /enlace` | `{ slug }` (parte legible) → `{ slug }`: enlace con código al azar; el anterior da 404. El código de misioneros sigue igual (no va en la URL); el panel descarta lo guardado con el viejo y navega al nuevo. "Tus próximos turnos" (`localStorage` por slug) no se migra |
| `POST /companerismos` · `PATCH /companerismos/:id` | Crear (al final del orden) o cambiar nombre, `activo` y `orden`. Nunca se borran: desactivar conserva el historial. Crear o reactivar genera los turnos que falten en los meses borrador y abiertos del mes actual en adelante (`insertsDeTurnos` en `src/worker/consultas.ts`, el mismo que usa crear mes) |
| `GET /meses` · `POST /meses` | Meses con conteos (`turnos`, `tomados`, `bloqueados`); crear `{ periodo }` en `borrador` con un turno por día y compañerismo activo (409 `MES_EXISTENTE`) |
| `GET /meses/:periodo` · `PATCH /meses/:periodo` | Mes completo para el panel (incluye borradores e inscripciones de turnos bloqueados); `{ estado }` con transiciones borrador→abierto→cerrado→abierto (si no, 422 `TRANSICION_INVALIDA`) |
| `PATCH /turnos/:turnoId` · `PATCH /dias/:fecha` | `{ bloqueado, motivo? }` para un turno o para todos los de esa fecha (también los de compañerismos inactivos) |
| `POST /turnos/:turnoId/inscripcion` | Anotar a mano: `origen = 'admin'`, `creadoPorUserId`, sin token de edición. Sirve en días pasados y meses no abiertos. 409 `TURNO_TOMADO`, 422 `TURNO_BLOQUEADO` |
| `PATCH/DELETE /inscripciones/:id` | Editar o borrar cualquier inscripción del barrio, sin restricción de día ni estado. El consentimiento del teléfono solo se puede quitar, no dar: eso le toca a la persona |
| `PATCH /meses/:periodo/personalizacion` | Cambia solo los campos presentes de `{ escritura, escrituraRef, mensaje, plantilla }` (`src/shared/personalizacion.ts`; vacío → null; en cualquier estado del mes) → `{ personalizacion: { imagenKey, escritura, escrituraRef, mensaje, plantilla } }` |
| `PUT /meses/:periodo/imagen` · `DELETE /meses/:periodo/imagen` | PUT: cuerpo = archivo crudo, tipo por `Content-Type` (jpeg/png/webp, máx 5 MB; 400 `IMAGEN_INVALIDA`, 413 `IMAGEN_MUY_GRANDE`). Guarda en R2 con clave nueva `meses/<barrioId>/<periodo>/<uuid>.<ext>` y borra la anterior. Con el cliente RPC: `.imagen.$put({ param }, { init: { body: archivo, headers: { "Content-Type": archivo.type } } })`. DELETE la quita. Ambos devuelven `{ personalizacion }` |

- Buscadores: toda la API responde `X-Robots-Tag: noindex` (middleware en `src/worker/index.ts`) y las pantallas también (`public/_headers`), salvo `/`, `/informacion` y `/solicitar`. `public/robots.txt` solo bloquea `/api/` y `/admin`: bloquear `/:barrio` impediría que el buscador vea el `noindex`.
- `GET /api/imagenes/*` (público, `rutas/imagenes.ts`): sirve el objeto de R2 si la clave empieza con `meses/`; la clave con uuid es impredecible y cambia al reemplazar, por eso `Cache-Control: public, max-age=31536000, immutable` y ETag. 404 `NO_ENCONTRADO` si no existe.
- Un turno, inscripción o compañerismo de otro barrio da 404 aunque se conozca su id. El admin ve nota y modalidad, y el teléfono **solo con consentimiento**, igual que los misioneros.
- D1 admite 100 parámetros por consulta: los INSERT grandes van en tandas dentro de un `db.batch` (ver `rutas/admin/meses.ts`).
- Tests de admin: `crearAdmin({ email, superAdmin?, barrios?: ids })` e `iniciarSesion(email)` en `test/worker/datos.ts`; la cookie va en `pedir(ruta, { cookie })` (agrega `Origin`, que Better Auth exige en los POST con cookie).
- Correos en tests: `vitest.config.ts` deja `RESEND_API_KEY` vacía y `capturarCorreos()` (`test/worker/datos.ts`) lee los que `enviarCorreo` escribe en la consola; los de Better Auth salen en segundo plano, esperarlos con `vi.waitFor`. Para probar Resend "encendido": poner `env.RESEND_API_KEY` de `cloudflare:test`, simular `globalThis.fetch` y limpiarla en `afterEach` (`test/worker/bienvenida.test.ts`).

## Tests

**Tests primero**: cada issue trae una sección "Tests primero"; se escriben antes de implementar y el issue se cierra con todos en verde.

CI: `.github/workflows/ci.yml` corre `bun run typecheck` y `bun run test` en cada PR y en cada push a `main`.

`bun run test` corre dos proyectos de Vitest (`vitest.config.ts`) sobre Node; `--project worker` o `--project app` corre uno solo. Ojo: `bun test` (sin `run`) es el runner de Bun, no Vitest.

- **worker** (`test/worker/`): la API real dentro de workerd con una D1 en memoria y las migraciones aplicadas. `datos.ts` siembra datos fijos y `pedir()` llama al Worker como el navegador.
- **app** (`test/app/`): React en jsdom con Testing Library. `utilidades.tsx` trae `Proveedores` (React Query sin reintentos + idioma), `renderizarRuta`, `renderizarApp` (las `rutas` reales, con sus cargas diferidas), `simularApi` (reemplaza `fetch` por URL; gana la clave más larga contenida en la URL, así que conviene usar rutas completas) y `guardarInscripciones`. El setup fija el navegador en `es-CL` y limpia `localStorage`.
- El Select de idioma funciona en jsdom (se abre con clic y se elige la opción por rol: `test/app/Encabezado.test.tsx`). Para tests que solo necesitan otro idioma, basta `useIdioma().cambiarIdioma` desde un componente auxiliar.
- Base UI pone un input oculto junto al checkbox y al radio dentro del mismo `<label>`: buscarlos con `getByRole("radio", { name })`, no con `getByLabelText` (encuentra dos).
- Buscar por rol y texto visible (`getByRole`, `getByLabelText`), como lo usaría una persona. Los textos con mayúscula inicial por CSS (`first-letter:uppercase`) están en minúscula en el DOM.
- `bun run typecheck` también revisa los tests (`tsconfig.test.json` y `tsconfig.test-app.json`).

## Hitos

Se siguen en GitHub: un milestone por hito e issues con criterios de aceptación y tests en [RaimonxDev/almuerzos-misional](https://github.com/RaimonxDev/almuerzos-misional/milestones). Etiquetas: `api`, `frontend`, `diseño`, `infra`, `tests`. Los commits que completan un issue llevan `Closes #N`. Resumen:

1. **Base** ✅ — scaffold, seed y API pública con tests.
2. **Flujo público** ✅ — vista pública y formulario según las maquetas 1 y 2, con selector de idioma, "Tu turno", éxito con `.ics` y 409 amable.
3. **Mi turno** ✅ — ver, editar y cancelar con el token guardado (sin maqueta: sigue el estilo de las pantallas 1 y 2).
4. **Misioneros** ✅ — API y pantalla de `/:barrio/m` (maqueta 5; desde #47 con código de acceso en vez de token en la URL): calendario con teléfonos solo si hubo consentimiento y botón a WhatsApp.
5. **Admin: auth y API** ✅ — Better Auth (regenerar `auth-schema.ts`), login (maqueta 6), `admins_barrio`, super admin crea barrios. API: crear el mes siguiente generando turnos, cambiar estado `borrador`/`abierto`/`cerrado` (en la maqueta 3), bloquear/desbloquear, asignar a mano, editar/borrar inscripciones, regenerar enlace de misioneros, nota para cocinar, activar/desactivar compañerismos.
6. **Panel de la presidenta** ✅ — frontend según la maqueta 3, con columnas desde los compañerismos del barrio y teléfonos solo con consentimiento.
7. **Calendario imprimible y compartir** ✅ — personalización (imagen en R2, escritura, mensaje, plantilla), vista A4 según la maqueta 4 calculando el día en que parte el mes y 5 o 6 filas, PNG con `html-to-image` + Web Share API.
8. **Producción** — crear D1 y R2 reales, `database_id`, migraciones `--remote`, deploy y dominio; protección básica contra abuso del formulario público (ej. Turnstile o rate limiting).
9. **Correo y cuentas** (falta verificar el dominio en Resend y cargar sus secretos) — correos con Resend (plan gratis, requiere el dominio del hito 8; `fetch` a su API, sin SDK; textos en diccionarios del Worker), cambiar contraseña y obligarlo en el primer ingreso con contraseña temporal, recuperar contraseña por correo y bienvenida por correo a la presidenta en vez de copiar la contraseña.
10. **Solicitudes de acceso y onboarding** ✅ (faltan las maquetas, #34) — formulario público `/solicitar` (Turnstile), tabla `solicitudes` con aprobación **manual** del super admin en `/admin/solicitudes` (aprobar abre `NuevoBarrio` prellenado y reutiliza la creación de barrio + presidenta), correos de cada paso y "Primeros pasos" de la presidenta en el panel.
