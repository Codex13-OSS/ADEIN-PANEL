# v081 — Histórico comercial desde Excel local (beta)

- Objetivo: complementar Dashboard con métricas ejecutivas agregadas desde Excel local.
- Lectura: el archivo se procesa localmente en navegador.
- Storage: `adein.historicalSales.v1`.
- Datos guardados: resumen agregado, columnas detectadas, warnings y preview limitado (máx 5 filas, teléfono enmascarado).
- Límites: no se sube archivo, no hay backend, no hay fetch para Excel, no hay escritura en BD.
- Seguridad: no incluir datos reales en el repo.

## Prueba rápida
1. Ir a Configuración.
2. Cargar archivo `.xlsx/.xls`.
3. Verificar resumen en Settings y bloque “Histórico comercial” en Dashboard.
4. Ejecutar `npm run crm:historical-sales-excel-preview:self-check` y `npm run build`.
