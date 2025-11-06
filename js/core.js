/* ======= core.js ======= */
window.canvas = document.getElementById('canvas');
window.stage  = document.getElementById('stageWrap');
window.wires  = document.getElementById('wires');

const pivot = document.getElementById('zoomPivot');
let _pivotTO = null;
function showZoomPivot(sx, sy){
  pivot.style.left = sx + 'px';
  pivot.style.top  = sy + 'px';
  pivot.style.opacity = 1;
  clearTimeout(_pivotTO);
  _pivotTO = setTimeout(()=>{ pivot.style.opacity = 0; }, 700);
}
function logZoomDebug(label, data){
  console.group(`[Zoom] ${label}`); console.table(data); console.groupEnd();
}

/* === Linking (Answer -> Answer/Case) === */
let linking = null; // { fromEl, owner, tempPath }
function startLink(fromEl, ownerNode){
  if (linking?.tempPath) linking.tempPath.remove();
  const temp = makeWire();
  temp.setAttribute('stroke-dasharray', '6 6');
  temp.setAttribute('opacity', '0.6');
  linking = { fromEl, owner: ownerNode, tempPath: temp };
}
function cancelLink(){ if (linking?.tempPath) linking.tempPath.remove(); linking = null; }
window.startLink = startLink; window.cancelLink = cancelLink;

/* === Zoom / Pan === */
function updateStageSize(){
  const baseW = window.innerWidth;
  const baseH = window.innerHeight;
  const scaleBuffer = Math.max(1, 1 / ZOOM);
  stage.style.width  = baseW * scaleBuffer + "px";
  stage.style.height = baseH * scaleBuffer + "px";
}
function clientToStageCoords(clientX, clientY){
  const r = stage.getBoundingClientRect();
  return { x:(clientX - r.left + canvas.scrollLeft)/ZOOM, y:(clientY - r.top + canvas.scrollTop)/ZOOM };
}
function applyZoom(centerClientX=null, centerClientY=null){
  let cx=null, cy=null;
  if (centerClientX!==null){ const s=clientToStageCoords(centerClientX, centerClientY); cx=s.x; cy=s.y; }
  stage.style.transform = `scale(${ZOOM})`;
  updateStageSize();
  if (cx!==null){
    const dx = cx*ZOOM - (centerClientX - canvas.getBoundingClientRect().left + canvas.scrollLeft);
    const dy = cy*ZOOM - (centerClientY - canvas.getBoundingClientRect().top  + canvas.scrollTop);
    canvas.scrollLeft = dx; canvas.scrollTop = dy;
    showZoomPivot(cx, cy);
    logZoomDebug('applyZoom', { centerClientX, centerClientY, anchor_stage_x:cx, anchor_stage_y:cy, zoom_current: ZOOM });
  }
}
function zoomAt(clientX, clientY, factor){
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect  = stage.getBoundingClientRect();
  if (clientX==null) clientX = canvasRect.left + canvas.clientWidth/2;
  if (clientY==null) clientY = canvasRect.top  + canvas.clientHeight/2;

  const sx = (clientX - stageRect.left + canvas.scrollLeft) / ZOOM;
  const sy = (clientY - stageRect.top  + canvas.scrollTop ) / ZOOM;

  showZoomPivot(sx, sy);
  logZoomDebug('before', { clientX, clientY, anchor_stage_x:sx, anchor_stage_y:sy, zoom_prev:ZOOM, scrollLeft_prev:canvas.scrollLeft, scrollTop_prev:canvas.scrollTop });

  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ZOOM * factor));
  if (newZoom === ZOOM) return;
  ZOOM = newZoom;

  stage.style.transformOrigin = "0 0";
  stage.style.transform = `scale(${ZOOM})`;
  updateStageSize();

  const newScrollLeft = sx * ZOOM - (clientX - stageRect.left);
  const newScrollTop  = sy * ZOOM - (clientY - stageRect.top);

  const maxScrollLeft = Math.max(0, stage.clientWidth * ZOOM - canvas.clientWidth);
  const maxScrollTop  = Math.max(0, stage.clientHeight* ZOOM - canvas.clientHeight);

  canvas.scrollLeft = Math.min(Math.max(newScrollLeft, 0), maxScrollLeft);
  canvas.scrollTop  = Math.min(Math.max(newScrollTop,  0), maxScrollTop);

  logZoomDebug('after', { clientX, clientY, anchor_stage_x:sx, anchor_stage_y:sy, zoom_new:ZOOM, scrollLeft_new:canvas.scrollLeft, scrollTop_new:canvas.scrollTop });
}

