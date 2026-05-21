# ADEIN CRM DB Schema v023

Esta carpeta contiene la preparación **versionada** del schema SQL inicial para ADEIN CRM.

## Alcance de v023
- Define el schema base en `001_initial_schema.sql` para MariaDB 10.6.
- Incluye un seed **opcional/demo** en `002_seed_demo_optional.sql` con datos ficticios.
- Incluye validaciones post-esquema en `self-check.sql`.
- Incluye notas técnicas y runbook de ejecución manual.

## Límites explícitos de esta fase
- No conecta la app al motor de base de datos.
- No ejecuta migraciones automáticamente desde frontend/backend.
- No migra datos reales ni escribe datos reales.
- No incluye credenciales, passwords ni `.env` reales.

## Contexto operativo
En infraestructura existe una base vacía `adein_crm` (servidor externo), pero este repositorio solo almacena el schema versionado y documentación para ejecución controlada en fases posteriores.
