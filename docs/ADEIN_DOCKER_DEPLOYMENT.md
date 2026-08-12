# ADEIN CRM — Docker Deployment

## Requisitos

- Docker Engine 24+
- MariaDB 11

## Estructura

```
adein-release/
  compose.yaml
  Dockerfile.web
  Dockerfile.lead-agent
  nginx.conf
  .env        ← NO commit (credenciales reales)
  adein-production-seed.sql.gz
```

## Variables (.env)

```
DB_ROOT_PASSWORD=     # MariaDB root
DB_NAME=adein_crm_dev
DB_USER=adein
DB_PASSWORD=           # password del user adein
DEEPSEEK_API_KEY=      # API key de DeepSeek
ADEIN_HTTP_PORT=8080   # puerto público del CRM
ADEIN_LIA_URL=http://XX.XX.XX.XX:3002  # URL de LIA-PAGARE
```

## Deploy

```bash
# 1. Crear .env con los valores reales

# 2. Levantar
ADEIN_HTTP_PORT=8080 docker compose up -d

# 3. Restaurar seed
cat adein-production-seed.sql.gz | gunzip | docker compose exec -T db mariadb -u adein -p"$DB_PASSWORD" adein_crm_dev

# 4. Verificar
curl http://localhost:8080/health
```

## Acceso

```
http://IP_DEL_SERVIDOR:8080
```

## Backup

```bash
# Using helper
DB_PASSWORD=xxx bash scripts/db-backup.sh <project>

# Or manual
docker compose exec -T db mariadb-dump -u adein -p"$DB_PASSWORD" adein_crm_dev | gzip > backup-$(date +%Y%m%d).sql.gz
```

## Restore

```bash
# Using helper
DB_PASSWORD=xxx bash scripts/db-restore.sh <project> backup.sql.gz

# Or manual
cat backup.sql.gz | gunzip | docker compose exec -T db mariadb -u adein -p adein_crm_dev
```

## NO hacer

- No publicar 3192 ni 3306 al host
- No exponer credenciales en Git
- No docker system prune sin verificar
- No modificar www.adein.com.mx
