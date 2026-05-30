# 01 - Manual de plataforma ADEIN CRM

## Propósito

ADEIN-PANEL es la plataforma CRM/comercial de ADEIN. Su objetivo operativo es concentrar prospección, seguimiento comercial, análisis local de conversaciones WhatsApp `.txt`, histórico comercial importado desde Excel y visualización ejecutiva en dashboard.

Este documento describe el estado funcional conocido; no autoriza cambios funcionales, escrituras reales ni uso de APIs externas.

## Módulos principales

| Módulo | Uso | Estado conocido | Frontera |
| --- | --- | --- | --- |
| Dashboard comercial | Resumen de prospectos, seguimientos e histórico | Activo en staging `3016` | Validación visual/técnica, sin tocar producción |
| CRM ventas | Gestión local de prospectos y seguimientos | Activo | No usar datos reales sin autorización |
| Analizador WhatsApp `.txt` | Cargar/pegar texto exportado y extraer señales comerciales | Flujo local/simulado | No usa WhatsApp API real |
| Histórico Excel | Carga local de `.xlsx` con parser tolerante | Activo localmente | No subir Excel real al repo |
| API interna read-only | Snapshot de datos CRM | `127.0.0.1:3091` | Read-only, no público |

## Dashboard comercial

El dashboard debe reflejar el estado agregado del CRM comercial, incluyendo prospectos guardados, seguimientos creados y métricas derivadas del histórico Excel local. Validaciones recomendadas:

- Confirmar que staging responde en `http://38.242.222.25:3016`.
- Confirmar que el login staging mantiene la corrección de usuario en minúsculas de la base `v0.1.86-adein-crm-login-username-lowercase`.
- Confirmar que los cambios locales de CRM se reflejan en tarjetas/resúmenes esperados.
- No validar contra producción `3006` salvo inspección read-only explícita.

## CRM ventas

Flujo operativo esperado:

1. Entrar a CRM ventas.
2. Registrar o revisar prospecto con datos demo/no sensibles.
3. Crear seguimiento.
4. Volver al dashboard.
5. Confirmar reflejo visual del seguimiento.

No se deben registrar datos reales de clientes, teléfonos, identificaciones, documentos, pagarés ni información financiera sin autorización y sin gates de privacidad.

## Flujo WhatsApp `.txt`

Flujo local actual:

1. Ir a `CRM ventas > Analizar WhatsApp`.
2. Cargar o pegar contenido `.txt` exportado.
3. Ejecutar análisis.
4. Guardar prospecto.
5. Crear seguimiento.
6. Confirmar reflejo en dashboard.

Fronteras:

- Es un flujo local/simulado.
- No debe llamar a WhatsApp API real.
- No debe llamar a Facebook API real.
- No debe subir conversaciones reales al repo.
- Si se usan ejemplos, deben ser sintéticos y sin datos personales.

## Histórico Excel

Capacidades conocidas:

- Carga local de `.xlsx`.
- Parser tolerante para columnas variables.
- Resumen comercial en dashboard.
- Persistencia local en navegador.

Reglas:

- No subir Excel real al repo.
- No incluir capturas con datos reales.
- No convertir archivos reales a fixtures sin anonimización validada.
- No mezclar histórico demo con histórico real.

## localStorage keys

| Key | Propósito | Tipo de dato esperado | Regla |
| --- | --- | --- | --- |
| `adein.crm.v1` | Estado local del CRM, prospectos y seguimientos | JSON local en navegador | Demo/local salvo autorización |
| `adein.historicalSales.v1` | Histórico comercial importado desde Excel | JSON local en navegador | No usar Excel real en repo |

Estas llaves viven en el navegador del usuario. No equivalen a una base de datos central ni garantizan persistencia multiusuario.

## Qué es local o simulado

- Análisis de WhatsApp `.txt`.
- Persistencia `localStorage`.
- Importación de histórico Excel desde navegador.
- Datos demo usados para validación visual.

## Qué está conectado read-only

- API interna CRM read-only en `127.0.0.1:3091`.
- Debe servir snapshots sin escribir.
- Debe permanecer solo accesible desde localhost en el servidor.

## Qué NO está conectado todavía

Pendiente de confirmar antes de cualquier implementación:

- Integración real con WhatsApp/Facebook APIs.
- Integración real con OpenAI API.
- Escritura centralizada a BD desde el flujo local.
- Sincronización multiusuario del localStorage.
- Enlace funcional profundo con LIA Pagaré desde este repo.

## Qué no debe tocarse

- Producción/anterior `3006` sin autorización explícita.
- API `3091` para exponerla públicamente o habilitar escrituras.
- LIA Pagaré `3003` desde ADEIN-PANEL.
- Nginx, certificados, `80`, `443` o proxy `8088`.
- BD staging/producción sin gates formales.
- Archivos reales Excel/PDF/clientes.

## Validaciones visuales y técnicas

Visuales:

- Login staging permite acceso esperado.
- Dashboard carga sin errores visibles.
- CRM ventas muestra prospectos/seguimientos demo.
- Flujo WhatsApp `.txt` procesa texto sintético.
- Histórico Excel demo se resume en dashboard.

Técnicas read-only:

```bash
git status --short
git log -1 --oneline --decorate
curl -I http://127.0.0.1:3016
curl -I http://38.242.222.25:3016
curl -I http://127.0.0.1:3091
```

## Riesgos conocidos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Mezclar datos demo y reales | Pérdida de confianza o exposición de datos | Separar ambientes y purgar localStorage demo |
| Exponer `3091` | Superficie pública innecesaria | Mantener binding localhost y validar desde fuera |
| Reiniciar PM2 incorrecto | Caída de producción o LIA Pagaré | Inspección, autorización y nombre exacto |
| Subir Excel/PDF real | Fuga de información | Bloqueo por checklist y revisión de diff |
| Confundir ADEIN-PANEL con LIA | Cambios fuera de repo | Usar doc 07 y repo separado |

## Próximos pasos naturales

- Mantener fixtures sintéticos para validación visual.
- Definir gates antes de cualquier escritura real.
- Documentar endpoints read-only reales cuando se confirmen.
- Diseñar plan de sincronización multiusuario antes de reemplazar localStorage.
- Mantener separación operativa con LIA Pagaré.
