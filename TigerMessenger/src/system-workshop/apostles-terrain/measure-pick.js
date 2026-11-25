/**
 * measure-pick.js — R-A5 十二门徒「按实测选优」（docs/PENDING_USER_DECISIONS.md P-R32-01）。
 *
 * 三套方案 approved / soft / soft,palette 各实测一遍 apostles.look.checks 的 totals，
 * 按 scoreLook 打分选出缺陷最少的一套，写进 tm.defaults.v1 的 apostles:apostles-terrain 记录
 * （adoptedBy='auto-test'、source='measured'、status 仍是 pending-measurement——实测选出只是推荐，
 * 采用与否仍要用户在三套对照面板点头；planId 只是「实测推荐」）。
 *
 * 全部在工坊页面内完成：switchLook 走 ?apostlesLook= 重载（不写 tm.apostles.look.v1、不改存档），
 * 跑完恢复扫描前外观。不写任何存档。
 *
 * 纯逻辑（scoreLook / rankMeasurements / measuredView）与 DOM 挂载分开，Node 可单测。
 */
import { getDefault, setDefault, clearDefault, defaultStorage } from '../defaults.js?v=defaults-r2';
import { seedPendingDefaults } from '../pending-defaults.js?v=defaults-r2';
import { SCHEMES } from '../apostles-compare.js?v=apt-r1';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const fmtTime = (at) => { if (!at) return '时间未知'; const d = new Date(at); return Number.isNaN(d.getTime()) ? String(at) : d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }); };
const schemeName = (param) => SCHEMES.find((s) => s.look === param)?.name || param;

/** 实测顺序 = SCHEMES 顺序（approved → soft → soft,palette），同时是并列时的 tiebreak：改动小的优先。 */
export const MEASURE_ORDER = Object.freeze(SCHEMES.map((s) => s.look));

/**
 * scoreLook(totals) → { score, parts }，分数越低越好。
 * 权重理由（都来自 apostoles.look.checks 的 totals，口径一致可直接比）：
 *   - transparentRock ×1000：半透明岩体材质是材质检查的 fail 级硬伤，出现即大幅罚；
 *   - inverted ×10 / openEdges ×2：反面三角与开口边是水线以上可见破面，反面比开口边严重；
 *   - plantBad ×20：植被不贴地的抽样株数（plantBad 优先，否则 plants×plantBadShare 折算）；
 *   - foamUncoveredShare ×60 / foamStrayShare ×30：白沫检查两个比例（0–1），无白沫比白沫离岸更伤岸线观感。
 * 计数项与比例项量级不同但都落在「缺陷越少越好」的同一把尺上；精确权重不重要，并列交给 tiebreak。
 */
export function scoreLook(totals) {
  const t = totals || {};
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const plantBad = n(t.plantBad) || n(t.plants) * n(t.plantBadShare);
  const parts = {
    transparentRock: n(t.transparentRock) * 1000,
    inverted: n(t.inverted) * 10,
    openEdges: n(t.openEdges) * 2,
    plantBad: plantBad * 20,
    foamUncovered: n(t.foamUncoveredShare) * 60,
    foamStray: n(t.foamStrayShare) * 30,
  };
  const score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0) * 100) / 100;
  return { score, parts };
}

/**
 * rankMeasurements(rows) → 按 scoreLook 排序（升序），并列按 MEASURE_ORDER（改动小的在前）。
 * rows: [{ param, lookId?, totals?, status?, error? }]；没有 totals / 有 error 的行排在最后（不参与选优但保留展示）。
 */
export function rankMeasurements(rows) {
  const order = (param) => { const i = MEASURE_ORDER.indexOf(param); return i < 0 ? MEASURE_ORDER.length : i; };
  return (rows || []).map((r) => ({ ...r, eval: r.totals && !r.error ? scoreLook(r.totals) : null }))
    .sort((a, b) => {
      if (!!a.eval !== !!b.eval) return a.eval ? -1 : 1;
      if (a.eval && b.eval && a.eval.score !== b.eval.score) return a.eval.score - b.eval.score;
      return order(a.param) - order(b.param);
    });
}

/** 选出最优一行；全部失败返回 null。 */
export const pickBest = (rows) => rankMeasurements(rows).find((r) => r.eval) || null;

