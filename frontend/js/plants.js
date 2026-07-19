// 水生植物：菖蒲（靠水小石旁，翠叶白花）、芦苇（阔水两岸，浅赭石色叶）
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { makeRandom, groundHeight, streamQuery, streamCurve } from "./environment.js";

export class WaterPlants {
  constructor(scene, config, env) {
    this.scene = scene;
    const rand = makeRandom(777);
    this._calamus(rand, env.streamRocks || []);
    this._reeds(rand);
  }

  // ---------- 菖蒲：靠水小石旁，翠绿叶、开白花 ----------
  _calamus(rand, rocks) {
    const leafGeos = [], headGeos = [];
    for (const rk of rocks) {
      if (rand() > 0.65) continue;              // 约六成石旁生菖蒲
      const nC = 1 + Math.floor(rand() * 2);    // 1~2 丛
      const q0 = streamQuery(rk.x, rk.z);
      const toWater = Math.atan2(q0.cx - rk.x, q0.cz - rk.z); // 朝涧心
      for (let c = 0; c < nC; c++) {
        const spread = 0.5 + rand() * 0.5;
        const px = rk.x + Math.sin(toWater) * spread + (rand() - 0.5) * 0.5;
        const pz = rk.z + Math.cos(toWater) * spread + (rand() - 0.5) * 0.5;
        if (streamQuery(px, pz).d < q0.halfW + 0.15) continue; // 不长进水里
        this._calamusClump(rand, px, pz, leafGeos, headGeos);
      }
    }
    this._add(leafGeos, calamusLeafMat(), true);
    this._add(headGeos, calamusFlowerMat(), true);
  }

