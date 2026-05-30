# 07 - Frontera con LIA Pagaré

## Resumen

LIA Pagaré vive en un repositorio separado y no debe modificarse desde ADEIN-PANEL. Este documento solo define la frontera operativa para evitar mezclar CRM comercial con generación documental.

## Inventario conocido

| Elemento | Valor |
| --- | --- |
| Sistema | LIA Pagaré / generación documental |
| URL pública | `http://38.242.222.25:3003` |
| PM2 | `lia-pagare-web` |
| Ruta runtime | `/opt/lia-pagare-v3` |
| Repo | `Codex13-OSS/LIA-PAGARE-WEB` |
| Manual oficial | `docs/lia-pagare-operations/` en el repo separado |
| Tag documental | `docs-lia-pagare-operations-manual-v001` |

## Regla principal

Desde ADEIN-PANEL solo se documenta la relación. No se deben modificar plantillas, mapping, QR, generación de PDF, rutas runtime, PM2 ni deploys de LIA Pagaré desde este repo.

## Qué NO modificar desde ADEIN-PANEL

- Plantillas de pagaré.
- Mapping de campos.
- QR o validación documental.
- Generación o firma de PDF.
- Servicio PM2 `lia-pagare-web`.
- Ruta `/opt/lia-pagare-v3`.
- Repo `Codex13-OSS/LIA-PAGARE-WEB`.
- Manual oficial `docs/lia-pagare-operations/` salvo trabajando dentro del repo LIA.

## Qué sí puede documentarse aquí

- Que ADEIN CRM puede necesitar navegar o enlazar hacia documentos.
- Que la generación documental vive fuera de ADEIN-PANEL.
- Que cualquier integración debe diseñarse con contrato claro.
- Que no se deben duplicar plantillas ni lógica documental.

## Si se necesita navegar o enlazar hacia documentos

Checklist conceptual antes de implementar en el futuro:

- [ ] Confirmar URL pública o ruta de navegación aprobada.
- [ ] Confirmar si el enlace requiere autenticación.
- [ ] Confirmar si se comparten identificadores entre CRM y LIA.
- [ ] Confirmar que no se exponen datos personales en query params.
- [ ] Confirmar que ADEIN-PANEL no genera ni modifica pagarés.
- [ ] Revisar manual oficial en `Codex13-OSS/LIA-PAGARE-WEB`.
- [ ] Trabajar cualquier cambio de LIA en el repo LIA, no aquí.

## Validación externa read-only

Si solo se necesita comprobar disponibilidad externa:

```bash
curl -I --max-time 5 http://38.242.222.25:3003
```

No usar esta validación como permiso para reiniciar, desplegar o modificar LIA.
