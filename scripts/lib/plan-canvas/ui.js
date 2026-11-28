'use strict';

/**
 * Plan Canvas browser chrome: the editor shell that frames an artifact,
 * plus the rendered-markdown artifact template.
 *
 * Visual language mirrors the ECC web dashboard (scripts/dashboard-web.js):
 * same design tokens, dark-first with a light theme, accent→pink brand
 * gradient. Everything is served inline — no CDNs, no external assets.
 */

const path = require('path');

const { escapeHtml } = require('./markdown');
const { computePlanDigest } = require('./verdict-binding');

// Pinned Mermaid ESM build, loaded in the browser only when an artifact
// actually contains a diagram. Override with a local/vendored URL (e.g. an
// air-gapped mirror) via ECC_PLAN_CANVAS_MERMAID_URL. If the fetch fails, the
// diagram source stays visible as a styled code block — nothing breaks.
const DEFAULT_MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';

function mermaidUrl(env = process.env) {
  const override = env.ECC_PLAN_CANVAS_MERMAID_URL;
  return override && String(override).trim() ? String(override).trim() : DEFAULT_MERMAID_URL;
}

// Browser module that renders `<pre class="mermaid">` blocks, themed to match
// the ECC canvas. Kept import-only so a CDN failure degrades gracefully.
function mermaidLoaderScript(url) {
  return `<script type="module">
  try {
    const mermaid = (await import(${JSON.stringify(url)})).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'dark',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      themeVariables: {
        primaryColor: '#13161e', primaryBorderColor: '#6885e8', primaryTextColor: '#dfe2e9',
        lineColor: '#80859a', secondaryColor: '#191d2a', tertiaryColor: '#101218',
        background: '#080a0e', mainBkg: '#13161e', clusterBkg: '#0d0f14'
      }
    });
    await mermaid.run({ querySelector: '.mermaid' });
  } catch (err) {
    document.querySelectorAll('.mermaid').forEach(el => el.classList.add('mermaid-unrendered'));
    console.warn('Mermaid render skipped:', err && err.message);
  }
</script>`;
}

// Design tokens shared by the chrome and the markdown artifact template.
const TOKENS_CSS = `
  :root{
    --bg:#080a0e; --bg2:#0d0f14; --bg3:#13161e; --bg4:#191d2a;
    --surface:#101218; --surface-hover:#171a24; --border:#1d2130; --border-light:#272c3e;
    --text:#dfe2e9; --text2:#80859a; --text3:#4c5168;
    --accent:#6885e8; --accent-glow:rgba(104,133,232,0.15); --accent-dim:#3d5ab8;
    --green:#4acb8a; --green-glow:rgba(74,203,138,0.15);
    --orange:#eca85a; --orange-glow:rgba(236,168,90,0.15);
    --pink:#e26a9e; --pink-glow:rgba(226,106,158,0.15);
    --red:#e86060; --red-glow:rgba(232,96,96,0.15);
    --teal:#4acbbe; --teal-glow:rgba(74,203,190,0.15);
    --radius:8px; --radius-sm:5px;
    --font:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter','Segoe UI',Roboto,sans-serif;
    --mono:'SF Mono','Fira Code','JetBrains Mono','Cascadia Code',monospace;
    --shadow:0 1px 2px rgba(0,0,0,0.4);
    --shadow-lg:0 8px 32px rgba(0,0,0,0.6);
  }
  [data-theme="light"]{
    --bg:#f4f5f7; --bg2:#ffffff; --bg3:#eaecef; --bg4:#dfe2e6;
    --surface:#ffffff; --surface-hover:#f4f5f7; --border:#cdd1d9; --border-light:#dde1e8;
    --text:#181b23; --text2:#585e6e; --text3:#9197a8;
    --accent:#4560d0; --accent-glow:rgba(69,96,208,0.08); --accent-dim:#2f44a0;
    --green:#16a34a; --green-glow:rgba(22,163,74,0.08);
    --orange:#d97706; --orange-glow:rgba(217,119,6,0.08);
    --pink:#c73877; --pink-glow:rgba(199,56,119,0.08);
    --red:#dc2626; --red-glow:rgba(220,38,38,0.08);
    --teal:#0d9488; --teal-glow:rgba(13,148,136,0.08);
    --shadow:0 1px 2px rgba(0,0,0,0.04);
    --shadow-lg:0 8px 32px rgba(0,0,0,0.08);
  }
`;

