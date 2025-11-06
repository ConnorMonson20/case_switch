// js/flowio.js

function downloadJSON(obj, filename = 'flow.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function _rowIndexInNode(nodeEl, rportEl) {
  const rows = [...nodeEl.querySelectorAll('.row .rport')];
  return rows.indexOf(rportEl);
}

function exportFlow() {
  const data = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString()
    },
    nodes: [],
    connections: []
  };

  document.querySelectorAll('.node').forEach(n => {
    const base = {
      id: n.id,
      x: +n.dataset.x || 0,
      y: +n.dataset.y || 0
    };

    if (n.classList.contains('case')) {
      const rows = [...n.querySelectorAll('.case-rows .row')].map(row => ({
        match: row.querySelector('.match')?.value ?? '',
        resp:  row.querySelector('.resp')?.value  ?? ''
      }));
    
      // schedule
      let schedule = { start:'', end:'', days:[], indefinitely:false };
      if (typeof n._getSchedule === 'function') {
        schedule = n._getSchedule() || schedule;
      }
    
      // No longer include 'test' since the field is removed
      data.nodes.push({
        ...base,
        type: 'case',
        q: n.querySelector('.q')?.value ?? '',
        rows,
        schedule
      });
    }
    else if (n.classList.contains('answer')) {
      const followRows = [...n.querySelectorAll('.follow-rows .row')].map(row => ({
        match: row.querySelector('.match')?.value ?? '',
        resp:  row.querySelector('.resp')?.value  ?? ''
      }));
      data.nodes.push({
        ...base,
        type: 'answer',
        text: n.querySelector('textarea.resp')?.value ?? '',
        followQ: n.querySelector('.follow-q')?.value ?? '',
        followRows
      });
    }
  });

  // connections
  connections.forEach(c => {
    if (!c?.from || !c?.to) return;
    const fromNode = c.from.closest('.node');
    const toNode   = c.to.closest('.node');
    const out = { node: fromNode?.id || null, port: null, index: null };
    if (c.from.classList.contains('oport')) {
      out.port = 'out';
    } else if (c.from.classList.contains('rport')) {
      out.port  = 'row';
      out.index = _rowIndexInNode(fromNode, c.from);
    }
    const inp = { node: toNode?.id || null, port: 'in' };
    data.connections.push({ from: out, to: inp, owner: c.owner?.id || null });
  });

  downloadJSON(data, `flow-${new Date().toISOString().slice(0,10)}.json`);
}

/** Load flow.json from file input and rebuild nodes + connections */
function importFlow(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      restoreFlow(data);
    } catch (err) {
      alert('Invalid JSON file.');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

/** Handle the actual reconstruction */
function restoreFlow(data) {
  // 1. Clear existing stage
  document.querySelectorAll('.node').forEach(n => n.remove());
  connections.forEach(c => c.path?.remove());
  connections.length = 0;

  // 2. Rebuild nodes
  const nodeMap = new Map();
  (data.nodes || []).forEach(n => {
    let nodeEl;
  
    if (n.type === 'case') {
      nodeEl = buildCaseNode({ x: n.x, y: n.y, skipDefault: true });
      nodeEl.id = n.id;
      nodeEl.querySelector('.q').value = n.q || '';
  
      // 🔹 Handle legacy flows gracefully — only set test if the input exists
      const testInput = nodeEl.querySelector('.test');
      if (testInput && typeof n.test === 'string') {
        testInput.value = n.test;
      }
  
      // 🔹 Schedule
      if (n.schedule && typeof nodeEl._setSchedule === 'function') {
        nodeEl._setSchedule(n.schedule);
      }
  
      // 🔹 Rows (rebuild without auto-spawning Answers)
      const rows = n.rows || [];
      const rowsWrap = nodeEl.querySelector('.case-rows');
      if (rowsWrap) rowsWrap.innerHTML = '';
      rows.forEach(r => {
        if (typeof nodeEl._appendRowBare === 'function') {
          nodeEl._appendRowBare(r.match || '', r.resp || '');
        } else {
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = `
            <div>
              <label>When input equals</label>
              <input class="match" type="text" />
            </div>
            <div>
              <label>Response</label>
              <input class="resp" type="text" />
            </div>
            <div class="rport" title="Row output"></div>
          `;
          rowsWrap.appendChild(row);
          row.querySelector('.match').value = r.match || '';
          row.querySelector('.resp').value  = r.resp  || '';
        }
      });
  
    } else if (n.type === 'answer') {
      const answer = buildAnswerNode({
        x: n.x,
        y: n.y
      });
      nodeEl = answer.el;
      nodeEl.id = n.id;
      nodeEl.querySelector('.resp').value = n.text || '';
      nodeEl.querySelector('.follow-q').value = n.followQ || '';
  
      const followWrap = nodeEl.querySelector('.follow-rows');
      followWrap.innerHTML = '';
      (n.followRows || []).forEach(r => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `
          <div><label>When user clicks</label><input class="match" type="text" value="${r.match || ''}" /></div>
          <div><label>Response</label><input class="resp" type="text" value="${r.resp || ''}" /></div>
          <div class="rport" title="Row output"></div>`;
        followWrap.appendChild(row);
      });
    }
  
    if (nodeEl) nodeMap.set(n.id, nodeEl);
  });
  
  // 3. Rebuild connections (now that rows & Answer nodes exist)
  (data.connections || []).forEach(c => {
    if (!c || !c.from || !c.to) return;

    const fromNode = nodeMap.get(c.from.node);
    const toNode   = nodeMap.get(c.to.node);
    const owner    = c.owner ? nodeMap.get(c.owner) : null;
    if (!fromNode || !toNode) return;

    // Be a bit more forgiving about port naming / legacy JSON
    const port = c.from.port || c.from.type || c.from.kind;

    let fromEl = null;

    // 1) Node-level output ports (ANSWER → something)
    if (port === 'out' || port === 'oport' || port === 'outport') {
      fromEl =
        fromNode.querySelector('.oport') ||
        fromNode.querySelector('.outport') ||
        null;
    }

    // 2) Row-level ports (CASE row or ANSWER follow row)
    if (!fromEl && (port === 'row' || port === 'rport' || typeof c.from.index === 'number')) {
      let rowPorts = [];

      if (fromNode.classList.contains('case')) {
        // Case node: only use ports under .case-rows
        rowPorts = [...fromNode.querySelectorAll('.case-rows .row .rport')];
      } else if (fromNode.classList.contains('answer')) {
        // Answer node: only use ports under .follow-rows
        rowPorts = [...fromNode.querySelectorAll('.follow-rows .row .rport')];
      } else {
        // Fallback for any other node type
        rowPorts = [...fromNode.querySelectorAll('.row .rport')];
      }

      const idx  = typeof c.from.index === 'number' ? c.from.index : 0;
      fromEl = rowPorts[idx] || null;
    }

    const toEl = toNode.querySelector('.inport');
    if (fromEl && toEl) {
      connect(fromEl, toEl, owner || null);
    }
  });

  updateConnections();
  if (typeof refreshPreviewCases === 'function') refreshPreviewCases();
  alert('Flow imported successfully!');
}

/** Create hidden file input to trigger import */
document.getElementById('importBtn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importFlow(file);
  });
  input.click();
});

// Hook up toolbar button
document.getElementById('exportBtn').addEventListener('click', exportFlow);
