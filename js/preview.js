/* ======= preview.js ======= */

window.currentNode = null;

/* ---------- Inspector DOM ---------- */
const inspWrap   = document.getElementById('inspectorWrap');
const inspPanel  = document.getElementById('inspector');
const inspPrompt = document.getElementById('inspPrompt');
const inspRepliesWrap = document.getElementById('inspReplies');
const inspAddReply    = document.getElementById('inspAddReply');
const inspMulti       = document.getElementById('inspMulti');
const inspTest        = document.getElementById('inspTest');
const inspSave        = document.getElementById('inspSave');
const inspMakeRoot    = document.getElementById('inspMakeRoot');
const inspDuplicate   = document.getElementById('inspDuplicate');
const inspDelete      = document.getElementById('inspDelete');

// card that wraps the "Message" textarea
const inspPromptCard = inspPrompt ? inspPrompt.closest('.insp-card') : null;

function clearInspectorUI(){
  if (inspPrompt) inspPrompt.value = '';
  if (inspTest)   inspTest.value   = '';
  inspRepliesWrap.innerHTML = '';
  if (inspMulti) inspMulti.checked = false;
}

/* Quick reply row in inspector */
function addInspectorReplyRow(value=''){
  const row = document.createElement('div');
  row.className = 'insp-row';
  row.style.marginTop = '6px';
  row.innerHTML = `
    <input class="insp-input reply-input" placeholder="Quick reply…" />
    <button class="btn mini" data-act="remove-reply" title="Remove">✕</button>
  `;
  const input = row.querySelector('.reply-input');
  input.value = value || '';
  row.querySelector('[data-act="remove-reply"]').onclick = () => row.remove();
  inspRepliesWrap.appendChild(row);
}

function collectInspectorReplies(){
  return [...inspRepliesWrap.querySelectorAll('.reply-input')]
    .map(i => i.value.trim())
    .filter(Boolean);
}

/* ---------- Inspector <-> Node sync ---------- */

function loadCaseIntoInspector(node){
  // For CASE nodes: hide the "Message" textarea.
  if (inspPromptCard) inspPromptCard.style.display = 'none';
  if (inspPrompt) inspPrompt.value = '';
  if (inspTest) inspTest.value = '';

  // Build quick replies from the case rows
  inspRepliesWrap.innerHTML = '';
  const rows = [...node.querySelectorAll('.case-rows .row')];
  if (rows.length) {
    rows.forEach(r => {
      const match = r.querySelector('.match')?.value || '';
      const label = match;
      addInspectorReplyRow(label);
    });
  } else {
    addInspectorReplyRow('');
  }
}

function loadAnswerIntoInspector(node){
  // For ANSWER nodes: show the "Message" textarea and bind it to the response text.
  if (inspPromptCard) inspPromptCard.style.display = '';

  const ta = node.querySelector('textarea.resp');
  if (inspPrompt) inspPrompt.value = ta ? ta.value : '';

  const fq = node.querySelector('.follow-q');
  if (inspTest) inspTest.value = fq ? fq.value : '';

  inspRepliesWrap.innerHTML = '';
  const rows = node._getFollowRows
    ? node._getFollowRows()
    : [...node.querySelectorAll('.follow-rows .row')];

  if (rows.length){
    rows.forEach(r=>{
      const match = r.querySelector('.match')?.value || '';
      const resp  = r.querySelector('.resp')?.value || '';
      const label = match || resp;
      addInspectorReplyRow(label);
    });
  } else {
    addInspectorReplyRow('');
  }
}

/* ---------- Save back into node ---------- */

function saveInspectorBackToNode() {
  const node = window.currentNode;
  if (!node) return;

  const replies = collectInspectorReplies();

  if (node.classList.contains('case')) {
    if (typeof node._setReplies === 'function') node._setReplies(replies);
    return;
  }

  if (node.classList.contains('answer')) {
    const ta = node.querySelector('textarea.resp');
    if (ta && inspPrompt) ta.value = inspPrompt.value;

    const fq = node.querySelector('.follow-q');
    if (fq && inspTest) fq.value = inspTest.value;

    if (typeof node._setFollowReplies === 'function') {
      node._setFollowReplies(replies);
    }
  }
}


/* ---------- Preview chat ---------- */

const previewToggle  = document.getElementById('previewToggle');
const previewPanel   = document.getElementById('previewPanel');
const previewReset   = document.getElementById('previewReset');
const previewClose   = document.getElementById('previewClose');

const previewButtons = document.getElementById('previewButtons');
const previewMsgs    = document.getElementById('previewMsgs');

