# ADEIN CRM — Write Readiness Checklist v043

## Propósito
Este checklist define controles mínimos antes de autorizar cualquier transición desde rollback-only hacia escritura controlada. En v043, la postura oficial sigue siendo **sin escritura persistente real**.

## Regla de oro de v043
- No ejecutar escritura real todavía.
- No usar datos reales todavía.
- No conectar UI a escritura todavía.
- No habilitar OpenAI/IA todavía.
- No abrir commit real sin gate nuevo, backup, aprobación explícita y evidencia previa.

## Checklist previo a cualquier escritura real

### 1) Condiciones mínimas de fase
- [ ] Existe documento de plan de fase con alcance acotado y aprobado.
- [ ] Existe protocolo de aprobación explícita (técnico + operativo).
- [ ] Se define ventana operativa y plan de reversa.
- [ ] Se mantiene evidencia de ejecución y validación en servidor.

### 2) Gates obligatorios
- [ ] Se mantiene gate de ejecución controlada para rollback-only.
- [ ] Se define **nuevo gate explícito** para cualquier paso posterior (no reutilizar `ROLLBACK_ONLY_V042`).
- [ ] Se documenta matriz de gates permitidos/prohibidos por ambiente.
- [ ] Cualquier ejecución sin gates completos debe quedar rechazada.

### 3) Validaciones de seguridad
- [ ] Sin credenciales hardcodeadas.
- [ ] Sin comandos destructivos fuera de protocolo aprobado.
- [ ] Logs redactados/sanitizados sin secretos.
- [ ] Revisión de cambios fuera de scope = bloqueante.

### 4) Validaciones de backup
- [ ] Backup completo reciente y verificado de `adein_crm`.
- [ ] Prueba de restauración de backup validada en entorno controlado.
- [ ] Hash/checksum o evidencia equivalente de integridad del backup.
- [ ] RTO/RPO definidos y aceptados para la ventana de ejecución.

### 5) Validaciones de datos
- [ ] Dataset de prueba no real y etiquetado de forma explícita.
- [ ] Trazabilidad de filas de prueba por token de ejecución.
- [ ] Verificación de no contaminación de datos productivos.
- [ ] Plan de limpieza validado para datos de ensayo permitidos.

### 6) Validaciones de auditoría
- [ ] Registro de quién aprueba, quién ejecuta y cuándo.
- [ ] Evidencia JSON de resultados archivada fuera del repo.
- [ ] Registro de commit/tag/HEAD ejecutado en servidor.
- [ ] Checklist firmado por responsables técnicos.

### 7) Validaciones de rollback y recovery
- [ ] Rollback técnico probado en fase previa.
- [ ] Procedimiento de recovery documentado y ensayado.
- [ ] Criterios de abortar ejecución definidos ex-ante.
- [ ] Criterios de éxito/fallo medibles antes de correr.

### 8) Validaciones de permisos
- [ ] Principio de mínimo privilegio para usuario de DB.
- [ ] Acceso temporal acotado a operadores autorizados.
- [ ] Segregación de funciones (ejecución vs aprobación).
- [ ] Rotación/gestión segura de secretos en entorno.

### 9) Validaciones de scope
- [ ] No tocar frontend/UI/auth/login/mobile/documentos.
- [ ] No modificar schema SQL en fase documental.
- [ ] No modificar scripts de escritura sin fase aprobada.
- [ ] No alterar package manifests ni configuración de servidor.

## Tablas candidatas futuras (solo evaluación, no ejecución)
Posibles candidatas para una fase controlada futura, condicionada a aprobación explícita:
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Tablas/áreas que NO deben tocarse aún sin autorización
- Cualquier tabla fuera del alcance de Business Promotion validado.
- Cualquier tabla con datos sensibles reales.
- Cualquier flujo de escritura conectado a UI.
- Cualquier ruta de escritura sin gate nuevo y sin backup verificado.

## Recomendación de siguiente fase (v044)
La fase **v044** debería limitarse a:
1. **Controlled write plan / approval protocol** totalmente documentado y firmado, todavía sin ejecutar escritura persistente real; o
2. Simulación adicional con commit deshabilitado, evidencia completa y checklist firmado.

## Cierre
Hasta completar y aprobar formalmente todos los puntos anteriores, la plataforma debe continuar estrictamente en modo **rollback-only** para pruebas controladas.
