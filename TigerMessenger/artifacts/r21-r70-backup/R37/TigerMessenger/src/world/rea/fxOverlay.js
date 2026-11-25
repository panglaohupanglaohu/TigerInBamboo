// 表现层管线（system-workshop/fx）的实景叠加预览：把验证过的 fx 计划画进真实游戏场景。
// 依赖 battle.probe 建好的 __tmBattleStage（stage.toWorld 把舞台坐标映到球面世界坐标）。
// 画的是不可碰撞的线层：红 = 战役前线，青 = 镜头环绕路径，白 = 尾迹泡沫带；不写存档。

import * as THREE from 'three';

const KEY = (id) => `tm.fx.plan.v1:${id}`;
let overlay = null;

const dispose = () => {
  if (!overlay) return;
  overlay.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  overlay.parent?.remove(overlay);
  overlay = null;
};

const liftAt = (stage, x, z, lift = .3) => {
  const c = stage.index?.cellAt?.(x, z);
  const top = c ? stage.world.top(c) : 0;
  return (top || 1) * stage.L + lift;
};

const mat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });

export function previewSceneFx({ scene, id = 'apostles', plan = null } = {}) {
  const stage = globalThis.__tmBattleStage;
  if (!stage) return { ok: false, reason: '没有舞台——先跑 battle.probe' };
  if (!plan) { try { plan = JSON.parse(localStorage.getItem(KEY(id)) || 'null')?.plan ?? null; } catch { plan = null; } }
  if (!plan || typeof plan !== 'object') return { ok: false, reason: `没有 fx 草稿（${KEY(id)}），先在工坊执行并存草稿` };
  dispose();
  const g = new THREE.Group(); g.name = 'tm-fx-overlay'; g.renderOrder = 30;
  const drawn = [];
  const strip = (pts, color, { loop = false, opacity = .92 } = {}) => {
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const l = loop ? new THREE.LineLoop(geo, mat(color, opacity)) : new THREE.Line(geo, mat(color, opacity));
    l.renderOrder = 30; g.add(l);
  };
  const f = plan.campaign?.frontier;
  if (Array.isArray(f) && f.length > 1) {
    strip(f.map(([x, y]) => stage.toWorld(x, liftAt(stage, x, y, .45), y)), 0xe5484d);
    drawn.push(`前线 ${f.length} 点`);
  }
  const cp = plan.camera?.path;
  if (Array.isArray(cp) && cp.length > 1) {
    strip(cp.map((p) => stage.toWorld(p.x, p.y, p.z)), 0x46c8dc, { loop: true });
    drawn.push(`镜头路径 ${cp.length} 点`);
  }
  const w = plan.wake;
  if (w?.points?.length) {
    const seg = new Float32Array(w.points.length * 6);
    w.points.forEach((p, i) => {
      const a = stage.toWorld(p.l[0], liftAt(stage, p.l[0], p.l[1], .2), p.l[1]);
      const b = stage.toWorld(p.r[0], liftAt(stage, p.r[0], p.r[1], .2), p.r[1]);
      seg.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(seg, 3));
    const l = new THREE.LineSegments(geo, mat(0xf2f4f1, .8)); l.renderOrder = 30; g.add(l);
    drawn.push(`尾迹 ${w.points.length} 段`);
    if (w.track?.length === 2) strip(w.track.map(([x, z]) => stage.toWorld(x, liftAt(stage, x, z, .15), z)), 0x5b8bd0, { opacity: .5 });
  }
  if (!drawn.length) return { ok: false, reason: '计划里没有可画的层（campaign / camera / wake）' };
  (scene || stage.anchor?.parent)?.add(g); overlay = g;
  return { ok: true, id, drawn: drawn.join(' · ') };
}

export function revertSceneFx() { const had = !!overlay; dispose(); return { ok: true, removed: had }; }
export function compareSceneFx(on) { if (!overlay) return { ok: false, reason: '没有叠加层' }; overlay.visible = !on; return { ok: true, hidden: !!on }; }
export function fxState() { return { overlay: !!overlay, visible: !!overlay?.visible, children: overlay?.children.length || 0 }; }