/** 一行实测结果的展示文案（工坊结果列表用）。 */
export function rowLine(r) {
  if (r.error) return `${schemeName(r.param)}（${r.param}）：实测失败 — ${r.error}`;
  if (!r.eval) return `${schemeName(r.param)}（${r.param}）：没有检查数据`;
  const t = r.totals || {};
  return `${schemeName(r.param)}（${r.param}）：得分 ${r.eval.score} · 反面三角 ${t.inverted ?? '?'} · 开口边 ${t.openEdges ?? '?'} · 半透明岩体 ${t.transparentRock ?? '?'} · 植物不贴地 ${((t.plantBadShare ?? 0) * 100).toFixed(1)}% · 无白沫 ${((t.foamUncoveredShare ?? 0) * 100).toFixed(1)}%`;
}

/**
 * measuredView(record) → { kind, text }。
 *   record 带 planId/plan.look（winner）→ 'winner'：实测选出 <look> · <时间> · <指标摘要（note）>
 *   pending-* 无 winner → 'pending'：待实测选出 · <pendingRef>
 *   无记录 → 'none'
 */
export function measuredView(record) {
  if (!record) return { kind: 'none', text: '还没有登记记录' };
  const look = record.planId || record.plan?.look || null;
  if (look) {
    const name = schemeName(look);
    return { kind: 'winner', look, at: record.at, note: record.note || '',
      text: `实测选出：${look === name ? look : `${name}（${look}）`} · ${fmtTime(record.at)}${record.note ? ' · ' + record.note : ''}` };
  }
  const pend = record.status === 'pending-measurement' ? '待实测选出' : '待决定';
  return { kind: 'pending', text: `${pend}${record.pendingRef ? ' · ' + record.pendingRef : ''}` };
}

/**
 * 挂载「按实测选优」区块（放在三套对照附近）。opts:
 *   host, storage?, request(action,payload)→Promise, switchLook(param)→Promise, getRestoreParam()→param,
 *   status(text)→void, nameOf?（不用，方案名走 SCHEMES）
 */
