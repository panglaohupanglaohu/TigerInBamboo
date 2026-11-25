// R50：创新 1 / 3 的制度检查——地貌枝每一条嫁接线都必须同时有：原版对照登记（④ 的家）、擂台登记（⑦ 的家）、对齐别名、单元测试。
//   少一样就红；登记表没实算（verdict / pass 为 null）时成熟度不许算到 ④ / ⑦（不把「登记了」说成「等价了」）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/relief-evidence-registry.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { describeReliefCapabilities } from '../src/system-workshop/relief/capabilities.js';
import { PARITY_CASES } from '../src/system-workshop/terrain/parity-cases.js';
import { ARENA_RULES } from '../src/system-workshop/relief/arena.js';
import { PARITY_VERDICTS } from '../../townscaper-web/REACodeRefactoring/src/core/capability-maturity.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const json = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const caps = describeReliefCapabilities();

test('每个用到原版文件的地貌能力（meta.ideas 里有 REACode/）都配齐：对照 case + ④ 登记 + 擂台规则 + ⑦ 登记', () => {
  const grafted = caps.filter((c) => (c.ideas || []).some((p) => p.includes('townscaper-web/REACode/')));
  assert.equal(grafted.length, caps.length, '六个能力都是从原版嫁接来的');
  for (const c of grafted) {
    assert.ok(PARITY_CASES.some((x) => x.id === c.id), c.id + ' 没有对照 case');
    assert.ok(json(`../src/scene-authoring/catalog/parity/${c.id}.json`), c.id + ' 没有 catalog/parity 登记');
    assert.ok(ARENA_RULES[c.id], c.id + ' 没有擂台规则');
    assert.ok(json(`../src/scene-authoring/catalog/arena/${c.id}.json`), c.id + ' 没有 catalog/arena 登记');
    const p = json(`../src/scene-authoring/catalog/parity/${c.id}.json`);
    assert.ok(c.ideas.includes(p.original) || (p.alsoOriginal || []).some((x) => c.ideas.includes(x)), c.id + '：能力 meta 的原版来源要和对照登记一致');
  }
});
test('诚实口径：verdict / pass 没实算（null）就不算 ④ / ⑦；实算过的必须是 capability-maturity.js 认的值', () => {
  for (const c of caps) {
    const p = json(`../src/scene-authoring/catalog/parity/${c.id}.json`), a = json(`../src/scene-authoring/catalog/arena/${c.id}.json`);
    const reached4 = p.capability === c.id && PARITY_VERDICTS.includes(p.verdict), reached7 = a.capability === c.id && a.pass === true;
    if (p.verdict == null) { assert.equal(reached4, false); assert.ok(p.measured == null || p.status === 'unregistered-diffs', c.id + '：没有 verdict 却有实算记录'); }
    else { assert.ok(PARITY_VERDICTS.includes(p.verdict)); assert.ok(p.measured?.at, c.id + '：有 verdict 就要有实算时间'); }
    if (a.pass == null) assert.equal(reached7, false); else assert.ok(a.recordedBy?.includes('实算'), c.id + '：擂台成绩必须是 record 脚本实算写的');
  }
});
test('对齐别名：对照登记里的每个原版文件都在 reacode-target-aliases.json 里有落点', () => {
  const al = json('../tools/refactor/reacode-target-aliases.json');
  for (const c of PARITY_CASES) for (const f of [c.original, ...(c.alsoOriginal || [])]) { const k = f.replace('townscaper-web/REACode/', ''); assert.ok(al[k]?.targets?.length, k + ' 没有对齐别名'); }
});
test('六个地貌测试都进了 test_workshops.py 单元清单（成熟度 ⑤ 只认清单里的测试）', () => {
  const py = read('../tools/scene-authoring/test_workshops.py');
  for (const n of ['relief-parity', 'relief-pipeline', 'relief-arena', 'relief-candidate', 'relief-panel', 'relief-evidence-registry']) assert.ok(py.includes(`'${n}'`), n);
});
test('记录脚本是登记表唯一写入方：测试和面板都不写 catalog/parity、catalog/arena', () => {
  for (const f of ['../src/system-workshop/relief-workshop.js', '../src/system-workshop/relief/arena.js', '../src/system-workshop/terrain/parity.js', './relief-parity.test.mjs', './relief-arena.test.mjs']) assert.ok(!/writeFileSync|fs\.write/.test(read(f)), f);
  assert.ok(read('../tools/refactor/record-relief-evidence.mjs').includes("path.join(CATALOG, 'parity'"));
});
