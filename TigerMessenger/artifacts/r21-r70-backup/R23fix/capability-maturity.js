/**
 * capability-maturity.js — 九级成熟度（CAPABILITY_PIPELINE_GUIDE §1.4 创新 4，R23）。纯逻辑：Node 与浏览器共用，不读文件。
 *
 * 每升一级必须有一份机器能查的证据（仓库根相对路径，可带 #锚点）。级别由脚本判定，不由人填：
 *   ① 看过来源          能力登记的来源帖子在学习记录里     townscaper-web/REACodeRefactoring/learn/data.js#<帖子ID>
 *   ② 原版有实现        原版 REACode 里有对应实现文件      townscaper-web/REACode/<文件>（能力 sources/ideas 里写明，或静态对账：原版 .js 的重构落点含本能力调用的模块）
 *   ③ 重构版有落点      重构库里有它真实调用的模块         townscaper-web/REACodeRefactoring/<模块>（或能力代码本身就在重构库 src/capabilities/ 里）
 *   ④ 行为等价或差异已登记（创新 1）                        TigerMessenger/src/scene-authoring/catalog/parity/<能力ID>.json
 *        { capability, verdict: 'equivalent' | 'diff-registered', original, inputs, diffs }  —— 现在一份都没有，所以全部「缺 ④」
 *   ⑤ 封装成可执行能力且有单元测试                          TigerMessenger/tests/<x>.test.mjs#<能力ID>
 *        能力已登记为可执行（本表只收可执行能力）+ 某个进了 test_workshops.py 单元清单的测试文件里以引号写出了能力 ID
 *   ⑥ 实景端到端跑通且有截图                                TigerMessenger/artifacts/<层>-<场景>-e2e/run-*/report.json
 *        report.pass === true 且同目录至少一张 .png；覆盖规则：report.capabilities 写明的能力优先；
 *        否则按目录名前缀对层：battle-* → 战役层、fx-* → 表现层、mountain-* → 山形层（整层覆盖，是粗口径）
 *   ⑦ 过了擂台（创新 3）                                    TigerMessenger/src/scene-authoring/catalog/arena/<能力ID>.json
 *        { capability, line, beat: <上一代能力ID或 'baseline'>, metrics, pass: true }  —— 现在没有
 *   ⑧ 用户采用                                              TigerMessenger/src/scene-authoring/catalog/adoptions.json#<能力ID>
 *        { adoptions: [{ capability, scene, at, by: 'user' }] }。浏览器本机的 tm.*.adopted.v1 脚本读不到，要导出进这个文件才算
 *   ⑨ 默认进游戏                                            TigerMessenger/src/scene-authoring/catalog/defaults.json#<能力ID>
 *        { defaults: [{ capability, scene, since, evidence }] }，evidence 指向游戏里默认启用它的代码位置
 *
 * 级别 level = 达到的最高一级（不要求连续）；strictLevel = 从 ① 起连续达到的最高一级。
 * 缺口不隐藏：比如 ①②③⑤⑥ 都有、④ 没有 → level 6、strictLevel 3、label「L6（缺 ④）」。
 * 证据只认路径：传 true / 空串 / 对象都不算；给了 verify 时路径还要通过校验（文件被删或内容被改 → 那一级掉下去）。
 */
