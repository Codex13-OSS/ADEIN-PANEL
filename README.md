# ADEIN PANEL

Panel privado para ADEIN V1.

Este repositorio será independiente del sistema documental actual.

## Objetivo

Construir:

- Login dueño / vendedores
- Dashboard maestro
- CRM de ventas
- Módulo de negocio actual
- Módulo de campañas
- Análisis de conversaciones de WhatsApp con IA
- Conexión futura con sistema documental por botón/proxy

## Arquitectura

- adein.com.mx/panel -> ADEIN-PANEL
- adein.com.mx/documentos -> LIA-PAGARE-WEB
- Base de datos -> MariaDB

## Regla principal

No mezclar lógica de generación documental dentro de este repositorio.
