/**
 * seed-report-panel.js — 多种子分布面板（R62，Guide §1.4 创新 6「看分布，不看单张」）：tier-workshop 每一层的侧栏里一块小面板。
 *   opt-in：层登记在 seed-layers.js 的 LAYERS 里才出现（tier-workshop 的 seedReport 默认 'auto' = 按登记表；false = 关；对象 = 显式给 layer / input）。
 *   山形层 R28 已有实景 30 种子面板（山形验收台），auto 时这里不重复出。
 *   「跑 N 个种子」在 Worker（seed-report-worker.js）里逐个算、逐个回传，页面不卡；完了给每项指标的分布（min / p10 / 中位 / p90 / max + 10 档直方图）
 *   和最好 / 最典型 / 最差三个种子。跑不了的层（体素场景层）面板写 NOT_RUN 与原因。
 *   命令行报告（tools/refactor/seed-report.mjs 写的 artifacts/seed-report/<层>/latest.json）存在时，面板顶上并排一句摘要，标明是 Node 跑的。
 * 不写浏览器本地存储、不改任何场景数据：分布只是看。
 */
import { seedLayerFor } from './seed-layers.js?v=seeds-r61';
import { formatMetric, summarizeReport, DEFAULT_SEED_COUNT } from './seed-report.js?v=seeds-r61';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const CSS = `.seed-panel{border:1px solid var(--line,#d8d3c6);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--panel,#fbfaf6)}
.seed-panel h4{margin:0 0 4px}.seed-panel .seed-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
.seed-panel input[type=number]{width:4.5em}.seed-panel table{width:100%;border-collapse:collapse;font-size:12px}
.seed-panel td,.seed-panel th{padding:2px 4px;border-bottom:1px solid var(--line,#e6e1d4);text-align:right}.seed-panel td:first-child,.seed-panel th:first-child{text-align:left}
.seed-hist{display:inline-flex;gap:1px;align-items:flex-end;height:18px;vertical-align:middle}.seed-hist i{display:inline-block;width:5px;background:#7f9c6a;min-height:1px}
.seed-picks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.seed-picks div{border:1px solid var(--line,#e6e1d4);border-radius:8px;padding:4px 6px;font-size:12px}
.seed-picks b{display:block}.seed-panel[data-state=not-run] .seed-note{color:#a05a2c}.seed-panel .seed-node{font-size:12px;color:#6b6b6b}`;
function ensureCss() { if (document.getElementById('seed-report-css')) return; const s = document.createElement('style'); s.id = 'seed-report-css'; s.textContent = CSS; document.head.append(s); }

/** 要不要挂（纯逻辑，单元测试用）：没登记 → 不挂；auto 时自带分布面板的层（山形 R28）→ 不挂；其余挂（含 NOT_RUN 层：面板写原因）。 */
export function seedPanelDecision({ key, explicit = false } = {}) {
  const L = seedLayerFor(key);
  if (!L) return { mount: false, reason: '这一层没有登记分布适配器' };
  if (!explicit && L.ownPanel) return { mount: false, reason: L.ownPanel };
  return { mount: true, reason: L.notRun ? 'NOT_RUN：' + L.notRun : '已登记' };
}
/** 按登记表决定要不要挂；返回面板或 null。 */
export function maybeMountSeedPanel({ host, key, input = null, explicit = false } = {}) {
  if (!host || !seedPanelDecision({ key, explicit }).mount) return null;
  return mountSeedReportPanel({ host, layer: key, input });
}

