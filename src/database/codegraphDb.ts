import initSqlJs, { SqlJsStatic, Database as SqlJsDatabase, Statement as SqlJsStatement } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { CodeGraphNode, CodeGraphEdge, CodeGraphFile, GraphStats, NodeKind, EdgeKind } from '../types';

export class CodeGraphDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string = '';
  private outputChannel: vscode.OutputChannel | undefined;
  private sqlReady: Promise<SqlJsStatic>;
  private SQL: SqlJsStatic | null = null;

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.sqlReady = initSqlJs({
      locateFile: (file: string) => {
        const extensionPath = vscode.extensions.getExtension('codegraph-viewer.codegraph-viewer')?.extensionPath;
        if (extensionPath) {
          return path.join(extensionPath, 'node_modules', 'sql.js', 'dist', file);
        }
        return path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file);
      }
    });
  }

  private normalizePath(p: string): string {
    return path.normalize(p);
  }

  private findCodeGraphDb(): string | undefined {
    const searchPaths: string[] = [];

    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders) {
      for (const folder of wsFolders) {
        searchPaths.push(path.join(folder.uri.fsPath, '.codegraph', 'codegraph.db'));
        searchPaths.push(path.join(folder.uri.fsPath, '.codegraph'));

        // Also search up to 3 levels of parent directories
        let parentDir = path.dirname(folder.uri.fsPath);
        for (let i = 0; i < 3; i++) {
          searchPaths.push(path.join(parentDir, '.codegraph', 'codegraph.db'));
          searchPaths.push(path.join(parentDir, '.codegraph'));
          parentDir = path.dirname(parentDir);
        }
      }
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const dir = path.dirname(editor.document.uri.fsPath);
      searchPaths.push(path.join(dir, '.codegraph', 'codegraph.db'));
      searchPaths.push(path.join(dir, '.codegraph'));
    }

    searchPaths.push(path.join(process.cwd(), '.codegraph', 'codegraph.db'));
    searchPaths.push(path.join(process.cwd(), '.codegraph'));

    this.log(`Searching for codegraph.db in ${searchPaths.length} locations...`);

    for (const searchPath of searchPaths) {
      if (searchPath.endsWith('.db')) {
        const normalized = this.normalizePath(searchPath);
        if (fs.existsSync(normalized)) {
          this.log(`Found database at: ${normalized}`);
          return normalized;
        }
      }
    }

    for (const searchPath of searchPaths) {
      if (!searchPath.endsWith('.db')) {
        const normalized = this.normalizePath(searchPath);
        if (fs.existsSync(normalized)) {
          try {
            const files = fs.readdirSync(normalized);
            const dbFile = files.find(f => f.endsWith('.db'));
            if (dbFile) {
              const fullPath = this.normalizePath(path.join(normalized, dbFile));
              this.log(`Found database at: ${fullPath}`);
              return fullPath;
            }
          } catch {
            // Ignore read errors
          }
        }
      }
    }

    this.log('No codegraph.db found');
    return undefined;
  }

  private resolveDbPath(): string {
    const config = vscode.workspace.getConfiguration('codegraph');
    const configuredPath = config.get<string>('dbPath', '.codegraph/codegraph.db');

    if (path.isAbsolute(configuredPath)) {
      return this.normalizePath(configuredPath);
    }

    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders) {
      for (const folder of wsFolders) {
        const fullPath = this.normalizePath(path.join(folder.uri.fsPath, configuredPath));
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }

    const found = this.findCodeGraphDb();
    return found || this.normalizePath(path.join(process.cwd(), configuredPath));
  }

  async open(): Promise<boolean> {
    await this.close();

    try {
      this.SQL = await this.sqlReady;
      this.log('sql.js initialized');
    } catch (err: any) {
      this.log(`Failed to initialize sql.js: ${err.message}`);
      return false;
    }

    this.dbPath = this.resolveDbPath();
    this.log(`Attempting to open database at: ${this.dbPath}`);

    if (this.dbPath && await this.tryOpen(this.dbPath)) {
      return true;
    }

    const found = this.findCodeGraphDb();
    if (found && found !== this.dbPath) {
      this.log(`Trying discovered path: ${found}`);
      this.dbPath = found;
      if (await this.tryOpen(found)) {
        return true;
      }
    }

    this.log('Failed to open database');
    return false;
  }

  private async tryOpen(dbPath: string): Promise<boolean> {
    try {
      const normalizedPath = this.normalizePath(dbPath);
      this.log(`Opening: ${normalizedPath}`);

      if (!fs.existsSync(normalizedPath)) {
        this.log(`File does not exist: ${normalizedPath}`);
        return false;
      }

      const stats = fs.statSync(normalizedPath);
      this.log(`File size: ${stats.size} bytes`);

      if (stats.size === 0) {
        this.log('File is empty');
        return false;
      }

      if (!this.SQL) {
        this.log('sql.js not initialized');
        return false;
      }

      const fileBuffer = fs.readFileSync(normalizedPath);
      const database = new this.SQL.Database(fileBuffer);

      const tablesResult = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tablesResult.length > 0 ? tablesResult[0].values.map((row: any) => row[0] as string) : [];
      this.log(`Tables found: ${tableNames.join(', ')}`);

      if (!tableNames.includes('nodes')) {
        this.log('Not a valid codegraph database (missing nodes table)');
        database.close();
        return false;
      }

      this.db = database;
      this.dbPath = normalizedPath;
      this.log('Database opened successfully');
      return true;
    } catch (err: any) {
      this.log(`Error opening database: ${err.message}`);
      return false;
    }
  }

  async openWithPath(dbPath: string): Promise<boolean> {
    await this.close();

    try {
      this.SQL = await this.sqlReady;
    } catch {
      return false;
    }

    const normalizedPath = this.normalizePath(dbPath);
    this.dbPath = normalizedPath;
    this.log(`Opening from explicit path: ${normalizedPath}`);
    return this.tryOpen(normalizedPath);
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore close errors
      }
      this.db = null;
    }
  }

  isOpen(): boolean {
    return this.db !== null;
  }

  getDbPath(): string {
    return this.dbPath;
  }

  private log(message: string): void {
    this.outputChannel?.appendLine(`[DB] ${message}`);
  }

  private queryAll<T>(sql: string, params: any[] = []): T[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    } catch (err: any) {
      this.log(`Query error: ${err.message}`);
      return [];
    }
  }

  private queryOne<T>(sql: string, params: any[] = []): T | undefined {
    if (!this.db) return undefined;
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      let result: T | undefined;
      if (stmt.step()) {
        result = stmt.getAsObject() as T;
      }
      stmt.free();
      return result;
    } catch (err: any) {
      this.log(`Query error: ${err.message}`);
      return undefined;
    }
  }

  getAllNodes(): CodeGraphNode[] {
    return this.queryAll<CodeGraphNode>('SELECT * FROM nodes ORDER BY kind, name');
  }

  getNodesByKind(kind: NodeKind): CodeGraphNode[] {
    return this.queryAll<CodeGraphNode>('SELECT * FROM nodes WHERE kind = ? ORDER BY name', [kind]);
  }

  getNodesForFile(filePath: string): CodeGraphNode[] {
    return this.queryAll<CodeGraphNode>('SELECT * FROM nodes WHERE file_path = ? ORDER BY start_line', [filePath]);
  }

  getNodeById(id: string): CodeGraphNode | undefined {
    return this.queryOne<CodeGraphNode>('SELECT * FROM nodes WHERE id = ?', [id]);
  }

  searchNodes(query: string): CodeGraphNode[] {
    try {
      const ftsResults = this.queryAll<CodeGraphNode>(
        'SELECT n.* FROM nodes_fts fts JOIN nodes n ON fts.id = n.id WHERE nodes_fts MATCH ? ORDER BY rank LIMIT 100',
        [query]
      );
      if (ftsResults.length > 0) return ftsResults;
    } catch {
      // FTS match syntax error, fall through to LIKE
    }

    return this.queryAll<CodeGraphNode>(
      'SELECT * FROM nodes WHERE name LIKE ? OR qualified_name LIKE ? ORDER BY name LIMIT 100',
      [`%${query}%`, `%${query}%`]
    );
  }

  getEdgesForNode(nodeId: string): CodeGraphEdge[] {
    return this.queryAll<CodeGraphEdge>(
      'SELECT * FROM edges WHERE source = ? OR target = ?',
      [nodeId, nodeId]
    );
  }

  getOutgoingEdges(nodeId: string): CodeGraphEdge[] {
    return this.queryAll<CodeGraphEdge>('SELECT * FROM edges WHERE source = ?', [nodeId]);
  }

  getIncomingEdges(nodeId: string): CodeGraphEdge[] {
    return this.queryAll<CodeGraphEdge>('SELECT * FROM edges WHERE target = ?', [nodeId]);
  }

  getCallers(nodeId: string): CodeGraphEdge[] {
    return this.queryAll<CodeGraphEdge>(
      "SELECT * FROM edges WHERE target = ? AND kind = 'calls'",
      [nodeId]
    );
  }

  getCallees(nodeId: string): CodeGraphEdge[] {
    return this.queryAll<CodeGraphEdge>(
      "SELECT * FROM edges WHERE source = ? AND kind = 'calls'",
      [nodeId]
    );
  }

  getFiles(): CodeGraphFile[] {
    return this.queryAll<CodeGraphFile>('SELECT * FROM files ORDER BY path');
  }

  getAllEdges(): CodeGraphEdge[] {
    return this.queryAll<CodeGraphEdge>('SELECT * FROM edges');
  }

  getGraphData(nodeLimit: number = 1000): { nodes: CodeGraphNode[]; edges: CodeGraphEdge[] } {
    const excludeKinds = ['import', 'export', 'parameter', 'file'];
    const placeholders = excludeKinds.map(() => '?').join(',');

    let nodes = this.queryAll<CodeGraphNode>(
      `SELECT * FROM nodes WHERE kind NOT IN (${placeholders}) ORDER BY CASE WHEN kind IN ('class','interface','struct','function','enum','method') THEN 0 ELSE 1 END, kind, name`,
      excludeKinds
    );

    // Deduplicate by qualified_name (keep first occurrence)
    const seen = new Map<string, CodeGraphNode>();
    for (const node of nodes) {
      const key = node.qualified_name;
      if (!seen.has(key)) {
        seen.set(key, node);
      }
    }
    nodes = Array.from(seen.values());

    const limitedNodes = nodes.slice(0, nodeLimit);
    const nodeIds = new Set(limitedNodes.map(n => n.id));

    const allEdges = this.queryAll<CodeGraphEdge>('SELECT * FROM edges');
    const filteredEdges = allEdges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return { nodes: limitedNodes, edges: filteredEdges };
  }

  getStats(): GraphStats | undefined {
    const nodeCountRow = this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM nodes');
    const edgeCountRow = this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM edges');
    const fileCountRow = this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM files');

    const languages = this.queryAll<{ language: string; count: number }>(
      'SELECT language, COUNT(*) as count FROM nodes GROUP BY language ORDER BY count DESC'
    );

    const kinds = this.queryAll<{ kind: string; count: number }>(
      'SELECT kind, COUNT(*) as count FROM nodes GROUP BY kind ORDER BY count DESC'
    );

    return {
      nodeCount: nodeCountRow?.count ?? 0,
      edgeCount: edgeCountRow?.count ?? 0,
      fileCount: fileCountRow?.count ?? 0,
      languages,
      kinds,
    };
  }

  findNodeAtPosition(filePath: string, line: number): CodeGraphNode | undefined {
    return this.queryOne<CodeGraphNode>(
      'SELECT * FROM nodes WHERE file_path = ? AND start_line <= ? AND end_line >= ? ORDER BY (end_line - start_line) ASC LIMIT 1',
      [filePath, line, line]
    );
  }

  getNodeNeighbors(nodeId: string, depth: number = 1): { nodes: CodeGraphNode[]; edges: CodeGraphEdge[] } {
    const visitedNodes = new Set<string>([nodeId]);
    const visitedEdges: CodeGraphEdge[] = [];

    let frontier = [nodeId];

    for (let d = 0; d < depth; d++) {
      const nextFrontier: string[] = [];

      for (const nid of frontier) {
        const edges = this.queryAll<CodeGraphEdge>(
          'SELECT * FROM edges WHERE source = ? OR target = ?',
          [nid, nid]
        );

        for (const edge of edges) {
          visitedEdges.push(edge);
          const neighborId = edge.source === nid ? edge.target : edge.source;
          if (!visitedNodes.has(neighborId)) {
            visitedNodes.add(neighborId);
            nextFrontier.push(neighborId);
          }
        }
      }

      frontier = nextFrontier;
    }

    const nodes: CodeGraphNode[] = [];
    for (const nid of visitedNodes) {
      const node = this.queryOne<CodeGraphNode>('SELECT * FROM nodes WHERE id = ?', [nid]);
      if (node) nodes.push(node);
    }

    return { nodes, edges: visitedEdges };
  }
}