document.getElementById('zoomIn').addEventListener('click', ()=> zoomAt(null,null,1+ZOOM_STEP));
document.getElementById('zoomOut').addEventListener('click',()=> zoomAt(null,null,1-ZOOM_STEP));
document.getElementById('zoomReset').addEventListener('click',()=>{
  const target = 1/ZOOM; zoomAt(null,null,target);
});

document.addEventListener('wheel', (e)=>{
  // Allow normal scrolling inside preview panel and inspector
  if (e.target.closest && e.target.closest('#previewPanel, #inspector')) {
    return;
  }
  if (e.target.tagName === 'TEXTAREA' && e.target.scrollHeight > e.target.clientHeight) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  const ZOOM_SPEED = 0.0035;
  const factor = 1 - e.deltaY * ZOOM_SPEED; // scroll down => zoom out
  zoomAt(e.clientX, e.clientY, factor);
}, { passive:false });

/* === Pan or finalize linking === */
let panning=false, panStartX=0, panStartY=0, startScrollLeft=0, startScrollTop=0;
stage.addEventListener('pointerdown', (e)=>{
  const isBg = (e.target === stage || e.target === document.getElementById('grid') || e.target === wires);
  if (!isBg) return;

  clearSelection();

  panning = true;
  stage.setPointerCapture(e.pointerId);
  panStartX = e.clientX; 
  panStartY = e.clientY; 
  startScrollLeft = canvas.scrollLeft; 
  startScrollTop  = canvas.scrollTop;
  document.body.style.cursor = 'grabbing';
});

stage.addEventListener('pointermove', (e)=>{
  if (linking){
    const a = stagePointFor(linking.fromEl);
    const spt = clientToStageCoords(e.clientX, e.clientY);
    linking.tempPath.setAttribute('d', pathBetween(a, spt));
    return;
  }
  if (!panning) return;
  const dx=e.clientX-panStartX, dy=e.clientY-panStartY;
  canvas.scrollLeft = startScrollLeft - dx; canvas.scrollTop = startScrollTop - dy;
});
stage.addEventListener('pointerup', (e)=>{
  if (linking){
    const target=e.target;
    if (target && target.classList && target.classList.contains('inport')){
      connect(linking.fromEl, target, linking.owner);
      updateConnections();
    }
    cancelLink();
    return;
  }
  if (panning){ panning=false; stage.releasePointerCapture(e.pointerId); document.body.style.cursor=''; }
});
window.addEventListener('keydown', (e)=>{ if (e.key==='Escape') cancelLink(); });

/* === Wires / Connections === */
window.connections = [];
function makeWire(){
  const p = document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('fill','none');
  p.setAttribute('stroke','#111827');
  p.setAttribute('stroke-width','2.2');
  p.setAttribute('stroke-linecap','round');
  p.setAttribute('opacity','0.8');
  p.setAttribute('vector-effect','non-scaling-stroke');
  wires.appendChild(p);
  return p;
}
window.makeWire = makeWire;

window.connect = function connect(fromEl, toEl, owner=null){
  if (connections.some(c => c.to === toEl)){
    console.warn('[connect] Skipped: target already has a parent', toEl);
    return null;
  }
  const path = makeWire();
  connections.push({ from: fromEl, to: toEl, path, owner });
  updateConnections();
  return path;
};

function stagePointFor(el){
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { x:(r.left + r.width/2 - s.left + canvas.scrollLeft)/ZOOM,
           y:(r.top  + r.height/2- s.top  + canvas.scrollTop )/ZOOM };
}

window.updateConnections = function updateConnections(){
  connections.forEach(c=>{
    if (!document.body.contains(c.from) || !document.body.contains(c.to)){
      if (c.path) c.path.remove();
      return;
    }
    const a=stagePointFor(c.from), b=stagePointFor(c.to);
    c.path.setAttribute('d', pathBetween(a,b));
  });
};

/* === Node selection, dragging, delete === */
window.currentNode = null;
function clearSelection(){
  document.querySelectorAll('.node.selected').forEach(n=>n.classList.remove('selected'));
  window.currentNode = null;
  if (typeof closeInspector === 'function') closeInspector();
}
window.clearSelection = clearSelection;

function selectNode(node){
  clearSelection();
  node.classList.add('selected');
  window.currentNode = node;
  if (typeof openInspector === 'function') openInspector(node);
}
window.selectNode = selectNode;