function canvasCss() {
  return `${TOKENS_CSS}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{font-family:var(--font);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.4;overflow:hidden;display:flex;flex-direction:column}
  ::selection{background:var(--accent);color:#fff}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  button{font-family:var(--font)}

  .bar{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;min-height:52px;padding:8px 14px;background:color-mix(in srgb,var(--bg2) 88%,transparent);border-bottom:1px solid var(--border);backdrop-filter:blur(16px)}
  .brand{display:flex;align-items:center;gap:9px;min-width:0;flex:none}
  .brand .logo{width:26px;height:26px;flex:none;background:linear-gradient(135deg,var(--accent),var(--pink));border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff}
  .brand .name{font-size:13.5px;font-weight:600;white-space:nowrap}
  .brand .file{font-size:11.5px;color:var(--text2);font-family:var(--mono);white-space:nowrap}
  .bar .spacer{flex:1}
  .bar .actions{display:flex;align-items:center;gap:8px;flex:none}
  .mode-chip{font-size:11px;font-family:var(--mono);color:var(--accent);background:var(--accent-glow);border:1px solid var(--accent-dim);border-radius:99px;padding:3px 10px;white-space:normal;line-height:1.35}
  .url-chip{display:inline-flex;align-items:center;min-height:24px;font-size:11px;font-family:var(--mono);color:var(--text2);background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 9px;text-decoration:none;flex:none;white-space:nowrap}
  .url-chip:hover{color:var(--text);border-color:var(--accent-dim)}
  a.icon-btn{text-decoration:none}

  .presence{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--text2);background:var(--bg3);border:1px solid var(--border);border-radius:99px;padding:3px 10px 3px 8px;white-space:nowrap}
  .presence .dot{width:7px;height:7px;border-radius:99px;background:var(--text3)}
  .presence[data-state="listening"] .dot{background:var(--green);box-shadow:0 0 0 3px var(--green-glow);animation:pulse 2s infinite}
  .presence[data-state="thinking"] .dot,.presence[data-state="typing"] .dot{background:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);animation:pulse 1.2s infinite}
  .presence[data-state="queued"] .dot{background:var(--orange);box-shadow:0 0 0 3px var(--orange-glow)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}

  .toggle{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text2);cursor:pointer;user-select:none}
  .toggle .track{width:30px;height:17px;border-radius:99px;background:var(--bg4);border:1px solid var(--border);position:relative;transition:background .15s}
  .toggle .knob{position:absolute;top:1px;left:1px;width:13px;height:13px;border-radius:99px;background:var(--text2);transition:transform .15s,background .15s}
  .toggle[aria-pressed="true"] .track{background:var(--accent);border-color:var(--accent-dim)}
  .toggle[aria-pressed="true"] .knob{transform:translateX(13px);background:#fff}

  .icon-btn{height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:11.5px;display:flex;align-items:center;gap:5px;transition:all .12s}
  .icon-btn:hover{border-color:var(--border-light);color:var(--text);background:var(--bg4)}
  .icon-btn.danger:hover{border-color:var(--red);color:var(--red);background:var(--red-glow)}

  .layout{display:flex;flex:1;min-height:0}
  .frame{flex:1;min-width:0;position:relative;background:var(--bg2)}
  .frame iframe{width:100%;height:100%;border:0;background:#fff;display:block;margin:0 auto;transition:width .15s,box-shadow .15s}
  .frame[data-viewport] iframe{box-shadow:0 0 0 1px var(--border),var(--shadow-lg)}
  [data-theme] .frame iframe{background:var(--bg2)}
  .frame.viewport{display:flex;justify-content:center;background:var(--bg3)}
  .frame.viewport iframe{width:var(--vp-w,100%);flex:none;border-left:1px solid var(--border);border-right:1px solid var(--border)}

  .vp{display:flex;align-items:center;gap:6px}
  .vp select,.vp input{height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);font-size:11.5px;padding:0 6px;outline:none;transition:all .12s}
  .vp select:hover,.vp input:hover{border-color:var(--border-light);color:var(--text)}
  .vp input{width:66px;font-family:var(--mono)}
  .vp input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
  .vp input[hidden]{display:none}
  .vp .icon-btn[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:var(--accent-glow)}

  .layout[data-panel="hidden"] .panel{display:none}
  .panel{width:340px;flex:none;display:flex;flex-direction:column;border-left:1px solid var(--border);background:var(--bg2)}
  .panel h2{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);padding:12px 14px 8px}

  .verdict{display:flex;gap:8px;padding:0 14px 12px;border-bottom:1px solid var(--border)}
  .verdict button{flex:1;height:30px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all .12s}
  .verdict .approve{border:1px solid var(--green);background:var(--green-glow);color:var(--green)}
  .verdict .approve:hover{background:var(--green);color:#fff}
  .verdict .changes{border:1px solid var(--orange);background:var(--orange-glow);color:var(--orange)}
  .verdict .changes:hover{background:var(--orange);color:#fff}

  .chat{flex:1;min-height:0;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:8px}
  .msg{max-width:92%;padding:7px 10px;border-radius:10px;font-size:12.5px;white-space:pre-wrap;word-break:break-word}
  .msg.user{align-self:flex-end;background:var(--accent-glow);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);color:var(--text);border-bottom-right-radius:3px}
  .msg.agent{align-self:flex-start;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:3px}
  .msg .meta{display:block;font-size:9.5px;color:var(--text3);margin-top:3px}
  .msg.kind-annotation{border-left:2px solid var(--teal)}
  .msg.kind-verdict{border-left:2px solid var(--green)}
  .stale-notice{flex:none;padding:6px 14px;font-size:12px;background:var(--orange-glow);color:var(--orange);border-bottom:1px solid var(--border)}
  .chat .empty{color:var(--text3);font-size:12px;text-align:center;margin-top:24px;line-height:1.6}

  /* iMessage-style activity bubble: dots while the agent thinks or types. */
  .typing{align-self:flex-start;display:none;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-bottom-left-radius:3px;border-radius:10px;padding:9px 12px}
  .typing.show{display:flex}
  .typing .dots{display:flex;align-items:center;gap:3px}
  .typing .dots i{width:6px;height:6px;border-radius:99px;background:var(--text2);animation:typing-bounce 1.4s infinite ease-in-out both}
  .typing .dots i:nth-child(1){animation-delay:-.32s}
  .typing .dots i:nth-child(2){animation-delay:-.16s}
  .typing .label{font-size:11px;color:var(--text3)}
  @keyframes typing-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}
  @media (prefers-reduced-motion:reduce){
    .typing .dots i{animation:none;opacity:.7}
    .presence .dot{animation:none}
  }
  /* A queued message nobody is listening for gets an explicit, honest note. */
  .stalled{align-self:flex-start;display:none;gap:8px;background:var(--orange-glow);border:1px solid color-mix(in srgb,var(--orange) 35%,transparent);border-radius:10px;padding:8px 11px;font-size:11.5px;color:var(--text2);line-height:1.5}
  .stalled.show{display:flex}

  .queue{padding:8px 14px 0;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto}
  .pill{display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-left:2px solid var(--teal);border-radius:6px;padding:6px 8px;font-size:11.5px}
  .pill.kind-chat{border-left-color:var(--accent)}
  .pill.kind-verdict{border-left-color:var(--green)}
  .pill .where{color:var(--teal);font-family:var(--mono);font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pill .body{flex:1;min-width:0;color:var(--text2)}
  .pill .txt{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
  .pill button{border:none;background:none;color:var(--text3);cursor:pointer;font-size:13px;line-height:1;padding:1px}
  .pill button:hover{color:var(--red)}

  .composer{flex:none;padding:10px 14px 14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px}
  .composer .hint{font-size:10px;color:var(--text3)}
  .composer textarea{width:100%;min-height:60px;max-height:160px;resize:vertical;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);font-size:12.5px;font-family:var(--font);outline:none;transition:all .15s}
  .composer textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
  .composer .row{display:flex;gap:8px;align-items:center}
  .composer .send{flex:1;height:32px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .12s}
  .composer .send:hover{background:var(--accent-dim)}
  .composer .send:disabled{opacity:.5;cursor:default}
  .composer .status{font-size:10.5px;color:var(--text3)}

  .overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bg) 80%,transparent);backdrop-filter:blur(6px);z-index:50}
  .overlay.show{display:flex}
  .overlay .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:26px 32px;text-align:center;max-width:340px}
  .overlay .card h3{font-size:14px;margin-bottom:6px}
  .overlay .card p{font-size:12px;color:var(--text2);line-height:1.5}
  `;
}

