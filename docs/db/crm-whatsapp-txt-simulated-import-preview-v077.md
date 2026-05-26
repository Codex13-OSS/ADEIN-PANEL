# v077 — WhatsApp TXT Simulated Import Preview

## Objetivo
Habilitar una vista previa local y controlada para simular la carga de conversaciones `.txt` de WhatsApp y mostrar prospectos detectados en el dashboard comercial, sin usar APIs reales ni persistencia real.

## Alcance
- Fixture sintético de conversación tipo exportación de WhatsApp.
- Parser local para extraer participantes, cantidad de mensajes y sugerencias comerciales demo.
- Integración en `OwnerDashboardPage` con botón **"Probar .txt simulado"**.

## Qué sí hace
- Permite ejecutar una demostración local sin recargar la página.
- Muestra prospecto detectado, interés, temperatura simulada y próxima acción sugerida.
- Muestra mensajes de seguridad visibles para dueño/vendedor.

## Qué no hace
- No sube archivos reales al servidor.
- No usa OpenAI, Facebook API ni WhatsApp API.
- No escribe en base de datos, localStorage ni servicios externos.
- No modifica autenticación, cobranza, contratos, documentos ni módulos móviles.

## Seguridad
- Fuente marcada como `simulated_whatsapp_txt_v077`.
- Respuesta del parser fija: `syntheticOnly: true` y `realDataUsed: false`.
- Mensajes de advertencia en UI:
  - Vista previa con conversación simulada.
  - No se subió ningún archivo real.
  - No se guardaron datos reales.

## Siguiente fase recomendada
Implementar carga de archivo `.txt` en modo staging-controlado con validaciones de tamaño/formato, manteniendo write-gate desactivado por defecto y sin persistencia hasta aprobación explícita.
