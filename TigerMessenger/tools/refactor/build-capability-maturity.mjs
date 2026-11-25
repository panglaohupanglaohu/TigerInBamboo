/**
 * build-capability-maturity.mjs — R23 九级成熟度（Guide §1.4 创新 4）：按证据文件给每个可执行能力定级，
 * 写 src/scene-authoring/catalog/capability-maturity.json（能力树、左栏、「最近新增」栏都读它）。
 *
 *   cd TigerMessenger && $NODE tools/refactor/build-capability-maturity.mjs            写 json
 *   cd TigerMessenger && $NODE tools/refactor/build-capability-maturity.mjs --stdout   只打印分布与计数表
 *
 * Guide §5.2 的第 ⑦ 步，放在 ⑥ export-learn-queue 之后。输出路径按仓库根算（不随当前目录漂），但按规矩仍在 TigerMessenger 目录里跑。
 *
 * 级别规则与证据位置见 REACodeRefactoring/src/core/capability-maturity.js 文件头。这里只做两件事：
 *   1. 收集：对每个能力找出每一级的候选证据路径（找不到就是 null）；
 *   2. 校验：makeVerifier 重新检查每条路径（文件在、锚点在、json 内容对），通不过的那一级不算 —— 证据被删或被改，级别当场掉下去。
 * 能力全集 = 页面口径（studio.js 的 getExecutables：场景管线 editor / live / code 节点 + 六个工坊层）∪ 脚本口径（computeLineage 的清单），按 ID 去重。
 * 不读浏览器本机数据（执行经验、采用记录）：要算进 ⑧，先把采用导出进 catalog/adoptions.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLineage, collectExecutables } from './build-capability-lineage.mjs';
import { buildCapabilityLineage } from '../../../townscaper-web/REACodeRefactoring/src/core/capability-lineage.js';
import { buildCapabilityTree } from '../../../townscaper-web/REACodeRefactoring/src/core/capability-tree.js';
import { decideMaturity, summarizeMaturity, lineMaturity, buildCountTable, MATURITY_LEVELS, PARITY_VERDICTS, E2E_DIR_LAYER } from '../../../townscaper-web/REACodeRefactoring/src/core/capability-maturity.js';
import { describeCapabilities } from '../../../townscaper-web/REACodeRefactoring/src/capabilities/registry.js';
import { describeObjectCapabilities } from '../../src/system-workshop/object/capabilities.js';
import { describeGsceneCapabilities } from '../../src/system-workshop/gscene/capabilities.js';
import { describePlanetCapabilities } from '../../src/system-workshop/planet/capabilities.js';
import { describeBattleCapabilities } from '../../src/system-workshop/battle/capabilities.js';
import { describeMountainCapabilities } from '../../src/system-workshop/mountain/capabilities.js';
import { describeFxCapabilities } from '../../src/system-workshop/fx/capabilities.js';
import { describeLightLifeCapabilities } from '../../src/system-workshop/lightlife/capabilities.js';
import { describeBuildingCapabilities } from '../../src/system-workshop/building/capabilities.js';
import { describeReliefCapabilities } from '../../src/system-workshop/relief/capabilities.js';
import { describeApostlesTerrainCapabilities } from '../../src/system-workshop/apostles-terrain/capabilities.js';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CATALOG = 'TigerMessenger/src/scene-authoring/catalog';
export const OUTPUT = CATALOG + '/capability-maturity.json';
export const EVIDENCE_HOME = Object.freeze({
  source: 'townscaper-web/REACodeRefactoring/learn/data.js',
  parity: CATALOG + '/parity', arena: CATALOG + '/arena', adoptions: CATALOG + '/adoptions.json', defaults: CATALOG + '/defaults.json',
  tests: 'TigerMessenger/tests', e2e: 'TigerMessenger/artifacts',
});
export const E2E_RULE = '⑥：TigerMessenger/artifacts/*-e2e/run-*/report.json 里 pass === true 且同目录有 .png。report.capabilities 写了就只覆盖写明的能力（条目可为字符串或 {id}）；没写就按目录名第一段对层（battle-*/nav-* → 战役层，fx-* → 表现层，mountain-* → 山形层，apostles-* → 十二门徒地形层，building-* → 建筑层），整层覆盖（粗口径）。UI 类端到端不算能力证据（E2E_UI_DIRS：面板/渲染验收目录，含写了 capabilities 花名册的 capability-contracts-e2e）；仓库根下误生成的 artifacts/ 不扫。';
// 本轮自己的测试只用假 ID；即使以后写进真 ID 也不算任何能力的单测证据（避免自证）
const SELF_TESTS = new Set(['capability-maturity.test.mjs', 'recent-additions.test.mjs']);
/** UI 类端到端：页面/面板渲染验收，不算任何能力的实景执行证据（E2E_RULE 的落地口径；写了 capabilities 列表的 UI 报告也排除）。 */
const E2E_UI_DIRS = new Set(['capability-contracts-e2e', 'capability-maturity-e2e', 'recent-additions-e2e', 'layer-focus-e2e', 'auto-preload-e2e', 'defaults-panel-e2e', 'defaults-buttons-e2e', 'nightly-panel-e2e', 'seed-report-e2e', 'before-after-e2e']);
const SCENE_EXEC = (c) => ['editor', 'live', 'code'].includes(c.mode);
const sceneClips = (c) => [...new Set([...(c.sourceVideos || []), ...(c.learn || []), ...(c.related || []), ...(c.provenance?.records || []).map((r) => r.id)].map(String).filter((id) => /^\d{16,20}$/.test(id)))];
const libMods = (c) => (c.sources || []).filter((x) => x.includes('REACodeRefactoring/')).map((x) => x.split('REACodeRefactoring/')[1]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quoted = (id) => new RegExp('[\'"`]' + esc(id) + '[\'"`]');
const safeId = (id) => String(id).replace(/[^\w.-]/g, '_');
const short = (n) => String(n || '').split(/[：:]/)[0];

function reader(root) {
  const cache = new Map();
  const text = (p) => { if (!cache.has(p)) { let t = null; try { t = fs.readFileSync(path.join(root, p), 'utf8'); } catch {} cache.set(p, t); } return cache.get(p); };
  const json = (p) => { const t = text(p); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } };
  const isFile = (p) => { try { return fs.statSync(path.join(root, p)).isFile(); } catch { return false; } };
  return { text, json, isFile };
}