export function mountSeedReportPanel({ host, layer, input = null }) {
  ensureCss();
  const L = seedLayerFor(layer), root = el('section', undefined, 'seed-panel');
  root.id = 'seed-report-' + layer; root.dataset.seedLayer = layer; root.dataset.state = L?.notRun ? 'not-run' : 'idle';
  const head = el('h4', '多种子分布 · ' + (L?.label || layer));
  const meta = el('p', L?.notRun ? 'NOT_RUN：' + L.notRun : `种子含义：${L?.seedMeaning || '—'}；输入：${input ? '实景采样（当前场景）/ 未连上时用 ' : ''}${L?.inputLabel || '—'}`, 'muted seed-note');
  const node = el('p', '', 'seed-node'); node.hidden = true;
  const row = el('div', undefined, 'seed-row'), cnt = el('input'); cnt.type = 'number'; cnt.min = 3; cnt.max = 60; cnt.value = DEFAULT_SEED_COUNT; cnt.setAttribute('aria-label', '种子个数');
  const go = el('button', `跑 ${DEFAULT_SEED_COUNT} 个种子`, 'small'); go.type = 'button'; go.dataset.seedRun = layer;
  const prog = el('small', '', 'muted'); cnt.oninput = () => { go.textContent = `跑 ${cnt.value} 个种子`; };
  row.append(cnt, go, prog);
  const table = el('table'), picks = el('div', undefined, 'seed-picks');
  root.append(head, meta, node);
  if (!L?.notRun) root.append(row, table, picks);
  host.append(root);
  // 命令行（Node）报告：只在用户真的点「跑种子」时探一次。页面加载即探测会在没有
  // artifacts/seed-report/<层>/latest.json 的环境（公网 Pages 不发布 artifacts）里背一个 404，
  // 而这条摘要本来就是可选信息。
  let nodeProbed = false;
  function probeNodeReport() {
    if (nodeProbed) return;
    nodeProbed = true;
    fetch(new URL(`../../artifacts/seed-report/${layer}/latest.json`, import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((r) => { if (!r) return; node.hidden = false; node.textContent = `命令行报告（Node，${r.at ? new Date(r.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '时间未知'}）：${summarizeReport(r)}`; root.dataset.nodeReport = r.status; }).catch(() => {});
  }
  go.addEventListener('click', probeNodeReport, { once: true });
  let worker = null, runId = 0;
  function draw(report) {
    table.replaceChildren(); picks.replaceChildren();
    if (report.status === 'NOT_RUN') { root.dataset.state = 'not-run'; meta.textContent = 'NOT_RUN：' + report.reason; return; }
    const tr = el('tr'); for (const h of ['指标', '最小', 'p10', '中位', 'p90', '最大', '分布']) tr.append(el('th', h)); table.append(tr);
    for (const m of report.metrics) {
      const d = report.distribution[m.key], r = el('tr'); r.dataset.metric = m.key;
      r.append(el('td', m.label + (m.better === 'higher' ? ' ↑' : m.better === 'lower' ? ' ↓' : '')));
      for (const k of ['min', 'p10', 'median', 'p90', 'max']) r.append(el('td', d ? formatMetric(m, d[k]) : '—'));
      const hc = el('td'), hist = el('span', undefined, 'seed-hist'), top = d ? Math.max(...d.bins, 1) : 1;
      for (const b of d?.bins || []) { const bar = el('i'); bar.style.height = Math.max(1, Math.round(b / top * 18)) + 'px'; bar.title = b + ' 个'; hist.append(bar); }
      hc.append(hist); r.append(hc); table.append(r);
    }
    for (const [k, name] of [['best', '最好'], ['typical', '最典型'], ['worst', '最差']]) {
      const s = report.pick[k], rowK = report.rows.find((x) => x.seed === s), box = el('div'); box.dataset.pick = k; box.dataset.seed = s ?? '';
      box.append(el('b', `${name} · 种子 ${s ?? '—'}`), el('span', rowK ? `分数 ${rowK.score} · ${rowK.status}` : '没有'));
      picks.append(box);
    }
    Object.assign(root.dataset, { state: 'done', count: String(report.count), passed: String(report.passed), best: String(report.pick.best ?? ''), typical: String(report.pick.typical ?? ''), worst: String(report.pick.worst ?? '') });
    prog.textContent = summarizeReport(report);
  }
  async function run() {
    if (L?.notRun) return null;
    const count = Math.max(3, Math.min(60, Number(cnt.value) || DEFAULT_SEED_COUNT)), my = ++runId;
    worker?.terminate(); worker = new Worker(new URL('./seed-report-worker.js?v=seeds-r62', import.meta.url), { type: 'module' });
    let live = null; try { live = typeof input === 'function' ? await input() : input; } catch { live = null; }
    root.dataset.state = 'running'; go.disabled = true; prog.textContent = `0 / ${count}`;
    return new Promise((resolve) => {
      let n = 0;
      worker.onmessage = ({ data }) => {
        if (data.runId !== my) return;
        if (data.row) { n++; prog.textContent = `${n} / ${count} · 种子 ${data.row.seed}：${data.row.status}`; return; }
        go.disabled = false;
        if (data.error) { root.dataset.state = 'error'; prog.textContent = '分布没跑完：' + data.error; resolve(null); return; }
        draw(data.report); worker.terminate(); worker = null; resolve(data.report);
      };
      worker.onerror = (e) => { go.disabled = false; root.dataset.state = 'error'; prog.textContent = 'Worker 出错：' + (e.message || e); resolve(null); };
      worker.postMessage({ runId: my, layer, count, input: live || null });
    });
  }
  go.onclick = () => { run(); };
  return { root, run, get state() { return root.dataset.state; } };
}
