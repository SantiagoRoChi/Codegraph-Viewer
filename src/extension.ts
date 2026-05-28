import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CodeGraphDatabase } from './database/codegraphDb';
import { GraphPanel } from './webView/graphPanel';
import { CodeGraphTreeProvider, CodeGraphSearchProvider } from './treeView/nodeProvider';
import { CodeGraphNode } from './types';

const execAsync = promisify(exec);

let db: CodeGraphDatabase;
let treeProvider: CodeGraphTreeProvider;
let searchProvider: CodeGraphSearchProvider;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('CodeGraph');
  db = new CodeGraphDatabase(outputChannel);

  const opened = await db.open();
  if (opened) {
    outputChannel.appendLine(`CodeGraph database opened: ${db.getDbPath()}`);
    const stats = db.getStats();
    if (stats) {
      outputChannel.appendLine(`  ${stats.nodeCount} nodes, ${stats.edgeCount} edges, ${stats.fileCount} files`);
    }
  } else {
    outputChannel.appendLine(`CodeGraph database not found at: ${db.getDbPath()}`);
  }

  treeProvider = new CodeGraphTreeProvider(db);
  searchProvider = new CodeGraphSearchProvider(db);

  vscode.window.registerTreeDataProvider('codegraphExplorer', treeProvider);
  vscode.window.registerTreeDataProvider('codegraphSearch', searchProvider);

  registerCommands(context);
  registerGitCommitHook(context);
  registerEditorIntegration(context);
  registerFileWatcher(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.setMode', (mode: string) => {
      treeProvider.setMode(mode as 'byKind' | 'byFile' | 'all');
    })
  );
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.openGraph', async () => {
      if (!db.isOpen()) {
        const retry = await db.open();
        if (!retry) {
          vscode.window.showErrorMessage(
            'CodeGraph database not found. Run "codegraph init" in your project.',
            'Set Path'
          ).then(choice => {
            if (choice === 'Set Path') {
              vscode.commands.executeCommand('codegraph.setDbPath');
            }
          });
          return;
        }
      }
      GraphPanel.createOrShow(context.extensionUri, db);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.openGraphFocus', async (arg?: any) => {
      if (!db.isOpen()) {
        await db.open();
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to focus a node in the graph.');
        return;
      }

      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showInformationMessage('Select a symbol name to focus in the graph.');
        return;
      }

      const results = db.searchNodes(selection.trim());
      if (results.length === 0) {
        vscode.window.showInformationMessage(`No symbol found matching "${selection}"`);
        return;
      }

      const node = results[0];
      GraphPanel.createOrShow(context.extensionUri, db);
      setTimeout(() => {
        GraphPanel.currentPanel?.focusNode(node.id);
      }, 500);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.previewGraph', async (arg?: any) => {
      if (!db.isOpen()) {
        await db.open();
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showInformationMessage('Select a symbol name to preview.');
        return;
      }

      const results = db.searchNodes(selection.trim());
      if (results.length === 0) {
        vscode.window.showInformationMessage(`No symbol found matching "${selection}"`);
        return;
      }

      const node = results[0];
      GraphPanel.createOrShow(context.extensionUri, db);
      setTimeout(() => {
        GraphPanel.currentPanel?.showNodePreview(node.id);
      }, 500);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.search', async () => {
      if (!db.isOpen()) {
        await db.open();
      }

      const query = await vscode.window.showInputBox({
        prompt: 'Search code symbols',
        placeHolder: 'e.g. UserService, handleSubmit, MyComponent',
      });

      if (!query) return;

      const results = db.searchNodes(query);
      if (results.length === 0) {
        vscode.window.showInformationMessage(`No symbols found for "${query}"`);
        return;
      }

      const items = results.map(node => ({
        label: node.name,
        description: `${node.kind} — ${node.file_path}:${node.start_line}`,
        detail: node.qualified_name,
        node: node,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Found ${results.length} symbols`,
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        openNodeInEditor(selected.node);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.refresh', async () => {
      if (db.isOpen()) {
        await db.close();
      }
      await db.open();
      treeProvider.refresh();
      searchProvider.refresh();
      vscode.window.showInformationMessage('CodeGraph refreshed');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.openNodeDetail', (node?: CodeGraphNode) => {
      if (!node) return;

      GraphPanel.createOrShow(context.extensionUri, db);
      setTimeout(() => {
        GraphPanel.currentPanel?.showNodePreview(node.id);
      }, 300);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.navigateToNode', (node?: CodeGraphNode) => {
      if (!node) return;
      openNodeInEditor(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.setDbPath', async () => {
      const currentPath = db.getDbPath();
      const newPath = await vscode.window.showInputBox({
        prompt: 'Path to codegraph.db',
        value: currentPath,
        placeHolder: '.codegraph/codegraph.db',
      });

      if (newPath) {
        const config = vscode.workspace.getConfiguration('codegraph');
        await config.update('dbPath', newPath, vscode.ConfigurationTarget.Workspace);
        await db.close();
        await db.open();
        treeProvider.refresh();
        searchProvider.refresh();
        vscode.window.showInformationMessage(`CodeGraph database path set to: ${newPath}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.openDbFile', async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      outputChannel.appendLine(`Opening database from file click: ${filePath}`);

      const success = await db.openWithPath(filePath);
      if (!success) {
        vscode.window.showErrorMessage(`Failed to open database: ${filePath}`);
        return;
      }

      treeProvider.refresh();
      searchProvider.refresh();
      GraphPanel.createOrShow(context.extensionUri, db);
      vscode.window.showInformationMessage(`CodeGraph database loaded: ${path.basename(filePath)}`);
    })
  );
}

