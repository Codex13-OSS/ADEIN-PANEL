# DEPLOY PRIVATE BETA — ADEIN + LIA-PAGARE (runbook)

Runbook de despliegue para el release candidate `contabo-private-beta-*`.
Solo plan: cada paso requiere ejecución humana autorizada en Contabo.

## 0. Arquitectura objetivo

```
Browser (con credenciales beta)
  ↓  Basic Auth (htpasswd externo, read-only, fallo cerrado)
nginx ADEIN (contenedor web, :18080)
  ├── /                    → SPA ADEIN (try_files)
  ├── /api/local/*         → lead-agent:3192 (contenedor) → MariaDB (contenedor)
  ├── /lia (308) y /lia/*  → LIA host *:3103 (host.docker.internal)
  ├── /api/(capturas|generar|descargar|print|auth) → LIA host :3103
  ├── /lia/api/auth/handoff → exact-match + sub_filter → /lia/?embedded=1
  ├── /api/auth/verify     → excepción Bearer (única; LIA valida su JWT)
  ├── /login.html          → 308 /lia/login.html (el iframe no escapa)
  └── /api/auth/handoff (root) → 404 (flujo no autorizado)
LIA host: PORT=3103, bind * (comportamiento actual), bloqueado desde Internet por firewall.
```

## 1. Preflight

- `git -C <release-dir> status` limpio y HEAD = commit del MANIFEST.
- Puertos: 18080 y 3103 libres; 3003 (antiguo LIA) intacto y en uso por el servicio viejo.
- `docker --version` y `docker compose version` OK en el host.
- Wrapper operativo `adein-compose` disponible y `adein-compose ps` OK
  (el wrapper inyecta SIEMPRE `--env-file /etc/adein/.env`; nunca ejecutar
  `docker compose` directo sin el env autoritativo: causa drift de variables
  vacías y recreación accidental de contenedores).
- `ufw status` visible (root); 3103 NO debe estar abierto desde Internet.
- Confirmar que NO existe el volumen `adein_mariadb_data` con datos reales en este host.
  Si existe: parar y decidir con el propietario (nunca `compose up` sobre datos desconocidos).
- Backup previo: mysqldump del MariaDB real (si aplica), copia de `data/` de LIA
  (clientes, output, print-jobs.json), backup de `/etc/nginx` y de PM2 de servicios viejos.

## 2. Secretos (nunca en Git, nunca en imagen, nunca en logs)

Crear en el host (permisos 600, root):

- `/etc/adein/secrets/lia-handoff.secret` — ≥32 chars aleatorios.
  Mismo archivo para ADEIN (mount) y LIA (`LIA_ADEIN_HANDOFF_SECRET_FILE`).
- `/etc/adein/secrets/htpasswd` — generado con:
  `htpasswd -cB -C 10 /etc/adein/secrets/htpasswd <usuario-beta>`
  (o `openssl passwd -apr1`). Archivo del BETA PRIVADO.
  PERMISOS 644 OBLIGATORIOS: los workers de nginx (uid 101 en el contenedor)
  deben poder leerlo; con 600 el web container responde 500 (fail-closed pero roto).
  Contiene solo hashes, nunca passwords en claro. Montado read-only.
- `/etc/adein/.env` (600): DB_ROOT_PASSWORD, DB_PASSWORD, DEEPSEEK_API_KEY,
  ADEIN_LIA_HANDOFF_SECRET_HOST_PATH=/etc/adein/secrets/lia-handoff.secret,
  ADEIN_HTPASSWD_HOST_PATH=/etc/adein/secrets/htpasswd, ADEIN_HTTP_PORT=18080.
- En LIA (.env propio del proceso host): PORT=3103,
  LIA_ADEIN_HANDOFF_SECRET_FILE=/etc/adein/secrets/lia-handoff.secret,
  JWT_SECRET (aleatorio), PRINT_AGENT_TOKEN (aleatorio), NODE_ENV=production.

Contrato de fallo cerrado: si `htpasswd` no existe en el host, el web container
no arranca (nginx no inicia sin el archivo). Si el secret de handoff falta,
el endpoint de handoff responde 503 y LIA rechaza con 401.

