# 🍽️ RestoAPI — Frontend

Interfaz web de RestoAPI: login, panel por rol, carta, mesas, reservas, pedidos y pantallas de cocina y barra en tiempo real.

> 🌐 **App en producción:** [apiresto-f5.vercel.app](https://apiresto-f5.vercel.app) · API: [restoapi-47sp.onrender.com](https://restoapi-47sp.onrender.com) ([Swagger](https://restoapi-47sp.onrender.com/docs))

> Backend: [IA-P1-BCN/Resto-API_Backend](https://github.com/IA-P1-BCN/Resto-API_Backend) · Despliegue: [guía de deploy](https://github.com/IA-P1-BCN/Resto-API_Backend/blob/dev/docs/deploy.md) (solo Anna despliega)

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite |
| Rutas | React Router |
| Cliente HTTP | axios (interceptor JWT) |
| Tipos de la API | openapi-typescript (generados desde `/openapi.json`) |
| Calidad | ESLint + typescript-eslint |
| Hosting | Vercel |

## Puesta en marcha

Requisitos: **Node.js 20.19+ o 22.12+** (lo que pide Vite; está en `engines` del `package.json`) y **Git**.

```bash
# 1. Clonar y situarse en dev
git clone https://github.com/IA-P1-BCN/Resto-API_Frontend.git
cd Resto-API_Frontend
git switch dev

# 2. Dependencias (instala exactamente las versiones del package-lock.json)
npm ci

# 3. Variables de entorno
cp .env.example .env
```

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | ESLint |
| `npm test` | Tests (Vitest + Testing Library) · `npm run test:watch` en modo continuo |
| `npm run gen:api` | Genera los tipos de la API desde el backend local (`src/api/schema.d.ts`) |

### Modo simulado (sin API)

Con `VITE_USE_MOCK=true` en el `.env`, el login funciona con usuarios de prueba y no se llama a la API. Sirve para trabajar en la UI antes de que el backend esté listo.

| Rol | Email | Contraseña |
|---|---|---|
| Administración | `admin@restoapi.dev` | `demo1234` |
| Sala (camarero) | `camarero@restoapi.dev` | `demo1234` |
| Cocina | `cocina@restoapi.dev` | `demo1234` |
| Barra | `barra@restoapi.dev` | `demo1234` |
| Cliente | `cliente@restoapi.dev` | `demo1234` |

En la pantalla de login hay un botón por rol que rellena las credenciales. **En Vercel debe ser `false`.**

**Demo en el despliegue.** Aunque la app use la API, el login ofrece *Probar la demo*: guarda `restoapi.demo=1` en el `localStorage` de ese navegador y recarga la app en modo simulado, con los mismos usuarios de prueba. No llama a la API ni toca la base de datos. Los cambios de la demo se guardan en ese navegador (`restoapi.demo.db`): quien vuelve a entrar, aunque haya cerrado sesión o la pestaña, encuentra lo que dejó. *Empezar de cero* (en el login) vuelve a los datos iniciales y *Salir de la demo* (en el login y en la cabecera) vuelve al login con la API. El modo simulado de desarrollo (`VITE_USE_MOCK=true`) no guarda nada y se reinicia al recargar.

Los datos simulados (carta, mesas, reservas y pedidos) siguen las mismas reglas que la API y se reinician al recargar la página. En las vistas **Cocina** y **Barra**, el botón *Simular pedido de sala* crea un pedido que aparece al instante, como si llegara por el WebSocket.

### Vistas (HU-13)

| Vista | Roles | Endpoints |
|---|---|---|
| Carta | todos (también bartender) | `GET /categories/`, `GET /dishes/` (filtros y paginación) |
| Mesas | admin, waiter | `GET /tables`, `PATCH /tables/{id}/status` |
| Reservas | admin, waiter, customer (solo las suyas) | `GET/POST /reservations`, `PATCH /reservations/{id}/cancel`, `GET /tables/available` |
| Pedidos | admin, waiter | `GET/POST /orders/`, `PATCH /orders/{id}/status` |
| Cocina | admin, kitchen | `GET /orders/`, `PATCH /orders/{id}/status`, `PATCH /orders/{id}/items/{item_id}`, `WS /ws/kitchen` |
| Barra (HU-41) | admin, bartender | Los mismos que cocina |
| Facturas (HU-14) | admin, waiter (exportar CSV: solo admin) | `GET /orders/?status=served`, `POST /orders/{id}/invoice`, `GET /invoices`, `GET /exports/invoices` |
| Estadísticas (HU-15) | admin | `GET /stats/sales`, `GET /stats/top-dishes` (filtros `from`, `to` y `limit`) |
| Crear contraseña (HU-52) | pública, con el enlace del email: `/crear-contrasena?token=…` | `POST /auth/set-password` |

La página *Crear contraseña* la abre quien recibe la invitación del admin (`POST /users/invite`). En el modo simulado cualquier token funciona, salvo `mock-invalido`, `mock-usado` y `mock-caducado`, que muestran su error.

Buscar mesas libres es solo para admin y waiter. El cliente (HU-51) reserva con *+ Nueva reserva* indicando día, hora, personas y notas, sin elegir mesa: `POST /reservations` sin `table_id` y el restaurante le asigna la mesa libre más ajustada. La hora se envía como hora local del restaurante, sin zona. Hasta 8 personas por reserva: con más, la web avisa de que llame al restaurante. El modo simulado aplica las mismas reglas. En la lista, el cliente ve "Asignada por el restaurante" (no puede consultar las mesas); si la API devuelve `table_number` en la reserva, ve "Mesa N".

### Login con Google y GitHub (HU-38)

En el login salen los botones *Continuar con Google* y *Continuar con GitHub* si su client id está configurado:

| Variable | Valor |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client id del cliente OAuth de Google (es público) |
| `VITE_GITHUB_CLIENT_ID` | Client id de la OAuth App de GitHub (es público) |

1. El botón lleva al proveedor con `redirect_uri` = `<URL de la app>/auth/callback` y un `state` aleatorio guardado en `sessionStorage`.
2. El proveedor vuelve a `/auth/callback?code=...&state=...`. Si el `state` no coincide, no se inicia sesión.
3. La página envía `{code, redirect_uri}` a `POST /auth/social/{provider}` y guarda el token igual que el login normal.

- Los secretos solo están en el backend (Render). En Vercel solo van los dos client id; después de cambiarlos hay que volver a desplegar, porque Vite los mete al construir.
- La callback (`https://<app>/auth/callback`) tiene que estar registrada en Google y en GitHub, y su dominio en `ALLOWED_ORIGINS` del backend.
- Modo simulado: los botones abren una ventana que imita a Google ("Elige una cuenta") o a GitHub ("Autorizar APIResto"). *Autorizar* entra como *Cliente Demo* y *Cancelar* muestra el mismo aviso que si se cancelara en el proveedor.

### Tiempo real (cocina y barra)

La vista de cocina se conecta a `ws(s)://<API>/ws/kitchen?token=<JWT>` y escucha los eventos `order_created` y `order_status_changed` (`{"event": ..., "order": {...}}`). Como el pedido del evento llega incompleto (sin hora ni notas), cada evento recarga la lista con `GET /orders/`; los cambios de estado se aplican además al momento. Si la conexión se cae, reintenta con espera creciente (1 s, 2 s, 4 s… hasta 30 s) y, mientras tanto, consulta `GET /orders/` cada 10 s.

Cada plato va a cocina o a barra según el campo `station` de su categoría (`kitchen` o `bar`), que el admin elige en *Gestionar categorías*; por defecto, cocina. En el modo simulado, Postres y Bebidas son de barra. Cada pantalla solo muestra sus platos. El estado de un pedido lo lleva cocina, salvo que solo tenga platos de barra.

### Estructura

```text
src/
├── api/          # Cliente axios (interceptor JWT) y un servicio por recurso (auth, menu, tables, reservations, orders)
│   └── mock/     # Modo simulado: datos de prueba (db.ts) y reglas de la API (server.ts)
├── components/   # Layout, rutas protegidas, paginación, formularios de reserva y pedido
├── context/      # AuthContext / AuthProvider / useAuth
├── hooks/        # useQuery (carga de datos), useKitchenFeed (cocina y barra en tiempo real)
├── pages/        # Login, panel, carta, mesas, reservas, pedidos, cocina, barra, facturas, estadísticas, 403, 404
├── routes/       # Navegación por rol (matriz de permisos del plan, 5.4)
├── utils/        # Formato de precios y fechas, textos de los estados
└── test/         # Tests de Vitest
```

> Para añadir una dependencia: `npm install <paquete>` y subir **también** el `package-lock.json`.

## Flujo de trabajo (Gitflow)

| Rama | Uso | Commits directos |
|---|---|---|
| `main` | Producción (Vercel) | ❌ Nunca |
| `dev` | Integración, rama por defecto | ❌ Nunca |
| `feature/HU-XX-descripcion` | Una rama por HU, sale de `dev` | ✅ Solo su dueña/o |
| `fix/HU-XX-descripcion` | Bug detectado en `dev` | ✅ Solo su dueña/o |
| `hotfix/descripcion` | Urgencia en producción, sale de `main` | ✅ Solo su dueña/o |

```bash
# Empezar una HU
git switch dev
git pull origin dev
git switch -c feature/HU-12-login

# Antes de abrir el PR
git pull origin dev     # traer lo último de dev y resolver conflictos en TU rama
npm run build
git push -u origin feature/HU-12-login
```

1. PR **`feature/...` → `dev`** con título `[HU-XX] Descripción` y `Closes #N`.
2. Lo revisa, aprueba y mergea **otra persona** (*Squash and merge*). La rama se borra automáticamente.
3. Quien mergea avisa en el canal: `✅ Mergeado #N [HU-XX] en dev → ¡haced pull!`
4. Todo el equipo actualiza su rama: `git pull origin dev`.
5. Al cierre de cada sprint: PR `dev` → `main` (*merge commit*) → despliegue.

**Commits** — [Conventional Commits](https://www.conventionalcommits.org/es/):
`feat(ui): ...` · `fix(login): ...` · `test: ...` · `docs: ...` · `ci: ...` · `chore(deps): ...`

## Reglas

- `.env` nunca se sube; solo `.env.example`.
- PRs pequeños (idealmente < 400 líneas).

## Docker

El `Dockerfile` construye la web con Node 22 y la sirve con nginx (con el mismo *rewrite* del SPA que `vercel.json`).
El stack completo (API + BD + web) se levanta con el `docker-compose.yml` del repo de backend: ver la [guía de despliegue, sección 7](https://github.com/IA-P1-BCN/Resto-API_Backend/blob/dev/docs/deploy.md#7-docker-en-local-hu-02).

```bash
# Solo el frontend:
docker build -t restoapi-frontend --build-arg VITE_API_URL=http://localhost:8000 .
docker run --rm -p 5173:80 restoapi-frontend    # http://localhost:5173
```