// Client logic for the chrome page (runs in the top window).
function canvasClientJs() {
  return `'use strict';
(() => {
  const boot = JSON.parse(document.getElementById('pc-session').textContent);
  const key = boot.key;
  const $ = id => document.getElementById(id);
  const frame = $('artifact');
  const chatLog = $('chatLog');
  const queueEl = $('queue');
  const input = $('chatInput');
  const sendBtn = $('send');
  const statusEl = $('sendStatus');
  const presence = $('presence');
  const QKEY = 'ecc-plan-canvas:queue:' + key;
  let queue = [];
  let lastScroll = { x: 0, y: 0 };
  let ended = boot.status === 'ended';
  let sending = false;

  try { queue = JSON.parse(sessionStorage.getItem(QKEY) || '[]'); } catch { queue = []; }

  // --- theme ---------------------------------------------------------
  const themeKey = 'ecc-plan-canvas:theme';
  function applyTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    $('themeBtn').textContent = t === 'light' ? '\\u263E dark' : '\\u2600 light';
  }
  // Storage access throws outright when the browser blocks site data for this
  // origin (loopback is a common trigger). Unguarded, that killed the whole
  // client IIFE here, before the send button and Enter handlers bound below:
  // every control rendered and stayed inert. sessionStorage is already guarded
  // above and below; match it. See affaan-m/ECC#2702.
  function readTheme() {
    try { return localStorage.getItem(themeKey); } catch { return null; }
  }
  function writeTheme(v) {
    try { localStorage.setItem(themeKey, v); } catch { /* site data blocked */ }
  }
  let theme = readTheme() || 'dark';
  applyTheme(theme);
  $('themeBtn').addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    writeTheme(theme);
    applyTheme(theme);
  });

  // --- panel toggle ----------------------------------------------------
  const layout = document.querySelector('.layout');
  const panelBtn = $('panelBtn');
  panelBtn.addEventListener('click', () => {
    const hidden = layout.getAttribute('data-panel') === 'hidden';
    if (hidden) layout.removeAttribute('data-panel');
    else layout.setAttribute('data-panel', 'hidden');
    panelBtn.setAttribute('aria-pressed', String(hidden));
    panelBtn.title = hidden ? 'Hide conversation panel' : 'Show conversation panel';
  });

  // --- artifact viewport width -----------------------------------------
  const vpSel = $('viewportSel');
  const vpCustom = $('viewportCustom');
  const frameEl = $('artifact');
  function applyViewport(width) {
    if (width) {
      const w = Math.min(4096, Math.max(240, width));
      frameEl.style.width = w + 'px';
      frameEl.parentElement.setAttribute('data-viewport', '');
    } else {
      frameEl.style.width = '';
      frameEl.parentElement.removeAttribute('data-viewport');
    }
  }
  vpSel.addEventListener('change', () => {
    if (vpSel.value === 'custom') {
      vpCustom.hidden = false;
      vpCustom.focus();
      applyViewport(Number(vpCustom.value) || 0);
    } else {
      vpCustom.hidden = true;
      applyViewport(Number(vpSel.value) || 0);
    }
  });
  vpCustom.addEventListener('input', () => {
    const w = Number(vpCustom.value);
    if (w > 0) applyViewport(w);
  });

  // --- annotate mode -------------------------------------------------
  // A framework-native preview frames a live app on its own origin, so the
  // annotation SDK can never be injected there: chat and verdicts only.
  // A live app only receives the SDK when its dev server runs a canvas
  // adapter. Until the app greets us, the toggle would be a dead control.
  let annotate = true;
  let sdkReady = boot.previewMode !== 'framework-native';
  function renderAnnotate() {
    const toggle = $('annotate');
    toggle.setAttribute('aria-pressed', String(sdkReady && annotate));
    toggle.setAttribute('aria-disabled', String(!sdkReady));
    toggle.title = sdkReady
      ? 'Toggle annotate mode (Cmd/Ctrl+I)'
      : 'Waiting for the annotation SDK in the live app - add the canvas dev-server adapter';
  }
  function setAnnotate(on) {
    if (!sdkReady) return;
    annotate = on;
    renderAnnotate();
    postToFrame({ type: 'pc:set-mode', annotate: on });
  }
  $('annotate').addEventListener('click', () => setAnnotate(!annotate));
  renderAnnotate();
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      setAnnotate(!annotate);
    }
  }, true);

  // --- iframe bridge --------------------------------------------------
  function postToFrame(msg) {
    if (frame.contentWindow) frame.contentWindow.postMessage(msg, '*');
  }
  window.addEventListener('message', e => {
    if (e.source !== frame.contentWindow) return;
    const msg = e.data || {};
    if (msg.type === 'pc:queue' && msg.item) addToQueue(msg.item);
    else if (msg.type === 'pc:queue-and-send' && msg.item) { addToQueue(msg.item); send(); }
    else if (msg.type === 'pc:scroll') lastScroll = { x: msg.x || 0, y: msg.y || 0 };
    else if (msg.type === 'pc:toggle-mode') setAnnotate(!annotate);
    else if (msg.type === 'pc:ready') {
      if (!sdkReady) { sdkReady = true; renderAnnotate(); }
      postToFrame({ type: 'pc:set-mode', annotate });
      postToFrame({ type: 'pc:restore-scroll', x: lastScroll.x, y: lastScroll.y });
    }
  });

  // --- queue ----------------------------------------------------------
  function persistQueue() { try { sessionStorage.setItem(QKEY, JSON.stringify(queue)); } catch { /* full */ } }
  function addToQueue(item) { queue.push(item); persistQueue(); renderQueue(); }
  function renderQueue() {
    queueEl.innerHTML = '';
    queue.forEach((item, i) => {
      const pill = document.createElement('div');
      pill.className = 'pill kind-' + item.kind;
      const body = document.createElement('span');
      body.className = 'body';
      if (item.anchor) {
        const where = document.createElement('span');
        where.className = 'where';
        where.textContent = item.anchor.snippet || item.anchor.selector;
        body.appendChild(where);
      }
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.textContent = item.kind === 'verdict'
        ? (item.verdict === 'approve'
          ? (boot.previewMode === 'framework-native' ? 'Approve design' : 'Approve plan')
          : 'Request changes') + (item.text ? ': ' + item.text : '')
        : item.text;
      body.appendChild(txt);
      const rm = document.createElement('button');
      rm.textContent = '\\u00D7';
      rm.title = 'Remove';
      rm.addEventListener('click', () => { queue.splice(i, 1); persistQueue(); renderQueue(); });
      pill.append(body, rm);
      queueEl.appendChild(pill);
    });
  }
  renderQueue();

  // --- activity indicators ---------------------------------------------
  // Built once and re-appended on every chat render so the animation never
  // restarts mid-thought.
  const typingEl = document.createElement('div');
  typingEl.className = 'typing';
  typingEl.setAttribute('role', 'status');
  typingEl.setAttribute('aria-live', 'polite');
  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
  const typingLabel = document.createElement('span');
  typingLabel.className = 'label';
  typingEl.append(dots, typingLabel);

  const stalledEl = document.createElement('div');
  stalledEl.className = 'stalled';
  stalledEl.setAttribute('role', 'status');

  const TYPING_LABELS = { thinking: 'agent is thinking\\u2026', typing: 'agent is typing\\u2026' };

  function renderActivity(state) {
    const typingText = TYPING_LABELS[state];
    typingEl.classList.toggle('show', Boolean(typingText));
    if (typingText) typingLabel.textContent = typingText;
    const stalled = state === 'queued';
    stalledEl.classList.toggle('show', stalled);
    if (stalled) {
      stalledEl.textContent =
        'Delivered to the queue. Your agent is not listening right now, so it picks this up the moment it checks in.';
    }
    if (typingText || stalled) scrollToEnd();
  }

  // --- chat -----------------------------------------------------------
  function atBottom() {
    return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 40;
  }
  function scrollToEnd() { chatLog.scrollTop = chatLog.scrollHeight; }

  function renderChat(entries) {
    const pinned = atBottom();
    chatLog.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Click anything in the plan to annotate it, or type below. Feedback goes straight to your agent.';
      chatLog.appendChild(empty);
    } else {
      for (const entry of entries) {
        const div = document.createElement('div');
        div.className = 'msg ' + (entry.role === 'agent' ? 'agent' : 'user') + ' kind-' + (entry.kind || 'chat');
        div.textContent = entry.text;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = (entry.role === 'agent' ? 'agent' : 'you') + ' \\u00B7 ' + new Date(entry.at).toLocaleTimeString();
        div.appendChild(meta);
        chatLog.appendChild(div);
      }
    }
    // The indicators live at the tail of the log, so they survive re-render.
    chatLog.appendChild(typingEl);
    chatLog.appendChild(stalledEl);
    if (pinned) scrollToEnd();
  }
  renderChat(boot.chat || []);

  // --- send -----------------------------------------------------------
  async function send(extraItems) {
    if (ended || sending) return;
    const items = queue.slice();
    if (extraItems) items.push(...extraItems);
    const text = input.value.trim();
    if (text) items.push({ kind: 'chat', text });
    if (!items.length) {
      statusEl.textContent = 'Nothing to send yet - annotate the plan or type a message.';
      return;
    }
    sending = true;
    sendBtn.disabled = true;
    statusEl.textContent = 'Sending\\u2026';
    try {
      const res = await fetch('/api/session/' + key + '/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json().catch(() => ({}));
      // A rejection means the batch was not queued, so the draft stays in the
      // composer for the human to re-send after reloading.
      const rejection = Array.isArray(body.rejected) ? body.rejected[0] : null;
      if (rejection) {
        // A stale verdict is the one rejection the human must understand: the
        // preview moved on, so this tab's approval was for an older revision.
        statusEl.textContent = rejection.reason === 'STALE_REVISION' || rejection.reason === 'STALE_DESIGN'
          ? 'Not approved: the design changed since this tab loaded. Reload the canvas and review the current revision.'
          : rejection.reason === 'STALE_SECTION'
            ? 'Not approved: this verdict names a different section. Reload the canvas.'
            : 'Not sent: ' + rejection.reason + '.';
        applyPresence(body.presence || 'waiting');
        // A mixed batch queued its accepted half, so clear that half too;
        // otherwise the retry sends the same items twice.
        if (!body.accepted) return;
        queue = [];
        persistQueue();
        renderQueue();
        input.value = '';
        return;
      }
      queue = [];
      persistQueue();
      renderQueue();
      input.value = '';
      // Say what actually happened: a parked agent takes the batch on the
      // spot, otherwise it sits in the queue until the agent checks in.
      statusEl.textContent = body.presence === 'thinking' || body.presence === 'typing'
        ? 'Delivered. Your agent has it.'
        : 'Queued. Your agent picks this up the moment it checks in.';
      if (body.presence) applyPresence(body.presence);
    } catch (err) {
      statusEl.textContent = 'Send failed (' + err.message + ') - is the canvas server still running?';
    } finally {
      sending = false;
      sendBtn.disabled = ended;
    }
  }
  sendBtn.addEventListener('click', () => send());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  function makeVerdictItem(verdict) {
    if (boot.target === 'antigravity-cli') {
      const meta = boot.previewMode === 'framework-native' ? boot.previewMeta : null;
      if (meta && meta.revisionDigest) {
        // Native: revisionDigest names the preview revision; the plan file
        // digest travels separately as planDigest.
        return {
          kind: 'verdict',
          verdict,
          revisionDigest: meta.revisionDigest,
          planDigest: boot.revisionDigest,
          section: meta.section,
          revision: meta.revision,
          designDigest: meta.designDigest,
          workspace: boot.workspace,
          session: boot.key,
          timestamp: new Date().toISOString()
        };
      }
      return {
        kind: 'verdict',
        verdict,
        revisionDigest: boot.revisionDigest,
        workspace: boot.workspace,
        session: boot.key,
        timestamp: new Date().toISOString()
      };
    }
    const meta = boot.previewMeta && typeof boot.previewMeta === 'object' ? boot.previewMeta : null;
    if (boot.previewMode === 'framework-native' && meta && meta.revisionDigest) {
      // Name the exact preview this tab rendered. If the session has moved on,
      // the server rejects this verdict instead of approving the newer draft.
      return {
        kind: 'verdict',
        verdict,
        section: meta.section,
        revision: meta.revision,
        revisionDigest: meta.revisionDigest,
        designDigest: meta.designDigest,
        timestamp: new Date().toISOString()
      };
    }
    return { kind: 'verdict', verdict };
  }
  $('approve').addEventListener('click', () => send([makeVerdictItem('approve')]));
  $('changes').addEventListener('click', () => send([makeVerdictItem('request-changes')]));

  // --- session controls ------------------------------------------------
  $('reloadBtn').addEventListener('click', reloadArtifact);
  $('endBtn').addEventListener('click', async () => {
    if (!window.confirm('End this review session?')) return;
    try { await fetch('/api/session/' + key + '/end', { method: 'POST' }); } catch { /* server gone */ }
  });
  async function reloadArtifact() {
    const base = frame.getAttribute('data-artifact-src');
    frame.src = base + '?t=' + Date.now();
    // Refresh the binding too: reloading only the frame leaves boot.previewMeta
    // stale, so every later verdict is rejected as STALE_REVISION.
    try {
      const res = await fetch('/api/sessions');
      const body = await res.json();
      const current = (body.sessions || []).filter(s => s.key === key)[0];
      if (current) {
        // The mode can change too (native preview replaced by standalone HTML),
        // and a stale mode makes later verdicts carry the wrong digest.
        boot.previewMode = current.previewMode || null;
        boot.previewMeta = current.previewMeta || null;
        checkStaleRevision((current.previewMeta || {}).revision);
      }
    } catch { /* server gone; the iframe reload already happened */ }
  }
  function markEnded(endedBy) {
    ended = true;
    sendBtn.disabled = true;
    input.disabled = true;
    renderActivity('ended');
    presence.setAttribute('data-state', 'ended');
    presence.querySelector('.label').textContent = 'session ended';
    $('endedOverlay').classList.add('show');
    $('endedWho').textContent = endedBy === 'agent'
      ? 'Your agent closed this review.'
      : 'You ended this review. Head back to your agent session.';
  }
  if (ended) markEnded(boot.endedBy);

  // --- server events ----------------------------------------------------
  const PRESENCE_LABELS = {
    waiting: 'agent not connected',
    listening: 'agent listening',
    thinking: 'agent is thinking\\u2026',
    typing: 'agent is typing\\u2026',
    queued: 'queued for your agent'
  };
  function applyPresence(state) {
    if (ended) return;
    presence.setAttribute('data-state', state);
    presence.querySelector('.label').textContent = PRESENCE_LABELS[state] || state;
    renderActivity(state);
  }
  function checkStaleRevision(revision) {
    if (boot.previewMode !== 'framework-native') return;
    const notice = document.getElementById('staleNotice');
    if (!notice) return;
    const current = boot.previewMeta && boot.previewMeta.revision;
    if (!revision || !current || revision === current) { notice.hidden = true; return; }
    notice.textContent = 'The preview moved to ' + revision + ' since this tab loaded. Reload to review the current draft.';
    notice.hidden = false;
  }
  function connectEvents() {
    const es = new EventSource('/events/' + key);
    es.addEventListener('chat-sync', e => renderChat(JSON.parse(e.data).chat || []));
    es.addEventListener('presence', e => {
      const payload = JSON.parse(e.data);
      applyPresence(payload.state);
      checkStaleRevision(payload.revision);
    });
    es.addEventListener('reload', reloadArtifact);
    es.addEventListener('ended', e => { markEnded(JSON.parse(e.data).endedBy); es.close(); });
    es.onerror = () => {
      if (ended) return;
      renderActivity('offline');
      presence.setAttribute('data-state', 'waiting');
      presence.querySelector('.label').textContent = 'canvas server offline';
    };
  }
  connectEvents();
})();`;
}

