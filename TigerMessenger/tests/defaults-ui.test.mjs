// R-A2/R-A3 默认登记处界面：纯逻辑（currentDefaultView）+ 接线静态检查（两个挂载点都在、走共享登记、按钮带 data 钩子）。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/defaults-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { currentDefaultView } from '../src/system-workshop/defaults-ui.js';
import { setDefault } from '../src/system-workshop/defaults.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('currentDefaultView：没有记录 → null；有记录 → 名称 / 谁定的 / 时间都在', () => {
  const s = mem();
  assert.equal(currentDefaultView(s, 'citadel', 'mountain'), null);
  setDefault(s, 'citadel', 'mountain', { capabilityId: 'mountain.rolling', planId: 'p9', adoptedBy: 'auto-test', at: '2026-11-23T01:02:03Z' });
  const v = currentDefaultView(s, 'citadel', 'mountain', (id) => '名字:' + id);
  assert.equal(v.name, '名字:mountain.rolling');
  assert.equal(v.planId, 'p9');
  assert.equal(v.by, '按实测选优代选');
  assert.ok(v.at.includes('2026'));
  const u = currentDefaultView(s, 'citadel', 'mountain');
  setDefault(s, 'citadel', 'mountain', { capabilityId: 'mountain.ridge', adoptedBy: 'user' });
  assert.equal(currentDefaultView(s, 'citadel', 'mountain').by, '手动采用');
});

test('defaults-ui.js 接线：两个挂载函数、走 defaults.js 登记、按钮带 data 钩子、不写场景存档', () => {
  const s = read('../src/system-workshop/defaults-ui.js');
  for (const fn of ['mountDefaultsControl', 'mountDefaultsSummary', 'currentDefaultView']) assert.ok(s.includes('export function ' + fn) || s.includes('export const ' + fn), fn);
  assert.match(s, /from '\.\/defaults\.js\?v=defaults-r2'/);
  assert.match(s, /dataset\.defaultsSet/); assert.match(s, /dataset\.defaultsClear/); assert.match(s, /dataset\.defaultsRow/);
  assert.doesNotMatch(s, /tm\.crystalCity|tm\.citadel\.|apostles\.adopted/i);
});

test('defaults-panel.js + pipeline.html：总栏挂载点、du- 前缀 request、撤销命令映射、页面有 section 与 script', () => {
  const p = read('../src/scene-authoring/defaults-panel.js'), h = read('../pipeline.html');
  assert.match(p, /mountDefaultsSummary/);
  assert.match(p, /'du-' \+ \(\+seq\)|'du-'/);
  assert.match(p, /UNADOPT_COMMANDS = Object\.freeze\(\{ mountain: 'mountain\.unadopt', building: 'building\.unadopt', battle: 'battle\.unadopt' \}\)/);
  assert.match(h, /id="defaults-summary"/);
  assert.match(h, /defaults-panel\.js\?v=defaults-r2/);
});
