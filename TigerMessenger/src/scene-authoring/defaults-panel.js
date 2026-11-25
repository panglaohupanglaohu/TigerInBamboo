// defaults-panel.js — R-A3 管线页「当前默认」栏：读 tm.defaults.v1（src/system-workshop/defaults.js），列出每个场景 × 层的默认记录，
// 一键撤回。撤回 = 删登记 + 尽量调该层已有的 unadopt / revert 桥接命令（mountain.unadopt、building.unadopt；其余层还没有「默认进游戏」的语义，
// 只删登记并在行内注明）。自带迷你 request：id 用 'du-N' 字符串前缀，不会和 studio.js 的数字 id 撞车。
// 只读登记 + 调既有撤销命令；不写场景存档。
import { mountDefaultsSummary } from '../system-workshop/defaults-ui.js?v=defaults-r2';
import { defaultStorage, setDefault, clearDefault } from '../system-workshop/defaults.js?v=defaults-r2';
import { seedPendingDefaults } from '../system-workshop/pending-defaults.js?v=defaults-r2';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const CSS = `.defaults-summary{margin:8px 0 0;padding:6px 10px;border:1px solid var(--line,#2c3440);border-radius:8px;background:var(--panel,#141a22);font-size:12px;max-height:220px;overflow:auto}
.defaults-summary table{width:100%;border-collapse:collapse}.defaults-summary td,.defaults-summary th{padding:2px 6px;border-bottom:1px solid var(--line,#2c3440);text-align:left;font-weight:normal}
.defaults-summary .du-none{opacity:.6}.defaults-summary button{font-size:11px;padding:1px 8px}`;

/** 层 → 撤销默认的桥接命令（没有 = 只有登记可删）。 */
export const UNADOPT_COMMANDS = Object.freeze({ mountain: 'mountain.unadopt', building: 'building.unadopt', battle: 'battle.unadopt' });

let seq = 0; const pending = new Map();
function gameFrame() { return document.getElementById('game'); }
/** 迷你 request：只用于撤销类命令；id 带 'du-' 前缀，与 studio.js 的数字序号隔离。 */
export function duRequest(action, payload = {}, timeoutMs = 15000) {
  const frame = gameFrame();
  if (!frame?.contentWindow) return Promise.reject(Error('游戏尚未连接'));
  const id = 'du-' + (++seq);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('场景响应超时')); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    frame.contentWindow.postMessage({ type: 'tm.pipeline.command', id, action, payload }, location.origin);
  });
}
if (typeof window !== 'undefined') window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'tm.pipeline.reply' || typeof e.data.id !== 'string' || !e.data.id.startsWith('du-')) return;
  const p = pending.get(e.data.id); if (!p) return;
  clearTimeout(p.timer); pending.delete(e.data.id);
  e.data.error ? p.reject(Error(e.data.error)) : p.resolve(e.data.result);
});

const currentSceneId = () => window.__tmCurrentScene || null;

/** 层 → 工坊面板 id（「去处理」滚过去用）。 */
const LAYER_PANES = Object.freeze({ mountain: 'mountain-workshop', building: 'building-workshop', battle: 'battle-workshop', fx: 'fx-workshop', relief: 'relief-workshop', 'apostles-terrain': 'apostles-terrain-workshop', gscene: 'gscene-workshop', lightlife: 'lightlife-workshop', object: 'object-workshop', planet: 'planet-workshop' });

/** 「去处理」：切到该场景（选项存在才切），等工坊起来后把面板滚进视野并闪一下。 */
function gotoLayer(scene, layer) {
  const sel = document.getElementById('scene');
  if (sel && scene && window.__tmCurrentScene !== scene && [...sel.options].some((o) => o.value === scene)) {
    sel.value = scene; sel.dispatchEvent(new Event('change'));
  }
  const paneId = LAYER_PANES[layer];
  const show = () => {
    const pane = paneId && document.getElementById(paneId);
    if (!pane) return;
    pane.scrollIntoView({ block: 'start', behavior: 'smooth' });
    pane.style.outline = '2px solid #e8a33d'; pane.style.outlineOffset = '2px';
    setTimeout(() => { pane.style.outline = ''; pane.style.outlineOffset = ''; }, 2600);
  };
  // 切场景后面板要重新挂载：多等一会儿再滚；场景本来就对就只等一下下
  setTimeout(show, sel && window.__tmCurrentScene !== scene ? 0 : 1400);
  setTimeout(show, 3500);
}

/** P-R57-01 行内决定：auto=true → adopted.autoDeploy=true + 登记转正式默认；false → 保持手动采用，删掉待决定登记。 */
function decideBuildingDeploy(scene, auto) {
  const st = defaultStorage(), key = 'tm.building.adopted.v1:' + scene;
  let rec = null; try { rec = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  if (rec) { rec.autoDeploy = auto; try { localStorage.setItem(key, JSON.stringify(rec)); } catch {} }
  if (auto) setDefault(st, scene, 'building', { capabilityId: 'building.pipeline', planId: rec?.sig ?? null, plan: null, adoptedBy: 'user', source: 'decide', note: 'P-R57-01：进游戏自动摆上（autoDeploy，进场景自动摆上并重核指纹）' });
  else clearDefault(st, scene, 'building');   // 决定已写进采用记录（autoDeploy=false），待决定登记撤下
}

/** pending 行的附加操作：每条都有「去处理」；building 的 P-R57-01 还能直接二选一。 */
export function rowActions(scene, layer, rec) {
  if (!rec?.status || rec.status === 'active') return [];
  const acts = [{ label: '去处理', title: '切到 ' + scene + ' 场景并滚到「' + layer + '」工坊面板', run: () => gotoLayer(scene, layer) }];
  if (layer === 'building' && /P-R57-01/.test(rec.pendingRef || '')) {
    let adopted = null; try { adopted = JSON.parse(localStorage.getItem('tm.building.adopted.v1:' + scene) || 'null'); } catch {}
    if (adopted) acts.unshift(
      { label: '进游戏自动摆上', title: 'P-R57-01：采用记录开 autoDeploy，进 ' + scene + ' 自动摆上这组建筑（会重核指纹）', run: () => decideBuildingDeploy(scene, true) },
      { label: '保持手动采用', title: 'P-R57-01：不自动摆上，采用记录保留但进游戏不换；撤下这条待决定登记', run: () => decideBuildingDeploy(scene, false) },
    );
  }
  return acts;
}

export function mount() {
  const host = document.getElementById('defaults-summary');
  if (!host) return null;
  const style = el('style', CSS); style.id = 'defaults-panel-css'; document.head.append(style);
  // R-A5：首次进管线页把 docs/PENDING_USER_DECISIONS.md 的待决定登记补进 tm.defaults.v1（只写缺失 key，幂等）。
  try { seedPendingDefaults(defaultStorage()); } catch { /* 登记失败不挡面板 */ }
  return mountDefaultsSummary({
    host, nameOf: (id) => id, onAction: rowActions,
    onClear: (scene, layer, rec) => {
      // pending 记录只是待决定追踪：撤回 = 删登记，不存在层采用记录，不该发 unadopt 命令。
      if (rec?.status && rec.status !== 'active') return Promise.resolve();
      const cmd = UNADOPT_COMMANDS[layer];
      // 不 await：登记先删（面板立刻刷新），层的 unadopt 命令在后台尽力同步（游戏没连上 / 超时也不影响删登记）。
      if (cmd) duRequest(cmd, { id: currentSceneId() }).catch(() => {});
    },
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
}