function _elBelongsToNode(el,node){
  return el===node || (el && node && node.contains && node.contains(el));
}

function deleteNode(node, _visited=new Set()){
  if (!node || _visited.has(node)) return;
  _visited.add(node);

  const ownedChildren = [...new Set(
    connections
      .filter(c => c.owner === node)
      .map(c => c.to && c.to.closest && c.to.closest('.node'))
      .filter(child => child && document.body.contains(child))
  )];
  ownedChildren.forEach(child => deleteNode(child, _visited));

  connections
    .filter(c => c.to && c.to.closest && c.to.closest('.node') === node)
    .forEach(c => {
      if (c.from && c.from.classList && c.from.classList.contains('rport')) {
        const row = c.from.closest('.row');
        if (row && row.parentElement) {
          row.remove();
        }
      }
    });

  const rct = rect(node); 
  poofEffect(rct.x + rct.w/2, rct.y + rct.h/2);

  connections
    .filter(c => _elBelongsToNode(c.from,node) || _elBelongsToNode(c.to,node) || c.owner===node)
    .forEach(c => c.path && c.path.remove());

  for (let i=connections.length-1;i>=0;i--){
    const c=connections[i];
    if (_elBelongsToNode(c.from,node) || _elBelongsToNode(c.to,node) || c.owner===node){
      connections.splice(i,1);
    }
  }

  if (window.currentNode === node) closeInspector?.();
  node.remove();
  updateConnections();
  if (typeof refreshPreviewCases==='function') refreshPreviewCases();
};

function poofEffect(x,y){
  const poof=document.createElement('div');
  poof.className='poof';
  poof.style.left = (x*ZOOM - canvas.scrollLeft) + 'px';
  poof.style.top  = (y*ZOOM - canvas.scrollTop)  + 'px';
  document.body.appendChild(poof);
  requestAnimationFrame(()=>{
    poof.classList.add('show');
    setTimeout(()=>poof.remove(), 350);
  });
}

function makeDraggable(node, onMove){
  let drag=false, startX=0, startY=0, baseX=0, baseY=0;

  function pointerDown(e){
    if (e.button!==0) return;
    const isHeader = e.target.closest('.header');
    if (!isHeader) return;
    drag=true;
    node.setPointerCapture(e.pointerId);
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(node.style.transform || '');
    baseX = m ? parseFloat(m[1]) : (parseFloat(node.dataset.x)||0);
    baseY = m ? parseFloat(m[2]) : (parseFloat(node.dataset.y)||0);
    startX = e.clientX;
    startY = e.clientY;
  }

  function pointerMove(e){
    if (!drag) return;
    const dx=(e.clientX-startX)/ZOOM, dy=(e.clientY-startY)/ZOOM;
    const nx=baseX+dx, ny=baseY+dy;
    node.dataset.x = nx;
    node.dataset.y = ny;
    node.style.transform = `translate(${nx}px, ${ny}px)`;
    if (onMove) onMove(node);
  }

  function pointerUp(e){
    if (!drag) return;
    drag=false;
    node.releasePointerCapture(e.pointerId);
  }

  node.addEventListener('pointerdown', pointerDown);
  node.addEventListener('pointermove', pointerMove);
  node.addEventListener('pointerup',   pointerUp);
}
window.makeDraggable = makeDraggable;

