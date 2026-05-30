# 06 - Fronteras de datos y almacenamiento

## Objetivo

Definir límites operativos entre datos locales, API read-only, BD staging/producción y archivos comerciales. Este documento no autoriza escrituras reales ni carga de datos sensibles.

## Tipos de almacenamiento

| Capa | Ejemplo | Persistencia | Riesgo | Regla |
| --- | --- | --- | --- | --- |
| `localStorage` navegador | `adein.crm.v1`, `adein.historicalSales.v1` | Local por navegador | Mezclar demo con real | Usar solo datos demo/sintéticos salvo autorización |
| API interna read-only | `127.0.0.1:3091` | Snapshot servido por backend interno | Exposición pública o escritura accidental | Mantener localhost y read-only |
| BD staging | Pendiente de confirmar | Centralizada si existe | Escrituras no autorizadas | No tocar sin gates |
| BD producción | Pendiente de confirmar | Centralizada real si existe | Impacto operativo/legal | No tocar sin autorización explícita |
| Archivos Excel/PDF | `.xlsx`, `.pdf` | Archivo local | Fuga de datos | No subir reales al repo |

## localStorage

### `adein.crm.v1`

Uso conocido: persistencia local de CRM, prospectos y seguimientos.

Reglas:

- No asumir que es fuente única de verdad.
- No usarlo para datos reales sin autorización.
- No copiar su contenido a commits, issues o documentación si contiene datos sensibles.
- Para demos, limpiar o recrear con datos sintéticos.

### `adein.historicalSales.v1`

Uso conocido: persistencia local del histórico comercial importado desde Excel.

Reglas:

- No subir Excel real.
- No subir JSON exportado de histórico real.
- No mezclar histórico real con datos demo.
- Documentar si una validación usa fixture sintético.

## API read-only `3091`

- Debe servir snapshot read-only.
- No debe escribir BD ni archivos.
- No debe exponerse públicamente.
- No debe usarse como puerta trasera para mutaciones.

Validaciones seguras:

```bash
curl -I http://127.0.0.1:3091
curl -I --max-time 5 http://38.242.222.25:3091
```

La segunda validación debe confirmar que no hay exposición pública.

## BD staging y producción

Estado: detalles pendientes de confirmar.

Reglas absolutas:

- No escribir BD sin gates.
- No ejecutar migraciones sin autorización.
- No conectarse con credenciales reales en documentación.
- No pegar cadenas de conexión en tickets, commits o prompts.
- No ejecutar scripts de escritura o purga sin backup y aprobación.

## Archivos reales Excel/PDF

Prohibido:

- Subir Excel real al repo.
- Subir PDF real al repo.
- Subir capturas que contengan datos reales.
- Crear fixtures desde datos reales sin anonimización aprobada.
- Usar nombres, teléfonos, domicilios, montos o contratos reales en ejemplos.

Permitido:

- Datos sintéticos.
- Estructuras de columnas sin valores reales.
- Documentación conceptual de flujos.
- Checklists y runbooks.

## Riesgos de mezclar datos demo con datos reales

| Riesgo | Ejemplo | Mitigación |
| --- | --- | --- |
| Decisiones con datos falsos | Dashboard combina demo y ventas reales | Etiquetar entorno y limpiar localStorage |
| Fuga de información | Excel real en commit | Revisar diff y bloquear binarios |
| Corrupción lógica | Parser aprende columnas específicas reales | Usar fixtures sintéticos representativos |
| Incumplimiento | Datos personales en prompts | Minimizar y anonimizar |

## Reglas de limpieza/purga conceptual

En navegador, con autorización del usuario y entendiendo que se pierde estado local:

```javascript
localStorage.removeItem('adein.crm.v1')
localStorage.removeItem('adein.historicalSales.v1')
```

Checklist antes de limpiar:

- [ ] Confirmar que el entorno es demo/local.
- [ ] Confirmar que no se necesita evidencia de ese estado.
- [ ] Exportar evidencia sintética si aplica.
- [ ] No ejecutar purgas sobre BD ni servidor.
