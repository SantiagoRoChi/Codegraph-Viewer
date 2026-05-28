# CodeGraph Viewer

<p align="center">
  <strong>Visualiza y navega por el grafo de conocimiento de tu código</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.85+-blue.svg" alt="VS Code Version">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
</p>

<p align="center">
  <a href="https://github.com/SantiagoRoChi/Codegraph-Viewer/releases/latest">📥 Descargar VSIX</a>
  ·
  <a href="https://github.com/SantiagoRoChi/Codegraph-Viewer">GitHub</a>
  ·
  <a href="https://github.com/SantiagoRoChi/Codegraph-Viewer/issues">Reportar Bug</a>
</p>

---

Extensión para VS Code que permite visualizar y navegar por los nodos del archivo `codegraph.db` generado por [CodeGraph](https://github.com/colbymchenry/codegraph), el indexador semántico de código.

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

### Descargar VSIX (recomendado)

Descarga el archivo `.vsix` desde la [última release](https://github.com/SantiagoRoChi/Codegraph-Viewer/releases/latest) e instálalo:

```bash
code --install-extension codegraph-viewer-*.vsix
```

O desde VS Code: Extensiones → "..." → Install from VSIX...

### Desde el código fuente

```bash
git clone https://github.com/SantiagoRoChi/Codegraph-Viewer.git
cd Codegraph-Viewer
npm install
npm run compile
npm run package
code --install-extension codegraph-viewer-*.vsix
```

## 🚀 Uso

1. Asegúrate de tener un proyecto indexado con [CodeGraph](https://github.com/colbymchenry/codegraph):
   ```bash
   cd tu-proyecto
   codegraph init -i
   ```

2. Abre el proyecto en VS Code

3. Abre el **CodeGraph Viewer**:
   - Click en el icono del Activity Bar
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

## 🔧 Desarrollo

### Requisitos

- [Node.js](https://nodejs.org/) >= 18
- [VS Code](https://code.visualstudio.com/) >= 1.85

### Compilar

```bash
npm install
npm run compile    # Compilar TypeScript
npm run watch      # Modo watch (recompila automáticamente)
```

### Empaquetar

```bash
npm run package
```

Genera `codegraph-viewer-<version>.vsix` en la raíz del proyecto. Este archivo se puede instalar directamente en VS Code.

### Publicar una Release

1. Actualiza la versión en `package.json` siguiendo [semver](https://semver.org/)
2. Actualiza `CHANGELOG.md`
3. Crea un tag y pushea:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. El pipeline de GitHub Actions generará automáticamente el `.vsix` y creará una **GitHub Release** con el archivo adjunto

## 🤖 CI/CD

Este repositorio incluye un pipeline de GitHub Actions (`.github/workflows/ci.yml`) que:

- **Compila** la extensión en cada push/PR
- **Genera el `.vsix`** en cada compilación (disponible como artefacto)
- **Crea una Release** automáticamente cuando se pushea un tag `v*`, con el `.vsix` adjunto para descarga directa

Así cualquiera puede descargar la última versión desde la sección [Releases](https://github.com/SantiagoRoChi/Codegraph-Viewer/releases) del repositorio.

## 📄 Licencia

MIT

---

Hecho con ❤️ para desarrolladores que usan CodeGraph