// The live-preview wrapper and the reviewed app are separate origins, so the
// annotation SDK cannot reach the chrome directly. This page is same-origin with
// the chrome and forwards the pc: protocol both ways; nothing else crosses.
function liveBridgeJs() {
  return `'use strict';
(() => {
  const frame = document.getElementById('app-frame');
  if (!frame || window.parent === window) return;
  const ours = msg => Boolean(msg) && typeof msg.type === 'string' && msg.type.indexOf('pc:') === 0;

  window.addEventListener('message', e => {
    if (e.source === frame.contentWindow) {
      if (ours(e.data)) window.parent.postMessage(e.data, '*');
      return;
    }
    if (e.source !== window.parent || !ours(e.data)) return;
    if (!frame.contentWindow) return;
    try { frame.contentWindow.postMessage(e.data, '*'); } catch { /* frame gone */ }
  });
})();`;
}

// The chrome page: header bar, artifact iframe, conversation rail.
function renderCanvasHtml(session, { clientPath = '/client.js', cssPath = '/canvas.css' } = {}) {
  const name = path.basename(session.file);
  // agy-cli sessions require cryptographically bound verdicts; bootstrap the
  // binding context so browser clicks produce exactly the payload sessions.js
  // enforces. Legacy sessions omit these fields and keep the plain path.
  let revisionDigest = null;
  if (session.target === 'antigravity-cli') {
    try { revisionDigest = computePlanDigest(session.file); } catch { revisionDigest = null; }
  }
  const bootstrap = JSON.stringify({
    key: session.key,
    file: session.file,
    status: session.status,
    target: session.target || null,
    workspace: session.workspace || (session.target ? path.dirname(session.file) : undefined),
    revisionDigest,
    endedBy: session.endedBy || null,
    // Absent preview fields leave the payload identical to the legacy shape.
    ...(session.previewMode ? { previewMode: session.previewMode } : {}),
    ...(session.previewUrl ? { previewUrl: session.previewUrl } : {}),
    ...(session.previewMeta ? { previewMeta: session.previewMeta } : {}),
    chat: session.chat
  }).replace(/</g, '\\u003c');
  const artifactSrc = `/artifact/${session.key}/`;
  const previewMeta = session.previewMeta && typeof session.previewMeta === 'object' ? session.previewMeta : {};
  const modeLabel = [session.previewMode, previewMeta.framework, previewMeta.section, previewMeta.revision]
    .filter(Boolean).map(String).join(' · ');
  const nativeApproval = session.previewMode === 'framework-native';
  // Sandbox flags are inherited by nested frames. A live preview wraps another
  // document, so without allow-same-origin that inner document gets an opaque
  // origin and its own module requests come back CORS-blocked. Only our
  // generated wrapper (never a raw artifact) gets the relaxed sandbox.
  const frameSandbox = session.previewMode === 'framework-native'
    ? 'allow-scripts allow-forms allow-popups allow-same-origin'
    : 'allow-scripts allow-forms allow-popups';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)} · Plan Canvas</title>
