# 03 - Sitio adein.com.mx y proxy interno

## Qué se sabe

- Dominio público conocido: `https://adein.com.mx`.
- Proxy interno conocido: `127.0.0.1:8088`.
- La relación exacta entre Nginx, certificados, upstream y aplicación detrás de `8088` está pendiente de confirmar.
- No se debe asumir que ADEIN-PANEL controla el sitio público.

## Relación con `127.0.0.1:8088`

El puerto `8088` se considera un upstream/proxy interno conocido para la página ADEIN. Hasta confirmar configuración, debe tratarse como zona restringida:

| Elemento | Estado | Regla |
| --- | --- | --- |
| Dominio `adein.com.mx` | Conocido | Inspección HTTP read-only permitida |
| `127.0.0.1:8088` | Conocido como proxy interno | No modificar ni reiniciar sin autorización |
| Nginx `80/443` | Pendiente de confirmar | No editar ni reload/restart sin autorización |
| Certificados TLS | Pendiente de confirmar | No tocar Certbot ni archivos TLS sin autorización |

## Pendiente de confirmar

- Repositorio fuente del sitio `adein.com.mx`.
- Archivo(s) de configuración Nginx aplicables.
- Upstream exacto hacia `127.0.0.1:8088`.
- Proceso PM2/systemd asociado, si existe.
- Estrategia de backup de configuración Nginx/certificados.
- Dueño operativo del dominio y DNS.

## Qué NO tocar sin autorización

- Nginx.
- Puertos `80` y `443`.
- Certificados TLS.
- Proxy interno `8088`.
- DNS del dominio.
- Archivos de configuración de virtual hosts.
- Servicios PM2/systemd asociados al sitio, si existen.

## Cómo inspeccionar sin modificar

Comandos read-only sugeridos en servidor:

```bash
curl -I https://adein.com.mx
curl -I http://127.0.0.1:8088
ss -tulpn | rg '(:80|:443|:8088)'
pm2 list
```

Si se tiene autorización para leer configuración, pero no modificar:

```bash
sudo nginx -T | less
sudo systemctl status nginx --no-pager
```

`sudo nginx -T` imprime configuración efectiva, pero no escribe archivos. Aun así puede exponer rutas o nombres internos; tratar su salida como evidencia sensible y no pegar secretos.

## Checklist antes de cualquier cambio futuro

- [ ] Confirmar repo fuente del sitio.
- [ ] Confirmar upstream actual de `adein.com.mx`.
- [ ] Respaldar configuración Nginx relevante.
- [ ] Confirmar estado de certificados y vencimiento.
- [ ] Confirmar ventana de mantenimiento.
- [ ] Confirmar plan de rollback.
- [ ] Validar staging o entorno alterno antes de tocar público.
- [ ] Obtener autorización explícita para reload/restart.
- [ ] Capturar evidencia antes/después.