let previewStartCaseId = null;
let chatbotLoaded = false;

function appendChatbot(){
  if (chatbotLoaded) return;
  chatbotLoaded = true;

  const wrap = document.createElement('div');
  wrap.className = 'bubble bot chatbot-bubble';

  const iframe = document.createElement('iframe');
  iframe.src = 'https://storage.googleapis.com/frontend-dsa-chatbot-wholistics/WHL%20Bots/TokenStreamingWholisticsChatbotCombinedNoBubble.html';
  iframe.title = 'Wholistics Chatbot';
  iframe.className = 'chatbot-frame';
  iframe.loading = 'lazy';

  wrap.appendChild(iframe);
  previewMsgs.appendChild(wrap);
  previewMsgs.scrollTop = previewMsgs.scrollHeight;
}

function appendBubble(text, who = 'bot') {
  const div = document.createElement('div');
  div.className = 'bubble ' + (who === 'user' ? 'user' : 'bot');

  // Match either full or short YouTube URLs
  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/i;
  const match = text.match(ytRegex);

  if (match) {
    const videoId = match[1];
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.aspectRatio = '16 / 9';
    iframe.style.borderRadius = '8px';
    iframe.style.display = 'block';
    iframe.style.marginTop = '6px';
    iframe.style.height = 'auto';

    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.title = 'YouTube video player';
    iframe.style.border = '0';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;

    const beforeText = text.replace(ytRegex, '').trim();
    if (beforeText) {
      const caption = document.createElement('div');
      caption.textContent = beforeText;
      caption.style.marginBottom = '6px';
      div.appendChild(caption);
    }

    div.appendChild(iframe);
  } else {
    div.textContent = text;
  }

  previewMsgs.appendChild(div);
  previewMsgs.scrollTop = previewMsgs.scrollHeight;
}

function resetPreviewConversation(){
  previewButtons.innerHTML = '';
  previewMsgs.innerHTML = '';
  chatbotLoaded = false;
}

/* ---------- Preview helpers ---------- */

window.refreshPreviewCases = function refreshPreviewCases(){
  const cases = [...document.querySelectorAll('.node.case')];

  if (!cases.length) {
    previewStartCaseId = null;
    return;
  }

  const root = document.querySelector('.node.case[data-root="true"]');
  const startNode = root || cases[0];

  previewStartCaseId = startNode.id;
};

function showCaseInPreview(node){
  if (!node) return;
  previewStartCaseId = node.id;

  resetPreviewConversation();

  const q = node.querySelector('.q')?.value || '(no question)';
  appendBubble(q, 'bot');

  const rows = [...node.querySelectorAll('.case-rows .row')];
  previewButtons.innerHTML = '';

  rows.forEach(row => {
    const match = row.querySelector('input')?.value || '';
    if (!match) return;

    const btn = document.createElement('button');
    btn.className = 'pbtn';
    btn.textContent = match;

    btn.addEventListener('click', () => {
      // user selected this option
      previewButtons.innerHTML = '';
      if (match) appendBubble(match, 'user');

      // follow the connection from this row's rport
      const rport = row.querySelector('.rport');
      const conn = (window.connections || []).find(c => c.from === rport);
      if (!conn) return;

      const targetNode = conn.to?.closest('.node');
      if (!targetNode) return;

      if (targetNode.classList.contains('answer')) {
        showAnswerInPreview(targetNode);
      } else if (targetNode.classList.contains('case')) {
        showCaseInPreview(targetNode);
      }
    });

    previewButtons.appendChild(btn);
  });
}

function showAnswerInPreview(ansNode){
  if (!ansNode) return;

  const txt = ansNode.querySelector('textarea.resp')?.value?.trim();
  if (txt) appendBubble(txt, 'bot');

  const followQ = ansNode.querySelector('.follow-q')?.value?.trim();
  const rows = ansNode._getFollowRows
    ? ansNode._getFollowRows()
    : [...ansNode.querySelectorAll('.follow-rows .row')];

  if (followQ){
    appendBubble(followQ, 'bot');
  }

  previewButtons.innerHTML = '';

  if (rows.length){
    rows.forEach(row=>{
      const label = row.querySelector('.match')?.value || row.querySelector('.resp')?.value || 'Option';
      const btn = document.createElement('button');
      btn.className = 'pbtn';
      btn.textContent = label;
      btn.addEventListener('click', ()=>{
        previewButtons.innerHTML = '';
        if (label) appendBubble(label, 'user');

        const rport = row.querySelector('.rport');
        const conn = (window.connections || []).find(c => c.from === rport);
        if (!conn) return;

        const targetNode = conn.to?.closest('.node');
        if (!targetNode) return;

        if (targetNode.classList.contains('answer')) {
          showAnswerInPreview(targetNode);
        } else if (targetNode.classList.contains('case')) {
          showCaseInPreview(targetNode);
        }
      });
      previewButtons.appendChild(btn);
    });
  } else {
    // No follow-up options → hand off to Wholistics chatbot
    appendChatbot();
  }
}

