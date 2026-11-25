// R-A5：十二门徒「按实测选优」纯逻辑（scoreLook / rankMeasurements / measuredView）+ pending-defaults 种子幂等。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/apostles-measure-pick.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLook, rankMeasurements, pickBest, measuredView, rowLine, MEASURE_ORDER } from '../src/system-workshop/apostles-terrain/measure-pick.js';
import { PENDING_DEFAULTS, seedPendingDefaults } from '../src/system-workshop/pending-defaults.js';
import { getDefault, setDefault } from '../src/system-workshop/defaults.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('scoreLook：缺陷越少分越低；transparentRock 权重最高；比例项按 0–1 计', () => {
  const clean = scoreLook({ transparentRock: 0, inverted: 0, openEdges: 0, plants: 100, plantBad: 0, plantBadShare: 0, foamUncoveredShare: 0, foamStrayShare: 0 });
  assert.equal(clean.score, 0);
  const badRock = scoreLook({ transparentRock: 1, inverted: 0, openEdges: 0, foamUncoveredShare: 0, foamStrayShare: 0 });
  const manyEdges = scoreLook({ transparentRock: 0, inverted: 0, openEdges: 100, foamUncoveredShare: 0, foamStrayShare: 0 });
  assert.ok(badRock.score > manyEdges.score, '1 个半透明岩体应比 100 条开口边罚得更重');
  // 植被：只给 plants+share（旧数据没有 plantBad）也能折算
  const plantsOnly = scoreLook({ plants: 100, plantBadShare: 0.5, foamUncoveredShare: 0, foamStrayShare: 0 });
  assert.equal(plantsOnly.parts.plantBad, 1000); // 100 株 × 50% = 50 坏株 ×20
  // 比例项：全没白沫覆盖 vs 全覆盖
  const noFoam = scoreLook({ foamUncoveredShare: 1, foamStrayShare: 0 });
  const okFoam = scoreLook({ foamUncoveredShare: 0, foamStrayShare: 0 });
  assert.ok(noFoam.score > okFoam.score);
});

test('rankMeasurements / pickBest：分数低者胜；并列取改动小的（approved < soft < soft,palette）；失败行垫底', () => {
  const totals = (over = {}) => ({ transparentRock: 0, inverted: 0, openEdges: 0, plants: 10, plantBad: 0, plantBadShare: 0, foamUncoveredShare: 0.1, foamStrayShare: 0.05, ...over });
  const rows = [
    { param: 'soft,palette', totals: totals({ inverted: 30 }) },
    { param: 'approved', totals: totals({ inverted: 30 }) },   // 与 soft,palette 同分 → approved 靠前
    { param: 'soft', totals: totals({ inverted: 5 }) },         // 最优
    { param: 'latest', error: '切换失败' },                      // 失败行不参与
  ];
  const ranked = rankMeasurements(rows);
  assert.equal(ranked[0].param, 'soft');
  assert.equal(pickBest(rows).param, 'soft');
  assert.equal(ranked.at(-1).param, 'latest');
  assert.equal(ranked.at(-1).eval, null);
  // 完全并列三套 → approved（改动最小）
  const tie = ['soft,palette', 'approved', 'soft'].map((param) => ({ param, totals: totals() }));
  assert.equal(pickBest(tie).param, 'approved');
  assert.deepEqual(MEASURE_ORDER, ['approved', 'soft', 'soft,palette']);
});

test('measuredView：无记录 none；pending 无 winner → 待实测选出；带 planId → winner 带时间与摘要', () => {
  assert.equal(measuredView(null).kind, 'none');
  const pend = measuredView({ status: 'pending-measurement', pendingRef: 'P-R32-01' });
  assert.equal(pend.kind, 'pending');
  assert.match(pend.text, /待实测选出 · P-R32-01/);
  const win = measuredView({ planId: 'soft', plan: { look: 'soft' }, at: '2026-11-24T01:00:00Z', note: '按实测选出：approved=10 / soft=5', status: 'pending-measurement', adoptedBy: 'auto-test' });
  assert.equal(win.kind, 'winner');
  assert.match(win.text, /实测选出：软坡（soft）/);
  assert.match(win.text, /按实测选出：approved=10 \/ soft=5/);
});