/* === Case Node === */
buildCaseNode = function buildCaseNode({x=100,y=100, skipDefault=false} = {}){
  const node=document.createElement('div'); node.className='node case'; node.dataset.x=x; node.dataset.y=y;
  node.style.transform=`translate(${x}px, ${y}px)`; node.id=uid('case');
  node.innerHTML=`
    <div class="trash" title="Delete">🗑️</div>
    <div class="header">
      <span class="pill">CASE</span>
      <span style="font-weight:600">Case</span>
      <span style="margin-left:auto"></span>
    </div>
    <div class="body">

      <div class="field">
        <label>Message</label>
        <input class="q" type="text" placeholder="Type message/question…" />
      </div>

      <div class="case-rows"></div>
      <div class="footer no-drag">
        <button class="btn mini add">＋ Add Option</button>
      </div>

      <div class="schedule">
        <div class="schedule-row">
          <label>Start</label>
          <input class="sched-start" type="date" />
        </div>
        <div class="schedule-row">
          <label>End</label>
          <input class="sched-end" type="date" />
        </div>
        <div class="schedule-row days">
          <label>Days</label>
          <div>
            <label><input type="checkbox" class="sched-day" value="mon">Mon</label>
            <label><input type="checkbox" class="sched-day" value="tue">Tue</label>
            <label><input type="checkbox" class="sched-day" value="wed">Wed</label>
            <label><input type="checkbox" class="sched-day" value="thu">Thu</label>
            <label><input type="checkbox" class="sched-day" value="fri">Fri</label>
            <label><input type="checkbox" class="sched-day" value="sat">Sat</label>
            <label><input type="checkbox" class="sched-day" value="sun">Sun</label>
          </div>
        </div>
        <div class="schedule-row">
          <label>Indefinite</label>
          <input type="checkbox" class="sched-indef" />
        </div>
      </div>
    </div>`;

  stage.appendChild(node);

  const caseIn=document.createElement('div');  caseIn.className='inport'; caseIn.title='In'; node.appendChild(caseIn);
  const rowsWrap=node.querySelector('.case-rows');
  node.querySelector('.trash').addEventListener('click', (e)=>{ e.stopPropagation(); deleteNode(node); });

  const schedEndInput = node.querySelector('.sched-end');
  const schedIndef    = node.querySelector('.sched-indef');
  if (schedEndInput && schedIndef){
    schedIndef.addEventListener('change', ()=>{
      if (schedIndef.checked){
        schedEndInput.dataset.prevValue = schedEndInput.value;
        schedEndInput.value='';
        schedEndInput.disabled=true;
      } else {
        schedEndInput.disabled=false;
        schedEndInput.value = schedEndInput.dataset.prevValue || '';
      }
    });
  }

  // ✅ make case block selectable
  node.addEventListener('click',(e)=>{
    if (e.target.closest('.trash')) return;
    selectNode(node);
  });

  function createRowBare(matchVal='', respVal=''){
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`
      <div>
        <label>When input equals</label>
        <input class="match" type="text" placeholder="e.g. yes" />
      </div>
      <div>
        <label>Response</label>
        <input class="resp" type="text" placeholder="Optional response label…" />
      </div>
      <div class="rport" title="Row output"></div>
    `;
    rowsWrap.appendChild(row);
    if (matchVal) row.querySelector('.match').value=matchVal;
    if (respVal)  row.querySelector('.resp').value =respVal;
    return row;
  }
  // Connect a parent node to a child node using their anchor ports
// - For CASE parents, it uses a specific row's .rport
// - For ANSWER parents, it uses the node-level .oport
function connectParentChild({ parentNode, childNode, rowIndex = 0 }) {
  if (!parentNode || !childNode) return null;

  let fromEl = null;

  if (parentNode.classList.contains('case')) {
    // CASE → child: use a row's .rport as the anchor
    const rowPorts = [...parentNode.querySelectorAll('.case-rows .row .rport')];
    fromEl = rowPorts[rowIndex] || null;
  } else if (parentNode.classList.contains('answer')) {
    // ANSWER → child: use the node's output port
    fromEl =
      parentNode.querySelector('.oport') ||
      parentNode.querySelector('.outport') ||
      null;
  }

  const toEl = childNode.querySelector('.inport');

  if (!fromEl || !toEl) return null;

  // This creates the connection object + SVG path
  return connect(fromEl, toEl, parentNode);
}
window.connectParentChild = connectParentChild;


  function addRow(withText=''){
    const idx=rowsWrap.children.length+1;
    const row=createRowBare(withText, withText);
    const caseRect=node.getBoundingClientRect(); const caseWidth=caseRect.width/ZOOM; const GAP=240;
    const baseX=parseFloat(node.dataset.x||'0'); const baseY=parseFloat(node.dataset.y||'0');
    const ansX=baseX+caseWidth+GAP; const ansY=baseY+40+(idx-1)*120;
    const ans=buildAnswerNode({ title:`Answer ${idx}`, responseEl: row.querySelector('.resp'), x: ansX, y: ansY });
    const rport=row.querySelector('.rport'); const inport=ans.el.querySelector('.inport');
    connect(rport, inport, node);
    updateConnections();
  }

  node._appendRowBare = (matchVal='', respVal='')=>{ createRowBare(matchVal, respVal); };

  if (!skipDefault) addRow('Option 1');

  node.querySelector('.add').addEventListener('click',(e)=>{ e.stopPropagation(); addRow('New option'); });

  makeDraggable(node, ()=>updateConnections());
  updateConnections();

  node._getReplies = ()=>[...rowsWrap.querySelectorAll('.row')].map(r=>r.querySelector('.match').value);
  node._setReplies = (arr = []) => {
    const replies = Array.isArray(arr) ? arr : [];
    const rows = [...rowsWrap.querySelectorAll('.row')];

    // 1) If there are fewer replies now, remove extra rows
    //    and delete their children + connections.
    for (let i = replies.length; i < rows.length; i++) {
      const row = rows[i];
      const rport = row.querySelector('.rport');

      if (rport && Array.isArray(window.connections)) {
        // Remove ALL connections that start from this rport
        for (let j = window.connections.length - 1; j >= 0; j--) {
          const c = window.connections[j];
          if (c.from === rport) {
            const childNode = c.to && c.to.closest ? c.to.closest('.node') : null;
            if (childNode) {
              // This will also clean up any wires owned by that child subtree
              deleteNode(childNode);
            }
            if (c.path && c.path.remove) {
              c.path.remove();
            }
            window.connections.splice(j, 1);
          }
        }
      }

      row.remove();
    }

    // 2) Re-read rows after deletions
    let currentRows = [...rowsWrap.querySelectorAll('.row')];

    // 3) Ensure we have exactly one row per reply.
    //    Existing rows keep their connections; we just update their text.
    replies.forEach((txt, idx) => {
      if (currentRows[idx]) {
        const matchInput = currentRows[idx].querySelector('.match');
        if (matchInput) {
          matchInput.value = txt;
        }
      } else {
        // New reply → new row with no child yet
        const newRow = createRowBare(txt, txt); // uses the local helper above
        currentRows.push(newRow);
      }
    });

    updateConnections();
  };


  node._getSchedule = ()=>{
    const start=node.querySelector('.sched-start')?.value||'';
    const end=node.querySelector('.sched-end')?.value||'';
    const days=[...node.querySelectorAll('.sched-day:checked')].map(i=>i.value);
    const indefinitely=!!node.querySelector('.sched-indef')?.checked;
    return {start,end,days,indefinitely};
  };
  node._setSchedule = (cfg={})=>{
    const startInput=node.querySelector('.sched-start');
    const endInput=node.querySelector('.sched-end');
    const daysInputs=[...node.querySelectorAll('.sched-day')];
    const indefInput=node.querySelector('.sched-indef');

    if (startInput && cfg.start) startInput.value=cfg.start;
    if (endInput && cfg.end) endInput.value=cfg.end;
    if (Array.isArray(cfg.days)){
      const set=new Set(cfg.days);
      daysInputs.forEach(i=>{ i.checked=set.has(i.value); });
    }
    if (indefInput && typeof cfg.indefinitely==='boolean'){
      indefInput.checked=cfg.indefinitely;
    }
  };

  const rootToggle = node.querySelector('.root-toggle');
  if (rootToggle) {
    rootToggle.addEventListener('change', ()=>{
      document.querySelectorAll('.node.case[data-root="true"]').forEach(n=>{
        if (n!==node) n.removeAttribute('data-root');
      });
      if (rootToggle.checked){
        node.setAttribute('data-root','true');
      } else {
        node.removeAttribute('data-root');
      }
      if (typeof refreshPreviewCases==='function') refreshPreviewCases();
    });
  }

  return node;
};
window.buildCaseNode = buildCaseNode;

