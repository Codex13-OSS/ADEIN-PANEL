# v052 — Server Staging Preflight / Backup + Row Count Verification

## Objetivo de v052
La fase **v052** implementa un preflight de servidor para preparar pruebas futuras de escritura controlada sin ejecutar cambios persistentes reales. Esta fase genera un artefacto JSON de evidencia conceptual y valida reglas de seguridad previas a cualquier operación de BD en servidor.

## Flujo oficial del proyecto (a partir de v052)
1. Trabajo por ramas.
2. Codex implementa cambios mínimos.
3. PR / merge.
4. Validación local de estructura/build/scripts.
5. Creación de tag estable.
6. `git pull` / deploy en servidor Contabo.
7. Prueba en puerto separado de staging.
8. Si falla, rollback de código al tag estable anterior.
9. Para datos, no confiar solo en Git: backup/snapshot/row-count/rollback obligatorios.

## Por qué no probar escritura real solo local
Las validaciones locales no reemplazan controles operativos del servidor real (puertos, PM2, estado de worktree, backup/snapshot y evidencia de conteos). Por ello, v052 separa el preflight de cualquier fase con escritura real.

## Entorno de servidor objetivo
- Servidor: `38.242.222.25`
- Repo en servidor: `/opt/ADEIN-PANEL`
- Puerto de producción actual: `3006` (**no tocar**)
- PM2 producción actual: `adein-panel-v040`
- Puerto de staging recomendado: `3016`
- PM2 staging sugerido: `adein-panel-staging-v052`

## Relación con v051
v052 toma como base estable:
- Tag: `v0.1.41-adein-crm-controlled-persistent-write-approval-evidence-pack`
- Head base: `fb09171`
- Fase previa: `v051`

## Evidencia que prepara v052
El script principal entrega un JSON con:
- checkpoint base;
- targets de servidor/staging;
- checklist de preflight (todo `false` por defecto);
- tablas permitidas/prohibidas;
- plan de row counts (sin queries reales en v052);
- plan de backup/snapshot;
- plan de deploy staging conceptual;
- plan de rollback/abort;
- safety envelope de la fase.

## Prohibiciones explícitas en v052
- No escritura persistente real.
- No COMMIT real de BD.
- No inserciones ni migraciones de datos.
- No cambio de schema.
- No modificación de PM2 de producción.
- No tocar puerto `3006`.
- No reinicios de servicios reales.
- No uso de credenciales dentro del repo.
- No conexión a BD por defecto.

## Ejecución
```bash
npm run db:server-staging:preflight
npm run db:server-staging:preflight:self-check
```

## Criterios de aceptación
- `db:server-staging:preflight` devuelve JSON válido.
- Modo por defecto: dry-run + preflight-only + read-only.
- Conexión DB deshabilitada por defecto.
- Sin commits ni writes persistentes.
- Señales peligrosas bloqueadas con exit code 1 y JSON válido (`ok=false`, `blocked=true`).
- Self-check valida caso positivo y todos los casos negativos definidos.

## Checklist de cierre de v052
- [ ] Script principal implementado y operativo.
- [ ] Self-check implementado y operativo.
- [ ] Scripts de `package.json` agregados.
- [ ] Build del proyecto en verde.
- [ ] Diff limitado a los archivos permitidos de v052.
- [ ] Sin credenciales ni payload de datos reales.
- [ ] Sin cambios a frontend/UI/auth/login/mobile/documentos/src/schema.

## Nota final
**v052 NO escribe en BD y NO modifica el servidor por sí misma; solo prepara la fase de deploy/control para un staging seguro con evidencia previa a escritura.**