test('PENDING_DEFAULTS：四条待决定种子（P-R32-01 已决移入 RESOLVED）', () => {
  assert.equal(PENDING_DEFAULTS.length, 4);
  const by = Object.fromEntries(PENDING_DEFAULTS.map((p) => [`${p.scene}:${p.layer}`, p]));
  assert.equal(by['apostles:apostles-terrain'], undefined); // P-R32-01 已决：不再当 pending 种子
  assert.equal(by['citadel:mountain'].status, 'pending-user');
  assert.equal(by['citadel:mountain'].pendingRef, 'P-R27-01,P-R28-01,P-R28-02');
  assert.equal(by['old-port:relief'].pendingRef, 'P-R49-01');
  assert.equal(by['citadel:building'].pendingRef, 'P-R57-01');
  assert.equal(by['crystal:building'].pendingRef, 'P-R57-01');
});

test('seedPendingDefaults：幂等只补缺失；RESOLVED 落实已决；不覆盖 active 用户默认；可注入 at', () => {
  const s = mem();
  assert.equal(seedPendingDefaults(s, { at: '2026-11-24T00:00:00Z' }), 4);
  assert.equal(seedPendingDefaults(s), 0); // 第二次全跳过
  // P-R32-01 决议：空存储 → 直接补 soft 正式默认（2026-11-25 改定）
  const apt = getDefault(s, 'apostles', 'apostles-terrain');
  assert.equal(apt.status, 'active');
  assert.equal(apt.planId, 'soft');
  assert.equal(apt.adoptedBy, 'user');
  assert.equal(apt.source, 'decide');
  const rec = getDefault(s, 'citadel', 'mountain');
  assert.equal(rec.status, 'pending-user');
  assert.equal(rec.pendingRef, 'P-R27-01,P-R28-01,P-R28-02');
  assert.equal(rec.at, '2026-11-24T00:00:00Z');
  assert.equal(rec.source, 'pending-seed');
  // 用户已设的 active 记录不被覆盖
  const s2 = mem();
  setDefault(s2, 'citadel', 'mountain', { capabilityId: 'mountain.rolling', status: 'active' });
  setDefault(s2, 'apostles', 'apostles-terrain', { capabilityId: 'apostles.look', planId: 'approved', status: 'active' });
  assert.equal(seedPendingDefaults(s2), 3); // 4 - 1 已存在
  assert.equal(getDefault(s2, 'citadel', 'mountain').capabilityId, 'mountain.rolling');
  assert.equal(getDefault(s2, 'apostles', 'apostles-terrain').planId, 'approved');
  assert.equal(getDefault(s2, 'old-port', 'relief').status, 'pending-user');
  // P-R32-01 仍挂 pending 的残留记录 → 决议翻成 soft 正式默认
  const s3 = mem();
  setDefault(s3, 'apostles', 'apostles-terrain', { capabilityId: 'apostles.look', planId: 'soft', status: 'pending-measurement', pendingRef: 'P-R32-01', note: '实测 pending' });
  seedPendingDefaults(s3);
  const r3 = getDefault(s3, 'apostles', 'apostles-terrain');
  assert.equal(r3.status, 'active');
  assert.equal(r3.planId, 'soft');
  assert.match(r3.note, /P-R32-01/);
});

test('rowLine：有 eval 显示得分与关键指标；error 行如实写失败', () => {
  const ok = rowLine({ param: 'soft', totals: { inverted: 3, openEdges: 1, transparentRock: 0, plantBadShare: 0.02, foamUncoveredShare: 0.1 }, eval: { score: 55 } });
  assert.match(ok, /软坡（soft）：得分 55/);
  assert.match(ok, /反面三角 3/);
  const err = rowLine({ param: 'approved', error: '游戏没有重新连上' });
  assert.match(err, /实测失败 — 游戏没有重新连上/);
});