  _calamusClump(rand, x, z, leafGeos, headGeos) {
    const y0 = groundHeight(x, z);
    // 叶：狭长剑形，翠绿水灵，自基部扇形散出、叶尖外弯
    const nL = 9 + Math.floor(rand() * 6);
    for (let i = 0; i < nL; i++) {
      const len = 0.55 + rand() * 0.45;
      const g = new THREE.PlaneGeometry(0.075, len, 1, 4);
      g.translate(0, len / 2, 0);
      const pos = g.attributes.position;
      const bend = 0.25 + rand() * 0.35;
      for (let k = 0; k < pos.count; k++) {
        const t = Math.max(pos.getY(k), 0) / len;
        pos.setZ(k, pos.getZ(k) + bend * t * t * len * 0.6);
      }
      const m = new THREE.Matrix4()
        .makeTranslation(x, y0, z)
        .multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI * 2))
        .multiply(new THREE.Matrix4().makeRotationX(0.12 + rand() * 0.3));
      g.applyMatrix4(m);
      leafGeos.push(g);
    }
    // 白花：细葶 2~3 枝，顶端三粒小花成簇
    const nF = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < nF; i++) {
      const h = 0.5 + rand() * 0.25;
      const ang = rand() * Math.PI * 2, rr = 0.06 + rand() * 0.12;
      const fx = x + Math.cos(ang) * rr, fz = z + Math.sin(ang) * rr;
      const fy = groundHeight(fx, fz);
      const sg = new THREE.CylinderGeometry(0.008, 0.012, h, 5);
      sg.translate(0, h / 2, 0);
      const m = new THREE.Matrix4().makeTranslation(fx, fy, fz)
        .multiply(new THREE.Matrix4().makeRotationZ((rand() - 0.5) * 0.15));
      sg.applyMatrix4(m);
      leafGeos.push(sg); // 花葶同翠绿叶色
      for (let p = 0; p < 3; p++) {
        const hg = new THREE.SphereGeometry(0.028, 6, 5);
        const hm = new THREE.Matrix4().makeTranslation(
          fx + (rand() - 0.5) * 0.05, fy + h + (p - 1) * 0.035, fz + (rand() - 0.5) * 0.05);
        hg.applyMatrix4(hm);
        headGeos.push(hg);
      }
    }
  }

  // ---------- 芦苇：宽阔水面两侧岸边，浅赭石色叶 ----------
  _reeds(rand) {
    const stemGeos = [], leafGeos = [], plumeGeos = [];
    // 找宽阔水面（半宽 > 1.5）
    const spots = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const p = streamCurve.getPointAt(t);
      const q = streamQuery(p.x, p.z);
      if (q.halfW > 1.5) spots.push({ t, p, hw: q.halfW });
    }
    const up = new THREE.Vector3(0, 1, 0), tan = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i < spots.length; i += 3) {
      const s = spots[i];
      streamCurve.getTangentAt(s.t, tan);
      side.crossVectors(up, tan).normalize();
      for (const sg of [-1, 1]) {           // 两岸
        if (rand() > 0.75) continue;        // 约七成机会成丛
        const off = s.hw + 0.5 + rand() * 0.8;
        const cx = s.p.x + side.x * sg * off + (rand() - 0.5);
        const cz = s.p.z + side.z * sg * off + (rand() - 0.5);
        if (streamQuery(cx, cz).d < s.hw + 0.3) continue;
        this._reedClump(rand, cx, cz, stemGeos, leafGeos, plumeGeos);
      }
    }
    this._add(stemGeos, reedStemMat(), true);
    this._add(leafGeos, reedLeafMat(), true);
    this._add(plumeGeos, reedPlumeMat(), true);
  }

  _reedClump(rand, x, z, stemGeos, leafGeos, plumeGeos) {
    const n = 5 + Math.floor(rand() * 4);   // 一丛 5~8 竿
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, rr = rand() * 0.45;
      const x0 = x + Math.cos(a) * rr, z0 = z + Math.sin(a) * rr;
      const y0 = groundHeight(x0, z0) - 0.05;
      const h = 1.7 + rand() * 1.1;
      const m = new THREE.Matrix4().makeTranslation(x0, y0, z0)
        .multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI * 2))
        .multiply(new THREE.Matrix4().makeRotationZ((rand() - 0.5) * 0.16));
      const sg = new THREE.CylinderGeometry(0.012, 0.02, h, 5);
      sg.translate(0, h / 2, 0);
      sg.applyMatrix4(m);
      stemGeos.push(sg);
      // 叶 3~4：狭长披针，浅赭石色，自竿身散出、叶尖垂弧
      const nL = 3 + Math.floor(rand() * 2);
      for (let k = 0; k < nL; k++) {
        const len = 0.6 + rand() * 0.5;
        const lg = new THREE.PlaneGeometry(0.05, len, 1, 3);
        lg.translate(0, len / 2, 0);
        const pos = lg.attributes.position;
        const droop = 0.5 + rand() * 0.5;
        for (let u = 0; u < pos.count; u++) {
          const t = Math.max(pos.getY(u), 0) / len;
          pos.setZ(u, pos.getZ(u) + droop * t * t * len * 0.8);
        }
        const lm = new THREE.Matrix4().copy(m)
          .multiply(new THREE.Matrix4().makeTranslation(0, h * (0.25 + rand() * 0.5), 0))
          .multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI * 2))
          .multiply(new THREE.Matrix4().makeRotationX(0.5 + rand() * 0.5));
        lg.applyMatrix4(lm);
        leafGeos.push(lg);
      }
      // 穗：顶端苇花（浅棕），约八成竿有穗
      if (rand() < 0.8) {
        const pg = new THREE.CylinderGeometry(0.02, 0.045, 0.32, 6);
        pg.translate(0, h + 0.14, 0);
        pg.applyMatrix4(m);
        plumeGeos.push(pg);
      }
    }
  }

  _add(geos, mat, shadow) {
    if (!geos.length) return;
    const mesh = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(geos), mat);
    mesh.castShadow = shadow;
    this.scene.add(mesh);
  }
}

// ---------- 材质 ----------
let _calamusLeaf = null;
function calamusLeafMat() {
  if (!_calamusLeaf) {
    _calamusLeaf = new THREE.MeshStandardMaterial({
      color: 0x2f9e63, roughness: 0.65, side: THREE.DoubleSide, // 翠绿
    });
  }
  return _calamusLeaf;
}

let _calamusFlower = null;
function calamusFlowerMat() {
  if (!_calamusFlower) {
    _calamusFlower = new THREE.MeshStandardMaterial({ color: 0xf7f7ee, roughness: 0.6 }); // 白花
  }
  return _calamusFlower;
}

let _reedStem = null;
function reedStemMat() {
  if (!_reedStem) {
    _reedStem = new THREE.MeshStandardMaterial({ color: 0xb08a55, roughness: 0.8 });
  }
  return _reedStem;
}

let _reedLeaf = null;
function reedLeafMat() {
  if (!_reedLeaf) {
    _reedLeaf = new THREE.MeshStandardMaterial({
      color: 0xcfa06b, roughness: 0.85, side: THREE.DoubleSide, // 浅赭石
    });
  }
  return _reedLeaf;
}

let _reedPlume = null;
function reedPlumeMat() {
  if (!_reedPlume) {
    _reedPlume = new THREE.MeshStandardMaterial({ color: 0x8a6b42, roughness: 1 }); // 苇穗
  }
  return _reedPlume;
}
