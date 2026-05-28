(function () {
  const vscode = acquireVsCodeApi();
  let cy = null;
  let allNodes = [];
  let allEdges = [];
  let showEdgeLabels = false;
  let currentLayout = 'fcose';

  const NODE_KIND_COLORS = {
    file: '#4b5563',
    module: '#8b5cf6',
    class: '#10b981',
    struct: '#10b981',
    interface: '#06b6d4',
    trait: '#06b6d4',
    protocol: '#06b6d4',
    function: '#3b82f6',
    method: '#60a5fa',
    property: '#f59e0b',
    field: '#d97706',
    variable: '#ec4899',
    constant: '#f43f5e',
    enum: '#8b5cf6',
    enum_member: '#a78bfa',
    type_alias: '#6366f1',
    namespace: '#64748b',
    parameter: '#94a3b8',
    import: '#6b7280',
    export: '#6b7280',
    route: '#14b8a6',
    component: '#f97316',
  };

  const EDGE_KIND_COLORS = {
    contains: '#475569',
    calls: '#3b82f6',
    imports: '#6b7280',
    exports: '#6b7280',
    extends: '#10b981',
    implements: '#06b6d4',
    references: '#a78bfa',
    type_of: '#f59e0b',
    returns: '#ec4899',
    instantiates: '#f97316',
    overrides: '#ef4444',
    decorates: '#8b5cf6',
  };

  const NODE_SIZES = {
    file: 12,
    class: 20,
    struct: 18,
    interface: 16,
    function: 14,
    method: 10,
    property: 8,
    field: 8,
    variable: 5,
    constant: 8,
    enum: 16,
    enum_member: 6,
    type_alias: 10,
    namespace: 14,
    parameter: 4,
    import: 4,
    export: 4,
    route: 12,
    component: 14,
    module: 14,
    trait: 16,
    protocol: 16,
  };

  const HIDDEN_KINDS = new Set(['import', 'export', 'parameter', 'variable', 'file']);
  const IMPORTANT_KINDS = new Set(['class', 'interface', 'struct', 'function', 'method', 'enum', 'route', 'component']);

  function filterNodes(nodes, edges) {
    const importantNodes = nodes.filter(n => !HIDDEN_KINDS.has(n.kind));
    const nodeIds = new Set(importantNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes: importantNodes, edges: filteredEdges };
  }

  function deduplicateNodes(nodes) {
    const seen = new Map();
    for (const node of nodes) {
      const key = node.qualified_name;
      if (!seen.has(key)) {
        seen.set(key, node);
      }
    }
    return Array.from(seen.values());
  }

  function initGraph(nodes, edges, layout) {
    const cyContainer = document.getElementById('cy');
    if (!cyContainer) return;

    if (cy) {
      cy.destroy();
    }

    allNodes = nodes;
    allEdges = edges;

    let processed = deduplicateNodes(nodes);
    processed = filterNodes(processed, edges);

    const elements = [];
    const nodeIds = new Set();

    for (const node of processed.nodes) {
      const size = NODE_SIZES[node.kind] || 8;
      const color = NODE_KIND_COLORS[node.kind] || '#6b7280';
      nodeIds.add(node.id);

      elements.push({
        data: {
          id: node.id,
          label: node.name,
          kind: node.kind,
          file: node.file_path,
          line: node.start_line,
          qualifiedName: node.qualified_name,
          color: color,
          size: size,
        },
      });
    }

    for (const edge of processed.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;

      const color = EDGE_KIND_COLORS[edge.kind] || '#475569';
      elements.push({
        data: {
          id: `e${edge.id || edge.source + edge.target + edge.kind}`,
          source: edge.source,
          target: edge.target,
          kind: edge.kind,
          color: color,
          label: showEdgeLabels ? edge.kind : '',
        },
      });
    }

    cy = cytoscape({
      container: cyContainer,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': '',
            'background-color': 'data(color)',
            'width': 'data(size)',
            'height': 'data(size)',
            'font-size': '9px',
            'color': '#e5e7eb',
            'text-valign': 'bottom',
            'text-margin-y': 3,
            'text-outline-color': '#111827',
            'text-outline-width': 2,
            'border-width': 1,
            'border-color': 'data(color)',
            'border-opacity': 0.3,
            'opacity': 0.9,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'label': 'data(label)',
            'border-width': 3,
            'border-color': '#ffffff',
            'background-color': '#ffffff',
            'font-weight': 'bold',
            'font-size': '11px',
            'text-outline-width': 3,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'label': 'data(label)',
            'border-width': 3,
            'border-color': '#fbbf24',
            'font-weight': 'bold',
            'font-size': '11px',
            'text-outline-width': 3,
          },
        },
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.08,
          },
        },
        {
          selector: 'node.neighbor',
          style: {
            'label': 'data(label)',
            'font-size': '10px',
            'opacity': 1,
            'text-outline-width': 2,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'width': 0.5,
            'opacity': 0.15,
            'label': '',
            'font-size': '7px',
            'color': '#94a3b8',
            'text-rotation': 'autorotate',
            'text-outline-color': '#111827',
            'text-outline-width': 1,
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'width': 2,
            'opacity': 0.8,
            'label': showEdgeLabels ? 'data(kind)' : '',
            'font-size': '9px',
          },
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.03,
          },
        },
      ],
      layout: { name: 'preset' },
      minZoom: 0.05,
      maxZoom: 8,
      wheelSensitivity: 0.2,
      boxSelectionEnabled: false,
    });

    applyLayout(layout || currentLayout);

    cy.on('tap', 'node', function (evt) {
      const node = evt.target;
      selectNode(node.id());
    });

    cy.on('dbltap', 'node', function (evt) {
      const node = evt.target;
      vscode.postMessage({ type: 'nodeDoubleClick', nodeId: node.id() });
    });

    cy.on('tap', function (evt) {
      if (evt.target === cy) {
        clearHighlight();
        hideDetailPanel();
      }
    });

    cy.on('zoom', updateLabelVisibility);
    updateLabelVisibility();

    updateStats(processed.nodes.length, processed.edges.length);
  }

  function updateLabelVisibility() {
    if (!cy) return;
    const zoom = cy.zoom();

    cy.nodes().forEach(node => {
      if (node.hasClass('highlighted') || node.hasClass('neighbor')) return;
      const kind = node.data('kind');
      const shouldShow = (zoom > 1.5 && IMPORTANT_KINDS.has(kind)) || zoom > 3;
      node.style('label', shouldShow ? node.data('label') : '');
    });
  }

  function applyLayout(name) {
    currentLayout = name;
    if (!cy) return;

    let layoutOptions = {
      name: name,
      animate: true,
      animationDuration: 600,
    };

    switch (name) {
      case 'fcose':
        layoutOptions = {
          ...layoutOptions,
          quality: 'proof',
          animate: true,
          animationDuration: 1000,
          nodeRepulsion: 4500,
          idealEdgeLength: 150,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.2,
          numIter: 3000,
          padding: 50,
          nodeDimensionsIncludeLabels: false,
          randomize: false,
        };
        break;
      case 'dagre':
        layoutOptions = {
          ...layoutOptions,
          rankDir: 'TB',
          rankSep: 80,
          nodeSep: 50,
          edgeSep: 30,
          padding: 50,
          spacingFactor: 1.5,
          nodeDimensionsIncludeLabels: false,
        };
        break;
      case 'circle':
        layoutOptions = {
          ...layoutOptions,
          avoidOverlap: true,
          spacingFactor: 2,
          padding: 50,
          nodeDimensionsIncludeLabels: false,
        };
        break;
      case 'concentric':
        layoutOptions = {
          ...layoutOptions,
          concentric: function (node) {
            return node.degree();
          },
          levelWidth: function () { return 2; },
          avoidOverlap: true,
          padding: 50,
          nodeDimensionsIncludeLabels: false,
        };
        break;
      case 'breadthfirst':
        layoutOptions = {
          ...layoutOptions,
          directed: true,
          spacingFactor: 1.5,
          padding: 50,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: false,
        };
        break;
    }

    cy.layout(layoutOptions).run();

    setTimeout(() => {
      cy.fit(undefined, 50);
      updateLabelVisibility();
    }, 1200);
  }

  function selectNode(nodeId) {
    if (!cy) return;

    const node = cy.getElementById(nodeId);
    if (!node.length) return;

    cy.elements().removeClass('highlighted dimmed neighbor');

    const neighborhood = node.neighborhood().nodes();
    const connectedEdges = node.connectedEdges();

    cy.elements().addClass('dimmed');
    node.removeClass('dimmed').addClass('highlighted');
    neighborhood.removeClass('dimmed').addClass('neighbor');
    connectedEdges.removeClass('dimmed').addClass('highlighted');

    showDetailForNode(nodeId);
    vscode.postMessage({ type: 'nodeClicked', nodeId: nodeId });
  }

  function focusNode(nodeId) {
    if (!cy) return;

    const node = cy.getElementById(nodeId);
    if (!node.length) return;

    selectNode(nodeId);

    cy.animate({
      center: { eles: node },
      zoom: 3,
    }, { duration: 400 });
  }

  function clearHighlight() {
    if (!cy) return;
    cy.elements().removeClass('highlighted dimmed neighbor');
    updateLabelVisibility();
  }

  function showDetailForNode(nodeId) {
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;

    const panel = document.getElementById('detailPanel');
    const content = document.getElementById('detailContent');
    if (!panel || !content) return;

    const color = NODE_KIND_COLORS[node.kind] || '#6b7280';
    const relatedEdges = allEdges.filter(e => e.source === nodeId || e.target === nodeId);

    const grouped = {};
    for (const edge of relatedEdges) {
      if (!grouped[edge.kind]) grouped[edge.kind] = 0;
      grouped[edge.kind]++;
    }

    let edgesHtml = '';
    for (const [kind, count] of Object.entries(grouped)) {
      const eColor = EDGE_KIND_COLORS[kind] || '#475569';
      edgesHtml += `<div class="edge-item"><span class="edge-badge" style="background:${eColor}">${kind}</span> <span>${count}</span></div>`;
    }

    const neighborIds = new Set();
    for (const edge of relatedEdges) {
      if (edge.source !== nodeId) neighborIds.add(edge.source);
      if (edge.target !== nodeId) neighborIds.add(edge.target);
    }

    const neighbors = Array.from(neighborIds)
      .map(id => allNodes.find(n => n.id === id))
      .filter(Boolean)
      .slice(0, 25);

    let neighborsHtml = '';
    for (const n of neighbors) {
      const nColor = NODE_KIND_COLORS[n.kind] || '#6b7280';
      neighborsHtml += `<div class="neighbor-item" data-node-id="${n.id}">
        <span style="color:${nColor}">●</span>
        <span>${escapeHtml(n.name)}</span>
        <span class="neighbor-kind">${n.kind}</span>
      </div>`;
    }

    content.innerHTML = `
      <div class="detail-header">
        <div class="detail-name">${escapeHtml(node.name)}</div>
        <span class="detail-kind" style="background:${color}">${node.kind}</span>
      </div>
      <div class="detail-meta">
        <div><strong>File:</strong> ${escapeHtml(node.file)}:${node.line}</div>
        <div><strong>Qualified:</strong> ${escapeHtml(node.qualifiedName)}</div>
      </div>
      ${edgesHtml ? `<div class="detail-section"><h3>Relationships</h3>${edgesHtml}</div>` : ''}
      ${neighborsHtml ? `<div class="detail-section"><h3>Connected (${neighbors.length})</h3><div class="neighbor-list">${neighborsHtml}</div></div>` : ''}
    `;

    panel.classList.remove('hidden');

    content.querySelectorAll('.neighbor-item').forEach(el => {
      el.addEventListener('click', () => {
        const nid = el.getAttribute('data-node-id');
        if (nid) focusNode(nid);
      });
    });
  }

  function hideDetailPanel() {
    const panel = document.getElementById('detailPanel');
    if (panel) panel.classList.add('hidden');
  }

  function updateStats(nodes, edges) {
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      statsEl.textContent = `${nodes} nodes · ${edges} edges`;
    }
  }

  function searchNodes(query) {
    vscode.postMessage({ type: 'search', query: query });
  }

  function showSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (!results || results.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.innerHTML = results.map(node => {
      const color = NODE_KIND_COLORS[node.kind] || '#6b7280';
      return `<div class="search-result-item" data-node-id="${node.id}">
        <div class="search-result-name">
          <span style="color:${color}">●</span> ${escapeHtml(node.name)}
        </div>
        <div class="search-result-meta">${node.kind} — ${escapeHtml(node.file_path)}:${node.start_line}</div>
      </div>`;
    }).join('');

    container.classList.remove('hidden');

    container.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const nodeId = el.getAttribute('data-node-id');
        if (nodeId) {
          focusNode(nodeId);
          container.classList.add('hidden');
          document.getElementById('searchInput').value = '';
        }
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.addEventListener('message', function (event) {
    const message = event.data;

    switch (message.type) {
      case 'init':
      case 'loadGraph':
        initGraph(message.nodes, message.edges, message.layout);
        if (message.focusNodeId) {
          setTimeout(() => focusNode(message.focusNodeId), 800);
        }
        break;

      case 'focusNode':
        focusNode(message.nodeId);
        break;

      case 'searchResults':
        showSearchResults(message.nodes);
        break;

      case 'stats':
        if (message.stats) {
          updateStats(message.stats.nodeCount, message.stats.edgeCount);
        }
        break;
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const layoutSelect = document.getElementById('layoutSelect');
    const showEdgeLabelsCheckbox = document.getElementById('showEdgeLabels');
    const refreshBtn = document.getElementById('refreshBtn');
    const fitBtn = document.getElementById('fitBtn');
    const closeDetailBtn = document.getElementById('closeDetail');

    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        searchTimeout = setTimeout(() => {
          if (query.length >= 2) {
            searchNodes(query);
          } else {
            const container = document.getElementById('searchResults');
            if (container) container.classList.add('hidden');
          }
        }, 300);
      });

      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          this.value = '';
          const container = document.getElementById('searchResults');
          if (container) container.classList.add('hidden');
        }
      });
    }

    if (layoutSelect) {
      layoutSelect.value = currentLayout;
      layoutSelect.addEventListener('change', function () {
        currentLayout = this.value;
        applyLayout(this.value);
        vscode.postMessage({ type: 'layoutChanged', layout: this.value });
      });
    }

    if (showEdgeLabelsCheckbox) {
      showEdgeLabelsCheckbox.addEventListener('change', function () {
        showEdgeLabels = this.checked;
        if (cy) {
          cy.edges().forEach(edge => {
            edge.style('label', showEdgeLabels ? edge.data('kind') : '');
          });
        }
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        vscode.postMessage({ type: 'refresh' });
      });
    }

    if (fitBtn) {
      fitBtn.addEventListener('click', function () {
        if (cy) {
          cy.animate({ fit: { eles: cy.elements(), padding: 50 } }, { duration: 400 });
        }
      });
    }

    if (closeDetailBtn) {
      closeDetailBtn.addEventListener('click', function () {
        hideDetailPanel();
        clearHighlight();
      });
    }
  });

  document.body.innerHTML += `
    <div class="loading-overlay" id="loadingOverlay">
      <div style="text-align:center">
        <div class="spinner"></div>
        <div class="loading-text">Loading CodeGraph...</div>
      </div>
    </div>
  `;

  window.addEventListener('message', function handler(event) {
    if (event.data.type === 'init' || event.data.type === 'loadGraph') {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.remove();
      window.removeEventListener('message', handler);
    }
  });
})();
