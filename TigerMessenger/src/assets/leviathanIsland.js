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
/** 整鲸（连同背上苔庭）线性缩放：体积观感缩到一半 */
export const LEVIATHAN_SIZE = 0.5;

const _up = new THREE.Vector3(0, 1, 0);

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
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
 * @param {number} [opts.groundRadius] 星球地表半径（默认 = minR）——
 *   升空落雨的水滴坠到地表高度即隐
 * @param {number} [opts.seed]
 * @returns {{ group: THREE.Group, island: THREE.Group,
 *             update: (dt:number, t:number) => void,
 *             setAnchorRadius: (r:number) => void }}
 */
export function buildEcoLeviathanIsland(opts = {}) {
  const rnd = lcg(opts.seed ?? 9901);
  const upN = (opts.up || new THREE.Vector3(0, 1, 0)).clone().normalize();
  const fwdN = (opts.forward || new THREE.Vector3(1, 0, 0)).clone();
  fwdN.addScaledVector(upN, -fwdN.dot(upN));
  if (fwdN.lengthSq() < 1e-8) {
    fwdN.set(0, 0, 1).addScaledVector(upN, -upN.z);
    if (fwdN.lengthSq() < 1e-8) fwdN.set(1, 0, 0).addScaledVector(upN, -upN.x);
  }
  fwdN.normalize();
  const rightN = new THREE.Vector3().crossVectors(fwdN, upN).normalize();
  fwdN.crossVectors(upN, rightN).normalize();
  const basePos = opts.basePos ? opts.basePos.clone() : new THREE.Vector3();
  const minR = Number.isFinite(opts.minR) ? opts.minR : basePos.length();
  const maxR = Number.isFinite(opts.maxR) ? opts.maxR : basePos.length();
  let anchorR = THREE.MathUtils.clamp(basePos.length(), minR, maxR);

  const group = new THREE.Group();
  group.name = "leviathanGroup";

  // 组姿态：局部 +X=鲸头 / +Y=背脊上方 / +Z=右舷。
  const _basis = new THREE.Matrix4().makeBasis(fwdN, upN, rightN);
  group.quaternion.setFromRotationMatrix(_basis);
  const poseQ = group.quaternion.clone();

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

    // 额头 + 吻突：把拉伸球体读成鲸头，而不是一颗光蛋
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 10),
      toonMat(SKIN, { flatShading: true })
    );
    head.name = "leviathan-head";
    head.scale.set(1.55, 0.72, 1.18);
    head.position.set(24.5, -2.15, 0);
    head.castShadow = true;
    addOutline(head, OUTLINE_W);
    group.add(head);
    const snout = new THREE.Mesh(
      new THREE.SphereGeometry(8, 10, 8),
      toonMat(SKIN, { flatShading: true })
    );
    snout.name = "leviathan-snout";
    snout.scale.set(1.28, 0.42, 0.58);
    snout.position.set(33.2, -4.85, 0);
    snout.castShadow = true;
    addOutline(snout, OUTLINE_W);
    group.add(snout);

    // 臀段：塞进躯干后极，把身体和尾柄焊死，中间不许留缝
    const rump = new THREE.Mesh(
      new THREE.SphereGeometry(8, 14, 11),
      toonMat(SKIN, { flatShading: true })
    );
    rump.name = "leviathan-rump";
    rump.scale.set(1.62, 0.94, 1.18);
    rump.position.set(-24.2, -4.15, 0);
    rump.castShadow = true;
    addOutline(rump, OUTLINE_W);
    group.add(rump);

    // 胸鳍：贴在躯干中段两侧，增加剪影
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 9.2, 6),
        toonMat(SKIN, { flatShading: true })
      );
      pec.name = `leviathan-pectoral-${side < 0 ? "L" : "R"}`;
      pec.scale.set(1, 0.22, 1.05);
      pec.position.set(6.5, -7.2, side * 14.2);
      pec.rotation.z = Math.PI / 2;
      pec.rotation.y = side * 0.42;
      pec.rotation.x = side * 0.18;
      pec.castShadow = true;
      addOutline(pec, OUTLINE_W);
      group.add(pec);
    }

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
  const size = LEVIATHAN_SIZE;
  group.scale.setScalar(size);
  const plateWorldLift = Number.isFinite(opts.plateWorldLift)
    ? opts.plateWorldLift
    : basePos.length() + LEVIATHAN_PLATE_Y * size;
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

  // ---------- 3. 尾柄 + 巨型 Y 字分叉尾鳍 ----------
  // 枢纽钉在臀段内部，只绕 Z 俯仰，禁止整段平移——平移会把尾巴从身上撕开。
  // 藏地：尾柄下折收起；升空：尾柄回水平并微抬，尾鳍再扬 35°。
  const TAIL_Z_BURIED = 0.78;
  const TAIL_Z_RISEN = -0.2;
  const tailRoot = new THREE.Group();
  tailRoot.name = "leviathan-tail-root";
  tailRoot.position.set(-31.2, -3.55, 0);
  tailRoot.rotation.z = TAIL_Z_RISEN;
  group.add(tailRoot);
  {
    const skinMat = toonMat(SKIN, { flatShading: true });
    const cuff = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), skinMat);
    cuff.name = "leviathan-tail-cuff";
    cuff.scale.set(0.78, 0.74, 0.92);
    cuff.position.set(1.2, 0, 0);
    cuff.castShadow = true;
    addOutline(cuff, OUTLINE_W);
    tailRoot.add(cuff);

    const addStalk = (name, rNear, rFar, len, x, y = 0) => {
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(rNear, rFar, len, 11),
        skinMat
      );
      stalk.name = name;
      stalk.rotation.z = -Math.PI / 2;
      stalk.position.set(x, y, 0);
      stalk.castShadow = true;
      addOutline(stalk, OUTLINE_W);
      tailRoot.add(stalk);
      return stalk;
    };
    // 三段交叠收细：近体粗端插进臀段，远端口对上尾鳍根
    addStalk("leviathan-tail-stalk", 5.35, 3.55, 9.2, -3.8, 0.05);
    addStalk("leviathan-tail-mid", 3.6, 2.05, 8.4, -11.8, 0.18);
    addStalk("leviathan-tail-tip", 2.1, 1.05, 6.6, -18.8, 0.38);

    const flukes = new THREE.Group();
    flukes.name = "leviathan-flukes";
    flukes.position.set(-22.2, 0.45, 0);
    flukes.rotation.x = 0.6;
    const flukeMat = toonMat(SKIN, { flatShading: true });
    const wing = (side) => {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(3.6, 10.4, 7), flukeMat);
      tri.name = `leviathan-fluke-${side < 0 ? "L" : "R"}`;
      tri.scale.set(1.05, 1, 0.2);
      tri.position.set(-4.6, 0, side * 2.15);
      tri.rotation.z = Math.PI / 2;
      tri.rotation.y = side * 0.38;
      tri.castShadow = true;
      addOutline(tri, OUTLINE_W);
      flukes.add(tri);
    };
    wing(-1);
    wing(1);
    tailRoot.add(flukes);
  }

  // ---------- 3b. 升空落雨：苔庭的水沿鲸身滑落、如雨坠向地面 ----------
  // 只在上浮时触发（上升速度驱动发射率；下沉不落雨）。水滴两个来源：
  // 苔庭地壳板缘（水从板缘滴落）+ 鲸身上半球（水沿体表下滑、过赤道
  // 后脱离坠落）；坠到地面高度即隐。水滴挂鲸体局部系，随鲸呼吸漂移。
  const groundRadius = Number.isFinite(opts.groundRadius)
    ? opts.groundRadius
    : minR;
  const RAIN_POOL = 110;
  const rainGroup = new THREE.Group();
  rainGroup.name = "leviathan-rain";
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0.3, 0, 0.1, -0.26, 0.06, -0.1, -0.26, 0.06, 0, 0.06, -0.17],
      3
    )
  );
  rainGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2]);
  rainGeo.computeVertexNormals();
  const rainMats = [0xbfe8f2, 0xd6f2fb, 0x9fd4e8].map(
    (c) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
  );
  const rainDrops = [];
  for (let i = 0; i < RAIN_POOL; i++) {
    const drop = new THREE.Mesh(rainGeo, rainMats[i % rainMats.length]);
    drop.visible = false;
    drop.userData = {
      dir: new THREE.Vector3(0, 1, 0),
      phase: 0,
      vel: new THREE.Vector3(),
      life: 0,
      dur: 2.4,
      s0: 0.6 + rnd() * 0.5,
    };
    rainGroup.add(drop);
    rainDrops.push(drop);
  }
  group.add(rainGroup);
  const _rn = new THREE.Vector3();
  const _rt = new THREE.Vector3();
  const _redge = { x: 0, z: 0 };
  const BODY_Y = 6 - 8 * 1.3; // 躯干局部 Y（与主躯干同值）
  const rainEdgePoint = () => {
    const s = rnd() * 78; // 板缘周长 2·(25+14)
    if (s < 25) {
      _redge.x = -12.5 + s;
      _redge.z = -7;
    } else if (s < 39) {
      _redge.x = 12.5;
      _redge.z = -7 + (s - 25);
    } else if (s < 64) {
      _redge.x = 12.5 - (s - 39);
      _redge.z = 7;
    } else {
      _redge.x = -12.5;
      _redge.z = 7 - (s - 64);
    }
  };
  const spawnRain = () => {
    const drop = rainDrops[rainCursor];
    rainCursor = (rainCursor + 1) % rainDrops.length;
    if (!drop) return;
    const u = drop.userData;
    u.life = 0;
    u.dur = 2.2 + rnd() * 0.9;
    u.s0 = 0.5 + rnd() * 0.55;
    if (rnd() < 0.5) {
      // 苔庭地壳板缘滴落
      rainEdgePoint();
      u.phase = 1;
      u.vel.set((rnd() - 0.5) * 2.4, -1.2 - rnd() * 1.6, (rnd() - 0.5) * 2.4);
      drop.position.set(
        _redge.x + (rnd() - 0.5) * 0.6,
        island.position.y + 0.08,
        _redge.z + (rnd() - 0.5) * 0.6
      );
    } else {
      // 鲸身上半球：沿体表下滑
      let d = null;
      for (let guard = 0; guard < 12 && !d; guard++) {
        const lat = rnd() * 1.25;
        const lon = rnd() * Math.PI * 2;
        const dx = Math.cos(lat) * Math.cos(lon);
        const dy = Math.sin(lat);
        const dz = Math.cos(lat) * Math.sin(lon);
        const x = dx * 36;
        const z = dz * 17.6;
        if (Math.abs(x) < 13.2 && Math.abs(z) < 7.6) continue; // 板下
        d = new THREE.Vector3(dx, dy, dz);
      }
      if (!d) return;
      u.dir.copy(d);
      u.phase = 0;
      u.vel.set(0, 0, 0);
      drop.position.set(u.dir.x * 36, u.dir.y * 10.4 + BODY_Y, u.dir.z * 17.6);
    }
    drop.visible = true;
  };
  const updateRain = (dt) => {
    const groundLocalY = groundRadius - anchorR + 0.6;
    for (const drop of rainDrops) {
      if (!drop.visible) continue;
      const u = drop.userData;
      u.life += dt;
      const e = Math.min(1, u.life / u.dur);
      if (e >= 1) {
        drop.visible = false;
        continue;
      }
      if (u.phase === 0) {
        // 沿椭球面下滑：法向 (dx/sx², dy/sy², dz/sz²)，滑向 = -Y 切向
        _rn.set(u.dir.x / 20.25, u.dir.y / 1.69, u.dir.z / 4.84).normalize();
        _rt.set(0, -1, 0).addScaledVector(_rn, -_rn.y);
        if (_rt.lengthSq() < 1e-8) _rt.set(1, 0, 0).addScaledVector(_rn, -_rn.x);
        _rt.normalize();
        u.dir.addScaledVector(_rt, dt * (1.6 + rnd() * 1.4)).normalize();
        drop.position.set(u.dir.x * 36, u.dir.y * 10.4 + BODY_Y, u.dir.z * 17.6);
        if (u.dir.y < -0.12) {
          // 滑过赤道：脱离体表，沿切向初速坠落
          u.phase = 1;
          u.vel.set(
            _rt.x * 3.4 + (rnd() - 0.5) * 0.8,
            _rt.y * 3.4,
            _rt.z * 3.4 + (rnd() - 0.5) * 0.8
          );
        }
      } else {
        u.vel.y -= 13 * dt; // 重力（鲸体上方 = +Y）
        u.vel.x *= 0.985;
        u.vel.z *= 0.985;
        drop.position.addScaledVector(u.vel, dt);
        if (drop.position.y < groundLocalY) {
          drop.visible = false;
          continue;
        }
      }
      drop.scale.setScalar(u.s0 * (1 - e) + 0.04);
    }
  };

  // ---------- 4. 平缓呼吸 + 缓慢漂移 + 藏地/升空尾姿 ----------
  // 用户锁死：position.y = sin(t·0.6)·0.25。鲸体上方在世界系近似 +Y
  // （栖息于 lat56），此处沿「鲸体上方」做同频径向起伏，语义一致且
  // 不破坏球面定位；另叠极低频的切向漂移（±1.1），呼应「缓缓漂移」。
  const _anchor = new THREE.Vector3();
  const _base = new THREE.Vector3();
  let _prevAnchorR = anchorR;
  let rainSpeed = 0;
  let rainAcc = 0;
  let rainCursor = 0;
  const setAnchorRadius = (r) => {
    anchorR = THREE.MathUtils.clamp(Number(r) || minR, minR, maxR);
  };
  const update = (_dt, t) => {
    const time = Number(t) || 0;
    const step = Math.min(1, Number(_dt) || 0.016);
    group.quaternion.copy(poseQ);
    _anchor.copy(upN).multiplyScalar(anchorR);
    const bob = Math.sin(time * 0.6) * 0.25 * size;
    const driftF = Math.sin(time * 0.05 + 1.3) * 1.1 * size;
    const driftR = Math.sin(time * 0.07) * 1.1 * size;
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
    tailRoot.rotation.z = THREE.MathUtils.lerp(TAIL_Z_BURIED, TAIL_Z_RISEN, tailT);
    const flukes = tailRoot.getObjectByName("leviathan-flukes");
    if (flukes) flukes.rotation.x = 0.6 * tailT;
    // 苔庭岛随鲸/留地：升空时骑在鲸背（Y=PLATE_Y），藏地时脱离鲸体、
    // 留在地表（plateWorldLift）——鲸身沉入地下，只见苔庭
    {
      const rideY = LEVIATHAN_PLATE_Y;
      const detachWorld = plateWorldLift - anchorR;
      island.position.y =
        detachWorld > rideY * size ? detachWorld / size : rideY;
    }

    // ---- 升空落雨：上升速度驱动发射，峰值在中段；下沉不落雨 ----
    const vRise = step > 1e-4 ? (anchorR - _prevAnchorR) / step : 0;
    _prevAnchorR = anchorR;
    rainSpeed += (Math.max(0, vRise) - rainSpeed) * Math.min(1, step * 1.6);
    const wRain = Math.sin(Math.PI * THREE.MathUtils.clamp(t01, 0, 1));
    rainAcc += step * rainSpeed * 34 * wRain;
    while (rainAcc >= 1) {
      spawnRain();
      rainAcc -= 1;
    }
    updateRain(step);
  };
  update(0, 0);

  return { group, update, setAnchorRadius, island };
}
