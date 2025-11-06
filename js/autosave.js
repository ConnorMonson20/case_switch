/* ======= autosave.js ======= */
/* Local autosave scaffolding (disabled until export/import are defined).
   Kept as no-ops so nothing breaks. */

(function(){
  const KEY='case-switch-autosave';
  function save(){ /* when exportFlowJSON is ready:
    const data = exportFlowJSON();
    localStorage.setItem(KEY, JSON.stringify(data));
  */ }
  function restore(){ /* when importFlowJSON is ready:
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    try { importFlowJSON(JSON.parse(raw)); } catch(e){ console.error(e); }
  */ }

  // Hooks you can enable later:
  // window.addEventListener('beforeunload', save);
  // document.addEventListener('keydown', e => { if (e.ctrlKey && e.key.toLowerCase()==='s'){ e.preventDefault(); save(); } });

  // restore(); // enable when import is implemented
})();
