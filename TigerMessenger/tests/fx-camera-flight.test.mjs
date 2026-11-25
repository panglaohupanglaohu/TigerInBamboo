// R40 fx.camera 的路径真实驱动镜头飞一圈：纯函数（src/system-workshop/fx/camera-flight.js）+ 实景接线静态检查。
// 浏览器里真飞、真还原的证据见 tests/fx-camera-flight-browser.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runPlan } from '../src/system-workshop/fx/capabilities.js';
import { poseAt, sweepDeg, flightPlan } from '../src/system-workshop/fx/camera-flight.js';
import { cliffStage, clone } from './fixtures/fx-stage.mjs';

const root = new URL('../../', import.meta.url), read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const cameraPlan = (params = {}) => { const s = clone(cliffStage()); runPlan(s, [{ id: 'fx.camera', params }]); return s.plan.camera; };

test('poseAt：两端等于路径首尾，中点在两采样点之间，越界夹紧', () => {
  const c = cameraPlan(), p = c.path;
  assert.deepEqual(poseAt(p, 0), { x: p[0].x, y: p[0].y, z: p[0].z });
  const e = poseAt(p, 1); assert.ok(Math.abs(e.x - p.at(-1).x) < 1e-9 && Math.abs(e.z - p.at(-1).z) < 1e-9);
  assert.deepEqual(poseAt(p, -3), poseAt(p, 0)); assert.deepEqual(poseAt(p, 9), poseAt(p, 1));
  const m = poseAt([{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: -2 }], 0.25); assert.deepEqual(m, { x: 0.5, y: 1, z: -0.5 });
  assert.throws(() => poseAt([], 0.5));
});

test('sweepDeg：fx.camera 一圈的路径扫过 ≈ 360°，半圈 ≈ 180°；沿路径匀速采样得到同一角度', () => {
  for (const laps of [1, 0.5, 2]) {
    const c = cameraPlan({ laps }), sw = sweepDeg(c.path.map((q) => [q.x, q.z]), c.centre);
    assert.ok(Math.abs(Math.abs(sw.signed) - 360 * laps) < 2, `laps ${laps} 扫过 ${sw.signed}`);
    const dense = []; for (let i = 0; i <= 400; i++) { const q = poseAt(c.path, i / 400); dense.push([q.x, q.z]); }
    assert.ok(Math.abs(sweepDeg(dense, c.centre).signed - sw.signed) < 1);
  }
  assert.deepEqual(sweepDeg([], [0, 0]), { signed: 0, absolute: 0 });
});

test('flightPlan：时长默认取计划、可覆盖；圈数与中心来自路径；没有路径报错', () => {
  const c = cameraPlan({ seconds: 10, laps: 1 });
  const f = flightPlan(c); assert.equal(f.seconds, 10); assert.ok(Math.abs(f.laps - 1) < 0.01); assert.deepEqual(f.centre, c.centre);
  assert.equal(flightPlan(c, { seconds: 4 }).seconds, 4);
  assert.ok(Math.abs(Math.abs(f.expectedSweep.signed) - 360) < 2);
  assert.throws(() => flightPlan(null), /fx\.camera/); assert.throws(() => flightPlan({ path: [] }));
});

test('实景接线：fxLive.js 每帧经 applyTownCamera 驱动镜头并能还原；桥与工坊按钮已登记；单元清单已登记', () => {
  const live = read('TigerMessenger/src/world/rea/fxLive.js');
  assert.match(live, /export function startCameraFlight\(/); assert.match(live, /export function stopCameraFlight\(/);
  assert.match(live, /morrisViewer\.applyTownCamera = apply/); assert.match(live, /morrisViewer\.applyTownCamera = s\.apply/);
  assert.match(live, /camera\.position\.copy\(s\.pos\)/); assert.match(live, /poseAt\(path, u\)/);
  assert.match(live, /revertSceneFxLive\(\) \{[^}]*stopCameraFlight\(\)/, '回退要顺带还原镜头');
  const bridge = read('TigerMessenger/src/scene-authoring/pipeline-bridge.js');
  for (const c of ['fx.camera.fly', 'fx.camera.stop', 'fx.camera.state']) assert.ok(bridge.includes(`case '${c}'`), c);
  const ws = read('TigerMessenger/src/system-workshop/fx-workshop.js'); assert.match(ws, /fx-camera-fly/); assert.match(ws, /fx-camera-stop/);
  assert.match(read('TigerMessenger/tools/scene-authoring/test_workshops.py'), /'fx-camera-flight'/);
});
