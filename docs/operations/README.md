# Manual operativo general ADEIN

Este directorio concentra la documentación operativa de alto nivel para `Codex13-OSS/ADEIN-PANEL`. El alcance es documental: no define credenciales, no ejecuta despliegues y no autoriza cambios en base de datos, Nginx, PM2, servicios externos ni repositorios separados.

## Índice operativo

| Documento | Cuándo leerlo | Alcance |
| --- | --- | --- |
| [`01-adein-crm-platform-manual.md`](01-adein-crm-platform-manual.md) | Cambios, validaciones o soporte del CRM/dashboard comercial | Módulos, flujos locales, localStorage, límites funcionales |
| [`02-server-topology-ports-and-services.md`](02-server-topology-ports-and-services.md) | Antes de inspeccionar Contabo, puertos o PM2 | Topología, puertos, servicios conocidos, comandos seguros |
| [`03-adein-com-mx-website-and-proxy.md`](03-adein-com-mx-website-and-proxy.md) | Cualquier tema relacionado con `adein.com.mx` | Proxy interno conocido, Nginx/certificados como zona restringida |
| [`04-github-to-contabo-deployment-workflow.md`](04-github-to-contabo-deployment-workflow.md) | Preparar release, tag, pull o rollback conceptual | Workflow GitHub → Contabo y evidencias requeridas |
| [`05-crm-staging-validation-runbook.md`](05-crm-staging-validation-runbook.md) | Validar staging `3016` sin modificar servicios | Comandos read-only y comandos que requieren autorización |
| [`06-data-and-storage-boundaries.md`](06-data-and-storage-boundaries.md) | Revisar límites de datos, Excel, PDF, BD o localStorage | Fronteras de almacenamiento y reglas anti-datos reales |
| [`07-lia-pagare-integration-boundary.md`](07-lia-pagare-integration-boundary.md) | Navegación o integración conceptual con LIA Pagaré | Frontera entre ADEIN-PANEL y repo LIA-PAGARE-WEB |
| [`08-ai-terminal-transition-plan-codex-openclaw.md`](08-ai-terminal-transition-plan-codex-openclaw.md) | Planear Codex/OpenClaw directo en Contabo | Fases, permisos, gates, riesgos y rollback |
| [`09-ai-handoff-next-prompt.md`](09-ai-handoff-next-prompt.md) | Continuar en otro chat/agente | Prompt puente y comandos iniciales de inspección |

## Sistemas conocidos

| Sistema | URL/host conocido | Puerto | Repo | Manual recomendado |
| --- | --- | ---: | --- | --- |
| ADEIN CRM / plataforma comercial staging | `http://38.242.222.25:3016` | `3016` | `Codex13-OSS/ADEIN-PANEL` | Docs 01, 02, 04, 05, 06 |
| ADEIN CRM producción/anterior | `http://38.242.222.25:3006` | `3006` | `Codex13-OSS/ADEIN-PANEL` | Docs 02, 04, 05; no tocar sin autorización |
| API interna CRM read-only | `127.0.0.1:3091` | `3091` | `Codex13-OSS/ADEIN-PANEL` | Docs 02, 05, 06 |
| LIA Pagaré / generación documental | `http://38.242.222.25:3003` | `3003` | `Codex13-OSS/LIA-PAGARE-WEB` | Doc 07 y manual oficial del repo separado |
| Página ADEIN | `https://adein.com.mx`; proxy interno conocido `127.0.0.1:8088` | `80/443/8088` | Pendiente de confirmar | Doc 03 |

## Servicios PM2 conocidos

| Servicio PM2 | Sistema | Ruta runtime conocida | Regla |
| --- | --- | --- | --- |
| `adein-panel-staging-same-origin-v074` | ADEIN CRM staging | `/opt/ADEIN-PANEL-staging-v052` | Reiniciar solo si aplica y con autorización |
| `adein-panel-v040` | ADEIN CRM producción/anterior | `/opt/ADEIN-PANEL` | No tocar salvo instrucción explícita |
| `adein-crm-prospect-readonly-api-v069` | API CRM read-only | Pendiente de confirmar | Mantener solo localhost/read-only |
| `lia-pagare-web` | LIA Pagaré | `/opt/lia-pagare-v3` | No tocar desde ADEIN-PANEL |

## Reglas absolutas

- No tocar BD ni escrituras reales sin autorización explícita.
- No tocar producción `3006` sin autorización explícita.
- No tocar LIA Pagaré `3003` desde ADEIN-PANEL.
- No exponer `3091` públicamente.
- No reiniciar PM2 sin inspección previa y autorización.
- No tocar Nginx, `80`, `443`, certificados ni proxy `8088` sin autorización.
- No subir archivos reales de clientes, Excel o PDF.
- No usar APIs reales de OpenAI, Facebook o WhatsApp.
- Todo cambio estable requiere evidencia, backup y validación.
- Separar comandos de solo lectura de comandos con efectos.

## Estado actual de plataforma

- Dashboard comercial ADEIN activo en staging `3016`.
- Login staging corregido en la base `v0.1.86-adein-crm-login-username-lowercase`.
- Flujo WhatsApp `.txt` local: cargar/pegar texto, analizar, guardar prospecto, crear seguimiento y reflejar en dashboard.
- Persistencia local conocida: `adein.crm.v1` y `adein.historicalSales.v1`.
- Histórico comercial desde Excel `.xlsx` funciona de forma local/tolerante; no subir Excel real al repo.
- API interna `3091` sirve snapshot read-only y no debe escribir ni exponerse públicamente.

## Próximo paso recomendado

Mantener esta carpeta como punto de entrada operativo. Antes de cualquier cambio futuro, identificar el sistema afectado, leer el manual correspondiente, ejecutar únicamente inspecciones read-only, capturar evidencia y pedir autorización explícita para operaciones con impacto.