/* ---------- Public inspector API ---------- */

window.openInspector = function(node){
  if (!node) return;

  window.currentNode = node;

  clearInspectorUI();

  if (node.classList.contains('case')) {
    loadCaseIntoInspector(node);
  } else if (node.classList.contains('answer')) {
    loadAnswerIntoInspector(node);
  }

  inspPanel.classList.add('open');
  inspWrap.setAttribute('aria-hidden', 'false');
};

window.closeInspector = function(){
  window.currentNode = null;
  inspPanel.classList.remove('open');
  inspWrap.setAttribute('aria-hidden', 'true');
};

/* ---------- Inspector actions ---------- */

inspAddReply.addEventListener('click', () => addInspectorReplyRow(''));

inspSave.addEventListener('click', () => {
  saveInspectorBackToNode();
});

inspDelete.addEventListener('click', () => {
  if (!window.currentNode) return;
  const n = window.currentNode;
  window.currentNode = null;
  deleteNode(n);
});

inspDuplicate.addEventListener('click', () => {
  const node = window.currentNode;
  if (!node) return;

  const x = (parseFloat(node.dataset.x || '0') || 0) + 80;
  const y = (parseFloat(node.dataset.y || '0') || 0) + 40;

  let clone;
  if (node.classList.contains('case')) {
    clone = buildCaseNode({ x, y });
    const srcQ     = node.querySelector('.q')?.value || '';
    const srcRep   = node._getReplies ? node._getReplies() : [];
    const srcSched = node._getSchedule ? node._getSchedule() : null;

    const cq = clone.querySelector('.q');
    if (cq) cq.value = srcQ;
    if (typeof clone._setReplies === 'function') clone._setReplies(srcRep);
    if (srcSched && typeof clone._setSchedule === 'function') clone._setSchedule(srcSched);
  } else if (node.classList.contains('answer')) {
    const orig = buildAnswerNode({ x, y });
    clone = orig.el;
    clone.querySelector('.resp').value = node.querySelector('.resp')?.value || '';
    clone.querySelector('.follow-q').value = node.querySelector('.follow-q')?.value || '';

    const srcRows = node._getFollowRows
      ? node._getFollowRows()
      : [...node.querySelectorAll('.follow-rows .row')];

    const followWrap = clone.querySelector('.follow-rows');
    followWrap.innerHTML = '';
    srcRows.forEach(r=>{
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div><label>When user clicks</label><input class="match" type="text" value="${r.querySelector('.match')?.value || ''}" /></div>
        <div><label>Response</label><input class="resp" type="text" value="${r.querySelector('.resp')?.value || ''}" /></div>
        <div class="rport" title="Row output"></div>
      `;
      followWrap.appendChild(row);
    });
  }

  if (clone){
    selectNode(clone);
    if (typeof refreshPreviewCases === 'function') refreshPreviewCases();
  }
});

inspMakeRoot.addEventListener('click', () => {
  if (!window.currentNode) return;
  document.querySelectorAll('.node.case').forEach(n => n.removeAttribute('data-root'));
  window.currentNode.setAttribute('data-root','true');
});

/* ---------- Preview controls ---------- */

if (previewToggle){
  previewToggle.addEventListener('click', () => {
    const open = previewPanel.classList.toggle('open');
    if (open) {
      refreshPreviewCases();
      if (previewStartCaseId){
        const node = document.getElementById(previewStartCaseId);
        if (node) showCaseInPreview(node);
      } else {
        resetPreviewConversation();
      }
    }
  });
}

if (previewClose){
  previewClose.addEventListener('click', () => {
    previewPanel.classList.remove('open');
  });
}

if (previewReset){
  previewReset.addEventListener('click', () => {
    if (previewStartCaseId){
      const node = document.getElementById(previewStartCaseId);
      if (node) showCaseInPreview(node);
    } else {
      resetPreviewConversation();
    }
  });
}

/* Initial call */
if (typeof refreshPreviewCases === 'function') {
  refreshPreviewCases();
} else {
  window.addEventListener('load', () => {
    if (typeof refreshPreviewCases === 'function') refreshPreviewCases();
  });
}