/* === Answer / Response Node === */
function buildAnswerNode({ title='Answer', responseEl=null, x=480, y=120 }){
  const node=document.createElement('div'); node.className='node answer'; node.dataset.x=x; node.dataset.y=y;
  node.style.transform=`translate(${x}px, ${y}px)`; node.id=uid('ans');
  node.innerHTML=`
    <div class="trash" title="Delete">🗑️</div>
    <div class="header">
      <span class="pill" style="background:#d1fae5;color:#064e3b">RESPONSE</span>
      <span style="font-weight:600">${title}</span>
      <span class="port" style="margin-left:auto"></span>
    </div>
    <div class="body">
      <label>Response Text</label>
      <textarea class="resp"></textarea>

      <div class="hr" style="height:1px;background:#eef0f5;margin:8px 0;"></div>
      <label>Follow-up Question (optional)</label>
      <input class="follow-q" type="text" placeholder="Ask a follow-up question…">

      <div class="follow-rows" style="display:grid;gap:8px;"></div>
      <div class="footer no-drag" style="display:flex; gap:8px;">
        <button class="btn mini log">Log to Console</button>
        <button class="btn mini" data-action="add-follow-row">＋ Add Option</button>
        <button class="btn mini" data-action="add-next">＋ Next</button>
        <span style="flex:1"></span>
        <span class="pill" title="Drag from this output port to another node’s input">Chain →</span>
      </div>
    </div>`;

  const inport = document.createElement('div');  inport.className='inport';  inport.title='In';  node.appendChild(inport);
  const outport= document.createElement('div');  outport.className='oport';   outport.title='Out (click to start linking)'; node.appendChild(outport);
  outport.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); startLink(outport, node); });

  stage.appendChild(node);

  node.addEventListener('click',(e)=>{
    if (e.target.closest('.trash')){
      deleteNode(node);
      return;
    }
    selectNode(node);
  });

  const ta = node.querySelector('textarea.resp');
  if (responseEl){
    ta.value = responseEl.value || '';
    responseEl.addEventListener('input', ()=>{ ta.value=responseEl.value; });
  }

  const followRows = node.querySelector('.follow-rows');
  const addFollowRowBtn = node.querySelector('[data-action="add-follow-row"]');

  function addFollowRow(withText=''){
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`
      <div><label>When user clicks</label><input class="match" type="text" placeholder="e.g. Yes" /></div>
      <div><label>Response</label><input class="resp" type="text" placeholder="Message to log" /></div>
      <div class="rport" title="Row output"></div>
    `;
    followRows.appendChild(row);
    if (withText){
      row.querySelector('.match').value=withText;
      row.querySelector('.resp').value =withText;
    }
    return row;
  }

  addFollowRowBtn.addEventListener('click',(e)=>{ e.stopPropagation(); addFollowRow('New option'); });

  const nextBtn=node.querySelector('[data-action="add-next"]');
  nextBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    if (!node.querySelector('.follow-rows .row')) addFollowRow('Option 1');
    const fq=node.querySelector('.follow-q'); if (fq && !fq.value.trim()) fq.value='Next question…';
  });

  makeDraggable(node, ()=>updateConnections());
  updateConnections();

  node._getFollowQuestion = ()=> node.querySelector('.follow-q')?.value?.trim() || '';
  node._getFollowRows     = ()=> [...node.querySelectorAll('.follow-rows .row')];

  node._setFollowReplies  = (arr = []) => {
    const followWrap = node.querySelector('.follow-rows');
    if (!followWrap) return;

    const rows = [...followWrap.querySelectorAll('.row')];
    const targetCount = Array.isArray(arr) ? arr.length : 0;
    const replies = Array.isArray(arr) ? arr : [];

    // Remove extra rows and any wires from their rports
    while (rows.length > targetCount) {
      const row = rows.pop();
      const rport = row.querySelector('.rport');
      if (rport && Array.isArray(window.connections)) {
        for (let i = window.connections.length - 1; i >= 0; i--) {
          const c = window.connections[i];
          if (c.from === rport) {
            c.path?.remove?.();
            window.connections.splice(i, 1);
          }
        }
      }
      row.remove();
    }

    // Add missing rows
    while (rows.length < targetCount) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div><label>When user clicks</label><input class="match" type="text" placeholder="e.g. Yes" /></div>
        <div><label>Response</label><input class="resp" type="text" placeholder="Message to log" /></div>
        <div class="rport" title="Row output"></div>
      `;
      followWrap.appendChild(row);
      rows.push(row);
    }

    // Sync text values
    rows.forEach((row, idx) => {
      const label = replies[idx] ?? '';
      const matchInput = row.querySelector('.match');
      if (matchInput) matchInput.value = label;
    });

    if (typeof updateConnections === 'function') {
      updateConnections();
    }
  };

  return { el: node, responseEl: ta };
}

/* === Add Case button === */
document.getElementById('addCase').addEventListener('click', ()=>{
  const centerX = stage.clientWidth/2, centerY = stage.clientHeight/2;
  const prefX   = Math.max(20, centerX - 800), prefY = Math.max(20, centerY - 100);
  const GAP=240; const spot=findFreeSpot(prefX, prefY, GAP);
  const node=buildCaseNode({ x: spot.x, y: spot.y }); selectNode(node);
  if (typeof refreshPreviewCases==='function') refreshPreviewCases();
});

/* === Init view === */
updateStageSize();
applyZoom();
(function centerWorkspace(){
  const r=canvas.getBoundingClientRect(), st=stage.getBoundingClientRect();
  canvas.scrollLeft=Math.max(0,(st.width-r.width)/2);
  canvas.scrollTop =Math.max(0,(st.height-r.height)/2);
})();
