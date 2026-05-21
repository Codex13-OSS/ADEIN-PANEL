# v028 - Snapshot read-only de BD en UI interna

## Qué hace v028
v028 agrega una vista interna/controlada en **Configuración** para visualizar un JSON de snapshot generado por `npm run db:snapshot`.

La vista:
- Parsea JSON pegado manualmente.
- Valida estructura base del snapshot v027.
- Muestra `summaryCards`, `dashboard.business`, `dashboard.collection`, `dashboard.pipeline`, `warnings` y `notes`.
- Muestra banderas de seguridad: `mode` y `writesEnabled`.

## Cómo generar snapshot
1. Ejecutar en terminal:

```bash
npm run db:snapshot
```

2. Copiar el JSON de salida generado por el script.

## Cómo usar la UI
1. Ir a **Configuración**.
2. Abrir sección **Snapshot read-only de BD**.
3. Pegar el JSON en el textarea.
4. Presionar **Validar snapshot**.
5. Opcional: usar **Cargar ejemplo vacío** para cargar un snapshot demo con valores cero.

## Seguridad y alcance
- Esta vista **no conecta frontend directo a MariaDB**.
- Esta vista **no escribe datos** en BD.
- Esta vista **no crea backend ni API**.
- Esta vista **no es dashboard vivo** todavía.
- Es una herramienta interna/controlada para inspección manual del snapshot read-only.
