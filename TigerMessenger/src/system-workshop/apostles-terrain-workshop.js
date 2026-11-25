/**
 * 十二门徒地形工坊（R31 / R32）：场景选十二门徒时出现在系统工坊「场景管线」页，与战役 / 表现层并列。
 *   管线：apostles.soft（软坡）· apostles.palette（库地形色）两个可执行能力（地形线），扫描后自动预装（R22），▶ 一键执行。
 *   扫描 = apostles.look.probe 的实景采样；扫描前先等岩体网格连续 3 次稳定出现（R29 stable-wait，修场景重建间隙读到 0 的竞态）。
 *   预览 = 游戏 iframe 带 ?apostlesLook=<候选> 重载并回到十二门徒（网址参数照旧可用）；对照 = 切回扫描时的外观；放弃 = 切回扫描时的外观。
 *   「✓ 记为候选」只在本机记一条候选记录（tm.apostles.look.choice.v1），不写 tm.apostles.look.v1、不改默认、不动存档和湖上建筑。
 *   下方「三套方案并排对照」（R32）：approved / soft / soft+palette × 全景 / 侧面 / 俯视 / 崖脚特写截图 + 破面 / 植被 / 白沫检查，一键切到任一套看实景。
 *   采用哪套要用户点头：docs/PENDING_USER_DECISIONS.md「十二门徒采用哪套」。
 */
import { describeApostlesTerrainCapabilities } from './apostles-terrain/capabilities.js?v=contract-r2';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r1';
import { waitForStable } from '../world/rea/stable-wait.js?v=apt-r1';
import { SCHEMES, MANIFEST_PATH, buildComparison, schemeOfLook, schemeOfParam, surfaceLine } from './apostles-compare.js?v=apt-r1';
import { mountMeasurePick } from './apostles-terrain/measure-pick.js?v=apt-r2';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = { pass: '✓', warn: '!', fail: '✗' };
const CHOICE_KEY = 'tm.apostles.look.choice.v1';
/** APOSTLES_LOOK.id → 网址参数写法 */
export const paramOfLookId = (id) => { const f = new Set(String(id || 'approved').split('+')); return ['latest', 'soft', 'palette'].filter((x) => f.has(x) && !(x === 'latest' && f.has('soft'))).join(',') || 'approved'; };

function ensureCss() {
  if (document.getElementById('apostles-terrain-css')) return;
  const l = document.createElement('link'); l.id = 'apostles-terrain-css'; l.rel = 'stylesheet'; l.href = new URL('./apostles-terrain.css?v=apt-r1', import.meta.url).href; document.head.append(l);
}

