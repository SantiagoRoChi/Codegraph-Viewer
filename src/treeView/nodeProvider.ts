import * as vscode from 'vscode';
import { CodeGraphDatabase } from '../database/codegraphDb';
import { CodeGraphNode, NodeKind, NODE_KIND_COLORS, NODE_KIND_ICONS } from '../types';

export class CodeGraphTreeProvider implements vscode.TreeDataProvider<GraphTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GraphTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private db: CodeGraphDatabase;
  private mode: 'byKind' | 'byFile' | 'all' = 'byKind';

  constructor(db: CodeGraphDatabase) {
    this.db = db;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setMode(mode: 'byKind' | 'byFile' | 'all'): void {
    this.mode = mode;
    this.refresh();
  }

  getTreeItem(element: GraphTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GraphTreeItem): Thenable<GraphTreeItem[]> {
    if (!this.db.isOpen()) {
      return Promise.resolve([]);
    }

    if (!element) {
      return Promise.resolve(this.getRootItems());
    }

    if (element.contextValue === 'kindGroup') {
      return Promise.resolve(this.getNodesForKind(element.kind!));
    }

    if (element.contextValue === 'fileGroup') {
      return Promise.resolve(this.getNodesForFile(element.filePath!));
    }

    return Promise.resolve([]);
  }

  private getRootItems(): GraphTreeItem[] {
    const items: GraphTreeItem[] = [];

    // Mode switcher
    items.push(new GraphTreeItem(
      this.mode === 'byKind' ? '▶ By Kind (active)' : '▶ By Kind',
      vscode.TreeItemCollapsibleState.None,
      { command: 'codegraph.setMode', title: 'Set Mode', arguments: ['byKind'] }
    ));
    items.push(new GraphTreeItem(
      this.mode === 'byFile' ? '▶ By File (active)' : '▶ By File',
      vscode.TreeItemCollapsibleState.None,
      { command: 'codegraph.setMode', title: 'Set Mode', arguments: ['byFile'] }
    ));

    items.push(new GraphTreeItem('', vscode.TreeItemCollapsibleState.None)); // separator

    if (this.mode === 'byKind') {
      return [...items, ...this.getKindGroups()];
    } else if (this.mode === 'byFile') {
      return [...items, ...this.getFileGroups()];
    } else {
      return [...items, ...this.getAllNodes()];
    }
  }

  private getKindGroups(): GraphTreeItem[] {
    const nodes = this.db.getAllNodes();
    const byKind = new Map<NodeKind, CodeGraphNode[]>();

    for (const node of nodes) {
      const list = byKind.get(node.kind) || [];
      list.push(node);
      byKind.set(node.kind, list);
    }

    const sortedKinds = Array.from(byKind.entries()).sort((a, b) => b[1].length - a[1].length);

    return sortedKinds.map(([kind, kindNodes]) => {
      const item = new GraphTreeItem(
        `${kind} (${kindNodes.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        'kindGroup'
      );
      item.kind = kind;
      item.iconPath = new vscode.ThemeIcon(NODE_KIND_ICONS[kind] || 'symbol-misc');
      item.description = `${kindNodes.length}`;
      return item;
    });
  }

  private getFileGroups(): GraphTreeItem[] {
    const nodes = this.db.getAllNodes();
    const byFile = new Map<string, CodeGraphNode[]>();

    for (const node of nodes) {
      if (node.kind === 'file') continue;
      const list = byFile.get(node.file_path) || [];
      list.push(node);
      byFile.set(node.file_path, list);
    }

    const sortedFiles = Array.from(byFile.entries()).sort((a, b) => b[1].length - a[1].length);

    return sortedFiles.map(([filePath, fileNodes]) => {
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const item = new GraphTreeItem(
        `${fileName} (${fileNodes.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        'fileGroup'
      );
      item.filePath = filePath;
      item.iconPath = vscode.ThemeIcon.File;
      item.description = filePath;
      item.resourceUri = vscode.Uri.file(filePath);
      return item;
    });
  }

  private getAllNodes(): GraphTreeItem[] {
    const nodes = this.db.getAllNodes();
    return nodes.slice(0, 500).map(node => this.nodeToTreeItem(node));
  }

  private getNodesForKind(kind: NodeKind): GraphTreeItem[] {
    const nodes = this.db.getNodesByKind(kind);
    return nodes.map(node => this.nodeToTreeItem(node));
  }

  private getNodesForFile(filePath: string): GraphTreeItem[] {
    const nodes = this.db.getNodesForFile(filePath);
    return nodes.map(node => this.nodeToTreeItem(node));
  }

  private nodeToTreeItem(node: CodeGraphNode): GraphTreeItem {
    const label = node.name;
    const item = new GraphTreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codegraph.openNodeDetail',
        title: 'Show Details',
        arguments: [node],
      },
      'node'
    );

    item.node = node;
    item.iconPath = new vscode.ThemeIcon(
      NODE_KIND_ICONS[node.kind] || 'symbol-misc',
      new vscode.ThemeColor(NODE_KIND_COLORS[node.kind] || 'charts.foreground')
    );

    item.description = node.signature
      ? node.signature.substring(0, 60) + (node.signature.length > 60 ? '...' : '')
      : node.kind;

    item.tooltip = [
      `**${node.qualified_name}**`,
      `Kind: ${node.kind}`,
      `File: ${node.file_path}:${node.start_line}`,
      node.signature ? `Signature: ${node.signature}` : '',
      node.docstring ? `\n${node.docstring.substring(0, 200)}` : '',
    ].filter(Boolean).join('\n');

    if (node.file_path) {
      item.resourceUri = vscode.Uri.file(node.file_path);
    }

    return item;
  }
}

export class CodeGraphSearchProvider implements vscode.TreeDataProvider<GraphTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GraphTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private db: CodeGraphDatabase;
  private searchQuery: string = '';

  constructor(db: CodeGraphDatabase) {
    this.db = db;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.refresh();
  }

  getTreeItem(element: GraphTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GraphTreeItem): Thenable<GraphTreeItem[]> {
    if (element || !this.db.isOpen()) {
      return Promise.resolve([]);
    }

    if (!this.searchQuery) {
      return Promise.resolve([
        new GraphTreeItem(
          'Type to search...',
          vscode.TreeItemCollapsibleState.None
        )
      ]);
    }

    const nodes = this.db.searchNodes(this.searchQuery);
    return Promise.resolve(nodes.map(n => {
      const item = new GraphTreeItem(
        n.name,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'codegraph.openNodeDetail',
          title: 'Show Details',
          arguments: [n],
        },
        'node'
      );
      item.node = n;
      item.iconPath = new vscode.ThemeIcon(
        NODE_KIND_ICONS[n.kind] || 'symbol-misc',
        new vscode.ThemeColor(NODE_KIND_COLORS[n.kind] || 'charts.foreground')
      );
      item.description = `${n.kind} — ${n.file_path}:${n.start_line}`;
      item.tooltip = n.qualified_name;
      return item;
    }));
  }
}

class GraphTreeItem extends vscode.TreeItem {
  kind?: NodeKind;
  filePath?: string;
  node?: CodeGraphNode;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    contextValue?: string
  ) {
    super(label, collapsibleState);
    if (command) {
      this.command = command;
    }
    if (contextValue) {
      this.contextValue = contextValue;
    }
  }
}
