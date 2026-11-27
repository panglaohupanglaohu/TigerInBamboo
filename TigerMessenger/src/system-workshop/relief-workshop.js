/**
 * 地貌管线工坊（R41–R50）：系统工坊「场景管线」页里一直在（不依赖当前场景），面板 #relief-workshop。
 *   管线：relief.soft / cliff / valley / overhang / ledge / passes 六个可执行能力（地形线），扫描后自动预装（R22 auto-preload），▶ 一键执行。
 *   输入两种：擂台岛（固定种子 20261123，不需要游戏）/ 实景场景（默认旧港湾 old-port，可选苔庭 moss）——扫描 = 游戏里 relief.probe 采样。
 *   预览：实景时游戏里藏原地形、贴候选网格 + 岩檐 + 梯子 / 等高线（relief.preview）；对照 = 看原样；放弃 = 拆掉候选回原样。
 *   「✓ 记为候选（不改默认）」只在本机写一条 tm.relief.candidate.v1；不写存档、不设默认、不碰湖上建筑。
 *   下方「对照与擂台」：六条线的原版对照（catalog/parity/relief.*.json）+ 擂台（catalog/arena/relief.*.json）登记，可以在本页实算。
 *   直达：pipeline.html?relief=old-port#scene（或 ?relief=moss / ?relief=arena）。
 *   用不用这套地形要用户点头：docs/PENDING_USER_DECISIONS.md P-R49-01。
 */
