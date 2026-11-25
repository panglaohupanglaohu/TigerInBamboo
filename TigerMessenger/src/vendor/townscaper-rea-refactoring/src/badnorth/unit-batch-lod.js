/**
 * unit-batch-lod.js — 817323301357948928「Trying to figure out a good approach to units. Has to look good, be quick to make
 *   and perform well in large numbers」。迁自 REACode/src/unitbatch.js 的 ③「large numbers」：批处理 + 按屏幕尺寸分级。
 *
 * Battle 早已把身体/头/盾/矛画成 InstancedMesh（一种部件一次 draw call，与人数无关）——原 gap「单位尚用独立对象」已过时。
 * 本模块补的是原版剩下的两件：
 *   · 剔除：视锥外的实例从实例数组里压实掉（GPU 不再处理它们的顶点），每帧 #draw 之后执行，不改写 Battle 的组装逻辑；
 *   · LOD：投影身高 < lodPx（原版 9px）的单位只留「身体 + 白盔」——原版在这个尺寸下也只画三块色块；盾/矛/星退掉
 *     （盾压成零尺寸，保持与身体/头共用的 aSoak 下标一致；矛和星各自压实）。
 * 只处理实例矩阵/颜色/aSoak；阴影批和精灵批另有自己的上限，不在这里动。
 */
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Sphere(), _f = new THREE.Frustum(), _pv = new THREE.Matrix4(), _size = new THREE.Vector2();

export function compactInstances(mesh, keep, { extra = [] } = {}) {
  const n = mesh.count, M = mesh.instanceMatrix.array, C = mesh.instanceColor?.array;
  let w = 0;
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    if (w !== i) {
      M.copyWithin(w * 16, i * 16, i * 16 + 16);
      if (C) C.copyWithin(w * 3, i * 3, i * 3 + 3);
      for (const a of extra) a.array.copyWithin(w * a.itemSize, i * a.itemSize, (i + 1) * a.itemSize);
    }
    w++;
  }
  mesh.count = w; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  for (const a of extra) a.needsUpdate = true;
  return w;
}

export class UnitBatchLod {
  constructor({ lodPx = 9, unitHeight = .18, margin = .25 } = {}) {
    if (![lodPx, unitHeight, margin].every(Number.isFinite) || lodPx < 0 || unitHeight <= 0 || margin < 0) throw new RangeError('invalid unit LOD');
    Object.assign(this, { lodPx, unitHeight, margin });
    this.stats = { instances: 0, culled: 0, lod: 0, kept: 0, spears: 0, stars: 0, drawCalls: 0 };
  }
  /** 屏幕投影高度（像素）：透视相机 = 世界高 / (距离 · tan(fov/2)) · 视口半高。 */
  pixelHeight(camera, position, worldHeight, viewportHeight) {
    if (camera.isOrthographicCamera) return worldHeight * camera.zoom / (camera.top - camera.bottom) * viewportHeight;
    const d = Math.max(1e-6, camera.position.distanceTo(position));
    return worldHeight / (d * Math.tan(camera.fov * Math.PI / 360)) * viewportHeight / 2;
  }
  apply(battle, camera = battle.view.camera, viewportHeight = null) {
    if (!camera) return this.stats;
    if (viewportHeight == null) viewportHeight = battle.view.renderer?.getDrawingBufferSize?.(_size).y ?? 900;
    camera.updateMatrixWorld(true);
    _f.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const body = battle.mBody, n = body.count, keep = new Uint8Array(n), lod = new Uint8Array(n);
    let culled = 0, small = 0;
    for (let i = 0; i < n; i++) {
      body.getMatrixAt(i, _m); _p.setFromMatrixPosition(_m);
      const scale = Math.max(1e-6, _m.getMaxScaleOnAxis());
      _s.center.copy(_p); _s.center.y += this.unitHeight * scale * .5; _s.radius = (this.unitHeight * .6 + this.margin) * scale;
      if (!_f.intersectsSphere(_s)) { culled++; continue; }
      keep[i] = 1;
      if (this.pixelHeight(camera, _s.center, this.unitHeight * scale, viewportHeight) < this.lodPx) { lod[i] = 1; small++; }
    }
    // 身体 / 头 / 盾共用 aSoak 下标 → 同一个保留掩码
    compactInstances(body, keep, { extra: [battle.aSoak] });
    compactInstances(battle.mHead, keep);
    compactInstances(battle.mShield, keep);
    if (small) { let w = 0; const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) { if (!keep[i]) continue; if (lod[i]) battle.mShield.setMatrixAt(w, zero); w++; } battle.mShield.instanceMatrix.needsUpdate = true; }
    // 矛：杆与矛头同下标；视锥外或太小（< lodPx）都退掉
    const spearKeep = new Uint8Array(battle.mSpear.count);
    for (let i = 0; i < spearKeep.length; i++) {
      battle.mSpear.getMatrixAt(i, _m); _p.setFromMatrixPosition(_m); _s.center.copy(_p); _s.radius = .5 + this.margin;
      spearKeep[i] = _f.intersectsSphere(_s) && this.pixelHeight(camera, _p, this.unitHeight, viewportHeight) >= this.lodPx ? 1 : 0;
    }
    const spears = compactInstances(battle.mSpear, spearKeep); compactInstances(battle.mSpearTip, spearKeep);
    const starKeep = new Uint8Array(battle.mStun.count);
    for (let i = 0; i < starKeep.length; i++) { battle.mStun.getMatrixAt(i, _m); _p.setFromMatrixPosition(_m); _s.center.copy(_p); _s.radius = .05 + this.margin; starKeep[i] = _f.intersectsSphere(_s) && this.pixelHeight(camera, _p, this.unitHeight, viewportHeight) >= this.lodPx ? 1 : 0; }
    const stars = compactInstances(battle.mStun, starKeep);
    const parts = [battle.mBody, battle.mHead, battle.mShield, battle.mSpear, battle.mSpearTip, battle.mStun];
    this.stats = { instances: n, culled, lod: small, kept: n - culled, spears, stars, drawCalls: parts.filter((m) => m.count > 0).length };
    return this.stats;
  }
}
