# ADEIN CRM — Business Promotion Real Rollback Evidence v043

## Resumen ejecutivo
La fase **v043** cierra formalmente la evidencia técnica de la prueba real **rollback-only** aprobada en **v042**. El resultado demuestra que la tubería de ejecución real contra base de datos está validada únicamente en modo controlado sin persistencia: se insertan filas demo dentro de transacción real y se fuerza rollback obligatorio al final.

## Estado base validado (v042)
- Rama cerrada: `fix/crm-rollback-fixture-required-columns-v042`
- HEAD estable: `75aa72c`
- Commit real de Codex: `da85650`
- PR mergeado: `#54` desde `codex/fix-rollback-harness-for-required-columns`
- Tag estable: `v0.1.32-adein-crm-rollback-fixture-required-columns`

## Qué validó v042
v042 corrigió la preparación de fixtures para respetar columnas requeridas y dependencias relacionales entre tablas, permitiendo ejecutar prueba real controlada con rollback obligatorio y sin persistencia final.

## Ambiente usado
- Infraestructura: servidor **Contabo**
- Motor DB: **MariaDB**
- Base: `adein_crm`
- Manejo de secretos: credenciales fuera del repositorio (solo vía entorno operativo)

## Tablas participantes verificadas
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Gates de protección usados en la ejecución aprobada
- `ADEIN_DB_ROLLBACK_LIVE_TEST=1`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V042`
- `ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1`

## Resultado JSON crítico aprobado
```json
{
  "ok": true,
  "phase": "v042",
  "mode": "verified_controlled_real_execution",
  "liveHarnessPhase": "v042",
  "databaseMode": "rollback_only",
  "rollbackExecuted": true,
  "commitAllowed": false,
  "commitExecuted": false,
  "persistedRowsAfterRollback": 0
}
```

## Confirmaciones de seguridad y control
- **Rollback obligatorio confirmado:** `rollbackExecuted: true`
- **Commit bloqueado confirmado:** `commitAllowed: false`
- **Commit no ejecutado confirmado:** `commitExecuted: false`
- **Cero persistencia post-rollback:** `persistedRowsAfterRollback: 0`

## Evidencia generada en servidor
Ruta de evidencia operacional de la prueba aprobada:

`/tmp/adein-v042-real-rollback-20260522-173709/db-rollback-real-test.json`

## Diferencia de fases v040 vs v041 vs v042
- **v040:** falló por `Unknown column 'name' in 'WHERE'`.
- **v041:** falló por `Field 'installment_number' doesn't have a default value`.
- **v042:** corrigió required columns y fixture relationship-aware; prueba real rollback-only aprobada.

## Qué NO se habilitó todavía
- No se autorizó escritura persistente real.
- No se habilitó commit real en producción.
- No se habilitó uso de datos reales.
- No se conectó UI a rutas de escritura DB.
- No se habilitó OpenAI/IA.

## Conclusión
La tubería técnica real de Business Promotion en ADEIN CRM queda comprobada y aprobada **hasta rollback-only** (con transacción real, rollback obligatorio y persistencia cero). A la fecha de esta fase v043, **todavía no existe autorización para escritura persistente real**.
