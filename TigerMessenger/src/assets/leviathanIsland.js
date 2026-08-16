// =====================================================================
//  太古巨型浮岛白鲸（The Grand Leviathan Island）
//
//  世界观重构：西芳寺苔庭不再贴地球面，而是整座扎根、承托在
//  一尾在天空中缓缓漂移的太古白鲸脊背上。本模块只产出「鲸体资产」：
//   - 非等比极致拉伸的山岳级流线型躯干（压扁拉长的低面数球体）
//   - 背部横向切平的墨绿苔原地壳层（西芳寺的地基容器）
//   - 后方斜向上 35° 微翘扬起的巨型 Y 字分叉尾鳍
//   - 20 枚极扁太古藤壶贴片 + 环绕地壳的「防空灌木围墙」
//   - 平缓呼吸缓动：leviathanGroup 随极低频正弦起伏 + 缓慢漂移
//
//  调用方（scenes/saihojiGarden.js）负责把苔庭组装配到鲸背：
//  见 buildEcoLeviathanIsland 的 opts（basePos/up/forward 锁定栖息位）。
//
//  性能：全部低面数网格 + 描边壳，SwiftShader 无头环境开销可忽略。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

/** 鲸体珍珠青白（太古皮肤） */
const SKIN = 0xe8f8f5;
/** 藤壶浅壳色 */
const BARNACLE = 0xd6eaf8;
/** 地壳深苔绿（西芳寺苔庭地基） */
const CRUST = 0x2e7d32;
/** 灌木围墙翠绿 */
const SHRUB = 0x3e8e52;
/** 全场景水墨粗描边厚度（用户锁死） */
const OUTLINE_W = 0.055;
/** 地壳板局部高度：鲸背在此「横向切平」 */
export const LEVIATHAN_PLATE_Y = 6.08;
/** 苔庭压缩比：六景跨度 ~40×23 → ~22×12.6，收进 25×14 地壳板 */
export const LEVIATHAN_GARDEN_SCALE = 0.55;

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 极扁三角形（尾鳍用）：三点逆时针铺平，DoubleSide 才能双面描边。 */
function flatTriangle(a, b, c, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]], 3)
  );
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/**
 * 构建太古巨型浮岛白鲸资产（含呼吸缓动 + 藏地/升空两态）。
 *
 * 藏地态（minR）：整头鲸沉入星球地下，只有背部苔原地壳与苔庭露出
 * 地表——「平时只见苔庭」；升空态（maxR）：扫描灯艇掠过时整鲸升空。
 * 两态之间由 setAnchorRadius() 平滑过渡；尾柄/尾鳍随升空微延迟地
 * 从「贴地收起」到「斜向上 35° 扬起」。
 *
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.basePos] 栖息锚点（世界位）。缺省原点。
 * @param {THREE.Vector3} [opts.up] 鲸体上方（径向朝外）。缺省 +Y。
 * @param {THREE.Vector3} [opts.forward] 鲸头朝向（局部 +X）。缺省 +X。
 * @param {number} [opts.minR] 藏地锚点半径（鲸身全沉地下；默认 = basePos 长度）
 * @param {number} [opts.maxR] 升空锚点半径（默认 = basePos 长度）
 * @param {number} [opts.plateWorldLift] 藏地时苔庭岛留驻的地表径向高度
 *   （默认 = basePos 长度 + 地壳板高）——鲸沉入地下时岛面不随之下陷
 * @param {number} [opts.seed]
 * @returns {{ group: THREE.Group, island: THREE.Group,
 *             update: (dt:number, t:number) => void,
 *             setAnchorRadius: (r:number) => void }}
 */
