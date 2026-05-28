import * as vscode from 'vscode';
import * as path from 'path';
import { CodeGraphDatabase } from '../database/codegraphDb';
import { CodeGraphNode, CodeGraphEdge, NODE_KIND_COLORS, EDGE_KIND_COLORS, EDGE_KIND_LABELS, EdgeKind } from '../types';

export class GraphPanel {
  public static currentPanel: GraphPanel | undefined;
  private static readonly viewType = 'codegraph.graph';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly db: CodeGraphDatabase;
  private disposables: vscode.Disposable[] = [];
  private lastFocusedNode: string | undefined;
  private currentLayout: string = 'fcose';

  public static createOrShow(extensionUri: vscode.Uri, db: CodeGraphDatabase): void {
    const column = vscode.ViewColumn.Beside;

    if (GraphPanel.currentPanel) {
      GraphPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      GraphPanel.viewType,
      'CodeGraph',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui'),
          vscode.Uri.joinPath(extensionUri, 'out'),
        ],
      }
    );

    GraphPanel.currentPanel = new GraphPanel(panel, extensionUri, db);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, db: CodeGraphDatabase): void {
    GraphPanel.currentPanel = new GraphPanel(panel, extensionUri, db);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, db: CodeGraphDatabase) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.db = db;

    const config = vscode.workspace.getConfiguration('codegraph');
    this.currentLayout = config.get<string>('graph.layout', 'fcose');
    this.lastFocusedNode = undefined;

    this.panel.webview.html = this.getHtmlForWebview();

    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.loadGraph();
  }

  public focusNode(nodeId: string): void {
    this.lastFocusedNode = nodeId;
    this.panel.webview.postMessage({
      type: 'focusNode',
      nodeId,
    });
  }

  public showNodePreview(nodeId: string): void {
    const node = this.db.getNodeById(nodeId);
    if (!node) return;

    const { nodes, edges } = this.db.getNodeNeighbors(nodeId, 2);
    this.sendGraphData(nodes, edges, nodeId);
  }

  private loadGraph(): void {
    const config = vscode.workspace.getConfiguration('codegraph');
    const nodeLimit = config.get<number>('graph.nodeLimit', 2000);
    const { nodes, edges } = this.db.getGraphData(nodeLimit);

    const stats = this.db.getStats();
    this.panel.webview.postMessage({
      type: 'init',
      nodes,
      edges,
      stats,
      layout: this.currentLayout,
    });
  }

  private sendGraphData(nodes: CodeGraphNode[], edges: CodeGraphEdge[], focusNodeId?: string): void {
    this.panel.webview.postMessage({
      type: 'loadGraph',
      nodes,
      edges,
      focusNodeId,
      layout: this.currentLayout,
    });
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'nodeClicked':
        this.lastFocusedNode = message.nodeId;
        await this.openNodeDetail(message.nodeId);
        break;

      case 'nodeDoubleClick':
        await this.navigateToNode(message.nodeId);
        break;

      case 'layoutChanged':
        this.currentLayout = message.layout;
        const config = vscode.workspace.getConfiguration('codegraph');
        await config.update('graph.layout', message.layout, vscode.ConfigurationTarget.Global);
        break;

      case 'refresh':
        this.loadGraph();
        break;

      case 'search':
        const results = this.db.searchNodes(message.query);
        this.panel.webview.postMessage({
          type: 'searchResults',
          nodes: results.slice(0, 50),
        });
        break;

      case 'getStats':
        const stats = this.db.getStats();
        this.panel.webview.postMessage({
          type: 'stats',
          stats,
        });
        break;

      case 'getNodeDetail':
        const node = this.db.getNodeById(message.nodeId);
        const nodeEdges = this.db.getEdgesForNode(message.nodeId);
        this.panel.webview.postMessage({
          type: 'nodeDetail',
          node,
          edges: nodeEdges,
        });
        break;
    }
  }

  private async openNodeDetail(nodeId: string): Promise<void> {
    const node = this.db.getNodeById(nodeId);
    if (!node) return;

    const edges = this.db.getEdgesForNode(nodeId);
    const callers = edges.filter(e => e.target === nodeId && e.kind === 'calls');
    const callees = edges.filter(e => e.source === nodeId && e.kind === 'calls');

    const callerNodes = callers.map(e => this.db.getNodeById(e.source)).filter(Boolean);
    const calleeNodes = callees.map(e => this.db.getNodeById(e.target)).filter(Boolean);

    const panel = vscode.window.createWebviewPanel(
      'codegraph.nodeDetail',
      `CodeGraph: ${node.name}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    panel.webview.html = this.getNodeDetailHtml(node, edges, callerNodes as CodeGraphNode[], calleeNodes as CodeGraphNode[]);
  }

  private async navigateToNode(nodeId: string): Promise<void> {
    const node = this.db.getNodeById(nodeId);
    if (!node) return;

    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) return;

    const filePath = path.join(wsFolder.uri.fsPath, node.file_path);
    const uri = vscode.Uri.file(filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      const position = new vscode.Position(node.start_line - 1, node.start_column);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (err) {
      vscode.window.showErrorMessage(`Cannot open file: ${node.file_path}`);
    }
  }

  private getNodeDetailHtml(
    node: CodeGraphNode,
    edges: CodeGraphEdge[],
    callers: CodeGraphNode[],
    callees: CodeGraphNode[]
  ): string {
    const kindColor = NODE_KIND_COLORS[node.kind] || '#6b7280';
    const grouped = new Map<string, CodeGraphEdge[]>();
    for (const edge of edges) {
      const list = grouped.get(edge.kind) || [];
      list.push(edge);
      grouped.set(edge.kind, list);
    }

    let edgesHtml = '';
    for (const [kind, kindEdges] of grouped) {
      const color = EDGE_KIND_COLORS[kind as EdgeKind] || '#6b7280';
      const label = EDGE_KIND_LABELS[kind as EdgeKind] || kind;
      edgesHtml += `<div class="edge-group"><span class="edge-badge" style="background:${color}">${label} (${kindEdges.length})</span></div>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }
  h1 { color: ${kindColor}; margin-bottom: 4px; }
  .kind-badge { display: inline-block; background: ${kindColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .meta { color: var(--vscode-descriptionForeground); margin: 8px 0; font-size: 13px; }
  .section { margin-top: 16px; }
  .section h3 { margin-bottom: 8px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 4px; }
  .edge-group { margin: 4px 0; }
  .edge-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; }
  pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
  .caller-list, .callee-list { list-style: none; padding: 0; }
  .caller-list li, .callee-list li { padding: 4px 0; cursor: pointer; }
  .caller-list li:hover, .callee-list li:hover { color: var(--vscode-textLink-foreground); }
  .name { font-weight: bold; }
  .file-link { color: var(--vscode-textLink-foreground); cursor: pointer; font-size: 13px; }
</style>
</head>
<body>
  <h1>${this.escapeHtml(node.name)}</h1>
  <span class="kind-badge">${node.kind}</span>
  <div class="meta">
    <div><strong>Qualified:</strong> ${this.escapeHtml(node.qualified_name)}</div>
    <div class="file-link" onclick="window.location.href='vscode://file/${node.file_path.replace(/\\/g, '/')}';">
      ${this.escapeHtml(node.file_path)}:${node.start_line}-${node.end_line}
    </div>
    ${node.language ? `<div><strong>Language:</strong> ${node.language}</div>` : ''}
    ${node.visibility ? `<div><strong>Visibility:</strong> ${node.visibility}</div>` : ''}
    ${node.is_async ? '<div><strong>Async:</strong> Yes</div>' : ''}
    ${node.is_static ? '<div><strong>Static:</strong> Yes</div>' : ''}
  </div>
  ${node.signature ? `<div class="section"><h3>Signature</h3><pre>${this.escapeHtml(node.signature)}</pre></div>` : ''}
  ${node.docstring ? `<div class="section"><h3>Documentation</h3><pre>${this.escapeHtml(node.docstring)}</pre></div>` : ''}
  <div class="section"><h3>Relationships</h3>${edgesHtml || '<em>No relationships</em>'}</div>
  ${callers.length > 0 ? `<div class="section"><h3>Callers (${callers.length})</h3><ul class="caller-list">${callers.map(c => `<li><span class="name">${this.escapeHtml(c.name)}</span> <span style="color:var(--vscode-descriptionForeground)">${c.kind}</span></li>`).join('')}</ul></div>` : ''}
  ${callees.length > 0 ? `<div class="section"><h3>Callees (${callees.length})</h3><ul class="callee-list">${callees.map(c => `<li><span class="name">${this.escapeHtml(c.name)}</span> <span style="color:var(--vscode-descriptionForeground)">${c.kind}</span></li>`).join('')}</ul></div>` : ''}
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getHtmlForWebview(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'graph.js')
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'style.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${this.panel.webview.cspSource} 'unsafe-inline' https://unpkg.com;
    script-src 'nonce-${nonce}' https://unpkg.com;
    img-src ${this.panel.webview.cspSource} data:;
  ">
  <link rel="stylesheet" href="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.css">
  <link rel="stylesheet" href="${styleUri}">
  <title>CodeGraph</title>
</head>
<body>
  <div id="toolbar">
    <div class="toolbar-left">
      <input type="text" id="searchInput" placeholder="Search symbols..." />
      <select id="layoutSelect">
        <option value="fcose">Force (Fcose)</option>
        <option value="dagre">Hierarchical (Dagre)</option>
        <option value="circle">Circular</option>
        <option value="concentric">Concentric</option>
        <option value="breadthfirst">Breadth-First</option>
      </select>
      <label id="edgeToggle">
        <input type="checkbox" id="showEdgeLabels" /> Edge Labels
      </label>
    </div>
    <div class="toolbar-right">
      <span id="stats"></span>
      <button id="refreshBtn" title="Refresh">⟳</button>
      <button id="fitBtn" title="Fit to screen">⊞</button>
    </div>
  </div>
  <div id="cy"></div>
  <div id="detailPanel" class="hidden">
    <div id="detailContent"></div>
    <button id="closeDetail">×</button>
  </div>
  <div id="searchResults" class="hidden"></div>
  <script nonce="${nonce}" src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
  <script nonce="${nonce}" src="https://unpkg.com/cytoscape-fcose@2.2.0/cytoscape-fcose.js"></script>
  <script nonce="${nonce}" src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    GraphPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
