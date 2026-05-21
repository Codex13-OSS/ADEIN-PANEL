# Modelo de Cobranza y Dashboard Ejecutivo

## Objetivo
Definir la lógica operativa y ejecutiva de cobranza para seguimiento por cliente/lote y toma de decisiones.

## Entidades base
- `clients`
- `lots`
- `contracts`
- `payment_schedule`
- `payments`
- `collection_status`

## KPIs por cliente/lote

| KPI | Definición | Fórmula conceptual |
|---|---|---|
| Costo total del lote | Precio contratado total | `contracts.total_price` |
| Pagado acumulado | Suma de pagos aplicados | `SUM(payments.amount_paid)` |
| Saldo pendiente | Monto restante | `total_price - pagado_acumulado` |
| Porcentaje pagado | Avance de pago | `(pagado_acumulado / total_price) * 100` |
| Próxima fecha de pago | Próximo vencimiento abierto | `MIN(payment_schedule.due_date where status=open)` |
| Monto próximo pago | Importe del próximo vencimiento | `payment_schedule.amount` próximo |
| Pagos vencidos | Cuotas vencidas sin liquidar | `COUNT(schedule vencido y abierto)` |
| Estatus de cobranza | Semáforo operativo | reglas de riesgo |

## Semáforo de riesgo (propuesta)
- **Al corriente**: 0 vencidos y próximo pago > 7 días.
- **Próximo a vencer**: 0 vencidos y próximo pago ≤ 7 días.
- **Atrasado**: 1 a 2 vencidos.
- **Riesgo**: 3+ vencidos o alto monto vencido acumulado.

## Resumen ejecutivo esperado
- Cobranza esperada hoy.
- Cobranza esperada semana.
- Cobranza esperada mes.
- Clientes atrasados.
- Clientes al corriente.
- Pagos próximos.
- Porcentaje promedio pagado.

## Vistas operativas recomendadas
1. **Por cliente**: estado general de pago y próximas acciones.
2. **Por lote/predio**: concentración de riesgo por zona/proyecto.
3. **Por vendedor/responsable**: cartera asignada y cumplimiento.
4. **Por antigüedad de mora**: 1-30, 31-60, 61+ días.

## Integración con pantallas actuales
- Dashboard maestro: resume KPIs y alertas.
- Negocio actual: detalle de clientes/lotes.
- Vendedores: desempeño por cartera.
- CRM ventas: continuidad desde seguimiento comercial hacia cobranza.

## Ejemplo ficticio
- Cliente: Cliente Demo
- Predio: Predio Demo
- Lote: Lote 01
- Responsable: Vendedor A
- Total lote: 300,000
- Pagado acumulado: 120,000
- Saldo pendiente: 180,000
- Porcentaje pagado: 40%
- Próximo pago: 2026-06-15 por 2,500
- Estatus: Próximo a vencer