export function buildEcoLeviathanIsland(opts = {}) {
  const rnd = lcg(opts.seed ?? 9901);
  const upN = (opts.up || new THREE.Vector3(0, 1, 0)).clone().normalize();
  const fwdN = (opts.forward || new THREE.Vector3(1, 0, 0))
    .clone()
    .addScaledVector(upN, -(opts.forward || new THREE.Vector3(1, 0, 0)).dot(upN))
    .normalize();
  const rightN = new THREE.Vector3().crossVectors(fwdN, upN).normalize(); // 组局部 +Z
  const basePos = opts.basePos ? opts.basePos.clone() : new THREE.Vector3();
  const minR = Number.isFinite(opts.minR) ? opts.minR : basePos.length();
  const maxR = Number.isFinite(opts.maxR) ? opts.maxR : basePos.length();
  let anchorR = THREE.MathUtils.clamp(basePos.length(), minR, maxR);

  const group = new THREE.Group();
  group.name = "leviathanGroup";

  // 组姿态：局部 +X=鲸头 / +Y=背脊上方 / +Z=右舷。
  // makeBasis 列 = (X, Y, Z)；右手性：X×Y=Z ⇔ fwd×up=right，
  // 故 Z 列取 cross(fwd, up)（= -cross(up, fwd)）。
  _q.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      fwdN.clone(),
      upN.clone(),
      new THREE.Vector3().crossVectors(fwdN, upN).normalize()
    )
  );
  group.quaternion.copy(_q);

  // ---------- 1. 主躯干：非等比极致拉伸的山岳巨鲸 ----------
  // SphereGeometry(8,16,12) × (4.5, 1.3, 2.2)：总长 72（玩家 35~40 倍），
  // 前粗后尖的流线由「球体拉伸 + 尾柄收细 + 尾鳍」三段共同完成；
  // 躯干整体下沉，使背部最高点恰好在 Y=6——地壳板在此横向切平封顶。
  {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(8.0, 16, 12),
      toonMat(SKIN, { flatShading: true })
    );
    body.name = "leviathan-body";
    body.scale.set(4.5, 1.3, 2.2); // 缩放死代码：锁死
    body.position.y = 6 - 8 * 1.3; // 背顶 = +6.0
    body.castShadow = true;
    body.receiveShadow = true;
    addOutline(body, OUTLINE_W);
    group.add(body);

    // 20 枚极扁太古藤壶：贴躯体表面，避开地壳板投影区与腹底
    let placed = 0;
    let guard = 0;
    while (placed < 20 && guard < 400) {
      guard++;
      const lat = (rnd() - 0.5) * Math.PI * 0.92;
      const lon = rnd() * Math.PI * 2;
      const dx = Math.cos(lat) * Math.cos(lon);
      const dy = Math.sin(lat);
      const dz = Math.cos(lat) * Math.sin(lon);
      const x = dx * 8 * 4.5;
      const y = dy * 8 * 1.3 + body.position.y;
      const z = dz * 8 * 2.2;
      if (Math.abs(x) < 13.2 && Math.abs(z) < 7.6 && y > 3.4) continue; // 板下投影
      if (y < -9.5) continue; // 腹底留白
      const barn = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        toonMat(BARNACLE, { flatShading: true })
      );
      barn.name = "leviathan-barnacle";
      const s = 0.32 + rnd() * 0.3;
      barn.scale.set(s * (0.85 + rnd() * 0.5), s * (0.16 + rnd() * 0.12), s * (0.85 + rnd() * 0.5));
      barn.position.set(x, y, z);
      // 椭球面法向 = (dx/sx², dy/sy², dz/sz²) 归一化
      const n = new THREE.Vector3(dx / 20.25, dy / 1.69, dz / 4.84).normalize();
      barn.quaternion.setFromUnitVectors(_up, n);
      barn.rotateY(rnd() * Math.PI);
      addOutline(barn, OUTLINE_W);
      group.add(barn);
      placed++;
    }
  }

  // ---------- 2. 背部苔原地壳层：西芳寺的地基容器 ----------
  // islandGroup 的局部原点 = 地壳板面（升空时随鲸、藏地时脱离鲸体
  // 留在球面地表——「平时只见苔庭」，鲸身整头沉入地下）。
  const plateWorldLift = Number.isFinite(opts.plateWorldLift)
    ? opts.plateWorldLift
    : basePos.length() + LEVIATHAN_PLATE_Y;
  const island = new THREE.Group();
  island.name = "leviathan-island";
  island.position.y = LEVIATHAN_PLATE_Y;
  group.add(island);
  {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(25.0, 14.0),
      toonMat(CRUST, { flatShading: true, side: THREE.DoubleSide })
    );
    plate.name = "leviathan-crust-plate";
    plate.rotation.x = -Math.PI / 2; // 绕 X 转 90° 平躺
    plate.position.y = 0;
    plate.castShadow = true;
    plate.receiveShadow = true;
    addOutline(plate, OUTLINE_W);
    island.add(plate);

    // 板面苔斑：墨绿/草绿系极扁圆片铺在板面上，承接西芳寺苔庭的
    // 地面语言（远端苔斑沉进板内时，板面仍读作苔原而非裸板）
    const MOSS_TONES = [0x3e704f, 0x477f58, 0x548c60, 0x5c9767, 0x1a331e];
    for (let i = 0; i < 42; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(1, 8),
        toonMat(MOSS_TONES[(rnd() * MOSS_TONES.length) | 0], {
          flatShading: true,
          side: THREE.DoubleSide,
        })
      );
      patch.name = "leviathan-moss-patch";
      const rx = 0.5 + rnd() * 1.15;
      const rz = 0.4 + rnd() * 1.0;
      patch.scale.set(rx, 0.05 + rnd() * 0.05, rz);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (rnd() * 2 - 1) * 11.6,
        0.02 + rnd() * 0.06,
        (rnd() * 2 - 1) * 6.2
      );
      patch.rotation.z = rnd() * Math.PI;
      patch.receiveShadow = true;
      island.add(patch);
    }

    // 防空灌木围墙：沿板缘一圈翠绿低面数小球，模糊鲸肤与大地的交界线
    const halfW = 12.5;
    const halfD = 7.0;
    const perimeter = 2 * (25 + 14);
    const count = 26;
    for (let i = 0; i < count; i++) {
      const s = (i / count) * perimeter;
      let x = 0;
      let z = 0;
      const a = 25; // 底边
      const b = 14; // 侧边
      if (s < a) {
        x = -halfW + s;
        z = -halfD;
      } else if (s < a + b) {
        x = halfW;
        z = -halfD + (s - a);
      } else if (s < 2 * a + b) {
        x = halfW - (s - a - b);
        z = halfD;
      } else {
        x = -halfW;
        z = halfD - (s - 2 * a - b);
      }
      const shrub = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        toonMat(SHRUB, { flatShading: true })
      );
      shrub.name = "leviathan-shrub-ring";
      const scl = 0.42 + rnd() * 0.4;
      shrub.scale.set(scl, scl * 0.62, scl);
      // 略外探半身，包住板缘棱线
      shrub.position.set(
        x + Math.sign(x || 1e-4) * rnd() * 0.9,
        0.1 + rnd() * 0.42,
        z + Math.sign(z || 1e-4) * rnd() * 0.9
      );
      shrub.rotateY(rnd() * Math.PI);
      addOutline(shrub, OUTLINE_W);
      island.add(shrub);
    }
  }

  // ---------- 3. 尾柄 + 巨型 Y 字分叉尾鳍（斜向上 35° 微翘） ----------
  // 藏地态：尾柄贴地收起、尾鳍放平（整鲸藏进地下，只见苔庭）；
  // 升空态：尾柄回位、尾鳍以微延迟重新扬起 35°——升空时的神韵动作。
  const TAIL_Y_UP = 3.6;
  const TAIL_Y_BURIED = -2.0;
  const tailRoot = new THREE.Group();
  tailRoot.name = "leviathan-tail-root";
  tailRoot.position.y = TAIL_Y_UP;
  group.add(tailRoot);
  {
    // CylinderGeometry(rTop, rBottom)：绕 Z −90° 后 +Y→+X，
    // 「顶」落在近体侧（x=−30）、「底」落在尾端（x=−44）——
    // 近体粗 2.55、尾端细 1.15，向后逐渐收窄。
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 1.15, 14, 10),
      toonMat(SKIN, { flatShading: true })
    );
    stalk.name = "leviathan-tail-stalk";
    stalk.rotation.z = -Math.PI / 2; // 圆柱轴沿 -X 后伸
    stalk.position.set(-37, 0, 0);
    stalk.castShadow = true;
    addOutline(stalk, OUTLINE_W);
    tailRoot.add(stalk);

    // 尾鳍组：双片扁平三角，从尾尖向左右展开；rotation.x=0.6 高高翘起
    const flukes = new THREE.Group();
    flukes.name = "leviathan-flukes";
    flukes.position.set(-44, 0, 0);
    flukes.rotation.x = 0.6; // 斜向上微翘 ~35°
    const skinMat = toonMat(SKIN, { flatShading: true, side: THREE.DoubleSide });
    const wing = (side) => {
      const tri = flatTriangle(
        [0, 0, 0],
        [-8.6, 0, side * 4.8],
        [-6.2, 0, side * 0.7],
        skinMat
      );
      tri.name = `leviathan-fluke-${side < 0 ? "L" : "R"}`;
      tri.castShadow = true;
      addOutline(tri, OUTLINE_W);
      flukes.add(tri);
    };
    wing(-1);
    wing(1);
    tailRoot.add(flukes);
  }

  // ---------- 4. 平缓呼吸 + 缓慢漂移 + 藏地/升空尾姿 ----------
  // 用户锁死：position.y = sin(t·0.6)·0.25。鲸体上方在世界系近似 +Y
  // （栖息于 lat56），此处沿「鲸体上方」做同频径向起伏，语义一致且
  // 不破坏球面定位；另叠极低频的切向漂移（±1.1），呼应「缓缓漂移」。
  const _anchor = new THREE.Vector3();
  const _base = new THREE.Vector3();
  const setAnchorRadius = (r) => {
    anchorR = THREE.MathUtils.clamp(Number(r) || minR, minR, maxR);
  };
  const update = (_dt, t) => {
    const time = Number(t) || 0;
    _anchor.copy(upN).multiplyScalar(anchorR);
    const bob = Math.sin(time * 0.6) * 0.25;
    const driftF = Math.sin(time * 0.05 + 1.3) * 1.1;
    const driftR = Math.sin(time * 0.07) * 1.1;
    group.position
      .copy(_anchor)
      .addScaledVector(upN, bob)
      .addScaledVector(fwdN, driftF)
      .addScaledVector(rightN, driftR);
    // 尾姿随升空进度：尾鳍比躯干微延迟 12% 扬起
    const span = Math.max(1e-6, maxR - minR);
    const t01 = THREE.MathUtils.clamp((anchorR - minR) / span, 0, 1);
    const k = t01 <= 0.12 ? 0 : (t01 - 0.12) / 0.88;
    const tailT = k * k * (3 - 2 * k); // smoothstep
    tailRoot.position.y = THREE.MathUtils.lerp(TAIL_Y_BURIED, TAIL_Y_UP, tailT);
    const flukes = tailRoot.getObjectByName("leviathan-flukes");
    if (flukes) flukes.rotation.x = 0.6 * tailT;
    // 苔庭岛随鲸/留地：升空时骑在鲸背（Y=PLATE_Y），藏地时脱离鲸体、
    // 留在地表（plateWorldLift）——鲸身沉入地下，只见苔庭
    island.position.y = Math.max(LEVIATHAN_PLATE_Y, plateWorldLift - anchorR);
  };
  update(0, 0);

  return { group, update, setAnchorRadius, island };
}
