# ADEIN CRM — Controlled Write Plan v044

## Resumen ejecutivo
La fase **v044** define el plan técnico y operativo para una **futura** escritura controlada en base de datos, manteniendo la política actual de no persistencia real. Este documento consolida alcance, límites, riesgos, mitigaciones y requisitos mínimos para que una fase posterior pueda evaluarse con seguridad, trazabilidad y aprobación explícita.

## Objetivo de la futura escritura controlada
Establecer un marco verificable para habilitar, en una fase posterior y bajo autorización humana explícita, una ejecución controlada de escritura persistente con gates dedicados, dataset no real, evidencia completa y capacidad de recuperación.

## Problema que resuelve esta fase
Sin un plan formal de control, aprobación y evidencia, cualquier transición desde rollback-only hacia persistencia podría introducir riesgo operativo, inconsistencia relacional o incumplimiento de gobernanza. v044 resuelve esta brecha documentando condiciones previas, restricciones y criterios de decisión antes de cualquier paso de escritura real.

## Estado actual (al cierre de v044)
- El modo **rollback-only** fue validado y aprobado en fases previas.
- La tubería real controlada demostró rollback obligatorio y persistencia final cero.
- La **escritura persistente real aún no está autorizada**.
- Cualquier COMMIT real permanece bloqueado por política y requiere aprobación futura específica.

## Alcance permitido para una futura escritura controlada
- Preparar ejecución acotada por tablas permitidas.
- Aplicar gates explícitos de modo, entorno, dataset, backup y autorización.
- Limitar operaciones a dataset demo/controlado.
- Registrar evidencia técnica y de QA antes y después de ejecución.

## Tablas candidatas futuras (scope potencial)
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Tablas que NO deben tocarse todavía sin autorización explícita
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`

## Orden relacional esperado para futura ejecución controlada
1. `clients` / `properties` según diseño final
2. `lots`
3. `contracts`
4. `payment_schedule`

## Requisitos mínimos antes de cualquier escritura persistente
- Backup real previo, verificable y reciente.
- Snapshot de conteos antes/después por tabla objetivo.
- Dry-run exitoso en el alcance definido.
- Rollback-only exitoso en el mismo flujo de validación.
- Revisión humana técnica y de QA.
- Write gate nuevo y específico para fase posterior.
- Dataset demo/controlado (no datos reales).
- Confirmación explícita del usuario/owner.

## Riesgos principales
- Persistencia accidental fuera de scope.
- Ejecución con gate incompleto o configuración ambigua.
- Contaminación con datos no controlados.
- Orden relacional incorrecto y fallas de integridad.
- Evidencia insuficiente para auditoría o rollback/recovery.

## Plan de mitigación
- Rechazar ejecución sin aprobación textual y gates completos.
- Usar dataset etiquetado y trazable por token de ejecución.
- Forzar validaciones previas de orden relacional y tablas permitidas.
- Exigir backup + verificación de restauración antes de habilitar fase posterior.
- Capturar evidencia estructurada (antes/después, entorno, resultado, recovery).

## Criterios de abortar
- Falta de backup verificable.
- Falta de aprobación explícita del owner.
- Desviación de scope de tablas permitidas.
- Falla de validaciones de pre-ejecución o evidencia incompleta.
- Detección de datos no controlados en el dataset objetivo.

## Evidencia requerida
- Timestamp y contexto de ejecución (branch, commit/tag).
- Gates activos y modo de ejecución.
- Tablas objetivo y conteos antes/después.
- Resultado final (éxito/fallo) con observaciones de QA.
- Confirmación de disponibilidad de rollback/recovery.

## Conclusión
La fase **v044** es exclusivamente documental: prepara el plan de controlled write, define controles y criterios de aprobación, y mantiene la postura vigente de **no habilitar escritura persistente real** en esta etapa.
