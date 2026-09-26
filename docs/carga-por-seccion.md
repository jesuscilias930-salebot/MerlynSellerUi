# Carga de datos por sección

La sesión se verifica con `/auth/me`. Después, `crmResources` define qué datos
compartidos necesita la vista activa; no se precargan todos los catálogos.
Los paneles autónomos (envíos, features, pedidos, catálogo y testimonios) siguen
consultando sus propios endpoints al montarse, únicamente al abrir su sección.

| Pantalla | Datos compartidos consultados |
| --- | --- |
| Bandeja sin conversación | Conversaciones y columnas para los filtros |
| Conversación abierta | Mensajes, documentos del contacto y herramientas del chat: respuestas rápidas, stickers, intenciones y conjuntos |
| Remarketing | Columnas y presets |
| Respuestas automáticas | Intenciones |
| Respuestas rápidas | Respuestas y plantillas de botones |
| Escenarios | Escenarios, columnas y conjuntos reutilizables |
| Documentos / conjuntos / stickers / plantillas | Solo su catálogo correspondiente |
| Control: resumen | Clientes, productos y ventas utilizados por los indicadores |
| Control: inventario, pesos, precios o bundles | Productos; cada subpanel carga sus propios datos |
| Control: productos | Productos y categorías |
| Control: categorías | Categorías |
| Control: compras | Compras y productos |
| Control: ventas | Ventas, clientes y productos; pedidos desde su subpanel |
| Control: reportes | Reporte para el período seleccionado |

Los clientes de Control también cargan conversaciones para vincular contactos;
los bundles cargan conjuntos para gestionar sus fotografías.

Al volver a una sección se actualizan sus dependencias. No hay una caché
persistente que oculte cambios de otro usuario. Las consultas compartidas en
curso se cancelan al cambiar sus dependencias o desmontar Control. Una consulta
fallida no impide completar las demás: se muestra el error y se puede reintentar
(en Control, mediante **Actualizar**).

El canal de eventos permanece conectado para avisar de mensajes. Un evento ya no
recarga plantillas, escenarios, documentos ni otros catálogos: únicamente refresca
conversaciones/columnas y mensajes visibles. No se marcan como leídos los mensajes
de una conversación que quedó seleccionada pero está oculta en otra sección.

## Validación

```sh
node --experimental-strip-types --test tests/section-data.test.mjs
npm run build
```

Comprobación manual en Network, filtrando Fetch/XHR (sin modificar datos):

1. Recargar e iniciar sesión: deben aparecer `/auth/me` (o `/auth/session`),
   `/conversations` y `/leads/board`, no todos los catálogos.
2. Abrir Inventario: verificar `/products/all`, sin compras, clientes ni reportes.
3. Abrir Categorías y después Reportes: cada vista debe consultar sus endpoints.
4. Abrir una conversación: verificar herramientas y mensajes; cambiar a Envíos
   y comprobar que nuevos eventos no consulten mensajes de ese chat oculto.
5. Cambiar rápidamente entre vistas con la red lenta: las cargas compartidas
   anteriores deben cancelarse y no sobrescribir la vista actual.
6. Forzar un fallo de red, restablecerla y usar Reintentar/Actualizar.

No requiere cambios de backend, migraciones ni variables nuevas.
