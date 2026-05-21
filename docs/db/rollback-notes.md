# Rollback Notes v023

## Principios
- Antes de cualquier ejecución en producción, generar backup verificable.
- No eliminar estructuras con datos reales sin respaldo validado.

## Reversión permitida en entorno vacío/demo
Si la base está vacía o es de laboratorio, se puede revertir eliminando tablas en orden inverso de dependencias.

## Advertencia crítica
- No ejecutar drops en ambientes con datos reales sin ventana de mantenimiento, backup y plan de restauración probado.
- v023 está diseñado para despliegue controlado; la reversión productiva requiere procedimiento formal de DBA.
