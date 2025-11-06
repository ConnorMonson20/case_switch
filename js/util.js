/* ======= util.js ======= */
window.NODE_ID = 1;
window.MIN_ZOOM = 0.6;
window.MAX_ZOOM = 2.5;
window.ZOOM_STEP = 0.125;
window.ZOOM = 0.8; // start slightly zoomed out

window.uid = function uid(prefix='n'){ return `${prefix}_${NODE_ID++}`; };

window.rect = function rect(el){
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - s.left + canvas.scrollLeft) / ZOOM,
    y: (r.top  - s.top  + canvas.scrollTop)  / ZOOM,
    w: r.width / ZOOM,
    h: r.height/ ZOOM
  };
};

window.pathBetween = function pathBetween(a,b){
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.35);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};

window.inflateRect = (r,m)=>({x:r.x-m,y:r.y-m,w:r.w+2*m,h:r.h+2*m});
window.rectsOverlap = (a,b)=>!(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);

window.snapshotExistingRects = ()=>Array.from(document.querySelectorAll('.node')).map(el=>inflateRect(rect(el),24));

window.findFreeSpot = function findFreeSpot(preferredX, preferredY, gap=240){
  const CASE_W_EST=380, CASE_H_EST=180, ANS_W_EST=260, ANS_H_EST=160, PLACE_STEP_X=40, PLACE_STEP_Y=220, PLACE_MARGIN=24;
  const existing = snapshotExistingRects();
  const maxX = Math.max(stage.clientWidth - (CASE_W_EST + gap + ANS_W_EST + 40), 20);
  let x = Math.max(20, preferredX), y = Math.max(20, preferredY);
  for (let tries=0; tries<2000; tries++){
    const caseRect = {x,y,w:CASE_W_EST,h:CASE_H_EST};
    const ansRect  = {x:x+CASE_W_EST+gap,y:y+40,w:ANS_W_EST,h:ANS_H_EST};
    const caseInfl = inflateRect(caseRect, PLACE_MARGIN);
    const ansInfl  = inflateRect(ansRect,  PLACE_MARGIN);
    const hit = existing.some(r => rectsOverlap(r, caseInfl) || rectsOverlap(r, ansInfl));
    if (!hit) return {x,y};
    x += PLACE_STEP_X; if (x>maxX){ x=20; y+=PLACE_STEP_Y; }
  }
  return {x:preferredX,y:preferredY};
};

window.ensureStageBoundsForRect = function ensureStageBoundsForRect(x,y,w,h,padding=600){
  const needW = x + w + padding;
  const needH = y + h + padding;

  const curW = parseFloat(stage.style.width)  || stage.clientWidth;
  const curH = parseFloat(stage.style.height) || stage.clientHeight;

  let changed = false;
  if (needW > curW){ stage.style.width  = needW + 'px'; changed = true; }
  if (needH > curH){ stage.style.height = needH + 'px'; changed = true; }

  if (changed && typeof updateConnections === 'function') updateConnections();
};
