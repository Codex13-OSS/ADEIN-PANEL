# AGENTS.md — ADEIN CRM Beta

Este repositorio es el workspace local autorizado de **ADEIN CRM Beta** dentro de la Oficina Virtual SI.

## Ruta y Git

- Ruta autorizada: `/home/coco/agentes-si/projects/adein-panel-agent-workspace`
- Remoto de integración: GitHub; no hacer push, PR, merge, tag ni deploy sin autorización humana explícita.
- La rama actual debe revisarse en cada tarea. La base funcional original se clonó desde un tag; toda tarea persistente debe usar su propia rama local.

## Lectura obligatoria antes de modificar

1. `AGENTS.md`
2. `README.md`
3. `docs/AGENT_DEVELOPMENT_GUIDE.md`
4. Documentación específica de la función afectada.

## Preflight obligatorio

```bash
git status --short --branch
git rev-parse HEAD
git remote -v
```

Si aparecen cambios previos no entendidos, detenerse y reportar bloqueo. No usar `reset`, `restore`, `clean`, `stash`, `rebase` ni comandos destructivos.

## Desarrollo local permitido

- Interfaz: `npm run dev -- --host 127.0.0.1`
- Build local: `npm run build`, sólo cuando la tarea lo requiera.
- No instalar dependencias sin autorización explícita.

## Límites de seguridad

- Prohibido leer, imprimir o modificar `.env`, secretos, credenciales, cookies, tokens o llaves.
- Prohibido conectar o escribir en bases de datos reales, staging o producción.
- No ejecutar scripts `db:*`, `crm:*`, migraciones, imports, staging, persistent writes, rollback rehearsals ni scripts de servidor, salvo autorización humana explícita y delimitada para ese script.
- No tocar Contabo, PM2, Nginx, Docker, servicios, puertos remotos ni deploy.
- No crear datos reales, exports, clientes, ventas, pagos ni archivos operativos.

## Relación con LIA Pagaré

LIA es un repositorio independiente. No copiar, mover ni mezclar archivos entre ambos. Para una tarea ADEIN ↔ LIA, primero inspeccionar en modo read-only ambos repositorios y explicar el flujo antes de editar.

## Entrega

Antes de entregar: revisar `git diff --check`, `git diff --name-only`, el estado Git y las validaciones relevantes. Si hay UI, entregar `READY_FOR_BROWSER_QA`; Browser QA es separado y read-only. Un cambio técnico no equivale a aprobación humana.

Cuando una tarea autorice ejecución local y Browser QA, avanzar autónomamente hasta la entrega: levantar la app, ejecutar Browser QA automatizado de navegador/Playwright cuando esté disponible, revisar DOM/consola y dejar el servidor vivo con la URL de revisión. Esperar entonces la revisión humana; no hacer commit, push ni deploy.
