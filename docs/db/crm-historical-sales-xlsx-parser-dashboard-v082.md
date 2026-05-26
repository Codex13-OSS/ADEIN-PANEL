# v082 — CRM histórico comercial: parser real `.xlsx` + alineación Dashboard/Negocio actual

## Qué corrige
v082 reemplaza el lector preliminar que trataba `.xlsx` como texto plano por un parser real de Excel en navegador.

## Por qué v081 fallaba
v081 usaba `await file.text()` y `split('\t')`. Un `.xlsx` real es un ZIP con XML internos, por eso aparecían columnas basura como `PK`, `xl/workbook.xml` y similares.

## Cómo se lee ahora el Excel
- `await file.arrayBuffer()`
- `XLSX.read(arrayBuffer, { type: 'array' })`
- detección de hojas reales con `workbook.SheetNames`
- selección preferente de hojas: Base limpia, Clientes actuales, Lotes libres, Prospectos campaña, Seguimiento vendedores, Dashboard, Catálogos
- fallback a la hoja con más filas útiles
- `XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })`

## Alineación funcional
- **Configuración**: muestra hojas detectadas, hoja usada, columnas reales limitadas visualmente y warnings.
- **Dashboard maestro**: bloque “Histórico comercial” robusto; evita mostrar métricas falsas si detecta parse legacy roto.
- **Negocio actual**: usa histórico local válido como fuente principal y mantiene fallback demo cuando no hay histórico válido.

## Seguridad y límites
- No escribe BD.
- No requiere servidor/back-end nuevo.
- No hace fetch del Excel.
- No guarda workbook completo ni datos crudos completos en localStorage; guarda resumen + preview limitado.
- No incluye datos reales de clientes en repo.