import { describeReliefCapabilities } from './relief/capabilities.js?v=relief-r2';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r2';
import { arenaSite, METRIC_NAMES } from './terrain/arena-generic.js?v=relief-r1';
import { thumbPixels, evidenceRows, directEntry, RELIEF_IDS, SCENE_LABEL } from './relief/panel-model.js?v=relief-r1';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const button = (text, fn, cls = 'small') => { const b = el('button', text, cls); b.type = 'button'; b.onclick = () => fn(b); return b; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CAND_KEY = 'tm.relief.candidate.v1';
const CATALOG = new URL('../scene-authoring/catalog/', import.meta.url).href;

function ensureCss() {
  if (document.getElementById('relief-css')) return;
  const l = document.createElement('link'); l.id = 'relief-css'; l.rel = 'stylesheet'; l.href = new URL('./relief.css?v=relief-r1', import.meta.url).href; document.head.append(l);
}

export function mountReliefWorkshop({ host, request, isConnected = () => true, openSource, status = () => {} }) {
  if (!host) return null;
  ensureCss();
  const caps = describeReliefCapabilities(), direct = directEntry(location.search);
  let mode = direct?.mode || 'arena', target = direct?.mode === 'game' ? direct.scene : 'old-port', lastSite = null, lastPlan = null, gamePreview = false;
  host.dataset.mode = mode; if (direct) host.dataset.direct = direct.scene;

  // ── 头部：输入选择 ───────────────────────────────────────────────
  const head = el('div', undefined, 'rl-head'); head.append(el('h3', '地貌管线 · 软坡 + 硬崖 + 河谷 + 悬垂 + 薄台攀爬 + 三遍等高线'), el('span', 'R41–R50 · 候选，不改默认', 'muted'));
  const input = el('div', undefined, 'rl-input'), sel = el('select'); sel.id = 'relief-input';
  for (const [v, t] of [['arena', '擂台岛（固定种子，不需要游戏）'], ['old-port', '实景：旧港湾'], ['moss', '实景：苔庭']]) { const o = el('option', t); o.value = v; sel.append(o); }
  sel.value = mode === 'arena' ? 'arena' : target;
  const inputNote = el('span', '', 'muted'); inputNote.id = 'relief-input-note';
  sel.onchange = () => { mode = sel.value === 'arena' ? 'arena' : 'game'; if (mode === 'game') target = sel.value; host.dataset.mode = mode; renderInput(); view.renderScope?.(); };
  input.append(el('label', '输入：'), sel, inputNote);
  const main = el('div', undefined, 'rl-main'), left = el('div'), side = el('div'); main.append(left, side);
  host.replaceChildren(head, input, main);
  function renderInput() { inputNote.textContent = mode === 'arena' ? '擂台岛 61×61 格、3 m 一格，中间一座「城」+ 一条「轨道」是保护格。' : `扫描会先把实景切到「${SCENE_LABEL[target]}」再采样（只换镜头，不改场景）；预览时原地形只隐藏不删除。`; }
  renderInput();

  // ── 缩略图：原样 vs 候选 ─────────────────────────────────────────
  const thumbs = el('div', undefined, 'rl-thumbs'); thumbs.id = 'relief-thumbs';
  const figBefore = el('figure'), figAfter = el('figure'), cvB = el('canvas'), cvA = el('canvas'), capB = el('figcaption', '原样：扫描后显示'), capA = el('figcaption', '候选：▶ 执行后显示');
  cvB.dataset.thumb = 'before'; cvA.dataset.thumb = 'after'; figBefore.append(cvB, capB); figAfter.append(cvA, capA); thumbs.append(figBefore, figAfter);
  const legend = el('p', '图例：蓝 = 河格 · 浅蓝 = 湖 · 深色短线 = 岩檐（悬垂）· 棕 = 梯子 · 黄 = 等高线（层界格边）· 灰 = 保护格（建筑 / 轨道）。俯视晕渲，不是三维效果。', 'rl-legend');
  function draw(cv, site, plan) { const img = thumbPixels(site, plan, { scale: site.n > 80 ? 2 : 4 }); cv.width = img.width; cv.height = img.height; cv.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0); }
  const metricLine = (m) => m ? Object.entries(METRIC_NAMES).filter(([k]) => m[k] != null).map(([k, name]) => `${name} ${typeof m[k] === 'number' && m[k] <= 1 && k !== 'hardEdge' && k !== 'pits' ? (m[k] * 100).toFixed(1) + '%' : m[k]}`).join(' · ') : '';

  async function focusScene(id) {
    const s = document.getElementById('scene');
    if (s && s.value !== id && [...s.options].some((o) => o.value === id)) { s.value = id; s.dispatchEvent(new Event('change')); await sleep(2500); return true; }
    if (s && ![...s.options].some((o) => o.value === id)) { await request('scenes.focus', { id }); await sleep(2500); }
    return false;
  }

  // ── 管线（通用 tier-workshop）────────────────────────────────────
  const view = mountTierWorkshop({
    host: left, sideHost: side, tier: 'relief', sideTier: 'relief', storageKey: 'relief', caps, openSource, status, autoPreload: true,
    sceneLabel: () => (mode === 'arena' ? '擂台岛' : SCENE_LABEL[target]),
    domains: [{ id: 'relief', name: '地貌管线（地形线）' }],
    intro: '地貌管线：六个能力按 软坡 → 硬崖 → 河谷 → 悬垂 → 薄台攀爬 → 三遍 的顺序在采样的私有副本上算候选，另一个 Worker 独立复算检查。实景预览只隐藏原地形，不改默认、不写存档。',
    goalHint: '例如：有软坡也有硬崖的山，带河谷和岩檐，崖之间能爬上去',
    scopeText: () => (mode === 'arena' ? '擂台岛 #20261123（61×61 格）' : `${SCENE_LABEL[target]}（实景采样 ${lastSite?.n ? lastSite.n + '×' + lastSite.n + ' 格' : '扫描后知道'}）`),
    agentConfig: {
      experienceKey: 'relief',
      transformUrl: new URL('./relief/transform-worker.js?v=relief-r1', import.meta.url), verifyUrl: new URL('./relief/verify-worker.js?v=relief-r2', import.meta.url),
      sceneId: () => (mode === 'arena' ? 'arena' : target),
      timeouts: { scan: { idle: 60000, total: 120000 } },
      hooks: {
        input: async () => {
          if (mode === 'arena') { lastSite = arenaSite(); }
          else {
            if (!isConnected()) throw Error('游戏还没连上：等「游戏已连接」后再扫描实景，或者先用擂台岛');
            await focusScene(target);
            const s = await request('relief.probe', { id: target });
            if (!s?.ok) throw Error(s?.reason || '实景采样失败');
            lastSite = s; status(`${s.label}：采样 ${s.n}×${s.n} 格（${s.cell} m）· 陆地 ${s.audit.land} 格 · 保护格 ${s.audit.protected} · 地形网格 ${s.audit.terrainMeshes} 个${s.revertedPreview ? '（之前的候选已先拆掉）' : ''}`);
          }
          draw(cvB, lastSite, null); capB.textContent = `原样：${lastSite.label}`; host.dataset.scanned = lastSite.scene;
          return lastSite;
        },
        scanMsg: (site) => ({ site }),
        runMsg: (site, steps) => ({ site, steps }),
        verifyMsg: (site, scan, run) => ({ site, plan: run.plan, steps: run.report.map((r) => ({ id: r.id, params: r.params })) }),
        preview: async (c) => {
          lastPlan = c.run.plan; draw(cvA, lastSite, lastPlan);
          capA.textContent = `候选：${(lastPlan.applied || []).length} 步 · ${metricLine(c.verification?.metrics)}`; host.dataset.previewed = '1';
          if (mode === 'game') {
            const r = await request('relief.preview', { id: target, plan: lastPlan });
            if (!r?.ok) throw Error(r?.reason || '实景预览失败');
            gamePreview = true; host.dataset.gamePreview = r.mode;
            status(`${r.label}：候选已贴上（${r.mode === 'replace' ? '原地形已隐藏' : r.mode === 'partial' ? '部分原地形隐藏' : '叠加模式：原地形太大没有隐藏'}）· ${r.stats.triangles} 三角 · 岩檐 ${r.stats.lips} · 梯子 ${r.stats.ladderSegs ? (lastPlan.ladders || []).length : 0}`);
            return { ok: true, mode: r.mode };
          }
          return { ok: true, mode: 'thumbnail' };
        },
        compare: (c, on) => { if (mode === 'game' && gamePreview) return request('relief.compare', { on }).catch((e) => status(e.message)); draw(cvA, lastSite, on ? null : c.run.plan); return null; },
        revert: async () => { lastPlan = null; delete host.dataset.previewed; const ctx = cvA.getContext('2d'); ctx.clearRect(0, 0, cvA.width, cvA.height); capA.textContent = '候选：已放弃'; if (gamePreview) { gamePreview = false; delete host.dataset.gamePreview; await request('relief.revert').catch((e) => status('拆候选失败：' + e.message)); } },
        commit: (c) => {
          const row = { scene: c.run.plan.scene, applied: c.run.plan.applied, verify: c.verification?.status, at: Date.now(), note: '候选记录，不是默认；用不用见 PENDING P-R49-01' };
          try { localStorage.setItem(CAND_KEY, JSON.stringify(row)); } catch {}
          return Promise.resolve({ ok: true, note: `已在本机记下候选（${CAND_KEY}）；没有设成默认，正常进游戏仍是原地形。` });
        },
      },
    },
    preview: { root: el('div'), onScan: () => {}, scanNote: (s) => { const m = s.matches || []; return m.length ? ` 可改陆地 ${m[0]?.targets?.[0]?.count ?? 0} 格。` : ''; } },
    actions: { commitLabel: '✓ 记为候选（不改默认）', committed: (r) => r?.note || '已记下候选。' },
  });
  left.append(thumbs, legend);

  // ── 实景：切场景 / 机位 / 对照 / 拆回（R49 直达）──────────────────
  const scene = el('section', undefined, 'rl-scene'); scene.id = 'relief-scene';
  const sceneState = el('p', '实景候选：没有', 'muted'); sceneState.id = 'relief-scene-state';
  const rowA = el('div', undefined, 'row'), rowB = el('div', undefined, 'row');
  const refresh = async () => { if (!isConnected()) { sceneState.textContent = '实景候选：游戏未连接'; return null; } try { const s = await request('relief.state'); sceneState.textContent = s.active ? `实景候选：${s.label} · ${s.previewing ? (s.comparing ? '正在看原样' : '正在看候选') : '只采样了'}（${s.mode || '—'}，隐藏原地形网格 ${s.hiddenMeshes} 个，岩檐 ${s.lips}，梯子 ${s.ladders}）` : '实景候选：没有（游戏里是原地形）'; sceneState.dataset.active = s.active ? (s.comparing ? 'original' : 'candidate') : 'none'; return s; } catch (e) { sceneState.textContent = '实景状态没读到：' + e.message; return null; } };
  rowA.append(
    button('在旧港湾上试（切场景 + 扫描）', async () => { sel.value = 'old-port'; sel.onchange(); await view.scan(); refresh(); }, 'small primary'),
    button('在苔庭上试', async () => { sel.value = 'moss'; sel.onchange(); await view.scan(); refresh(); }),
    button('回到擂台岛', () => { sel.value = 'arena'; sel.onchange(); }),
  );
  rowB.append(
    button('看候选', async () => { await request('relief.compare', { on: false }).catch((e) => status(e.message)); refresh(); }),
    button('看原样', async () => { await request('relief.compare', { on: true }).catch((e) => status(e.message)); refresh(); }),
    button('拆掉候选（回原样）', async () => { gamePreview = false; await request('relief.revert').catch((e) => status(e.message)); refresh(); }),
    ...['oblique', 'top', 'side'].map((v) => button({ oblique: '机位：斜看', top: '机位：俯视', side: '机位：侧面' }[v], () => request('relief.view', { id: target, view: v }).catch((e) => status(e.message)))),
  );
  const pend = el('p', undefined, 'rl-pending'); pend.append(el('b', '待你决定：'), el('span', 'P-R49-01「旧港湾要不要换成地形管线做的地形」——现在只是候选，没有设成默认；看完候选 / 原样对照再告诉我（docs/PENDING_USER_DECISIONS.md）。不决定时游戏保持原地形。'));
  scene.append(el('h4', '实景候选（圣城之外的场景）'), sceneState, rowA, rowB, pend);
  left.append(scene);

  // ── 对照与擂台（R41 / R47）──────────────────────────────────────
  const ev = el('section'); ev.id = 'relief-evidence';
  const evHead = el('div', undefined, 'rl-head'); evHead.append(el('h4', '地貌枝 · 原版对照（④）与擂台（⑦）'), el('span', '登记由 tools/refactor/record-relief-evidence.mjs 实算写入；本页按钮只在本页算，不写文件', 'muted'));
  const table = el('table', undefined, 'rl-evidence'); table.id = 'relief-evidence-table';
  const evNote = el('p', '', 'muted');
  let regs = { parity: {}, arena: {} }, live = { parity: {}, arena: {} };
  async function loadRegs() {
    const get = async (p) => { try { const r = await fetch(CATALOG + p + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } };
    for (const id of RELIEF_IDS) { regs.parity[id] = await get('parity/' + id + '.json'); regs.arena[id] = await get('arena/' + id + '.json'); }
    renderEvidence();
  }
  function renderEvidence() {
    const rows = evidenceRows(regs.parity, regs.arena), name = new Map(caps.map((c) => [c.id, c.name]));
    table.replaceChildren();
    const tr = el('tr'); for (const t of ['能力', '原版', '④ 对照登记', '本页实算对照', '⑦ 擂台登记', '本页实算擂台']) tr.append(el('th', t)); table.append(tr);
    for (const r of rows) {
      const row = el('tr'); row.dataset.cap = r.id;
      const lp = live.parity[r.id], la = live.arena[r.id];
      const cls = (s) => (s === 'measured' || s === 'won' ? 'ok' : s === 'lost' || s === 'unregistered' ? 'bad' : 'na');
      row.append(el('td', `${name.get(r.id) || r.id}（${r.id}）`), el('td', (r.original || '').replace('townscaper-web/REACode/', '')), el('td', r.parityText, cls(r.parity)),
        el('td', lp ? (lp.error ? '出错：' + lp.error : lp.verdict === 'unregistered' ? `有 ${lp.unregisteredCount} 条没登记的差异（例：${lp.unregistered[0]?.path}）` : lp.verdict === 'equivalent' ? '一致' : `差异都已登记（${lp.total} 处）`) : '—', lp ? (lp.error || lp.verdict === 'unregistered' ? 'bad' : 'ok') : 'na'),
        el('td', r.arenaText, cls(r.arena)), el('td', la ? (la.error ? '出错：' + la.error : la.judge.why) : '—', la ? (la.error || !la.pass ? 'bad' : 'ok') : 'na'));
      table.append(row);
    }
  }
  const runParity = button('在本页实算对照（原版 vs 重构）', async (b) => {
    b.disabled = true; evNote.textContent = '对照中：每条线原版跑一遍、重构库跑一遍…';
    try { const [{ PARITY_CASES }, { runParityCase }] = await Promise.all([import('./terrain/parity-cases.js?v=relief-r1'), import('./terrain/parity.js?v=relief-r1')]);
      for (const c of PARITY_CASES) { try { live.parity[c.id] = await runParityCase(c, regs.parity[c.id]); } catch (e) { live.parity[c.id] = { error: e.message }; } renderEvidence(); await sleep(30); }
      evNote.textContent = '对照完成（本页实算，没有写登记表）。'; ev.dataset.parityRun = '1';
    } finally { b.disabled = false; }
  });
  const runArenaB = button('在本页跑擂台（加这一代 vs 不加）', async (b) => {
    b.disabled = true; evNote.textContent = '擂台：固定种子测试岛，每个能力跑两遍…';
    try { const { runArena } = await import('./relief/arena.js?v=relief-r1');
      for (const id of RELIEF_IDS) { try { live.arena[id] = runArena(id); } catch (e) { live.arena[id] = { error: e.message }; } renderEvidence(); await sleep(30); }
      evNote.textContent = '擂台完成（本页实算，没有写登记表）。'; ev.dataset.arenaRun = '1';
    } finally { b.disabled = false; }
  });
  runParity.id = 'relief-run-parity'; runArenaB.id = 'relief-run-arena';
  const evBtns = el('div', undefined, 'row'); evBtns.append(runParity, runArenaB, button('刷新登记', () => loadRegs()));
  ev.append(evHead, evBtns, table, evNote);
  left.append(ev);
  loadRegs(); refresh();

  // 直达：?relief=old-port → 滚到面板、等游戏连上、切场景、扫描
  if (direct) {
    host.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (direct.mode === 'game') (async () => { for (let i = 0; i < 900 && !isConnected(); i++) await sleep(400); if (!isConnected()) return status('直达地貌管线：游戏没有连上'); for (let i = 0; i < 60 && !document.querySelector(`#scene option[value="${direct.scene}"]`); i++) await sleep(1000); try { await view.scan(); refresh(); } catch (e) { status('直达扫描失败：' + e.message); } })();
    else view.scan();
  }
  return { ...view, refresh, loadRegs, get mode() { return mode; }, get lastPlan() { return lastPlan; } };
}
