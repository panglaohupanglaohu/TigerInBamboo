// =====================================================================
//  莫比斯水晶异星城市（南半球）
//  15 座巨型棱晶塔（玩家 5~8 倍高）+ 悬空发光连线桥
//  最大的一座「主晶塔」位置固定（电车环城绕行地标）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";

const CRYSTAL_GOLD = 0xf39c12; // 明黄能量晶
const CRYSTAL_BLUE = 0x3498db; // 亮蓝能量晶
const BRIDGE = 0x9fd8f0;

/** 主晶塔（电车绕行的最宏大地标）：南纬 46°、东经 -115° */
export const GRAND_CRYSTAL = Object.freeze({ lat: -46, lon: -115, h: 13.5, r: 1.6 });

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * 单座棱晶塔：CylinderGeometry（5/6 段）拉长、顶部收缩尖刺，
 * 半透明自发光，描边加粗；顶端斜指外太空。
 */
function createCrystal(h, r, color, rnd) {
  const g = new THREE.Group();
  const mat = toonMat(color, {
    transparent: true,
    opacity: 0.82,
    emissive: color,
    emissiveIntensity: 0.45,
  });
  const segs = rnd() < 0.5 ? 5 : 6;
  const body = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(r * 0.16, r, h, segs)),
    mat
  );
  body.position.y = h / 2;
  body.castShadow = true;
  addOutline(body, 0.045);
  g.add(body);
  // 塔身微倾（斜指外太空）
  g.rotation.z = (rnd() - 0.5) * 0.16;
  g.rotation.x = (rnd() - 0.5) * 0.16;
  return g;
}

/**
 * 在南半球种植水晶城。
 * @param {THREE.CatmullRomCurve3} [trackCurve] 有则让开轨道走廊（角距 >0.09 rad）
 * @returns {{ group, crystals, grand }}
 */
export function buildMoebiusCity(scene, R, { trackCurve } = {}) {
  const rnd = lcg(20260803);
  const group = new THREE.Group();
  group.name = "moebius-crystal-city";
  const crystals = [];
  const _dir = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  function clearOfTrack(dir) {
    if (!trackCurve) return true;
    for (let i = 0; i <= 60; i++) {
      const p = trackCurve.getPointAt(i / 60, _dir);
      if (p.angleTo(dir) < 0.09) return false;
    }
    return true;
  }

  function plant(lat, lon, h, r, color) {
    const dir = latLonToDir(lat, lon, new THREE.Vector3());
    const c = createCrystal(h, r, color, rnd);
    c.position.copy(dir).multiplyScalar(R);
    c.quaternion.copy(quatYToDir(dir, _q));
    // 在法线系内再斜一点（尖端指向外太空）
    c.rotateZ((rnd() - 0.5) * 0.12);
    group.add(c);
    crystals.push({ group: c, dir, h, r });
    return c;
  }

  // 主晶塔（固定地标）
  const grand = plant(
    GRAND_CRYSTAL.lat,
    GRAND_CRYSTAL.lon,
    GRAND_CRYSTAL.h,
    GRAND_CRYSTAL.r,
    CRYSTAL_GOLD
  );

  // 14 座随机塔（南纬 -18°..-72°），高度 5~8 倍玩家（8.5~13.6）
  let planted = 0;
  let attempts = 0;
  while (planted < 14 && attempts < 200) {
    attempts++;
    const lat = -18 - rnd() * 54;
    const lon = rnd() * 360 - 180;
    const dir = latLonToDir(lat, lon, new THREE.Vector3());
    // 与主晶塔及其他塔保持间距（角距 >0.14 rad）
    if (crystals.some((c) => c.dir.angleTo(dir) < 0.14)) continue;
    if (!clearOfTrack(dir)) continue;
    const h = 8.5 + rnd() * 5.1;
    const r = 0.7 + rnd() * 0.6;
    const color = rnd() < 0.5 ? CRYSTAL_GOLD : CRYSTAL_BLUE;
    plant(lat, lon, h, r, color);
    planted++;
  }

  // 悬空发光连线桥：就近两两相连（极简发光线）
  const bridgeMat = new THREE.LineBasicMaterial({
    color: BRIDGE,
    transparent: true,
    opacity: 0.6,
  });
  const bridgeCount = Math.min(6, crystals.length - 1);
  for (let i = 0; i < bridgeCount; i++) {
    const a = crystals[i];
    // 找最近邻
    let best = null;
    let bestD = Infinity;
    for (let j = i + 1; j < crystals.length; j++) {
      const d = a.dir.angleTo(crystals[j].dir);
      if (d < bestD) {
        bestD = d;
        best = crystals[j];
      }
    }
    if (!best || bestD > 0.6) continue;
    const p0 = a.dir.clone().multiplyScalar(R + a.h * 0.7);
    const p1 = best.dir.clone().multiplyScalar(R + best.h * 0.7);
    const geo = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    group.add(new THREE.Line(geo, bridgeMat));
  }

  scene.add(group);
  return { group, crystals, grand };
}