export function mountMeasurePick({ host, storage, request, switchLook, getRestoreParam = () => 'approved', status = () => {} } = {}) {
  if (!host || typeof request !== 'function' || typeof switchLook !== 'function') return null;
  const st = storage || defaultStorage();
  seedPendingDefaults(st); // 幂等：保证 apostles:apostles-terrain 有 pending-measurement 追踪记录

  const root = el('section', undefined, 'apt-measure'); root.id = 'apostles-measure-pick';
  root.setAttribute('aria-label', '十二门徒按实测选优');
  const head = el('div', undefined, 'apt-compare-head');
  head.append(el('h3', '按实测选出'), el('span', '（P-R32-01：三套各跑一遍破面 / 植被 / 白沫检查，分数低的当选；只写登记推荐，不切换游戏默认外观）', 'muted'));
  const stateLine = el('p', '', 'apt-measure-state'); stateLine.dataset.measureState = 'pending';
  const btnRow = el('div', undefined, 'du-row');
  const runBtn = el('button', '跑实测选出', 'small primary'); runBtn.type = 'button'; runBtn.dataset.measureRun = '1';
  const undoBtn = el('button', '撤销实测选择', 'small'); undoBtn.type = 'button'; undoBtn.dataset.measureUndo = '1';
  btnRow.append(runBtn, undoBtn);
  const list = el('ol', undefined, 'apt-measure-results'); list.dataset.measureResults = '1';
  const note = el('p', '', 'muted apt-note');
  root.append(head, stateLine, btnRow, list, note);
  host.append(root);

  let running = false, lastRows = [];
  // 断点续跑：逐套测量每步写 localStorage 草稿，页面崩了重进工坊自动从未完成的那套继续（渲染进程崩了实测会发生）。
  const SCRATCH = 'tm.apt.measure.v1';
  const saveScratch = (o) => { try { localStorage.setItem(SCRATCH, JSON.stringify(o)); } catch {} };
  const readScratch = () => { try { const o = JSON.parse(localStorage.getItem(SCRATCH) || 'null'); return o?.running ? o : null; } catch { return null; } };
  const dropScratch = () => { try { localStorage.removeItem(SCRATCH); } catch {} };

  function draw() {
    const v = measuredView(getDefault(st, 'apostles', 'apostles-terrain'));
    stateLine.textContent = v.text;
    stateLine.dataset.measureState = v.kind;
    undoBtn.disabled = running || !(v.kind === 'winner');
    list.replaceChildren(...lastRows.map((r) => { const li = el('li', rowLine(r)); if (r.eval) li.dataset.score = String(r.eval.score); return li; }));
  }

  /** 实测主循环：fromIdx 起跑，rows 沿用已测结果（续跑时传入草稿里的行）。 */
  async function runFlow(fromIdx = 0, rows = [], restoreParam = null, attempts = {}) {
    if (running) return;
    running = true; runBtn.disabled = true; undoBtn.disabled = true;
    lastRows = rows;
    const restore = restoreParam || getRestoreParam();
    try {
      status('按实测选出：依次切 approved → soft → soft,palette，每套等网格稳定后跑破面 / 植被 / 白沫检查（每次切换都要重载游戏，约几分钟）…');
      for (let i = fromIdx; i < SCHEMES.length; i++) {
        const s = SCHEMES[i];
        if ((attempts[s.id] = (attempts[s.id] || 0) + 1) > 2) { const row = { param: s.look, scheme: s.id, error: '连续两次页面崩溃，跳过这套' }; lastRows.push(row); draw(); continue; }
        const row = lastRows.find((r) => r.scheme === s.id) || { param: s.look, scheme: s.id };
        if (!lastRows.includes(row)) lastRows.push(row);
        delete row.error; draw();
        status(`按实测选出：切到「${s.name}」并检查…（第 ${attempts[s.id]} 次尝试）`);
        saveScratch({ running: true, idx: i, rows: lastRows, restoreParam: restore, attempts });
        try {
          await switchLook(s.look);
          const r = await request('apostles.look.checks');
          if (!r?.ok || !r.totals) throw Error(r?.reason || '检查失败');
          row.totals = r.totals; row.lookId = r.look?.id || ''; row.checkStatus = r.status;
        } catch (e) { row.error = e?.message || String(e); }
        draw();
      }
      dropScratch(); // 量完即清草稿：后面的恢复外观若崩页不该再续跑
      const ranked = rankMeasurements(lastRows), best = ranked.find((r) => r.eval) || null;
      if (!best) { status('按实测选出：三套都没测出数据，登记保持「待实测选出」。'); draw(); return; }
      const noteText = '按实测选出：' + ranked.filter((r) => r.eval).map((r) => `${r.param}=${r.eval.score}`).join(' / ') + '（分数越低越好；并列取改动小的）';
      setDefault(st, 'apostles', 'apostles-terrain', {
        capabilityId: 'apostles.look', planId: best.param,
        plan: { look: best.param, lookId: best.lookId || null, scores: Object.fromEntries(ranked.filter((r) => r.eval).map((r) => [r.param, r.eval.score])) },
        adoptedBy: 'auto-test', source: 'measured',
        status: 'pending-measurement', pendingRef: 'P-R32-01',
        note: noteText,
      });
      status(`按实测选出：${schemeName(best.param)}（${best.param}）得分最低 ${best.eval.score}。已写入登记推荐——采用与否仍需你在三套对照面板点头；游戏外观已切回原样。`);
    } catch (e) {
      status('按实测选出失败：' + (e?.message || e));
    } finally {
      // 恢复扫描前外观（尽力而为；失败如实提示，不写存档）
      try { await switchLook(restore); } catch (e) { status('恢复原外观失败：' + (e?.message || e) + '——可在对照面板手动切回。'); }
      running = false; runBtn.disabled = false; draw();
    }
  }

  runBtn.onclick = () => runFlow();
  // 上次实测中途崩页：重进工坊自动从未完成的那套续跑（attempts 限每套两次，防崩溃循环）。
  const resume = readScratch();
  if (resume) { status('检测到上次实测中断（第 ' + (resume.idx + 1) + ' 套起）——自动续跑。'); runFlow(resume.idx, resume.rows || [], resume.restoreParam, resume.attempts || {}); }

  undoBtn.onclick = async () => {
    undoBtn.disabled = true;
    try {
      clearDefault(st, 'apostles', 'apostles-terrain');
      seedPendingDefaults(st); // 恢复「待实测选出」追踪记录
      lastRows = []; status('已撤销实测选择：登记回到「待实测选出」，游戏外观不受影响。');
    } finally { draw(); }
  };

  draw();
  return { root, refresh: draw, scoreLook, rankMeasurements };
}