<link rel="stylesheet" href="${cssPath}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%236885e8'/><stop offset='1' stop-color='%23e26a9e'/></linearGradient></defs><rect width='100' height='100' rx='22' fill='url(%23g)'/><text x='50' y='68' font-size='52' font-weight='700' font-family='sans-serif' fill='white' text-anchor='middle'>E</text></svg>">
</head>
<body>
<script id="pc-session" type="application/json">${bootstrap}</script>
<header class="bar">
  <div class="brand">
    <div class="logo">E</div>
    <span class="name">Plan Canvas</span>
    <span class="file" title="${escapeHtml(session.file)}">${escapeHtml(name)}</span>
  </div>
  <div class="spacer"></div>
${session.previewMode ? `  <span id="modeChip" class="mode-chip" title="Preview mode">${escapeHtml(modeLabel)}</span>\n` : ''}${session.previewUrl ? `  <a id="previewUrl" class="url-chip" href="${escapeHtml(session.previewUrl)}" target="_blank" rel="noopener" title="Live preview URL">${escapeHtml(session.previewUrl)}</a>\n` : ''}  <div class="actions">
  <div id="presence" class="presence" data-state="waiting"><span class="dot"></span><span class="label">agent not connected</span></div>
  <div id="annotate" class="toggle" role="switch" aria-pressed="true" title="Toggle annotate mode (Cmd/Ctrl+I)">
    <span>Annotate</span><span class="track"><span class="knob"></span></span>
  </div>
  <div class="vp">
    <select id="viewportSel" class="icon-btn" title="Artifact viewport width" aria-label="Artifact viewport width">
      <option value="">Fit</option>
      <option value="1440">1440px desktop</option>
      <option value="1280">1280px desktop</option>
      <option value="1024">1024px tablet landscape</option>
      <option value="768">768px tablet portrait</option>
      <option value="390">390px mobile</option>
      <option value="360">360px mobile</option>
      <option value="custom">Custom&hellip;</option>
    </select>
    <input id="viewportCustom" type="number" min="240" max="4096" step="1" placeholder="px" title="Custom viewport width (px)" hidden>
  </div>
  ${session.previewUrl ? `<a id="openSeparate" class="icon-btn" href="${escapeHtml(session.previewUrl)}" target="_blank" rel="noopener" title="Open the live preview in its own tab">Open separately</a>` : ''}
  <button id="panelBtn" class="icon-btn" type="button" title="Hide conversation panel" aria-pressed="true">Panel</button>
  <button id="themeBtn" class="icon-btn" type="button">light</button>
  <button id="reloadBtn" class="icon-btn" type="button" title="Reload artifact">Reload</button>
  <button id="endBtn" class="icon-btn danger" type="button">End session</button>
  </div>