## 3. MariaDB (cold start automático)

- Los SQL `docs/db/004_adein_local_lead_agent_schema.sql` y
  `docs/db/005_commercial_intelligence_v1.sql` se montan en
  `/docker-entrypoint-initdb.d/` (solo se ejecutan con volumen VACÍO).
- Primer arranque: `adein-compose up -d db` → esperar healthy →
  verificar `SHOW TABLES` (adein_leads, adein_lead_appointments,
  adein_lead_analysis_events, adein_processed_files,
  adein_commercial_analysis_history).
- Persistencia: los scripts init NO se re-ejecutan si el volumen ya tiene datos.
- 3306 NO se publica (solo `expose` interno). Verificar `ss -tlnp` sin 3306 externo.

## 4. LIA (host, inmutable, NO se modifica)

- Extraer `lia-pagare-adein-workingtree.tar.gz` (SHA256 en MANIFEST) en su
  directorio de destino; `npm ci`/`npm install` ya incluidos según artefacto.
- Arrancar con PORT=3103 (bind *: comportamiento actual) y los secretos del paso 2.
- Verificar: `curl http://127.0.0.1:3103/` → 200 (index LIA).
- NO tocar el antiguo LIA en 3003.

## 5. Firewall (ANTES de abrir 18080)

- `sudo ufw deny 3103/tcp` (o iptables equivalente) y verificar:
  - 3103 inaccesible desde Internet (test desde otra máquina/IP).
  - 3103 accesible desde el contenedor web (`docker exec <web> wget -q -O- http://host.docker.internal:3103/`).
- 3306 no publicado (contenedor): verificar con `ss -tlnp`.
- `sudo ufw allow 18080/tcp` SOLO después de los checks anteriores.
- antiguo 3003 intacto (reglas existentes sin cambios).

## 6. ADEIN (docker compose)

- `adein-compose up -d --build` (el wrapper inyecta `--env-file /etc/adein/.env`;
  NUNCA `docker compose` directo sin el env autoritativo).
- Verificar healthchecks: db healthy, web healthy
  (healthcheck = /api/local/lead-agent/leads acepta 200|401; lead-agent
  healthy con su nuevo healthcheck de Node fetch).
- `docker compose ps` y `docker logs` sin errores.

## 7. Smoke tests (obligatorios, sin secretos reales)

- Sin credenciales beta: `/`, `/lia/`, `/api/capturas`, `/api/generar`,
  `/api/descargar/x`, `/api/print/jobs`, `/api/auth/login` → 401.
- Con credenciales beta (sintéticas en QA): flujo completo ADEIN → Documents →
  handoff → iframe → wizard LIA; POST capturas sintético; descarga PDF;
  replay handoff → 401.
- Script automatizado: `scripts/adein-private-beta-e2e.mjs` con
  ADEIN_E2E_BASE_URL / ADEIN_E2E_BASIC_USER / ADEIN_E2E_BASIC_PASS /
  ADEIN_E2E_HANDOFF_SECRET (sintéticos).
- Fallos: parar LIA → /lia/* responde 503 con página amigable y /api/local sigue 200;
  reiniciar LIA → recuperación sin reiniciar nginx.

## 8. Rollback

1. `adein-compose down` (SIN -v: conservar volumen).
2. Restaurar servicios viejos (PM2 antiguo ADEIN + LIA 3003, /etc/nginx real).
3. Si se reutilizó MariaDB: restaurar mysqldump previo. Si el volumen es nuevo: `docker volume rm adein_mariadb_data`.
4. Revertir firewall: deny 18080, restaurar reglas previas.
5. Verificar: antiguo ADEIN OK, antiguo LIA OK, 18080 cerrado, 3103 sin servicio.
   Tiempo objetivo < 15 min.

## 9. Evidencia

Guardar en el release dir: salida de smoke tests, `docker compose ps`,
`ss -tlnp`, `ufw status`, hashes SHA256 de artefactos. NUNCA pegar secretos.