export const MATURITY_LEVELS = Object.freeze([
  { n: 1, key: 'source', name: '看过来源', short: '来源', evidence: 'learn/data.js 里的来源帖子', home: 'townscaper-web/REACodeRefactoring/learn/data.js#<帖子ID>' },
  { n: 2, key: 'original', name: '原版有实现', short: '原版', evidence: '原版 REACode 文件', home: 'townscaper-web/REACode/<文件>' },
  { n: 3, key: 'refactored', name: '重构版有落点', short: '重构', evidence: '重构库模块', home: 'townscaper-web/REACodeRefactoring/<模块>' },
  { n: 4, key: 'parity', name: '行为等价或差异已登记', short: '等价', evidence: '对照登记', home: 'TigerMessenger/src/scene-authoring/catalog/parity/<能力ID>.json' },
  { n: 5, key: 'unit', name: '封装成可执行能力且有单元测试', short: '单测', evidence: '单元测试文件', home: 'TigerMessenger/tests/<x>.test.mjs#<能力ID>' },
  { n: 6, key: 'e2e', name: '实景端到端跑通且有截图', short: '实景', evidence: '端到端报告 + 截图', home: 'TigerMessenger/artifacts/<层>-<场景>-e2e/run-*/report.json' },
  { n: 7, key: 'arena', name: '过了擂台', short: '擂台', evidence: '擂台成绩', home: 'TigerMessenger/src/scene-authoring/catalog/arena/<能力ID>.json' },
  { n: 8, key: 'adopted', name: '用户采用', short: '采用', evidence: '采用记录', home: 'TigerMessenger/src/scene-authoring/catalog/adoptions.json#<能力ID>' },
  { n: 9, key: 'default', name: '默认进游戏', short: '默认', evidence: '默认启用登记', home: 'TigerMessenger/src/scene-authoring/catalog/defaults.json#<能力ID>' },
]);
export const CIRCLED = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
export const PARITY_VERDICTS = Object.freeze(['equivalent', 'diff-registered']);
/** ⑥ 的目录名前缀 → 工坊层（report.json 没写 capabilities 时用）。UI 类测试（layer-focus / auto-preload / capability-maturity / recent-additions）不算任何能力的实景证据。 */
export const E2E_DIR_LAYER = Object.freeze({ battle: 'battle', fx: 'fx', mountain: 'mountain' });

const isPath = (p) => typeof p === 'string' && p.trim().length > 0 && !/^(true|false|yes|ok|1)$/i.test(p.trim());

/**
 * @param evidence  { 1: 'path', 2: 'path' | null, ... }（键可以是数字或数字字符串）
 * @param options.verify  (path, n) => boolean：校验证据还成立（脚本里查文件；测试里可以伪造）
 * @returns { level, strictLevel, reached, missing, evidence, label }
 */
export function decideMaturity(evidence = {}, { verify = null } = {}) {
  const ok = {};
  for (const L of MATURITY_LEVELS) {
    const p = evidence?.[L.n] ?? evidence?.[String(L.n)];
    if (!isPath(p)) continue;
    let good = true;
    if (verify) { try { good = verify(p, L.n) === true; } catch { good = false; } }
    if (good) ok[L.n] = p;
  }
  const reached = MATURITY_LEVELS.map((L) => L.n).filter((n) => ok[n]);
  const level = reached.length ? reached[reached.length - 1] : 0;
  let strictLevel = 0; while (ok[strictLevel + 1]) strictLevel++;
  const missing = MATURITY_LEVELS.map((L) => L.n).filter((n) => n < level && !ok[n]);
  return { level, strictLevel, reached, missing, evidence: ok, label: maturityLabel({ level, missing }) };
}

/** 「L6（缺 ④）」；L0 写「L0（无证据）」 */
export function maturityLabel({ level = 0, missing = [] } = {}) {
  if (!level) return 'L0（无证据）';
  return 'L' + level + (missing.length ? '（缺 ' + missing.map((n) => CIRCLED[n]).join('') + '）' : '');
}

/** 分布：每一级有多少能力（按最高级）、按连续级、每一级有证据的能力数，以及「谁都没到」的级 */
export function summarizeMaturity(rows = []) {
  const byLevel = Object.fromEntries([0, ...MATURITY_LEVELS.map((L) => L.n)].map((n) => [n, 0]));
  const byStrict = { ...byLevel }, reachedBy = Object.fromEntries(MATURITY_LEVELS.map((L) => [L.n, 0]));
  const gapRows = {};
  for (const r of rows) {
    byLevel[r.level || 0] = (byLevel[r.level || 0] || 0) + 1;
    byStrict[r.strictLevel || 0] = (byStrict[r.strictLevel || 0] || 0) + 1;
    for (const n of r.reached || []) reachedBy[n]++;
    for (const n of r.missing || []) gapRows[n] = (gapRows[n] || 0) + 1;
  }
  const missingEverywhere = MATURITY_LEVELS.map((L) => L.n).filter((n) => !reachedBy[n]);
  return { total: rows.length, byLevel, byStrict, reachedBy, gapRows, missingEverywhere,
    note: missingEverywhere.length ? '没有任何能力达到：' + missingEverywhere.map((n) => CIRCLED[n] + ' ' + MATURITY_LEVELS[n - 1].name).join('、') : '每一级都至少有一个能力达到' };
}