/** 证据校验：(路径, 级) → 是否仍成立。路径 = 仓库根相对路径，可带 #能力ID / #帖子ID。 */
export function makeVerifier(root = workspace) {
  const { text, json, isFile } = reader(root);
  return (evidencePath, n) => {
    const s = String(evidencePath || ''), k = s.indexOf('#'), file = k < 0 ? s : s.slice(0, k), anchor = k < 0 ? '' : s.slice(k + 1);
    if (!file || path.isAbsolute(file) || file.split('/').includes('..') || !isFile(file)) return false;
    if (n === 4) { const j = json(file); return !!j && j.capability === anchor && PARITY_VERDICTS.includes(j.verdict); }
    if (n === 6) {
      const j = json(file); if (!j || j.pass !== true) return false;
      if (Array.isArray(j.capabilities) && !j.capabilities.map((x) => (typeof x === 'string' ? x : x?.id)).includes(anchor)) return false;
      try { return fs.readdirSync(path.join(root, path.dirname(file))).some((f) => f.endsWith('.png')); } catch { return false; }
    }
    if (n === 7) { const j = json(file); return !!j && j.capability === anchor && j.pass === true; }
    if (n === 8) { const j = json(file); return Array.isArray(j?.adoptions) && j.adoptions.some((a) => a?.capability === anchor && a.by === 'user'); }
    if (n === 9) {
      const j = json(file), d = Array.isArray(j?.defaults) ? j.defaults.find((x) => x?.capability === anchor) : null;
      const ev = typeof d?.evidence === 'string' ? d.evidence.split('#')[0] : '';
      return !!ev && !path.isAbsolute(ev) && !ev.split('/').includes('..') && isFile(ev);
    }
    if (n === 5) return !!anchor && quoted(anchor).test(text(file) || '');
    if (anchor) return (text(file) || '').includes(anchor);
    return true;
  };
}

