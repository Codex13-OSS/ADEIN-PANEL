# 05 - Runbook de validación CRM staging

## Objetivo

Validar ADEIN CRM staging `3016` y sus dependencias conocidas sin modificar servicios, archivos, BD, Nginx ni PM2.

## Alcance

- Servicio público staging: `http://38.242.222.25:3016`.
- PM2 staging: `adein-panel-staging-same-origin-v074`.
- Ruta staging conocida: `/opt/ADEIN-PANEL-staging-v052`.
- API interna read-only: `127.0.0.1:3091`.
- Producción/anterior `3006` y LIA `3003` solo se validan como externos/no tocar.

## Comandos solo lectura

### Git

```bash
cd /opt/ADEIN-PANEL-staging-v052
git status --short
git log -1 --oneline --decorate
```

Resultado esperado: rama/tag/commit conocidos y sin cambios inesperados.

### PM2

```bash
pm2 list
```

Revisar que existan, si aplica:

- `adein-panel-staging-same-origin-v074`
- `adein-crm-prospect-readonly-api-v069`
- `adein-panel-v040`
- `lia-pagare-web`

No reiniciar desde este runbook sin autorización.

### Puertos

```bash
ss -tulpn
```

Validar:

- `3016` escucha para staging.
- `3091` escucha solo en `127.0.0.1`.
- `3006` existe como producción/anterior, no tocar.
- `3003` existe como LIA Pagaré, no tocar desde ADEIN-PANEL.
- `8088`, `80`, `443` pertenecen al ámbito página/proxy/Nginx y no se modifican.

### Curl local/público staging `3016`

```bash
curl -I http://127.0.0.1:3016
curl -I http://38.242.222.25:3016
```

Esperado: respuesta HTTP del CRM staging.

### Curl local API read-only `3091`

```bash
curl -I http://127.0.0.1:3091
```

Esperado: respuesta local. No debe implicar escritura.

### Validación de que `3091` no sea público

Desde un entorno externo o desde el servidor usando la IP pública:

```bash
curl -I --max-time 5 http://38.242.222.25:3091
```

Esperado: timeout, conexión rechazada o no exposición pública. Si responde públicamente, escalar como hallazgo de seguridad y no continuar con despliegues.

### Validación de `3006` sin tocarlo

```bash
curl -I --max-time 5 http://38.242.222.25:3006
```

Uso: confirmar disponibilidad externa básica. No hacer login, no reiniciar, no deployar y no modificar runtime.

### Validación de `3003` solo como externo/no tocar

```bash
curl -I --max-time 5 http://38.242.222.25:3003
```

Uso: confirmar que LIA Pagaré existe como servicio separado. No modificar desde ADEIN-PANEL.

## Comandos que requieren autorización

Estos comandos cambian estado o pueden afectar disponibilidad:

```bash
git pull
git fetch --all --tags
git checkout <branch-or-tag>
npm ci
npm install
npm run build
pm2 restart adein-panel-staging-same-origin-v074
pm2 restart adein-crm-prospect-readonly-api-v069
pm2 restart adein-panel-v040
pm2 restart lia-pagare-web
pm2 save
sudo systemctl reload nginx
sudo systemctl restart nginx
```

Reglas:

- Nunca ejecutar restart de `adein-panel-v040` o `lia-pagare-web` como parte de validación staging.
- `pm2 save` solo después de validar un cambio autorizado.
- Nginx queda fuera de este runbook salvo tarea explícita.

## Checklist de evidencia

- [ ] `git status --short` capturado.
- [ ] `git log -1 --oneline --decorate` capturado.
- [ ] `pm2 list` capturado.
- [ ] `ss -tulpn` revisado para `3016` y `3091`.
- [ ] `curl` local y público de `3016` capturado.
- [ ] `curl` local de `3091` capturado.
- [ ] `curl` público de `3091` demuestra no exposición.
- [ ] `3006` validado solo read-only si era necesario.
- [ ] `3003` validado solo read-only si era necesario.
