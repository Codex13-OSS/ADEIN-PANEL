# 02 - Topología de servidor, puertos y servicios

## Mapa general Contabo

Servidor conocido: `38.242.222.25`.

Este mapa es operativo y debe tratarse como inventario parcial. Cualquier ruta, proceso o proxy no listado queda como pendiente de confirmar mediante inspección read-only antes de modificar.

```text
Internet
  |
  |-- :80/:443  -> Nginx/web público (incluye adein.com.mx; config pendiente de confirmar)
  |-- :3016     -> ADEIN CRM staging (público)
  |-- :3006     -> ADEIN CRM producción/anterior (público; no tocar)
  |-- :3003     -> LIA Pagaré (público; repo separado)

Servidor localhost
  |-- 127.0.0.1:3091 -> API CRM read-only (no exponer)
  |-- 127.0.0.1:8088 -> proxy interno conocido para adein.com.mx (pendiente de confirmar)
```

## Tabla de puertos

| Puerto | Alcance | Sistema | PM2/servicio conocido | Ruta conocida | Regla |
| ---: | --- | --- | --- | --- | --- |
| `3003` | Público | LIA Pagaré | `lia-pagare-web` | `/opt/lia-pagare-v3` | No tocar desde ADEIN-PANEL |
| `3016` | Público | ADEIN CRM staging | `adein-panel-staging-same-origin-v074` | `/opt/ADEIN-PANEL-staging-v052` | Validar y reiniciar solo con autorización |
| `3091` | Interno localhost | API CRM read-only | `adein-crm-prospect-readonly-api-v069` | Pendiente de confirmar | No exponer; mantener read-only |
| `3006` | Público | ADEIN CRM producción/anterior | `adein-panel-v040` | `/opt/ADEIN-PANEL` | No tocar salvo instrucción explícita |
| `8088` | Interno localhost | Página ADEIN/proxy interno conocido | Pendiente de confirmar | Pendiente de confirmar | No tocar sin autorización |
| `80` | Público | Nginx/web público | Nginx pendiente de confirmar | Pendiente de confirmar | No tocar sin autorización |
| `443` | Público | Nginx/web público TLS | Nginx/certificados pendientes de confirmar | Pendiente de confirmar | No tocar sin autorización |

## PM2 conocidos

| PM2 | Rol | Acción permitida por defecto |
| --- | --- | --- |
| `adein-panel-staging-same-origin-v074` | Staging ADEIN CRM `3016` | Inspección read-only; restart requiere autorización |
| `adein-crm-prospect-readonly-api-v069` | API interna `3091` | Inspección read-only; no publicar ni habilitar writes |
| `adein-panel-v040` | Producción/anterior `3006` | No tocar salvo instrucción explícita |
| `lia-pagare-web` | LIA Pagaré `3003` | No tocar desde ADEIN-PANEL |

## Público vs interno

- Público: `3003`, `3006`, `3016`, `80`, `443`.
- Interno esperado: `127.0.0.1:3091`, `127.0.0.1:8088`.
- Un puerto interno no debe aparecer escuchando en `0.0.0.0` ni responder desde Internet salvo autorización formal y revisión de seguridad.

## Riesgos de reiniciar servicios incorrectos

| Error | Riesgo | Ejemplo |
| --- | --- | --- |
| Reiniciar `adein-panel-v040` | Interrupción de producción/anterior | Tocar `3006` durante validación staging |
| Reiniciar `lia-pagare-web` | Interrupción de generación documental | Confundir relación documental con integración |
| Reiniciar API `3091` sin revisar | Pérdida de snapshot interno | Cambiar binding o modo read-only accidentalmente |
| Ejecutar `pm2 save` antes de validar | Persistir estado roto | Guardar proceso caído o comando incorrecto |

## Reglas de no exposición pública

- `3091` debe permanecer solo en `127.0.0.1`.
- `8088` se considera interno hasta confirmar arquitectura.
- Nginx, certificados, `80` y `443` no se modifican sin autorización.
- No abrir firewall/security group para servicios internos sin ticket explícito.

## Comandos de inspección seguros

Ejecutar solo en el servidor y sin cambiar estado:

```bash
hostname
pwd
git status --short
git log -1 --oneline --decorate
pm2 list
ss -tulpn
curl -I http://127.0.0.1:3016
curl -I http://38.242.222.25:3016
curl -I http://127.0.0.1:3091
curl -I --max-time 5 http://38.242.222.25:3091
curl -I --max-time 5 http://38.242.222.25:3006
curl -I --max-time 5 http://38.242.222.25:3003
```

## Comandos que requieren autorización

No ejecutar sin confirmación explícita, evidencia previa y plan de rollback:

```bash
git pull
git checkout <branch-or-tag>
npm install
npm run build
pm2 restart <service-name>
pm2 reload <service-name>
pm2 save
sudo systemctl reload nginx
sudo systemctl restart nginx
sudo certbot renew
```

> Nota: los comandos anteriores son ejemplos operativos; deben ajustarse al runtime real confirmado antes de usarse.