</header>
<div id="staleNotice" class="stale-notice" role="status" hidden></div>
<div class="layout">
  <main class="frame">
    <iframe id="artifact" title="Artifact under review" src="${artifactSrc}" data-artifact-src="${artifactSrc}" sandbox="${frameSandbox}"></iframe>
    <div id="endedOverlay" class="overlay"><div class="card"><h3>Session ended</h3><p id="endedWho"></p></div></div>
  </main>
  <aside class="panel">
    <h2>${nativeApproval ? 'Design verdict' : 'Plan verdict'}</h2>
    <div class="verdict">
      <button id="approve" class="approve" type="button">${nativeApproval ? 'Approve design' : 'Approve plan'}</button>
      <button id="changes" class="changes" type="button">Request changes</button>
    </div>
    <h2>Conversation</h2>
    <div id="chatLog" class="chat"></div>
    <div id="queue" class="queue"></div>
    <div class="composer">
      <textarea id="chatInput" placeholder="Message your agent&#10;Enter to send &middot; Shift+Enter for a new line"></textarea>
      <div class="row">
        <button id="send" class="send" type="button">Send to agent</button>
      </div>
      <div id="sendStatus" class="status"></div>
      <div class="hint">Annotations queue up here until you send them together.</div>
    </div>
  </aside>