export function mountApostlesTerrainWorkshop({ host, sideHost, request, reloadGame, isConnected = () => true, openSource, status = () => {}, sceneId = () => 'apostles', sceneLabel = () => '十二门徒' }) {
  ensureCss();
  const caps = describeApostlesTerrainCapabilities();
  // ── 侧栏：当前实景 + 检查 ─────────────────────────────────────────────
  const root = el('div', undefined, 'apt-side'), live = el('p', '等岩体网格稳定出现后显示当前外观。', 'muted'), checksBox = el('ul', undefined, 'verify-checks apt-checks');
  const recheck = el('button', '复查破面 / 植被 / 白沫', 'small'); recheck.type = 'button'; recheck.id = 'apt-recheck';
  root.append(el('h4', '十二门徒地形'), live, recheck, checksBox);
  let currentLook = null, busySwitch = false, scanLook = 'approved';

  async function stableState(timeout = 240000) {
    return waitForStable(async () => (isConnected() ? request('apostles.look.state') : null), { need: 3, interval: 1500, timeout });
  }
  function showLive(w) {
    if (!w.ok) { live.textContent = '实景状态没读到：' + w.reason; live.dataset.state = 'blocked'; return; }
    currentLook = w.sample.look; live.dataset.state = 'stable'; live.dataset.look = currentLook;
    const sch = schemeOfLook(currentLook), name = SCHEMES.find((s) => s.id === sch)?.name || ('其他：' + currentLook);
    live.textContent = `实景当前外观：${name}（${currentLook}）· 岩体网格 ${w.sample.count} 块，连续 3 次采样稳定（${w.samples} 次采样，场景重建 ${w.resets} 次）`;
    renderCompare();
  }
  async function runChecks() {
    checksBox.replaceChildren(el('li', '检查中…（等网格稳定 → 材质 / 破面 / 植被高差 / 白沫距离）'));
    try {
      const w = await stableState(); showLive(w); if (!w.ok) throw Error(w.reason);
      const r = await request('apostles.look.checks'); if (!r?.ok) throw Error(r?.reason || '检查失败');
      checksBox.replaceChildren(); checksBox.dataset.status = r.status; checksBox.dataset.look = r.look?.id || '';
      const t = r.totals, rows = [
        ['material', '岩体材质不透明', t.transparentRock ? 'fail' : 'pass', `半透明岩体材质 ${t.transparentRock} 个（${t.masses} 块岩体）`],
        ['integrity', '水线以上破面', t.inverted || t.openEdges ? 'warn' : 'pass', `反面三角 ${t.inverted} · 开口边 ${t.openEdges}（${t.considered} 面）；要和认可现状同机位比`],
        ['plants', '植被贴地', t.plantBadShare > 0.2 ? 'fail' : t.plantBadShare > 0.05 ? 'warn' : 'pass', `${t.plants} 株抽样，不贴地 ${(t.plantBadShare * 100).toFixed(1)}%`],
        ['foam', '岸线白沫跟随', Math.max(t.foamUncoveredShare, t.foamStrayShare) > 0.35 ? 'fail' : Math.max(t.foamUncoveredShare, t.foamStrayShare) > 0.1 ? 'warn' : 'pass', `水线 3 米内无白沫 ${(t.foamUncoveredShare * 100).toFixed(1)}% · 白沫离岸 ${(t.foamStrayShare * 100).toFixed(1)}%`],
      ];
      for (const [id, name, st, detail] of rows) { const li = el('li', undefined, 'check-' + st); li.dataset.check = id; li.append(el('b', ICON[st] + ' ' + name), el('small', detail)); checksBox.append(li); }
      if (r.defect) checksBox.append(el('li', `反面三角最多：${r.defect.massId}（崖脚特写可以对准这里）`, 'muted'));
      return r;
    } catch (e) { checksBox.replaceChildren(el('li', '检查没跑成：' + e.message, 'check-warn')); return null; }
  }
  recheck.onclick = () => runChecks();

  /** 一键切换外观：游戏 iframe 带 ?apostlesLook= 重载 → 回到十二门徒 → 等网格稳定。不写 localStorage。 */
  async function switchLook(param) {
    if (busySwitch) throw Error('正在切换外观，请等这一次完成');
    if (typeof reloadGame !== 'function') throw Error('工坊没有拿到游戏重载入口');
    busySwitch = true; renderCompare();
    const label = SCHEMES.find((s) => s.id === schemeOfParam(param))?.name || param;
    try {
      status(`十二门徒切到「${label}」：游戏重新加载（不写存档、不改默认），约半分钟到几分钟…`);
      reloadGame({ apostlesLook: param });
      for (let i = 0; i < 1200 && !isConnected(); i++) await sleep(500);
      if (!isConnected()) throw Error('游戏没有重新连上');
      let focused = null;
      for (let i = 0; i < 40 && !focused; i++) { try { focused = await request('scenes.focus', { id: sceneId() || 'apostles' }); } catch { await sleep(3000); } }
      if (!focused) throw Error('重新加载后回不到十二门徒');
      const w = await stableState(); showLive(w); if (!w.ok) throw Error(w.reason);
      if (schemeOfLook(w.sample.look) !== schemeOfParam(param)) throw Error(`切换后实景外观是 ${w.sample.look}，不是 ${param}`);
      status(`十二门徒已切到「${label}」（${w.sample.look}）。`);
      runChecks();
      return { ok: true, look: w.sample.look };
    } finally { busySwitch = false; renderCompare(); }
  }

  const view = mountTierWorkshop({
    host, sideHost, tier: 'apostles-terrain', sideTier: 'apostles-terrain', storageKey: 'apostles-terrain', caps, openSource, status, autoPreload: true, sceneLabel: () => (typeof sceneLabel === 'function' ? sceneLabel() : '') || '十二门徒',
    domains: [{ id: 'apostles-terrain', name: '十二门徒地形（地形线）' }],
    intro: '十二门徒地形管线：软坡（缓坡省 + 连续软坡顶面）与库地形色两个开关做成了能力。执行 = 算出候选开关组合并独立验证；预览 = 游戏带网址参数重载。不改默认、不写存档。',
    goalHint: '例如：岩体更柔和的缓坡，配色跟建筑同一套',
    scopeText: () => (sceneLabel?.() || '十二门徒') + ' · 9 块岩体',
    agentConfig: {
      experienceKey: 'apostles-terrain',
      transformUrl: new URL('./apostles-terrain/transform-worker.js?v=apt-r1', import.meta.url), verifyUrl: new URL('./apostles-terrain/verify-worker.js?v=apt-r1', import.meta.url),
      sceneId,
      timeouts: { scan: { idle: 30000, total: 90000 } },
      hooks: {
        input: async () => {
          const w = await stableState(); showLive(w);
          if (!w.ok) throw Error(w.reason);
          const site = await request('apostles.look.probe');
          if (!site?.ok) throw Error(site?.reason || '十二门徒采样失败');
          scanLook = paramOfLookId(site.look?.id);
          return site;
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site, steps }),
        verifyMsg: (site, scan, run) => ({ site, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),
        preview: async (c) => { const r = await switchLook(c.run.plan.look); return { ok: true, look: r.look }; },
        compare: (c, on) => switchLook(on ? scanLook : c.run.plan.look).catch((e) => status(e.message)),
        revert: () => switchLook(scanLook).catch((e) => status('切回原外观失败：' + e.message)),
        commit: (c) => {
          const row = { look: c.run.plan.look, lookId: c.run.plan.lookId, verify: c.verification?.status, at: Date.now(), note: '候选记录，不是默认；采用哪套见 PENDING「十二门徒采用哪套」' };
          try { localStorage.setItem(CHOICE_KEY, JSON.stringify(row)); } catch {}
          return Promise.resolve({ ok: true, note: `已在本机记下候选 ?apostlesLook=${row.look}（${CHOICE_KEY}）；没有设成默认，正常进游戏仍是认可现状。` });
        },
      },
    },
    preview: { root, onScan: () => {}, scanNote: (s) => { const m = s.matches || []; return m.length ? ` 软坡可作用岩体 ${m.find((x) => x.id === 'apostles.soft')?.count || 0} 块 · 配色可作用 ${m.find((x) => x.id === 'apostles.palette')?.count || 0} 块。` : ''; } },
    actions: { commitLabel: '✓ 记为候选（不改默认）', committed: (r) => r?.note || '已记下候选。' },
  });

  // ── R32 三套方案并排对照（整行宽，放在管线下面）────────────────────────
  const cmp = el('section', undefined, 'apt-compare'); cmp.id = 'apostles-compare'; cmp.setAttribute('aria-label', '十二门徒三套方案并排对照');
  host.append(cmp);
  let manifest = null;
  async function loadManifest() {
    try { const r = await fetch(new URL(MANIFEST_PATH, location.href).href + '?t=' + Date.now(), { cache: 'no-store' }); manifest = r.ok ? await r.json() : null; } catch { manifest = null; }
    renderCompare();
  }
  function renderCompare() {
    const model = buildComparison(manifest, { current: currentLook ? schemeOfLook(currentLook) : null });
    cmp.replaceChildren();
    const head = el('div', undefined, 'apt-compare-head');
    head.append(el('h3', '十二门徒 · 三套方案并排对照'), el('span', model.currentKnown ? '' : '（当前外观读取中…）', 'muted'));
    const reload = el('button', '刷新截图', 'small'); reload.type = 'button'; reload.onclick = () => loadManifest(); head.append(reload);
    cmp.append(head, el('p', model.note, 'muted apt-note'));
    const pend = el('p', undefined, 'apt-pending'); pend.append(el('b', '待你决定：'), el('span', `「${model.pending}」——三套都没有设成默认；看完下面的图和实景后告诉我采用哪一套（记录在 docs/PENDING_USER_DECISIONS.md）。不决定时游戏保持认可现状。`)); cmp.append(pend);
    const grid = el('div', undefined, 'apt-grid');
    for (const row of model.rows) {
      const card = el('article', undefined, 'apt-card' + (row.current ? ' current' : '')); card.dataset.scheme = row.id;
      const h = el('header'); h.append(el('b', row.name), el('code', '?apostlesLook=' + row.look));
      if (row.current) h.append(el('span', '● 实景当前', 'apt-badge'));
      const sw = el('button', row.current ? '实景已是这套' : '切到这套看实景', row.current ? 'small' : 'small primary'); sw.type = 'button'; sw.dataset.switch = row.id; sw.disabled = row.current || busySwitch;
      sw.onclick = () => switchLook(row.look).catch((e) => status('切换失败：' + e.message));
      h.append(sw);
      const shots = el('div', undefined, 'apt-shots');
      for (const s of row.shots) {
        const fig = el('figure', undefined, s.src ? (s.valid ? '' : 'invalid') : 'missing'); fig.dataset.view = s.view;
        if (s.src) { const img = el('img'); img.loading = 'lazy'; img.alt = row.name + ' · ' + s.label; img.src = s.src; const a = el('a'); a.href = s.src; a.target = '_blank'; a.append(img); fig.append(a); }
        else fig.append(el('div', '未拍', 'apt-empty'));
        fig.append(el('figcaption', s.label + (s.note ? ' · ' + s.note : ''))); shots.append(fig);
      }
      card.append(h, el('p', row.desc, 'muted'), shots, el('p', surfaceLine(row), 'apt-surface' + (row.regressions?.length ? ' worse' : '')));
      grid.append(card);
    }
    cmp.append(grid);
  }
  renderCompare(); loadManifest();
  // ── R-A5 按实测选优（P-R32-01）：三套各跑一遍检查打分，写登记推荐（不切默认外观），放在三套对照下面 ──
  mountMeasurePick({ host, request, switchLook, status, getRestoreParam: () => paramOfLookId(currentLook || scanLook || 'approved') });
  // 挂载后读一次实景状态（不阻塞扫描）
  stableState(180000).then(showLive).catch(() => {});
  return { ...view, switchLook, runChecks, loadManifest, get currentLook() { return currentLook; } };
}
