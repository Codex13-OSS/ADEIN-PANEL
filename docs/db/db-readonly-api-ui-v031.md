# v031 · Carga manual de snapshot desde API read-only hacia UI

## Objetivo
v031 agrega en la UI de Configuración una carga **manual y controlada** del snapshot vía API read-only local (v030), sin conexión directa del navegador a MariaDB y sin escrituras.

## Alcance implementado
- Nuevo subbloque en **Configuración → Snapshot read-only de BD**: **“Cargar desde API read-only”**.
- Campo de URL base configurable en memoria React (default: `http://127.0.0.1:3090`).
- Botón manual: **“Cargar snapshot desde API read-only”**.
- Estados visuales: `idle`, `loading`, `success`, `error`.
- Fetch manual a `GET /api/db/snapshot` (solo al presionar botón).
- Validaciones mínimas de respuesta:
  - `ok === true`
  - `mode === "read_only"`
  - `writesEnabled === false`
  - `summaryCards` existente
- Reutiliza `validateSnapshotInput` para validar estructura completa antes de dejarlo listo.
- Si carga correctamente, el JSON se coloca en el textarea existente y queda listo para el flujo manual:
  1. Cargar desde API
  2. Validar snapshot
  3. Aplicar snapshot al dashboard

## Restricciones confirmadas
- **NO usa IA**.
- **NO integra OpenAI**.
- **NO usa API keys**.
- **NO escribe en BD**.
- **NO migra datos**.
- **NO usa localStorage** para snapshot ni URL.
- **NO hace polling ni auto-refresh**.
- **NO aplica automáticamente** al dashboard.

## Arranque de API read-only
```bash
npm run db:api:readonly
```

API esperada en:
- `http://127.0.0.1:3090/health`
- `http://127.0.0.1:3090/api/db/snapshot`

## Uso en UI (manual)
1. Abrir Configuración.
2. Ir a **Snapshot read-only de BD**.
3. En **Cargar desde API read-only**, confirmar o ajustar URL base (`http://127.0.0.1:3090`).
4. Presionar **Cargar snapshot desde API read-only**.
5. Verificar estado (`success`) y mensaje de carga.
6. Revisar/ajustar JSON en textarea si se requiere.
7. Presionar **Validar snapshot**.
8. Presionar **Aplicar snapshot al dashboard**.

## QA manual sugerido
1. API apagada:
   - Botón debe terminar en `error` con mensaje HTTP/red.
2. API encendida:
   - Debe cargar y mostrar `success`.
   - Debe poblar textarea con JSON snapshot.
3. Respuesta inválida (simulada):
   - Debe rechazar si `mode != read_only` o `writesEnabled != false`.
4. Validación UI:
   - Flujo debe seguir siendo manual; no auto-aplica dashboard.

## Seguridad funcional
“Esta acción consume la API read-only local. No conecta el navegador a MariaDB y no escribe datos.”

## CORS para desarrollo local (ajuste v031)
La API read-only ahora permite consumo desde frontend local de Vite con CORS controlado:

- Orígenes permitidos:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
- Headers CORS en respuestas:
  - `Access-Control-Allow-Origin` (solo si el Origin está permitido)
  - `Vary: Origin`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `Access-Control-Max-Age: 86400`
- `OPTIONS` responde `204` y no ejecuta lecturas de BD.
- `POST` y otros métodos no permitidos siguen en `405`.