</div>
<script src="${clientPath}"></script>
</body>
</html>`;
}

// ECC-styled document template for rendered markdown plan artifacts.
function renderMarkdownArtifactHtml(bodyHtml, { title, sdkSrc }) {
  const hasMermaid = bodyHtml.includes('class="mermaid"');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${TOKENS_CSS}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--font);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.65;font-size:14.5px}
  .doc{max-width:860px;margin:0 auto;padding:44px 36px 90px}
  h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .55em;letter-spacing:-.01em}
  h1{font-size:26px;margin-top:.3em;padding-bottom:.45em;border-bottom:1px solid var(--border)}
  h1:after{content:'';display:block;width:56px;height:3px;margin-top:14px;border-radius:2px;background:linear-gradient(90deg,var(--accent),var(--pink))}
  h2{font-size:19px;padding-bottom:.3em;border-bottom:1px solid var(--border)}
  h3{font-size:15.5px}
  h4,h5,h6{font-size:13.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}
  p,ul,ol,blockquote,table,pre{margin-bottom:.9em}
  ul,ol{padding-left:1.5em}
  li{margin:.25em 0}
  li.task{list-style:none;margin-left:-1.3em}
  li.task input{margin-right:.5em;accent-color:var(--accent)}
  a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-glow)}
  a:hover{border-bottom-color:var(--accent)}
  code{font-family:var(--mono);font-size:.88em;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:.12em .38em}
  pre{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;overflow-x:auto}
  pre code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.55}
  blockquote{border-left:3px solid var(--accent);background:var(--accent-glow);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:8px 14px;color:var(--text2)}
  table{width:100%;border-collapse:collapse;font-size:13px;display:block;overflow-x:auto}
  th,td{text-align:left;padding:7px 12px;border:1px solid var(--border)}
  th{background:var(--bg3);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--text2);white-space:nowrap}
  tbody tr:hover{background:var(--surface-hover)}
  hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
  img{max-width:100%;border-radius:var(--radius-sm)}
  pre.mermaid{font-family:var(--mono);font-size:12.5px;line-height:1.55;white-space:pre-wrap}
  pre.mermaid[data-processed]{background:transparent;border:none;padding:4px 0;text-align:center;overflow-x:auto}
  pre.mermaid[data-processed] svg{max-width:100%;height:auto}
  pre.mermaid.mermaid-unrendered:before{content:'diagram source (renderer unavailable)';display:block;font-family:var(--font);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:6px}
</style>
</head>
<body>
<article class="doc">
${bodyHtml}
</article>
${hasMermaid ? mermaidLoaderScript(mermaidUrl()) : ''}
<script src="${sdkSrc}"></script>
</body>
</html>`;
}

