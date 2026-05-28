export interface CodeGraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  qualified_name: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  start_column: number;
  end_column: number;
  docstring: string | null;
  signature: string | null;
  visibility: string | null;
  is_exported: number;
  is_async: number;
  is_static: number;
  is_abstract: number;
  decorators: string | null;
  type_parameters: string | null;
  updated_at: number;
}

export interface CodeGraphEdge {
  id: number;
  source: string;
  target: string;
  kind: EdgeKind;
  metadata: string | null;
  line: number | null;
  col: number | null;
  provenance: string | null;
}

export interface CodeGraphFile {
  path: string;
  content_hash: string;
  language: string;
  size: number;
  modified_at: number;
  indexed_at: number;
  node_count: number;
  errors: string | null;
}

export type NodeKind =
  | 'file' | 'module' | 'class' | 'struct' | 'interface' | 'trait' | 'protocol'
  | 'function' | 'method' | 'property' | 'field' | 'variable' | 'constant'
  | 'enum' | 'enum_member' | 'type_alias' | 'namespace' | 'parameter'
  | 'import' | 'export' | 'route' | 'component';

export type EdgeKind =
  | 'contains' | 'calls' | 'imports' | 'exports'
  | 'extends' | 'implements' | 'references' | 'type_of'
  | 'returns' | 'instantiates' | 'overrides' | 'decorates';

export const NODE_KIND_COLORS: Record<NodeKind, string> = {
  file: '#6b7280',
  module: '#8b5cf6',
  class: '#10b981',
  struct: '#10b981',
  interface: '#06b6d4',
  trait: '#06b6d4',
  protocol: '#06b6d4',
  function: '#3b82f6',
  method: '#2563eb',
  property: '#f59e0b',
  field: '#d97706',
  variable: '#ec4899',
  constant: '#f43f5e',
  enum: '#8b5cf6',
  enum_member: '#a78bfa',
  type_alias: '#6366f1',
  namespace: '#64748b',
  parameter: '#94a3b8',
  import: '#78716c',
  export: '#78716c',
  route: '#14b8a6',
  component: '#f97316',
};

export const NODE_KIND_ICONS: Record<NodeKind, string> = {
  file: 'file',
  module: 'package',
  class: 'symbol-class',
  struct: 'symbol-struct',
  interface: 'symbol-interface',
  trait: 'symbol-interface',
  protocol: 'symbol-interface',
  function: 'symbol-function',
  method: 'symbol-method',
  property: 'symbol-property',
  field: 'symbol-field',
  variable: 'symbol-variable',
  constant: 'symbol-constant',
  enum: 'symbol-enum',
  enum_member: 'symbol-enum-member',
  type_alias: 'symbol-type-parameter',
  namespace: 'symbol-namespace',
  parameter: 'symbol-parameter',
  import: 'symbol-import',
  export: 'symbol-export',
  route: 'globe',
  component: 'symbol-class',
};

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  contains: 'contains',
  calls: 'calls',
  imports: 'imports',
  exports: 'exports',
  extends: 'extends',
  implements: 'implements',
  references: 'references',
  type_of: 'has type',
  returns: 'returns',
  instantiates: 'instantiates',
  overrides: 'overrides',
  decorates: 'decorates',
};

export const EDGE_KIND_COLORS: Record<EdgeKind, string> = {
  contains: '#94a3b8',
  calls: '#3b82f6',
  imports: '#78716c',
  exports: '#78716c',
  extends: '#10b981',
  implements: '#06b6d4',
  references: '#a78bfa',
  type_of: '#f59e0b',
  returns: '#ec4899',
  instantiates: '#f97316',
  overrides: '#ef4444',
  decorates: '#8b5cf6',
};

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  fileCount: number;
  languages: { language: string; count: number }[];
  kinds: { kind: string; count: number }[];
}
