# Change Log

## [0.2.0] - 2026-05-28

### Added
- Barra de estado con contador de nodos y estado de conexión
- Output channel visible automáticamente al activarse
- Notificación con botones "Set Path" y "Show Log" cuando no encuentra la DB
- Búsqueda de `codegraph.db` en directorios padres del workspace (hasta 3 niveles)

### Fixed
- La extensión ahora muestra logs sin que el usuario tenga que buscar el canal manualmente
- La barra de estado da feedback inmediato del estado de la base de datos

## [0.1.0] - 2026-05-28

### Added
- Visualización de grafos con Cytoscape.js (force-directed, hierarchical, circular, concentric, breadth-first)
- Panel de detalle con información completa del nodo (firma, documentación, relaciones)
- Explorador lateral con agrupación por tipo y por archivo
- Búsqueda full-text de símbolos
- "Focus Node in Graph" y "Preview Graph for Symbol" desde el editor
- Hover provider con información y enlace al grafo
- CodeLens sobre definiciones de funciones/clases
- Auto-detección de la base de datos `codegraph.db`
- File watcher para refresco automático
- Git hook (post-commit) para auto-sync
- Múltiples layouts intercambiables
- Zoom-based label visibility para grafos grandes
- Deduplicación de nodos por qualified_name
- Filtrado de nodos ruidosos (import, export, parameter, variable, file)