// Landing page listing sessions (GET /).
function renderSessionListHtml(sessions) {
  const rows = sessions.map(s => {
    const status = s.status === 'ended' ? `ended by ${escapeHtml(s.endedBy || 'agent')}` : s.status;
    const link = s.status === 'ended'
      ? escapeHtml(path.basename(s.file))
      : `<a href="/canvas/${escapeHtml(s.key)}">${escapeHtml(path.basename(s.file))}</a>`;
    return `<tr><td>${link}</td><td class="mono">${escapeHtml(s.file)}</td><td><span class="badge ${escapeHtml(s.status)}">${status}</span></td></tr>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Plan Canvas · sessions</title>
<style>
${TOKENS_CSS}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--font);background:var(--bg);color:var(--text);padding:40px;line-height:1.5}
  .logo{width:30px;height:30px;background:linear-gradient(135deg,var(--accent),var(--pink));border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:#fff;margin-right:10px;vertical-align:middle}
  h1{font-size:18px;display:inline-block;vertical-align:middle}
  table{margin-top:24px;border-collapse:collapse;width:100%;max-width:900px;font-size:13px}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
  th{color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  a{color:var(--accent);text-decoration:none}
  .mono{font-family:var(--mono);font-size:11.5px;color:var(--text2)}
  .badge{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--bg3);border:1px solid var(--border);color:var(--text2)}
  .badge.open,.badge.feedback{color:var(--green);border-color:var(--green);background:var(--green-glow)}
  .empty{margin-top:24px;color:var(--text3);font-size:13px}
</style>
</head>
<body>
<span class="logo">E</span><h1>Plan Canvas sessions</h1>
${sessions.length ? `<table><thead><tr><th>Artifact</th><th>Path</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">No sessions yet. Ask your agent to open a plan with the plan-canvas skill.</p>'}
</body>
</html>`;
}

module.exports = {
  canvasCss,
  canvasClientJs,
  liveBridgeJs,
  renderCanvasHtml,
  renderMarkdownArtifactHtml,
  renderSessionListHtml
};
