# Guía de desarrollo segura — ADEIN CRM Beta

## Propósito y arquitectura conocida

ADEIN PANEL es un panel privado con login, dashboard, CRM, campañas y análisis de conversaciones. El repositorio es independiente de la generación documental. La integración futura hacia documentos debe tratarse como una comunicación entre repositorios, no como código para copiar.

Stack detectado: React 18, TypeScript y Vite. El manifiesto también contiene utilidades de MariaDB y XLSX que no se usan automáticamente durante desarrollo visual.

## Arranque local

Las dependencias ya están instaladas. Para UI local:

```bash
npm run dev -- --host 127.0.0.1
```

La URL conocida es `http://127.0.0.1:5173/`.

## Validación técnica

Para cambios de frontend, seleccionar la validación mínima aplicable:

```bash
git diff --check
npm run build
git diff --name-only
git status --short --branch
```

No iniciar Browser QA ni servidor local a menos que la tarea lo autorice. Cuando haya UI autorizada, Browser QA no modifica código y la revisión humana decide el siguiente paso.

## Base de datos y scripts sensibles

`docs/db/` documenta schema y runbooks de ejecución manual; no es autorización para conectarse a una base ni aplicar SQL. El paquete contiene muchos scripts con nombres `db:*` y `crm:*`; algunos pueden involucrar staging, importaciones, migraciones, evidencia de servidor o escrituras. Todos están bloqueados por defecto, incluso los que se describen como dry-run o self-check, hasta tener autorización explícita por comando.

## Integración futura con LIA

La aplicación documental está en otro workspace. Antes de cambiar cualquier integración, inspeccionar ambas bases de código y documentar:

1. qué inicia la comunicación;
2. qué datos cruza el límite;
3. qué autenticación o proxy participa;
4. qué pruebas locales no escriben datos reales.

No usar assets, documentos, clientes ni datos de runtime como fuente de pruebas.
