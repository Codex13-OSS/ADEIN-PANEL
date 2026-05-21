# v029 · Puente de snapshot read-only hacia Dashboard maestro

## ¿Qué hace v029?
v029 agrega un puente controlado en frontend para tomar un snapshot read-only validado en **Configuración** y mostrarlo en una sección dedicada del **Dashboard maestro**.

- No conecta el navegador a MariaDB.
- No usa API/backend real.
- No escribe datos.
- No migra datos.
- No reemplaza métricas históricas existentes del dashboard.

## Flujo operativo
1. Generar snapshot desde entorno controlado de backend/script:
   ```bash
   npm run db:snapshot
   ```
2. Ir a **Configuración** → bloque **Snapshot read-only de BD**.
3. Pegar el JSON del snapshot.
4. Pulsar **Validar snapshot** y confirmar estado `OK`.
5. Pulsar **Aplicar snapshot al dashboard**.
6. Ir a **Dashboard maestro** y revisar la sección **Snapshot BD read-only**.

## Alcance funcional
- Estado compartido en memoria React (Context):
  - `appliedSnapshot: DbDashboardSnapshot | null`
  - `applySnapshot(snapshot)`
  - `clearSnapshot()`
- Botones en Configuración:
  - `Aplicar snapshot al dashboard`
  - `Quitar snapshot aplicado`
- Visualización en Dashboard maestro:
  - `database`
  - `mode`
  - `writesEnabled`
  - `generatedAt`
  - Clientes, Lotes, Contratos
  - Cobranza esperada, Cobranza pendiente
  - Warnings

## Límites y garantías
- El snapshot aplicado **vive solo en memoria** de la sesión React.
- Al recargar la app, el snapshot aplicado se pierde (comportamiento esperado en v029).
- Esta implementación **no** convierte el dashboard en dashboard vivo productivo.
- Es exclusivamente un puente manual controlado para lectura.
