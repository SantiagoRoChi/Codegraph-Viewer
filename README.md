# CodeGraph Viewer

<p align="center">
  <strong>Visualiza y navega por el grafo de conocimiento de tu código</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.85+-blue.svg" alt="VS Code Version">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
</p>

---

Extensión para VS Code que permite visualizar y navegar por los nodos del archivo `codegraph.db` generado por [CodeGraph](https://github.com/colbymchenry/codegraph), el indexador semántico de código.

<p align="center">
  <a href="https://github.com/SantiagoRoChi/Codegraph-Viewer">GitHub</a>
  ·
  <a href="https://github.com/SantiagoRoChi/Codegraph-Viewer/issues">Reportar Bug</a>
</p>

## ✨ Características

- **🧠 Visualización de grafos** — Renderizado interactivo del grafo de conocimiento usando Cytoscape.js
- **🔍 Navegación** — Haz doble clic en un nodo para abrir el archivo fuente en la línea exacta
- **📂 Explorador lateral** — Navega por símbolos agrupados por tipo (clases, funciones, métodos, etc.) o por archivo
- **🔎 Búsqueda FTS** — Búsqueda full-text sobre todos los símbolos indexados
- **🎯 Desde el editor** — Selecciona un símbolo y haz clic derecho → "Focus Node in Graph" o "Preview Graph for Symbol"
- **🖱️ Hover** — Al pasar el ratón sobre un símbolo, muestra información detallada y enlace al grafo
- **🔗 Open Source** — Doble clic en un nodo del grafo abre el archivo fuente
- **🔄 Auto-sync** — Se actualiza automáticamente cuando `codegraph.db` cambia
- **🧩 Múltiples layouts** — Force-directed (fcose), jerárquico (dagre), circular, concéntrico
- **📊 Panel de detalle** — Información completa del nodo (firma, documentación, relaciones, callers/callees)

## 📦 Instalación

### Desde el Marketplace (próximamente)

```bash
code --install-extension codegraph-viewer.vsix
```

### Desde el código fuente

```bash
git clone <repo>
cd codegraph-viewer
npm install
npm run compile
code --install-extension codegraph-viewer.vsix
```

## 🚀 Uso

1. Asegúrate de tener un proyecto indexado con [CodeGraph](https://github.com/colbymchenry/codegraph):
   ```bash
   cd tu-proyecto
   codegraph init -i
   ```

2. Abre el proyecto en VS Code

3. Abre el **CodeGraph Viewer**:
   - Click en el icono del Activity Bar (🕸️)
   - O `Ctrl+Shift+P` → `CodeGraph: Open CodeGraph`

4. Navega por el grafo:
   - **Click** en un nodo → panel de detalle
   - **Doble clic** → abre el archivo fuente
   - **Rueda** → zoom
   - **Arrastrar** → mover el lienzo

5. Desde el editor:
   - Selecciona un símbolo → click derecho → **"Focus Node in Graph"**
   - Pasa el ratón sobre un símbolo → información + enlace al grafo

## ⚙️ Configuración

| Propiedad | Descripción | Default |
|-----------|-------------|---------|
| `codegraph.dbPath` | Ruta al archivo `codegraph.db` | `.codegraph/codegraph.db` |
| `codegraph.graph.layout` | Algoritmo de layout inicial | `fcose` |
| `codegraph.graph.nodeLimit` | Número máximo de nodos a renderizar | `1000` |
| `codegraph.graph.showEdgeLabels` | Mostrar etiquetas en las aristas | `false` |
| `codegraph.graph.autosyncOnCommit` | Ejecutar `codegraph sync` en cada commit | `true` |
| `codegraph.editor.codeLens` | Mostrar enlace "View in Graph" sobre definiciones | `true` |
| `codegraph.editor.hover` | Mostrar información al pasar el ratón | `true` |

## 🧪 Desarrollo

### Compilar

```bash
npm install
npm run compile    # Compilar TypeScript
npm run watch      # Modo watch
```

### Empaquetar

```bash
npm install -g @vscode/vsce
vsce package
```

Esto genera `codegraph-viewer-0.1.0.vsix`.

### Publicar en Marketplace

```bash
vsce publish
```

Requiere un token de acceso personal de Azure DevOps en la variable `VSCE_PAT`.

## 🤖 CI/CD

Este repositorio incluye un pipeline de GitHub Actions que:

- **Compila** la extensión en cada push/PR
- **Publica** automáticamente cuando se crea un tag `v*`
- Genera el `.vsix` como artefacto

Ver [`.github/workflows/publish.yml`](.github/workflows/publish.yml).

## 📄 Licencia

MIT

---