/** 一条能力线最高到哪一级（线上能力里 level 最大的那个），连同它的缺口 */
export function lineMaturity(rows = []) {
  if (!rows.length) return null;
  const top = [...rows].sort((a, b) => (b.level || 0) - (a.level || 0) || (b.strictLevel || 0) - (a.strictLevel || 0))[0];
  const counts = {}; for (const r of rows) counts[r.level || 0] = (counts[r.level || 0] || 0) + 1;
  return { level: top.level || 0, strictLevel: top.strictLevel || 0, missing: top.missing || [], label: maturityLabel(top), by: top.id, count: rows.length, counts };
}

/**
 * 统一计数表：页面上出现过的「可执行 N」各自数的是什么。数值由 build-capability-maturity.mjs 复算后填入 value。
 * seen = 2026-11-23 页面审计 / 验收里看到的数（visible-audit run-1795435941396、run-1795442726695）。
 */
export const COUNT_DEFINITIONS = Object.freeze([
  { id: 'sidebar', label: '系统工坊左栏「可执行 N」', seen: 39,
    basis: '当前工坊（默认场景层）里能拖进管线的 ⚙ 能力，按能力 ID 去重；不含球系统层、物件层。来源：场景管线节点（mode 为 editor / live / code，含启动时登记的重构库能力代码）+ 通用场景 + 战役 + 山形 + 表现层。浏览器本机的「归属调配」会改变它。',
    code: 'TigerMessenger/src/system-workshop/capability-sidebar.js renderLineage() 末尾 items.size（工坊分区视图是各分区 runnable 之和）；能力清单来自 studio.js 的 sources.scene' },
  { id: 'lineage', label: '能力谱系「可执行能力」', seen: 55,
    basis: 'computeLineage 登记的可执行能力条目：重构库能力注册表（按场景层）+ 通用场景 + 球系统 + 物件 + 战役 + 山形 + 表现层。不含场景管线里的 editor / live 节点。条目不去重。',
    code: 'TigerMessenger/tools/refactor/build-capability-lineage.mjs computeLineage() → REACodeRefactoring/src/core/capability-lineage.js loop.executables = execRows.length' },
  { id: 'tree-script', label: '能力树摘要（脚本口径）', seen: 64,
    basis: '对 27 条能力线逐条数可执行能力再求和。一个能力按来源帖子 / 模块归到几条线就算几次，所以比能力个数大。',
    code: 'REACodeRefactoring/src/core/capability-tree.js buildCapabilityTree() summary.executables = Σ nodes[线].executables.length（输入：computeLineage 的能力清单）' },
  { id: 'tree-page', label: '能力树页面顶栏「可执行」', seen: 105,
    basis: '与上一行同一个按线求和，但输入是页面 studio.js getExecutables()：多了场景管线的 editor / live / code 节点，它们的来源帖子多、归线多、重复也多。R23 起顶栏改显示去重数，按线求和只留在提示里。',
    code: 'TigerMessenger/src/scene-authoring/studio.js getExecutables → REACodeRefactoring/src/ui/capability-tree.js 顶栏 S.executables（R23 前）' },
  { id: 'unique', label: '去重后的可执行能力（唯一对外数字）', seen: null, primary: true,
    basis: '以上所有来源按能力 ID 合并去重，每个能力只数一次；等于 capability-maturity.json 的行数。对外、文档、汇报一律用这个数。',
    code: 'TigerMessenger/tools/refactor/build-capability-maturity.mjs（rows.length）；页面：能力树顶栏 summary.executablesUnique、左栏括号里的「全系统去重」' },
]);

/** 把复算值填进计数表；缺的值写 null（不编数） */
export function buildCountTable(values = {}) {
  return COUNT_DEFINITIONS.map((d) => ({ ...d, value: Number.isFinite(values[d.id]) ? values[d.id] : null }));
}