/** test_workshops.py 里真正会跑的测试文件（单元清单 + 重构库清单）；解析不了就退回目录里全部 *.test.mjs 并注明 */
export function unitTestFiles(root = workspace) {
  const { text } = reader(root), py = text('TigerMessenger/tools/scene-authoring/test_workshops.py') || '';
  const names = (re) => { const m = py.match(re); return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null; };
  const unit = names(/TigerMessenger\/tests\/\{n\}\.test\.mjs' for n in \[([^\]]*)\]/), lib = names(/REACodeRefactoring\/tests\/\{n\}\.mjs' for n in \[([^\]]*)\]/);
  let files = [], basis = 'test_workshops.py 单元清单';
  if (unit) files.push(...unit.map((n) => `TigerMessenger/tests/${n}.test.mjs`)); else { basis = 'test_workshops.py 解析失败：退回 tests/*.test.mjs 全部'; try { files.push(...fs.readdirSync(path.join(root, 'TigerMessenger/tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => 'TigerMessenger/tests/' + f)); } catch {} }
  if (lib) files.push(...lib.map((n) => `townscaper-web/REACodeRefactoring/tests/${n}.mjs`));
  return { files: files.filter((f) => !SELF_TESTS.has(path.basename(f))), basis };
}

/** 端到端报告：最新的在前 */
export function e2eReports(root = workspace) {
  const base = path.join(root, EVIDENCE_HOME.e2e), out = [];
  let dirs = []; try { dirs = fs.readdirSync(base).filter((d) => d.endsWith('-e2e')); } catch {}
  for (const d of dirs) {
    if (E2E_UI_DIRS.has(d)) continue;
    let runs = []; try { runs = fs.readdirSync(path.join(base, d)).filter((r) => /^run-\d+$/.test(r)); } catch {}
    for (const r of runs) {
      const file = `${EVIDENCE_HOME.e2e}/${d}/${r}/report.json`; let j = null;
      try { j = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); } catch { continue; }
      let hasPng = false; try { hasPng = fs.readdirSync(path.join(base, d, r)).some((f) => f.endsWith('.png')); } catch {}
      out.push({ file, dir: d, run: Number(r.slice(4)), pass: j?.pass === true, hasPng, capabilities: Array.isArray(j?.capabilities) ? j.capabilities.map((x) => (typeof x === 'string' ? x : x?.id)).filter((x) => typeof x === 'string') : null, layer: E2E_DIR_LAYER[d.split('-')[0]] || null });
    }
  }
  return out.sort((a, b) => b.run - a.run);
}

/** 工坊日志：每个带日期的二级标题一段 */
export function logSections(text = '') {
  const out = []; let cur = null;
  for (const line of String(text).split('\n')) {
    const m = /^## (.*)$/.exec(line);
    if (m) { const d = /(\d{4}-\d{2}-\d{2})/.exec(m[1]); cur = { title: m[1].trim(), date: d ? d[1] : null, body: '' }; out.push(cur); continue; }
    if (cur) cur.body += line + '\n';
  }
  return out;
}
/** 只对带点的 ID（如 mountain.rolling）查日志，避免 'waves' 这类普通词误命中；取最早那一段 */
export function firstLogMention(id, sections) {
  if (!String(id).includes('.')) return null;
  const re = new RegExp('(^|[^\\w.-])' + esc(id) + '(?![\\w-]|\\.\\w)');
  const hits = sections.filter((s) => s.date && re.test(s.title + '\n' + s.body)).sort((a, b) => a.date.localeCompare(b.date));
  return hits[0] || null;
}

async function scenePipelineNodes() {
  try {
    const m = await import('../../src/scene-authoring/pipeline-model.js');
    const copy = m.CAPABILITIES.map((c) => ({ ...c }));
    m.registerCodeCapabilities(copy, describeCapabilities());     // 与 studio.js 启动时一致：重构库能力代码登记成场景管线节点
    return copy.filter(SCENE_EXEC);
  } catch (e) { console.warn('读不到场景管线节点（左栏 / 页面口径无法复算）：' + e.message); return null; }
}

export async function buildMaturity({ root = workspace, today = new Date().toISOString().slice(0, 10) } = {}) {
  const R = reader(root), verify = makeVerifier(root);
  const sceneNodes = await scenePipelineNodes();
  const L = { gscene: describeGsceneCapabilities(), battle: describeBattleCapabilities(), mountain: describeMountainCapabilities(), fx: describeFxCapabilities(), planet: describePlanetCapabilities(), object: describeObjectCapabilities(), lightlife: describeLightLifeCapabilities(), building: describeBuildingCapabilities(), relief: describeReliefCapabilities(), 'apostles-terrain': describeApostlesTerrainCapabilities() };
  const registry = describeCapabilities();
  const LAYER_FILE = { gscene: 'TigerMessenger/src/system-workshop/gscene/capabilities.js', battle: 'TigerMessenger/src/system-workshop/battle/capabilities.js', mountain: 'TigerMessenger/src/system-workshop/mountain/capabilities.js', fx: 'TigerMessenger/src/system-workshop/fx/capabilities.js', planet: 'TigerMessenger/src/system-workshop/planet/capabilities.js', object: 'TigerMessenger/src/system-workshop/object/capabilities.js', lightlife: 'TigerMessenger/src/system-workshop/lightlife/capabilities.js', building: 'TigerMessenger/src/system-workshop/building/capabilities.js', relief: 'TigerMessenger/src/system-workshop/relief/capabilities.js', 'apostles-terrain': 'TigerMessenger/src/system-workshop/apostles-terrain/capabilities.js' };
  const regDir = 'townscaper-web/REACodeRefactoring/src/capabilities';
  let regFiles = []; try { regFiles = fs.readdirSync(path.join(root, regDir)).filter((f) => f.endsWith('.js')).map((f) => regDir + '/' + f); } catch {}
  const regFileOf = (id) => regFiles.find((f) => new RegExp('id:\\s*[\'"]' + esc(id) + '[\'"]').test(R.text(f) || '')) || null;

  // 页面口径（studio.js getExecutables 的同一份拼法）与脚本口径
  const pageExec = [
    ...(sceneNodes || registry.map((c) => ({ ...c, sourceVideos: c.sources }))).map((c) => ({ id: c.id, name: c.name, tier: 'scene', clips: sceneClips(c), modules: (c.provenance?.modules || []).map((m) => m.path) })),
    ...L.gscene.map((c) => ({ ...c, tier: 'scene' })), ...L.battle.map((c) => ({ ...c, tier: 'scene' })),
    ...L.mountain.map((c) => ({ ...c, tier: 'scene', modules: libMods(c) })), ...L.fx.map((c) => ({ ...c, tier: 'scene', modules: libMods(c) })),
    ...L.planet.map((c) => ({ ...c, tier: 'planet' })), ...L.object.map((c) => ({ ...c, tier: 'object' })),
    ...L.building.map((c) => ({ ...c, tier: 'scene' })), ...L.relief.map((c) => ({ ...c, tier: 'scene' })), ...L['apostles-terrain'].map((c) => ({ ...c, tier: 'scene' })),
  ];
  const scriptExec = collectExecutables();
  const { manifest, lineage } = await computeLineage({ root });
  const jev = R.json(CATALOG + '/capability-tree-jev.json');
  const scriptTree = buildCapabilityTree(lineage, { alignment: manifest.alignment, executables: scriptExec, jev });
  const pageLineage = buildCapabilityLineage(manifest.evolution, { modules: manifest.modules, alignment: manifest.alignment, executables: pageExec });
  const pageTree = buildCapabilityTree(pageLineage, { alignment: manifest.alignment, executables: pageExec, jev });
  const realLines = new Map(lineage.lines.filter((l) => l.kind === 'line').map((l) => [l.id, short(l.name)]));

  // 能力全集（按 ID 去重）：记下它来自哪一层、登记在哪个文件
  const caps = new Map();
  const put = (c, layer, origin, file, extra = {}) => {
    const cur = caps.get(c.id) || { id: c.id, name: c.name, tier: layer === 'planet' ? 'planet' : layer === 'object' ? 'object' : 'scene', layer, origin, file, meta: c, clips: new Set(), modules: new Set(), raw: [], lines: new Set() };
    for (const p of [...(c.sources || []), ...(c.ideas || [])]) if (typeof p === 'string') cur.raw.push(p);
    for (const m of [...(extra.modules || []), ...(c.modules || [])]) if (typeof m === 'string') cur.modules.add(m);
    for (const id of extra.clips || []) cur.clips.add(String(id));
    if (c.line && realLines.has(c.line)) cur.lines.add(c.line);
    if (!cur.added && /^\d{4}-\d{2}-\d{2}$/.test(String(c.added || ''))) cur.added = c.added;
    caps.set(c.id, cur);
  };
  for (const c of sceneNodes || []) put(c, 'voxel', c.mode === 'code' ? 'registry' : 'pipeline-model', c.mode === 'code' ? regFileOf(c.id) : 'TigerMessenger/src/scene-authoring/pipeline-model.js', { modules: (c.provenance?.modules || []).map((m) => m.path), clips: sceneClips(c) });
  for (const c of registry) put(c, 'voxel', 'registry', regFileOf(c.id), { modules: c.modules || [], clips: (c.sources || []).filter((x) => /^\d{16,20}$/.test(String(x))) });
  for (const [layer, list] of Object.entries(L)) for (const c of list) put(c, layer, layer, LAYER_FILE[layer], { modules: [...(c.modules || []), ...libMods(c)], clips: sceneClips(c) });
  for (const row of [...pageLineage.executables, ...lineage.executables]) { const c = caps.get(row.id); if (!c) continue; for (const id of row.clips || []) c.clips.add(String(id)); for (const l of row.lines || []) if (realLines.has(l)) c.lines.add(l); }

  // 证据：每一级的候选路径
  const learnFile = EVIDENCE_HOME.source, learnText = R.text(learnFile) || '';
  const alignment = (manifest.alignment || []).filter((a) => !/\.html?$/i.test(a.source) && a.status !== 'missing-target');
  const tests = unitTestFiles(root), reports = e2eReports(root).filter((r) => r.pass);
  const adoptions = R.json(EVIDENCE_HOME.adoptions), defaults = R.json(EVIDENCE_HOME.defaults);
  const sections = logSections(R.text('TigerMessenger/docs/WORKSHOP_LOG.md') || '');
  const previous = R.json(OUTPUT), prevRows = new Map((previous?.rows || []).map((r) => [r.id, r]));
  const rows = [];
  for (const c of caps.values()) {
    const ev = {}, basis = {};
    const clip = [...c.clips].find((id) => learnText.includes(id)); if (clip) ev[1] = `${learnFile}#${clip}`;
    const declared = c.raw.map((p) => p.split(/[\s#]/)[0]).find((p) => /^townscaper-web\/REACode\//.test(p) && R.isFile(p));
    if (declared) { ev[2] = declared; basis[2] = '能力 sources / ideas 写明的原版文件'; }
    else { const a = alignment.find((x) => (x.targets || []).some((t) => t.exists && c.modules.has(t.path)) && R.isFile('townscaper-web/REACode/' + x.source)); if (a) { ev[2] = 'townscaper-web/REACode/' + a.source; basis[2] = '静态对账：这个原版文件的重构落点含本能力调用的模块（不代表行为等价）'; } }
    const called = libMods(c.meta).map((m) => 'townscaper-web/REACodeRefactoring/' + m).find((p) => R.isFile(p));
    const landing = [...c.modules].map((m) => 'townscaper-web/REACodeRefactoring/' + m).find((p) => R.isFile(p));
    if (called) { ev[3] = called; basis[3] = '能力真实调用的重构库模块'; }
    else if (landing) { ev[3] = landing; basis[3] = '能力学习内容在重构库的落点模块'; }
    else if (c.file && c.file.startsWith('townscaper-web/REACodeRefactoring/') && R.isFile(c.file)) { ev[3] = c.file; basis[3] = '能力代码本身在重构库 src/capabilities/'; }
    const parity = `${EVIDENCE_HOME.parity}/${safeId(c.id)}.json`; if (R.isFile(parity)) ev[4] = `${parity}#${c.id}`;
    const t = tests.files.find((f) => quoted(c.id).test(R.text(f) || '')); if (t) { ev[5] = `${t}#${c.id}`; basis[5] = tests.basis; }
    const rep = reports.find((r) => r.hasPng && (r.capabilities ? r.capabilities.includes(c.id) : r.layer && r.layer === c.layer)); if (rep) { ev[6] = `${rep.file}#${c.id}`; basis[6] = rep.capabilities ? 'report.capabilities 写明' : `目录名 ${rep.dir} → ${rep.layer} 层整层覆盖`; }
    const arena = `${EVIDENCE_HOME.arena}/${safeId(c.id)}.json`; if (R.isFile(arena)) ev[7] = `${arena}#${c.id}`;
    if (Array.isArray(adoptions?.adoptions) && adoptions.adoptions.some((a) => a?.capability === c.id)) ev[8] = `${EVIDENCE_HOME.adoptions}#${c.id}`;
    if (Array.isArray(defaults?.defaults) && defaults.defaults.some((d) => d?.capability === c.id)) ev[9] = `${EVIDENCE_HOME.defaults}#${c.id}`;
    const m = decideMaturity(ev, { verify });
    for (const k of Object.keys(basis)) if (!m.evidence[k]) delete basis[k];
    // 加入日期：meta.added > 工坊日志首次提到 > 本脚本上次首次见到 > 登记文件修改时间（只是上限）
    let added = null;
    if (c.added) added = { date: c.added, basis: 'meta', label: '能力 meta.added 登记' };
    if (!added) { const s = firstLogMention(c.id, sections); if (s) added = { date: s.date, basis: 'workshop-log', label: '工坊日志首次提到（' + s.title.slice(0, 40) + '）' }; }
    const prev = prevRows.get(c.id)?.added;
    if (!added && prev?.basis === 'first-seen') added = prev;
    if (!added && previous && !prevRows.has(c.id)) added = { date: today, basis: 'first-seen', label: '成熟度脚本第一次见到它' };
    if (!added && c.file && R.isFile(c.file)) added = { date: new Date(fs.statSync(path.join(root, c.file)).mtimeMs).toISOString().slice(0, 10), basis: 'file-mtime', label: '登记文件最后修改时间（加入日期不晚于此）' };
    if (!added) added = { date: null, basis: 'unknown', label: '没有可用的日期依据' };
    const lines = [...c.lines], line = c.meta.line && realLines.has(c.meta.line) ? c.meta.line : lines[0] || null;
    rows.push({ id: c.id, name: c.name, tier: c.tier, layer: c.layer, origin: c.origin, file: c.file, line, lineName: line ? realLines.get(line) : null, lines,
      level: m.level, strictLevel: m.strictLevel, label: m.label, reached: m.reached, missing: m.missing, evidence: m.evidence, basis, added,
      inPage: pageExec.some((x) => x.id === c.id), inLineage: scriptExec.some((x) => x.id === c.id) });
  }
  rows.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));
  const byLine = {}; for (const r of rows) for (const l of r.lines) (byLine[l] ||= []).push(r);
  const lines = Object.fromEntries([...realLines].map(([id, name]) => [id, { id, name, ...(lineMaturity(byLine[id] || []) || { level: 0, label: '无可执行能力', count: 0 }) }]));

  const uniq = (list) => new Set(list.map((x) => x.id)).size;
  const sidebarScene = sceneNodes ? uniq([...sceneNodes, ...L.gscene, ...L.battle, ...L.mountain, ...L.fx]) : null;
  const values = { sidebar: sidebarScene, lineage: lineage.loop.executables, 'tree-script': scriptTree.summary.executables, 'tree-page': sceneNodes ? pageTree.summary.executables : null, unique: rows.length };
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), generator: 'TigerMessenger/tools/refactor/build-capability-maturity.mjs',
    levels: MATURITY_LEVELS, evidenceHome: EVIDENCE_HOME, e2eRule: E2E_RULE, unitTests: tests.basis,
    counts: buildCountTable(values),
    countsDetail: {
      sidebarByTier: { scene: sidebarScene, planet: uniq(L.planet), object: uniq(L.object) },
      lineageEntries: scriptExec.length, lineageUnique: uniq(scriptExec), pageEntries: pageExec.length, pageUnique: uniq(pageExec),
      treeScriptLinkedUnique: scriptTree.summary.executablesLinked ?? null, treePageLinkedUnique: sceneNodes ? pageTree.summary.executablesLinked ?? null : null,
      onlyInPage: rows.filter((r) => r.inPage && !r.inLineage).map((r) => r.id), onlyInLineage: rows.filter((r) => !r.inPage && r.inLineage).map((r) => r.id),
      sceneNodesRead: !!sceneNodes,
    },
    distribution: summarizeMaturity(rows), lines, rows,
    limits: [
      '② 的「静态对账」只说明原版文件的重构落点里有本能力调用的模块，不代表行为等价（那是 ④）。',
      '⑥ 没写 report.capabilities 的报告按层整层覆盖：同一层后来新加的能力也会被算进去，直到报告写明能力清单。',
      '⑤ 只看测试文件里有没有以引号写出能力 ID，不看断言强弱。',
      '⑧ 不读浏览器本机采用记录；⑨ 只认 defaults.json 登记。现在 ④⑦⑧⑨ 都没有证据文件，所以这几级是 0。',
      '加入日期的依据逐行写在 added.basis；file-mtime 只是上限（文件后来又改过），不是真实加入日。',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (path.basename(process.cwd()) !== 'TigerMessenger') console.warn('提示：Guide §5.2 要求在 TigerMessenger 目录里跑（本脚本输出按仓库根定位，不会写错地方）。');
  const out = await buildMaturity();
  const brief = { distribution: out.distribution.byLevel, missingEverywhere: out.distribution.missingEverywhere, counts: out.counts.map((c) => ({ id: c.id, value: c.value, seen: c.seen })) };
  if (process.argv.includes('--stdout')) process.stdout.write(JSON.stringify(brief, null, 1) + '\n');
  else { const file = path.join(workspace, OUTPUT); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(brief)); console.log('已写 ' + OUTPUT + '：' + out.rows.length + ' 个能力'); }
}