async function openNodeInEditor(node: CodeGraphNode): Promise<void> {
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder) return;

  const filePath = path.join(wsFolder.uri.fsPath, node.file_path);
  const uri = vscode.Uri.file(filePath);

  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    const position = new vscode.Position(node.start_line - 1, node.start_column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );
  } catch {
    vscode.window.showErrorMessage(`Cannot open: ${node.file_path}`);
  }
}

function registerEditorIntegration(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider('*', new CodeGraphCodeLens(db))
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider('*', new CodeGraphHover(db))
  );
}

class CodeGraphCodeLens implements vscode.CodeLensProvider {
  private db: CodeGraphDatabase;

  constructor(db: CodeGraphDatabase) {
    this.db = db;
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!this.db.isOpen()) return [];

    const config = vscode.workspace.getConfiguration('codegraph');
    const enabled = config.get<boolean>('editor.codeLens', true);
    if (!enabled) return [];

    const lenses: vscode.CodeLens[] = [];
    const filePath = vscode.workspace.asRelativePath(document.uri);

    // Scan first 200 lines for function/class definitions
    const text = document.getText();
    const lines = text.split('\n').slice(0, 200);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match common function/class/method patterns
      const match = line.match(
        /^\s*(?:export\s+)?(?:async\s+)?(?:function|class|method|def|fn|func|const|let|var)\s+(\w+)/
      );

      if (match) {
        const name = match[1];
        const node = this.db.findNodeAtPosition(filePath, i + 1);
        if (node) {
          const range = new vscode.Range(i, 0, i, 0);
          lenses.push(
            new vscode.CodeLens(range, {
              title: '$(graph) View in Graph',
              command: 'codegraph.openGraphFocus',
              arguments: [node],
            })
          );
        }
      }
    }

    return lenses;
  }
}

class CodeGraphHover implements vscode.HoverProvider {
  private db: CodeGraphDatabase;

