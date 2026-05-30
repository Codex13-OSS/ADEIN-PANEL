# 04 - Workflow GitHub a Contabo

## Flujo actual

1. Codex trabaja sobre repo/rama en GitHub.
2. Se hacen cambios en rama específica.
3. Se valida localmente o en Codex.
4. Se revisa scope del diff.
5. Se crea commit y, si aplica, tag.
6. En Contabo se hace `git pull` o checkout del tag autorizado.
7. Se instala/build solo si aplica.
8. Se valida HTTP, PM2 y puertos.
9. Se reinicia solo el PM2 necesario si aplica.
10. Se ejecuta `pm2 save` solo después de validar.
11. Se documenta evidencia.

## Crear rama

```bash
git status --short
git checkout -b <tipo>/<descripcion>-vNNN
```

Reglas:

- Una rama por objetivo.
- No mezclar documentación con código funcional.
- Para esta carpeta, el scope permitido es `docs/operations/**`.

## Validar scope

```bash
git diff --name-only
git diff --stat
git status --short
```

Checklist:

- [ ] No se tocaron lockfiles.
- [ ] No se tocaron assets ni binarios.
- [ ] No se tocaron rutas de auth/login salvo tarea explícita.
- [ ] No se tocaron documentos/pagarés desde ADEIN-PANEL.
- [ ] No se incluyeron secretos ni datos reales.

## Commit y tag

```bash
git add <files>
git commit -m "docs(operations): add ADEIN platform operations manual v087"
git tag <tag-name>
```

Crear tag solo cuando el cambio esté validado y autorizado para release documental.

## Pull/checkout en servidor

Requiere autorización y debe ejecutarse en la ruta correcta, por ejemplo staging:

```bash
cd /opt/ADEIN-PANEL-staging-v052
git status --short
git fetch --all --tags
git checkout <branch-or-tag>
```

No ejecutar en `/opt/ADEIN-PANEL` (`3006`) salvo autorización explícita.

## Build

Solo si aplica. Para cambios exclusivamente documentales no se requiere build.

```bash
npm ci
npm run build
```

No ejecutar instalación/build si no se confirmó que el cambio afecta runtime.

## Validación HTTP

```bash
curl -I http://127.0.0.1:3016
curl -I http://38.242.222.25:3016
curl -I http://127.0.0.1:3091
curl -I --max-time 5 http://38.242.222.25:3091
```

La validación pública de `3091` debe fallar o no responder públicamente; si responde desde Internet, detener operación y escalar.

## Restart PM2 solo si aplica

```bash
pm2 list
pm2 restart adein-panel-staging-same-origin-v074
pm2 save
```

Reglas:

- `pm2 restart` requiere autorización y nombre exacto.
- `pm2 save` solo después de validar HTTP y logs básicos.
- No reiniciar `adein-panel-v040` ni `lia-pagare-web` durante deploy CRM staging.

## Separar CRM de LIA Pagaré

| Sistema | Repo | Servicio | Regla |
| --- | --- | --- | --- |
| ADEIN CRM | `Codex13-OSS/ADEIN-PANEL` | `adein-panel-staging-same-origin-v074` / `adein-panel-v040` | Deploy propio |
| LIA Pagaré | `Codex13-OSS/LIA-PAGARE-WEB` | `lia-pagare-web` | No tocar desde ADEIN-PANEL |

## Checklist de deploy seguro

- [ ] Objetivo y rama/tag confirmados.
- [ ] Scope revisado con `git diff --name-only`.
- [ ] Backup o punto de rollback identificado.
- [ ] Servicio PM2 exacto confirmado.
- [ ] Puertos validados antes del cambio.
- [ ] Build requerido confirmado o descartado.
- [ ] Reinicio requerido confirmado o descartado.
- [ ] `pm2 save` post-validación, no antes.
- [ ] Evidencia capturada.

## Rollback conceptual

1. Identificar último tag/commit sano.
2. Confirmar ruta correcta del servicio.
3. Checkout del tag/commit sano.
4. Rebuild si aplica.
5. Restart solo del PM2 afectado si aplica.
6. Validar HTTP/puertos.
7. Ejecutar `pm2 save` solo si el estado quedó sano.
8. Documentar causa, evidencia y commit revertido.

## Evidencia requerida

- `git log -1 --oneline --decorate` antes/después.
- `git status --short` antes/después.
- `pm2 list` antes/después si se tocó runtime.
- `ss -tulpn` si se validaron puertos.
- `curl -I` local y público del servicio afectado.
- Captura visual si hubo cambio perceptible en web.
