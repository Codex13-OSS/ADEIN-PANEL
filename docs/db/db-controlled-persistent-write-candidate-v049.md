# v049 - Controlled Persistent Write Candidate / Minimum Safe Commit Planning

## Qué hace v049
v049 define un candidato controlado de escritura persistente mínima **solo como planeación verificable**.
Genera un artifact JSON con:
- gates de seguridad,
- plan relacional mínimo,
- checklist de precondiciones,
- approval artifact candidate,
- safety envelope.

## Qué NO hace v049
- No ejecuta escritura persistente.
- No ejecuta commit real de base de datos.
- No abre conexión a base de datos por defecto.
- No inserta datos reales.
- No requiere credenciales.
- No usa IA/OpenAI.
- No modifica frontend/UI/auth/login/mobile/documentos/src/schema.
- No modifica schema SQL.

## Por qué todavía no ejecuta escritura persistente
Esta fase es de hardening de seguridad y trazabilidad. Antes de cualquier ejecución real se exige evidencia previa, aprobación humana explícita y controles de respaldo/snapshots/rollback.

## Qué aprendimos de v048
v048 validó el enfoque de rollback-only rehearsal con cadena relacional objetivo y evidencia de no persistencia final.
v049 reutiliza ese aprendizaje para formalizar un candidato de commit mínimo seguro, aún no ejecutable.

## Qué se necesita antes de cualquier commit real
- Aprobación humana explícita del owner.
- Verificación de backup.
- Snapshot antes y después.
- Evidencia de rollback rehearsal.
- Gate explícito de fase futura (v050 o equivalente).

## Tablas en scope
- clients
- properties
- lots
- contracts
- payment_schedule

## Tablas bloqueadas
- crm_users
- sellers
- crm_followups
- import_batches
- import_raw_rows
- migration_plans
- migration_plan_events
- audit_log

## Orden relacional propuesto
1. properties
2. clients
3. lots
4. contracts
5. payment_schedule

## Columnas requeridas conocidas
- properties.name
- clients.full_name
- lots.property_id
- lots.lot_code
- contracts.client_id
- contracts.lot_id
- contracts.contract_code
- payment_schedule.contract_id
- payment_schedule.installment_number
- payment_schedule.due_date
- payment_schedule.expected_amount

## Approval artifact candidate
Estado: `draft_only`.

Aprobaciones requeridas:
- human_owner_approval
- backup_verified
- snapshot_before_verified
- rollback_rehearsal_evidence_verified
- explicit_future_commit_gate

Evidencia requerida:
- v048 rollback-only rehearsal
- backup reference
- snapshot before reference
- proposed row counts
- expected affected tables
- abort/rollback plan

No ejecutable porque:
`v049 is planning-only and does not allow persistent writes`.

## Safety envelope
- noCommitInThisPhase: true
- noPersistentWriteInThisPhase: true
- noRealDataInRepo: true
- noCredentialsInRepo: true
- noOpenAI: true
- noFrontendChanges: true
- commitRequiresFuturePhase: true
- commitRequiresHumanApproval: true
- commitRequiresBackupVerification: true
- commitRequiresBeforeAfterSnapshots: true
- commitRequiresRollbackEvidence: true

## Cómo ejecutar
- `npm run db:controlled-write:persistent-candidate`
- `npm run db:controlled-write:persistent-candidate:self-check`

## Checklist para futura v050 (o fase equivalente)
- [ ] Mantener scope estricto de tablas permitidas.
- [ ] Validar columnas requeridas en entorno objetivo.
- [ ] Confirmar backup válido y recuperable.
- [ ] Tomar snapshot antes de ejecutar.
- [ ] Definir snapshot después de ejecutar.
- [ ] Confirmar approval artifact completo.
- [ ] Definir abort plan y rollback plan verificables.
- [ ] Confirmar gate explícito de commit futuro.

## Riesgos bloqueados en v049
- Activación accidental de escritura persistente vía env vars.
- Intento de commit real sin aprobación humana.
- Uso de datos reales sin autorización explícita futura.
- Deriva de alcance hacia tablas no autorizadas.

## Confirmación explícita
En v049 no hay datos reales, no hay credenciales, no hay uso de IA/OpenAI y no hay cambios de frontend/UI/auth/login/mobile/documentos/src/schema.
