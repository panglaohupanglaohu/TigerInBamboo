/**
 * before-after-panel.js — 「之前 / 之后 · 同机位对照」面板（R70，通用：每一层的 tier-workshop 侧栏都有，beforeAfter:false 可关）。
 * 有候选时点「拍之前 / 之后」：这一层 agent.compare(true) → 拍游戏画面 → compare(false) → 同镜头再拍 → 并排 + 逐像素差（before-after.js）。
 * 游戏画面直接从同源的游戏 iframe（#game）的 renderer 拿（先渲染一帧再 toDataURL），不经桥接命令，所以任何层都能用。
 * 只在页面内存里（globalThis.__tmBeforeAfter[层]），不写浏览器本地存储、不设默认。
 */
import { pixelDiff, pushEntry, diffSentence, DIFF_SIZE } from './before-after.js?v=ba-r70';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CSS = `.ba-panel{border:1px solid var(--line,#d8d3c6);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--panel,#fbfaf6)}.ba-panel h4{margin:0 0 4px}
.ba-pair{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}.ba-pair figure{margin:0}.ba-pair img{width:100%;display:block;border-radius:4px;background:#ddd}.ba-pair figcaption{font-size:11px;color:#666}`;
function ensureCss() { if (document.getElementById('before-after-css')) return; const s = document.createElement('style'); s.id = 'before-after-css'; s.textContent = CSS; document.head.append(s); }

/** 从游戏 iframe 拍一张（PNG dataURL）。拿不到画布就抛错，不编图。 */
export function grabGame(doc = document) {
  const w = doc.getElementById('game')?.contentWindow, tm = w?.__tm, cv = tm?.renderer?.domElement || w?.document?.querySelector('canvas');
  if (!cv || typeof cv.toDataURL !== 'function') throw Error('游戏画面还没就绪（找不到画布）');
  try { if (tm?.renderer && tm.scene && tm.camera) tm.renderer.render(tm.scene, tm.camera); } catch {}
  return cv.toDataURL('image/png');
}
async function pixels(url) {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'), k = DIFF_SIZE / Math.max(img.width, img.height); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height).data;
}

export function mountBeforeAfterPanel({ host, layer, agent, label = layer, settle = 1500 }) {
  ensureCss();
  const store = (globalThis.__tmBeforeAfter ||= {}), root = el('section', undefined, 'ba-panel');
  root.id = 'before-after-' + layer; root.dataset.layer = layer; root.dataset.state = 'idle';
  const go = el('button', '拍之前 / 之后（同机位）', 'small'); go.type = 'button'; go.dataset.beforeAfter = layer;
  const msg = el('small', '有候选之后点：先切到原样拍一张，再切回候选用同一个镜头拍一张。', 'muted'), pair = el('div', undefined, 'ba-pair');
  root.append(el('h4', '之前 / 之后 · 同机位对照'), go, el('br'), msg, pair); host.append(root);
  function draw(e) {
    pair.replaceChildren();
    for (const [k, cap] of [['before', '之前（原样）'], ['after', '之后（候选）']]) { const f = el('figure'), img = el('img'); img.src = e[k]; img.alt = cap; img.dataset.shot = k; f.append(img, el('figcaption', cap)); pair.append(f); }
    msg.textContent = `${e.scene || ''} · ${e.steps.length} 个能力 · ${diffSentence(e.diff)}`;
  }
  async function shoot() {
    const c = agent.current?.();
    if (!c) { msg.textContent = '还没有候选：先 ▶ 执行管线，出了候选再拍。'; root.dataset.state = 'no-candidate'; return null; }
    root.dataset.state = 'running'; go.disabled = true;
    try {
      await agent.compare(true); await sleep(settle); const before = grabGame();
      await agent.compare(false); await sleep(settle); const after = grabGame();
      const [a, b] = await Promise.all([pixels(before), pixels(after)]), diff = pixelDiff(a, b);
      store[layer] = pushEntry(store[layer], { layer, scene: globalThis.__tmCurrentScene || null, candidate: c.id, steps: c.report.map((r) => r.id), verify: c.verification?.status, before, after, diff });
      draw(store[layer][0]); Object.assign(root.dataset, { state: 'done', diff: String(diff.mean), changed: String(diff.changed) });
      return store[layer][0];
    } catch (e) { root.dataset.state = 'error'; msg.textContent = '没拍成：' + e.message; return null; }
    finally { go.disabled = false; }
  }
  go.onclick = () => { shoot(); };
  return { root, shoot };
}
