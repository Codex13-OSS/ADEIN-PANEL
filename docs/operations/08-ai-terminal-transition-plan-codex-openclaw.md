# 08 - Plan futuro: Codex/OpenClaw directo en Contabo

## Objetivo futuro

Integrar Codex en terminal del servidor Contabo junto con OpenClaw para reducir dependencia de GitHub como entorno de ejecución y acelerar inspección, documentación y operaciones controladas.

## Estado

NO implementado todavía. Este documento es un plan de transición, no una autorización para instalar agentes, abrir permisos, modificar servicios o ejecutar deploys desde el servidor.

## Requisitos previos

- [ ] Manuales operativos listos y revisados.
- [ ] Backups definidos para repos, configuración y datos.
- [ ] Usuario Linux limitado para agente.
- [ ] Permisos mínimos por ruta y comando.
- [ ] Auditoría/logs de sesiones.
- [ ] Lista de comandos permitidos/prohibidos.
- [ ] Modo dry-run primero.
- [ ] Sin escritura BD por defecto.
- [ ] Sin Nginx/PM2 restart sin confirmación.
- [ ] Separación clara entre ADEIN-PANEL y LIA-PAGARE-WEB.
- [ ] Política de secretos: no imprimir, no persistir, no pegar en prompts.

## Comandos permitidos/prohibidos conceptuales

| Categoría | Permitido inicialmente | Prohibido sin gate |
| --- | --- | --- |
| Git | `status`, `log`, `diff`, `show` | `pull`, `checkout`, `reset`, `push` |
| Sistema | `pwd`, `hostname`, `ss -tulpn`, `df -h` | Cambios de firewall, usuarios o permisos |
| PM2 | `pm2 list`, logs acotados read-only | `restart`, `reload`, `delete`, `save` |
| Nginx | Lectura autorizada de config | `reload`, `restart`, editar sites/certs |
| BD | Ninguno por defecto | Queries write, migraciones, dumps reales sin aprobación |
| Archivos | Leer docs y repo autorizado | Editar runtime, subir Excel/PDF reales |

## Fases recomendadas

### 1. Solo lectura/inspección

- Ejecutar inventarios read-only.
- Reportar estado de puertos, PM2 y repos.
- No modificar archivos.
- No usar credenciales ni APIs reales.

### 2. Documentación y reportes

- Crear/actualizar documentación operativa.
- Guardar cambios en rama documental.
- No desplegar automáticamente.

### 3. Cambios en rama local no desplegada

- Permitir edits en ramas locales aisladas.
- Validar `git diff --name-only` y scope.
- Prohibir cambios en producción sin revisión humana.

### 4. Build controlado

- Ejecutar build solo en ruta staging/autorizada.
- No ejecutar migraciones ni scripts de escritura.
- Capturar logs y resultados.

### 5. Deploy manual supervisado

- Humano aprueba pull/checkout/tag.
- Agente prepara checklist y evidencia.
- Restart PM2 solo con confirmación explícita.
- `pm2 save` solo tras validar.

### 6. Operación semi-autónoma con gates

- Gates por tipo de comando.
- Allowlist de servicios.
- Rollback predefinido.
- Auditoría obligatoria.
- Alertas ante intento de tocar Nginx, BD, producción o LIA.

## Matriz de riesgos

| Riesgo | Probabilidad | Impacto | Control |
| --- | --- | --- | --- |
| Agente reinicia PM2 incorrecto | Media | Alto | Allowlist, confirmación humana, nombre exacto |
| Exposición accidental de `3091` | Baja/media | Alto | Validación de binding, bloqueo firewall, checklist |
| Escritura BD no autorizada | Media | Crítico | Sin credenciales write, gates, dry-run |
| Modificar Nginx/certificados | Baja/media | Alto | Prohibición por defecto y backups |
| Mezclar ADEIN-PANEL con LIA | Media | Alto | Repos separados y documentación frontera |
| Filtrar secretos en logs/prompts | Media | Crítico | Redacción, no imprimir envs, auditoría |
| Deploy desde rama equivocada | Media | Alto | `git log`, `git status`, tag aprobado |

## Plan de rollback

- Mantener último tag/commit sano identificado.
- Registrar rutas runtime actuales.
- Registrar PM2 list antes de cambios.
- No ejecutar `pm2 save` hasta validar estado sano.
- Si falla build/deploy, volver a tag sano y reiniciar solo servicio afectado con autorización.
- Documentar incidente, comandos ejecutados y evidencia.

## Checklist antes de activar Codex/OpenClaw en Contabo

- [ ] Usuario Linux limitado creado y probado.
- [ ] Rutas permitidas documentadas.
- [ ] Comandos peligrosos bloqueados o gated.
- [ ] Backups probados.
- [ ] Logs de sesión habilitados.
- [ ] Manuales en `docs/operations/` revisados.
- [ ] Manual LIA separado revisado.
- [ ] Prueba dry-run completada.
- [ ] Política de secretos aprobada.
- [ ] Responsable humano definido para autorizaciones.
