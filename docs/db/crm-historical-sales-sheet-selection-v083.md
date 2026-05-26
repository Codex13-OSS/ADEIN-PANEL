# CRM Historical Sales v083 — Sheet Selection Hotfix

## Bug detectado en v082
El parser de Excel real ya funcionaba (`arrayBuffer` + `XLSX.read`), pero la selección de hoja principal tomaba el primer match encontrado en el orden físico del workbook. En archivos donde `Dashboard` aparecía primero, se terminaba usando un resumen visual en lugar de una hoja tabular de datos.

## Causa raíz
La lógica anterior usaba un `find` sobre `workbookSheets` con `PREFERRED_SHEETS.includes(...)`, lo que respetaba el orden del Excel y no la prioridad del negocio.

## Corrección aplicada en v083
- Se implementó selección de hoja principal respetando la prioridad de `PREFERRED_SHEETS`.
- `Base limpia` queda con prioridad superior y `Dashboard` baja al fallback final.
- Se añadieron perfiles de calidad por hoja para descartar hojas no tabulares.

## Reglas de calidad de hoja
Una hoja puede descartarse como principal si:
- no tiene headers útiles,
- tiene headers genéricos (`_1`, `_2`, ...),
- parece resumen visual (ej. `BASE CRM ADEIN` + columnas genéricas),
- no se detectan columnas clave (cliente/teléfono/predio/vendedor/estatus).

## KPIs multi-hoja
La hoja principal sigue siendo una sola (`selectedSheet`), pero se usan hojas auxiliares cuando están disponibles y son tabulares:
- `Clientes actuales` para `currentClients` y `clientsWithPhone`.
- `Lotes libres` para `freeLots`.
- `Seguimiento vendedores` para enriquecer `topSellers`.

## Compatibilidad y límites
- Mantiene lectura local en navegador.
- Mantiene almacenamiento en `localStorage` (`adein.historicalSales.v1`).
- No hay cambios de BD, servidor, rutas backend ni despliegue.
- No se suben datos reales al repositorio.
