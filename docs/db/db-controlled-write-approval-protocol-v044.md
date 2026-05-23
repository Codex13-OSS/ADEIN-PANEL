# ADEIN CRM — Controlled Write Approval Protocol v044

## Propósito del protocolo
Definir el proceso formal de aprobación previo a cualquier transición futura desde **rollback-only** hacia escritura persistente controlada, manteniendo bloqueado el COMMIT real por defecto hasta contar con autorización textual explícita y evidencia completa.

## Estado de referencia
- v042 validó ejecución real controlada en modo rollback-only.
- v043 aprobó evidencia y checklist de readiness sin habilitar persistencia.
- v044 formaliza el protocolo de aprobación, todavía sin ejecutar escritura real.

## Roles y responsabilidades
- **Usuario/Owner:** aprueba explícitamente alcance, ventana y condiciones.
- **Engineer:** valida scope técnico, gates y precondiciones operativas.
- **QA:** valida evidencia, integridad de resultados y criterios de aceptación/rechazo.

## Checklist de autorización (previo a fase futura)
- [ ] Aprobación textual explícita del owner con scope definido.
- [ ] Alcance técnico limitado a tablas permitidas y orden relacional acordado.
- [ ] Backup real verificado y evidencia de recuperación disponible.
- [ ] Dataset controlado confirmado (sin datos reales).
- [ ] Gates completos y consistentes con ambiente objetivo.
- [ ] Plan de evidencia posterior acordado (before/after + resultado + recovery).

## Gates requeridos para una futura fase
1. **Gate de modo explícito**
   - Debe declarar de forma inequívoca si la ejecución es dry-run, rollback-only o fase controlada posterior.
2. **Gate de entorno**
   - Debe validar ambiente permitido y bloquear ejecución fuera del entorno autorizado.
3. **Gate de backup**
   - Debe exigir evidencia de backup vigente y verificable antes de cualquier habilitación posterior.
4. **Gate de dataset controlado**
   - Debe bloquear datasets no etiquetados o potencialmente reales.
5. **Gate de tablas permitidas**
   - Debe rechazar cualquier tabla fuera del scope explícitamente autorizado.
6. **Gate de COMMIT explícito**
   - COMMIT real deshabilitado por defecto; solo habilitable en fase futura con aprobación textual y checklist completo.

## Prohibiciones
- No escritura real sin aprobación textual explícita.
- No COMMIT real por defecto.
- No datos reales todavía.
- No OpenAI/IA todavía.
- No UI conectada a escritura.
- No cambios de schema.
- No operaciones destructivas.

## Plantilla de aprobación humana (futura)
> “Autorizo ejecutar prueba controlada de escritura persistente en ADEIN CRM bajo el scope X, con backup Y, gate Z, dataset controlado y verificación posterior.”

## Plantilla de evidencia posterior
- `timestamp`
- `branch`
- `commit/tag`
- `backup_path_sanitized`
- `tablas_tocadas`
- `filas_antes`
- `filas_despues`
- `gate_usado`
- `resultado`
- `rollback_recovery_disponible`

## Condiciones para rechazar ejecución
- Ausencia de aprobación textual explícita del owner.
- Falta de backup verificable o evidencia de recovery.
- Dataset no controlado o no trazable.
- Scope fuera de tablas permitidas.
- Inconsistencia entre gates declarados y ambiente real.
- Evidencia incompleta para auditoría técnica y QA.

## Siguiente fase recomendada
La fase **v045** debería enfocarse en **controlled write dry-run implementation / commit-disabled rehearsal**, todavía sin escritura persistente real; alternativamente, una fase con script preparado pero con COMMIT bloqueado por defecto y self-checks reforzados.

## Cierre
Este protocolo v044 habilita gobernanza y seguridad documental para decisiones futuras, pero **no autoriza ejecución persistente real en esta fase**.