  constructor(db: CodeGraphDatabase) {
    this.db = db;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    if (!this.db.isOpen()) return undefined;

    const config = vscode.workspace.getConfiguration('codegraph');
    if (!config.get<boolean>('editor.hover', true)) return undefined;

    const filePath = vscode.workspace.asRelativePath(document.uri);
    const node = this.db.findNodeAtPosition(filePath, position.line + 1);

    if (!node) return undefined;

    const kindColorMap: Record<string, string> = {
      function: '#3b82f6',
      method: '#2563eb',
      class: '#10b981',
      interface: '#06b6d4',
      variable: '#ec4899',
      constant: '#f43f5e',
      struct: '#10b981',
      trait: '#06b6d4',
      protocol: '#06b6d4',
      property: '#f59e0b',
      field: '#d97706',
      enum: '#8b5cf6',
      enum_member: '#a78bfa',
      type_alias: '#6366f1',
      namespace: '#64748b',
      parameter: '#94a3b8',
      import: '#78716c',
      export: '#78716c',
      route: '#14b8a6',
      component: '#f97316',
      file: '#6b7280',
      module: '#8b5cf6',
    };
    const kindColor = kindColorMap[node.kind] || '#6b7280';

    const content = new vscode.MarkdownString();
    content.appendMarkdown(`**${node.name}** \`${node.kind}\`\n\n`);
    content.appendMarkdown(`$(file) ${node.file_path}:${node.start_line}\n\n`);

    if (node.signature) {
      content.appendCodeblock(node.signature, node.language);
    }

    if (node.docstring) {
      content.appendMarkdown(`\n${node.docstring.substring(0, 300)}\n\n`);
    }

    content.appendMarkdown(`---\n`);
    content.appendMarkdown(`$(graph) [View in CodeGraph](command:codegraph.openGraphFocus?${encodeURIComponent(JSON.stringify(node))})`);

    return new vscode.Hover(content);
  }
}

function registerGitCommitHook(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('codegraph');
  if (!config.get<boolean>('graph.autosyncOnCommit', true)) return;

  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder) return;

  const gitDir = path.join(wsFolder.uri.fsPath, '.git');
  if (!fs.existsSync(gitDir)) return;

  const hooksDir = path.join(gitDir, 'hooks');
  const hookPath = path.join(hooksDir, 'post-commit');

  // Only install if codegraph CLI is available
  const installHook = async () => {
    try {
      await execAsync('codegraph --version');
    } catch {
      return; // codegraph not installed
    }

    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    let existingHook = '';
    if (fs.existsSync(hookPath)) {
      existingHook = fs.readFileSync(hookPath, 'utf-8');
      if (existingHook.includes('codegraph sync')) {
        return; // Already installed
      }
    }

    const hook = `#!/bin/sh
# CodeGraph auto-sync on commit
codegraph sync --quiet 2>/dev/null &
`;

    try {
      fs.writeFileSync(hookPath, existingHook + '\n' + hook, { mode: 0o755 });
      outputChannel.appendLine('CodeGraph git hook installed (post-commit)');
    } catch (err) {
      outputChannel.appendLine(`Failed to install git hook: ${err}`);
    }
  };

  installHook();

  // Also watch for commits via git log
  const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/COMMIT_EDITMSG');
  gitWatcher.onDidCreate(() => {
    const config = vscode.workspace.getConfiguration('codegraph');
    if (!config.get<boolean>('graph.autosyncOnCommit', true)) return;

    setTimeout(() => {
      exec('codegraph sync --quiet', { cwd: wsFolder.uri.fsPath }, (err) => {
        if (!err) {
          outputChannel.appendLine('CodeGraph synced after commit');
          treeProvider.refresh();
          searchProvider.refresh();
        }
      });
    }, 1000);
  });
  context.subscriptions.push(gitWatcher);
}

function registerFileWatcher(context: vscode.ExtensionContext) {
  const watcher = vscode.workspace.createFileSystemWatcher('**/.codegraph/codegraph.db');

  watcher.onDidChange(async () => {
    outputChannel.appendLine('codegraph.db changed, refreshing...');
    await db.close();
    await db.open();
    treeProvider.refresh();
    searchProvider.refresh();
  });

  watcher.onDidCreate(async () => {
    outputChannel.appendLine('codegraph.db created, opening...');
    await db.open();
    treeProvider.refresh();
    searchProvider.refresh();
  });

  watcher.onDidDelete(() => {
    outputChannel.appendLine('codegraph.db deleted');
    treeProvider.refresh();
    searchProvider.refresh();
  });

  context.subscriptions.push(watcher);
}

export async function deactivate() {
  await db?.close();
  outputChannel?.dispose();
}
