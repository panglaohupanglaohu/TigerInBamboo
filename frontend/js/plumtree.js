// 寒梅归雁图 · 第二层：繁花古梅（画眼）+ 梅下小竹丛 + 塘岸芦苇 + 落花瓣
// 古梅十倍之姿，枝干八层生发：
//   向上五层 —— 一、二层分形；三、四层转横向；五层为向下垂枝之起始层
//   向下三层 —— 垂枝分形三层；其中黄金分割点（0.618）出一枝超长垂枝（约常枝 3 倍）
//   向上一、二层之黄金分割点亦出超长枝（约常枝 5 倍），独枝冲天、不再分枝
//   另有一支出画垂枝：画面右 1/5 处横垂入画、梢头出画右缘，主枝分形多枝、繁花似锦（按全景机位投影反推枝位）
import * as THREE from "../assets/vendor/three/three.module.js";
import * as BufferGeometryUtils from "../assets/vendor/three/jsm/utils/BufferGeometryUtils.js";
import { makeRandom, groundHeight, PLUM_TREE_POS, POND } from "./environment-plum.js";

const BARK_DARK = new THREE.Color(0x3d2f24);   // 老干皴皮深褐
const BARK_LIGHT = new THREE.Color(0x6b5640);  // 向阳面赭褐
const PETAL_WHITE = new THREE.Color(0xeef1f2); // 冷白（高冷墨梅为骨）
const PETAL_PINK = new THREE.Color(0xd7a7a6);  // 极淡赭粉，仅作微晕
const BUD_RED = new THREE.Color(0xb8766c);     // 花蕾红，稀疏提神

const GOLD = 0.618; // 黄金分割点

// 沿短曲线起一截锥化管（干/枝），带树皮皴皱与顶点色
function tubeAlong(curvePts, r0, r1, radialSegs, rand) {
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const segs = Math.max(10, curvePts.length * 6);
  const geo = new THREE.TubeGeometry(curve, segs, 1, radialSegs, false);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const center = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = uv.getX(i);
    curve.getPoint(t, center);
    v.fromBufferAttribute(pos, i).sub(center);
    const r = THREE.MathUtils.lerp(r0, r1, t);
    const gn = 1 + 0.09 * Math.sin(t * 26 + v.x * 2.2) * Math.sin(t * 15 + 1.3); // 皴皱
    v.setLength(Math.max(r * gn, 0.1));
    pos.setXYZ(i, center.x + v.x, center.y + v.y, center.z + v.z);
  }
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = uv.getX(i);
    c.copy(BARK_DARK).lerp(BARK_LIGHT, THREE.MathUtils.clamp(t * 0.7 + (rand() - 0.5) * 0.3 + 0.3, 0, 1));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export class PlumGrove {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.time = 0;
    this.bambooSnowCaps = []; // 竹上积雪帽（可被大雁碰落）
    this._initFragmentPool();
    this._buildTree();
    this._buildBambooClumps();
    this._buildReeds();
    this._buildPetals();
  }

  /** 雪屑池：积雪碰落时飞溅的小雪粒 */
  _initFragmentPool() {
    const fragGeo = new THREE.SphereGeometry(0.05, 4, 3);
    this._fragPool = [];
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(fragGeo, new THREE.MeshStandardMaterial({ color: 0xf4f6f4, roughness: 1 }));
      m.visible = false;
      this.scene.add(m);
      this._fragPool.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }
  }

  _spawnFragments(pos) {
    const n = 6 + Math.floor(Math.random() * 4);
    let spawned = 0;
    for (const frag of this._fragPool) {
      if (frag.life > 0) continue;
      frag.mesh.position.copy(pos);
      frag.mesh.scale.setScalar(1);
      frag.mesh.visible = true;
      frag.vel.set(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 1.5 + 0.3,
        (Math.random() - 0.5) * 2.5);
      frag.life = 1.2 + Math.random() * 0.4;
      if (++spawned >= n) break;
    }
  }

  /** 大雁碰落竹上积雪：飞行中的雁接近雪帽时触发雪块脱落飞溅 */
  updateBambooSnow(dt, geese) {
    if (!this.bambooSnowCaps.length || !geese) return;
    for (const cap of this.bambooSnowCaps) {
      if (cap.state === "resting") {
        for (const g of geese) {
          if (g.state !== "FORM" && g.state !== "LAND" && g.state !== "TAKEOFF") continue;
          if (g.pos.distanceTo(cap.pos) < 3.0) {
            cap.state = "falling";
            const knock = new THREE.Vector3().subVectors(cap.pos, g.pos).normalize();
            cap.vel.copy(knock).multiplyScalar(0.8 + Math.random() * 0.6);
            cap.vel.y = -0.3;
            cap.angVel.set(
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 4);
            this._spawnFragments(cap.pos);
            break;
          }
        }
      } else if (cap.state === "falling") {
        cap.vel.y -= 9.8 * dt;
        cap.mesh.position.addScaledVector(cap.vel, dt);
        cap.mesh.rotation.x += cap.angVel.x * dt;
        cap.mesh.rotation.y += cap.angVel.y * dt;
        cap.mesh.rotation.z += cap.angVel.z * dt;
        const gy = groundHeight(cap.mesh.position.x, cap.mesh.position.z);
        if (cap.mesh.position.y < gy + 0.1) {
          cap.state = "gone";
          cap.mesh.visible = false;
          cap.regenTimer = 20 + Math.random() * 12;
        }
      } else if (cap.state === "gone") {
        cap.regenTimer -= dt;
        if (cap.regenTimer <= 0) {
          cap.state = "resting";
          cap.mesh.position.copy(cap.origPos);
          cap.mesh.quaternion.copy(cap.origQuat);
          cap.mesh.visible = true;
          cap.vel.set(0, 0, 0);
        }
      }
    }
    // 雪屑飞溅
    for (const frag of this._fragPool) {
      if (frag.life <= 0) continue;
      frag.life -= dt;
      if (frag.life <= 0) { frag.mesh.visible = false; continue; }
      frag.vel.y -= 6 * dt;
      frag.mesh.position.addScaledVector(frag.vel, dt);
      if (frag.life < 0.4) frag.mesh.scale.setScalar(frag.life / 0.4);
      const gy = groundHeight(frag.mesh.position.x, frag.mesh.position.z);
      if (frag.mesh.position.y < gy + 0.05) { frag.life = 0; frag.mesh.visible = false; }
    }
  }

  /** 一枝：start 沿 dir 长 len 的锥化管（down=true 时垂向下弯）；返回 {mid, end} */
  _bough(geos, rand, start, dir, len, r0, down) {
    const d = dir.clone().normalize();
    const mid = start.clone().addScaledVector(d, len * 0.5)
      .add(new THREE.Vector3((rand() - 0.5) * len * 0.06, (down ? -0.12 : 0.07) * len, (rand() - 0.5) * len * 0.06));
    const end = start.clone().addScaledVector(d, len);
    end.y += (down ? -0.3 : 0.14) * len; // 上枝梢头微挑 / 垂枝梢头沉坠
    geos.push(tubeAlong([start, mid, end], r0, Math.max(r0 * 0.45, 0.16), 6, rand));
    return { mid, end };
  }

  /** 分形枝：一枝生发 2~3 子枝，递归 depth→maxDepth 层，梢头集于 tips */
  _branch(geos, tips, rand, start, dir, len, r0, depth, maxDepth, down) {
    const { end } = this._bough(geos, rand, start, dir, len, r0, down);
    if (depth >= maxDepth) { tips.push(end); return end; }
    const n = 2 + (rand() < 0.5 ? 1 : 0);
    const d = dir.clone().normalize();
    for (let i = 0; i < n; i++) {
      const nd = d.clone();
      nd.applyAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 1.7);
      nd.y += down ? -(0.08 + rand() * 0.3) : (0.18 + rand() * 0.4);
      nd.normalize();
      this._branch(geos, tips, rand, end, nd, len * (0.55 + rand() * 0.15), r0 * 0.55, depth + 1, maxDepth, down);
    }
    if (rand() < 0.5) tips.push(end); // 枝节处亦着花
    return end;
  }

  /** 繁花古梅：十倍树干，八层枝法 */
  _buildTree() {
    const rand = makeRandom(2026);
    const geos = [], tips = [];
    const H = 55; // 十倍于旧（旧约 5.5m）

    // —— 主干：S 形扭曲上升，五个生发层位 ——
    const trunkPts = [
      new THREE.Vector3(0, -2, 0),
      new THREE.Vector3(H * 0.06, H * 0.16, H * 0.03),
      new THREE.Vector3(-H * 0.05, H * 0.33, H * 0.06),
      new THREE.Vector3(H * 0.045, H * 0.51, -H * 0.03),
      new THREE.Vector3(-H * 0.033, H * 0.69, H * 0.02),
      new THREE.Vector3(H * 0.022, H * 0.85, -H * 0.011),
      new THREE.Vector3(-H * 0.007, H * 0.97, H * 0.005),
    ];
    const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
    geos.push(tubeAlong(trunkPts, H * 0.062, H * 0.016, 10, rand));

    const upDir = (yaw, pitch) =>
      new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

    // —— 第一层（t≈0.16）· 第二层（t≈0.33）：分形枝，三层 —
    // 其中第一层主枝在黄金分割点出一枝 5 倍超长独枝，冲天不再分枝
    let goldenDone = false;
    const lowTiers = [
      { t: 0.16, yaws: [0.7, 2.9], pitch: 0.55, len: H * 0.26, r: H * 0.024 },
      { t: 0.33, yaws: [-1.2, 1.8], pitch: 0.5, len: H * 0.24, r: H * 0.022 },
    ];
    for (const tier of lowTiers) {
      const start = trunkCurve.getPoint(tier.t);
      for (const yaw of tier.yaws) {
        const dir = upDir(yaw, tier.pitch + (rand() - 0.5) * 0.15);
        const childLen = tier.len * 0.6;
        // 黄金分割超长独枝（仅全局一枝，出在第 1、2 层）
        if (!goldenDone) {
          const p618 = start.clone().addScaledVector(dir.clone().normalize(), tier.len * GOLD);
          const longDir = dir.clone(); longDir.y += 0.35;
          const longLen = childLen * 5; // 5 倍于常枝
          this._bough(geos, rand, p618, longDir, longLen, tier.r * 0.5, false);
          // 独枝梢头与沿途着花
          const ld = longDir.clone().normalize();
          for (let k = 1; k <= 4; k++) tips.push(p618.clone().addScaledVector(ld, longLen * k / 4));
          goldenDone = true;
        }
        this._branch(geos, tips, rand, start, dir, tier.len, tier.r, 1, 3, false);
      }
    }

    // —— 第三层（t≈0.51）· 第四层（t≈0.68）：枝干转横向，平伸而出 —
    const midTiers = [
      { t: 0.51, yaws: [0.3, 2.4, 4.2], len: H * 0.28, r: H * 0.018 },
      { t: 0.68, yaws: [-0.9, 1.5], len: H * 0.25, r: H * 0.016 },
    ];
    for (const tier of midTiers) {
      const start = trunkCurve.getPoint(tier.t);
      for (const yaw of tier.yaws) {
        const dir = upDir(yaw, (rand() - 0.5) * 0.16); // 横向：俯仰近零
        this._branch(geos, tips, rand, start, dir, tier.len, tier.r, 1, 3, false);
      }
    }

    // —— 第五层（t≈0.84）：向下垂枝之起始层（先上挑、继而下垂） ——
    const t5 = trunkCurve.getPoint(0.84);
    const downTiers = [
      { start: t5, yaws: [1.0, 3.4], pitch: 0.3, len: H * 0.2, r: H * 0.016 },
      { start: trunkCurve.getPoint(0.94), yaws: [-0.5, 2.0, 4.6], pitch: -0.15, len: H * 0.18, r: H * 0.014 },
    ];
    let longWeepDone = false;
    for (const tier of downTiers) {
      for (const yaw of tier.yaws) {
        const dir = upDir(yaw, tier.pitch + (rand() - 0.5) * 0.2);
        // 向下分形三层
        const childLen = tier.len * 0.6;
        // 黄金分割点出 3 倍超长垂枝（仅全局一枝，垂向沉坠、可及近地处）
        if (!longWeepDone) {
          const p618 = tier.start.clone().addScaledVector(dir.clone().normalize(), tier.len * GOLD);
          const longDir = dir.clone(); longDir.y -= 0.85;
          const longLen = childLen * 3; // 3 倍于常枝
          this._bough(geos, rand, p618, longDir, longLen, tier.r * 0.45, true);
          const ld = longDir.clone().normalize();
          for (let k = 1; k <= 4; k++) tips.push(p618.clone().addScaledVector(ld, longLen * k / 4));
          longWeepDone = true;
        }
        this._branch(geos, tips, rand, tier.start, dir, tier.len, tier.r, 1, 3, true);
      }
    }

    // —— 出画垂枝：画面右 1/5 处横垂入画，梢头出画右缘；主枝分形多枝、繁花似锦 ——
    // 枝点位按全景机位投影反推（世界坐标 → 树局部坐标）
    const gyT = groundHeight(PLUM_TREE_POS.x, PLUM_TREE_POS.z);
    const W = (x, y, z) => new THREE.Vector3(x - PLUM_TREE_POS.x, y - gyT, z - PLUM_TREE_POS.z);
    const overhang = [
      W(6, 29, 7), W(10, 27, 7.6), W(15, 24.2, 8), W(17, 20.3, 8),
      W(20.1, 16.5, 8), W(23.5, 13.5, 8), W(29, 11.1, 8),
    ];
    geos.push(tubeAlong(overhang, 0.5, 0.08, 6, rand));
    // 分形小枝：可见段每节出 1~2 枝，垂挂分形两层
    for (let k = 2; k < overhang.length - 1; k++) {
      const n = 1 + (rand() < 0.6 ? 1 : 0);
      for (let b = 0; b < n; b++) {
        const dir = new THREE.Vector3(0.6 + rand() * 0.8, -(0.5 + rand() * 0.5), (rand() - 0.5) * 1.2).normalize();
        this._branch(geos, tips, rand, overhang[k], dir, 2.2 + rand() * 1.8, 0.16, 1, 2, true);
      }
    }
    // 繁花似锦：主枝每段密缀花点三段，末梢亦着花
    for (let k = 1; k < overhang.length - 1; k++) {
      const a = overhang[k], b = overhang[k + 1];
      for (let j = 0; j < 3; j++) tips.push(a.clone().lerp(b, j / 3));
    }
    tips.push(overhang[overhang.length - 1]);

    const treeGeo = BufferGeometryUtils.mergeGeometries(geos);
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    const tree = new THREE.Mesh(treeGeo, treeMat);
    const gy = groundHeight(PLUM_TREE_POS.x, PLUM_TREE_POS.z);
    this.treeGroup = new THREE.Group();
    this.treeGroup.position.set(PLUM_TREE_POS.x, gy, PLUM_TREE_POS.z);
    tree.castShadow = tree.receiveShadow = true;
    this.treeGroup.add(tree);

    this._buildBlossoms(rand, tips);
    this.scene.add(this.treeGroup);
  }

  /** 繁花与花蕾：十倍树以"花团"意匠着花（白粉底、淡红晕），花量随配置 */
  _buildBlossoms(rand, tips) {
    const density = this.config.plum?.blossomDensity ?? 1.0;
    const petalXforms = [], petalColors = [], budXforms = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const tip of tips) {
      // 开花枝：花密集——每梢多枚、紧簇于枝（抖动半径收窄），呈国画繁花积翠
      const n = Math.max(2, Math.round((2.6 + rand() * 3.2) * density));
      for (let i = 0; i < n; i++) {
        p.set(tip.x + (rand() - 0.5) * 0.9, tip.y + (rand() - 0.5) * 0.7, tip.z + (rand() - 0.5) * 0.9);
        e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        q.setFromEuler(e);
        const sc = 0.5 + rand() * 0.5;  // 单花缩小（整体约为原 1/2）
        s.set(sc, sc * (0.7 + rand() * 0.4), sc);
        m.compose(p, q, s);
        petalXforms.push(m.clone());
        // 高冷：冷白为骨，淡粉仅作极轻晕染
        petalColors.push(PETAL_WHITE.clone().lerp(PETAL_PINK, rand() * 0.22));
      }
      if (rand() < 0.55) { // 梢头花蕾（红点提神，稀疏）
        p.set(tip.x + (rand() - 0.5) * 0.6, tip.y + (rand() - 0.5) * 0.5, tip.z + (rand() - 0.5) * 0.6);
        q.identity();
        s.setScalar(0.5 + rand() * 0.4);
        m.compose(p, q, s);
        budXforms.push(m.clone());
      }
    }

    // 单花：压扁小球成瓣状花点（径缩至约 0.28，于十倍古梅上如墨点疏花，求其高冷）
    const petalGeo = new THREE.SphereGeometry(0.28, 8, 6);
    petalGeo.scale(1, 0.5, 1);
    const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, petalXforms.length);
    petalXforms.forEach((mx, i) => {
      petals.setMatrixAt(i, mx);
      petals.setColorAt(i, petalColors[i]);
    });
    petals.castShadow = true;
    this.treeGroup.add(petals);

    const budGeo = new THREE.SphereGeometry(0.22, 6, 5);
    const budMat = new THREE.MeshStandardMaterial({ color: BUD_RED, roughness: 0.8 });
    const buds = new THREE.InstancedMesh(budGeo, budMat, budXforms.length);
    budXforms.forEach((mx, i) => buds.setMatrixAt(i, mx));
    this.treeGroup.add(buds);
  }

  /** 梅下小竹：两三丛相伴梅根，多节竹竿（节环突起）、节节生枝、枝分形、叶作长三角 */
  _buildBambooClumps() {
    const rand = makeRandom(404);
    const culmGeos = [], ringGeos = [], leafGeos = [];
    if (!this._snowMat) this._snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f4, roughness: 1 });
    // 丛位/每丛竹数/最大倾角均可配置（默认即塘扩后的梅根岸上丛位）
    const bc = this.config.plum?.bamboo ?? {};
    const perClump = Math.max(1, Math.round(bc.count ?? 5));
    const leanMax = ((bc.lean ?? 12) * Math.PI) / 180;
    const spots = (Array.isArray(bc.clumps) && bc.clumps.length ? bc.clumps : null)
      ?.map((c) => [c.x ?? 0, c.z ?? 0])
      ?? [[-14, 11.5], [-4, 12.5], [-10, 13]];

    // 细锥化短管（竿段/枝），无顶点色以便同类合并
    const slimTube = (pts, r0, r1, radial = 4) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, Math.max(4, pts.length * 3), 1, radial, false);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      const c = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const t = uv.getX(i);
        curve.getPoint(t, c);
        v.fromBufferAttribute(pos, i).sub(c);
        v.setLength(Math.max(THREE.MathUtils.lerp(r0, r1, t), 0.015));
        pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // 长三角叶：基部宽、尖端收，叶尖下垂（本地 +Z 向，宽 X）
    const leafGeo = (len, w) => {
      const N = 5, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const ww = (w * (1 - t)) / 2;
        pos.push(-ww, -len * 0.3 * t * t, len * t, ww, -len * 0.3 * t * t, len * t);
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };

    // 分形枝：一枝生发 2~3 子枝，递归两层，梢头簇生长三角叶
    const branchOut = (start, dir, len, r, depth) => {
      const mid = start.clone().addScaledVector(dir, len * 0.5);
      mid.y -= len * 0.05;
      const end = start.clone().addScaledVector(dir, len);
      end.y -= len * 0.12; // 枝梢微垂
      culmGeos.push(slimTube([start, mid, end], r, Math.max(r * 0.5, 0.012)));
      if (depth < 2) {
        const n = 2 + (rand() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const nd = dir.clone();
          nd.applyAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 1.9);
          nd.y += 0.1 + rand() * 0.35;
          nd.normalize();
          branchOut(end, nd, len * (0.5 + rand() * 0.18), r * 0.6, depth + 1);
        }
      } else {
        const ln = 2 + Math.floor(rand() * 2);
        for (let j = 0; j < ln; j++) {
          const leaf = leafGeo(1.5 + rand() * 1.0, 0.34);
          leaf.rotateX((rand() - 0.5) * 0.7);
          leaf.rotateY(rand() * Math.PI * 2);
          leaf.translate(
            end.x + (rand() - 0.5) * 0.5,
            end.y - rand() * 0.25,
            end.z + (rand() - 0.5) * 0.5);
          leafGeos.push(leaf);
        }
        // 叶簇积雪：枝梢叶丛上方覆盖雪团
        const lsR = 0.14 + rand() * 0.12;
        const lsPos = end.clone(); lsPos.y += 0.06;
        const lsCap = new THREE.Mesh(new THREE.SphereGeometry(lsR, 7, 5), this._snowMat);
        lsCap.scale.y = 0.45;
        lsCap.position.copy(lsPos);
        lsCap.castShadow = true;
        this.scene.add(lsCap);
        this.bambooSnowCaps.push({
          mesh: lsCap, pos: lsPos.clone(),
          state: "resting", vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
          origPos: lsPos.clone(), origQuat: lsCap.quaternion.clone(), regenTimer: 0,
        });
      }
    };

    for (const [cx, cz] of spots) {
      for (let i = 0; i < perClump; i++) {
        const x = cx + (rand() - 0.5) * 3.2, z = cz + (rand() - 0.5) * 3.2;
        const gy = groundHeight(x, z);
        const h = 7 + rand() * 4.5;
        const rBase = 0.055 + rand() * 0.03;
        // 倾斜方向（随机方位角，倾角不超过配置的最大倾角）
        const la = rand() * leanMax, lp = rand() * Math.PI * 2;
        const up = new THREE.Vector3(Math.sin(la) * Math.cos(lp), Math.cos(la), Math.sin(la) * Math.sin(lp)).normalize();
        const base = new THREE.Vector3(x, gy, z);
        const at = (hh) => base.clone().addScaledVector(up, hh);

        // —— 多节竹竿：节间逐段收细，节环微突 ——
        const nodeL = 1.0 + rand() * 0.35;
        const nNodes = Math.max(4, Math.floor(h / nodeL));
        const nodeH = [0];
        for (let k = 1; k <= nNodes; k++) nodeH.push(Math.min(k * nodeL, h));
        for (let k = 0; k < nodeH.length - 1; k++) {
          const y0 = nodeH[k], y1 = nodeH[k + 1];
          const r0 = rBase * (1 - (y0 / h) * 0.5), r1 = rBase * (1 - (y1 / h) * 0.5);
          culmGeos.push(slimTube([at(y0), at((y0 + y1) / 2), at(y1)], r0, r1, 5));
          if (k > 0) { // 节环（基部入土节不现）
            const rr = r0 * 1.3;
            ringGeos.push(slimTube([at(y0 - 0.035), at(y0 + 0.035)], rr, rr, 5));
          }
        }

        // —— 节节生枝：每个出土节出 1~2 枝，上分形、梢簇叶 ——
        for (let k = 1; k < nodeH.length - 1; k++) {
          const y = nodeH[k];
          const rNode = rBase * (1 - (y / h) * 0.5);
          const nb = y > h * 0.45 ? 2 : 1; // 上密下疏
          for (let b = 0; b < nb; b++) {
            const el = 0.45 + rand() * 0.5;   // 仰角
            const az = rand() * Math.PI * 2;  // 方位
            const dir = new THREE.Vector3(
              Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
            const blen = (0.75 + rand() * 0.65) * (1 - (y / h) * 0.35);
            branchOut(at(y), dir, blen, Math.max(rNode * 0.45, 0.018), 0);
          }
        }

        // —— 积雪：竹竿顶端 + 全部竹节覆盖厚白雪 ——
        const snowQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        // 顶端厚雪帽（最大）
        const tipPos = at(h);
        const tipR = Math.max(rBase * 0.5 * 4.0, 0.18);
        const tipCap = new THREE.Mesh(new THREE.SphereGeometry(tipR, 10, 7), this._snowMat);
        tipCap.scale.y = 0.7; // 厚堆积
        tipCap.position.copy(tipPos).addScaledVector(up, tipR * 0.35);
        tipCap.quaternion.copy(snowQuat);
        tipCap.castShadow = true;
        this.scene.add(tipCap);
        this.bambooSnowCaps.push({
          mesh: tipCap, pos: tipPos.clone(),
          state: "resting", vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
          origPos: tipPos.clone(), origQuat: snowQuat.clone(), regenTimer: 0,
        });
        // 全部出土竹节厚雪帽（越往上越厚）
        for (let k = 1; k < nNodes; k++) {
          const ny = nodeH[k];
          const nPos = at(ny);
          const heightRatio = ny / h; // 0=底 1=顶
          const nR = Math.max(rBase * (1 - heightRatio * 0.5) * (2.5 + heightRatio * 2.0), 0.12);
          const nCap = new THREE.Mesh(new THREE.SphereGeometry(nR, 8, 6), this._snowMat);
          nCap.scale.y = 0.55 + heightRatio * 0.2; // 上部更厚
          nCap.position.copy(nPos).addScaledVector(up, nR * 0.25);
          nCap.quaternion.copy(snowQuat);
          nCap.castShadow = true;
          this.scene.add(nCap);
          this.bambooSnowCaps.push({
            mesh: nCap, pos: nPos.clone(),
            state: "resting", vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
            origPos: nPos.clone(), origQuat: snowQuat.clone(), regenTimer: 0,
          });
        }
        // 竹枝分叉处亦添雪团（枝根节点处额外加厚）
        for (let k = Math.max(1, nNodes - 3); k < nNodes; k++) {
          const ny = nodeH[k];
          const bPos = at(ny);
          const bR = Math.max(rBase * (1 - (ny / h) * 0.5) * 3.5, 0.15);
          const bCap = new THREE.Mesh(new THREE.SphereGeometry(bR, 8, 6), this._snowMat);
          bCap.scale.y = 0.5;
          bCap.scale.x = bCap.scale.z = 1.3; // 横向展宽，如雪团包裹枝根
          bCap.position.copy(bPos).addScaledVector(up, bR * 0.2);
          bCap.quaternion.copy(snowQuat);
          bCap.castShadow = true;
          this.scene.add(bCap);
          this.bambooSnowCaps.push({
            mesh: bCap, pos: bPos.clone(),
            state: "resting", vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
            origPos: bPos.clone(), origQuat: snowQuat.clone(), regenTimer: 0,
          });
        }
      }
    }
    const culmMat = new THREE.MeshStandardMaterial({ color: 0x5f7046, roughness: 0.85 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x8a9a6e, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6238, roughness: 0.9, side: THREE.DoubleSide });
    const culms = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(culmGeos), culmMat);
    const rings = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(ringGeos), ringMat);
    const leaves = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(leafGeos), leafMat);
    culms.castShadow = rings.castShadow = leaves.castShadow = true;
    this.scene.add(culms, rings, leaves);
  }

  /** 塘岸芦苇：南岸一线成丛（竿 + 垂叶 + 苇穗，浅赭冬色） */
  _buildReeds() {
    const rand = makeRandom(505);
    const stemGeos = [], bladeGeos = [], headGeos = [];
    const CLUSTERS = Math.max(0, Math.round(this.config.plum?.reedClusters ?? 12));
    if (CLUSTERS === 0) return; // 配置为 0：不种芦苇（空数组合并会抛错）
    for (let ci = 0; ci < CLUSTERS; ci++) {
      // 南岸半圈取丛心（e≈1.06，岸上浅水线）
      const a = (0.12 + 0.76 * (ci / Math.max(CLUSTERS - 1, 1))) * Math.PI;
      const cx = POND.cx + Math.cos(a) * POND.rx * (1.04 + rand() * 0.06);
      const cz = POND.cz + Math.sin(a) * POND.rz * (1.04 + rand() * 0.06);
      const n = 5 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const x = cx + (rand() - 0.5) * 2.6, z = cz + (rand() - 0.5) * 2.6;
        const gy = groundHeight(x, z);
        const h = 2.2 + rand() * 1.4;
        const lean = (rand() - 0.5) * 0.3;
        const stem = new THREE.CylinderGeometry(0.014, 0.026, h, 4);
        stem.translate(0, h / 2, 0);
        stem.rotateZ(lean); stem.rotateY(rand() * Math.PI);
        stem.translate(x, gy, z);
        stemGeos.push(stem);
        for (let j = 0; j < 2; j++) {
          const blade = new THREE.PlaneGeometry(0.12, 1.2, 1, 4);
          const bp = blade.attributes.position;
          for (let vi = 0; vi < bp.count; vi++) {
            const fy = bp.getY(vi) / 1.2 + 0.5;
            // 浮点行坐标可微超 1.0：底数须钳非负，否则 pow(负, 2.2)=NaN
            bp.setZ(vi, -Math.pow(Math.max(1 - fy, 0), 2.2) * 0.8); // 叶尖大幅下垂
          }
          blade.computeVertexNormals();
          blade.rotateX(-Math.PI / 2 + (rand() - 0.5) * 0.7);
          blade.rotateY(rand() * Math.PI * 2);
          blade.translate(x, gy + h * (0.35 + rand() * 0.3), z);
          bladeGeos.push(blade);
        }
        if (rand() < 0.8) {
          const head = new THREE.CylinderGeometry(0.014, 0.06, 0.5, 5);
          head.translate(0, 0.25, 0);
          head.rotateZ(lean * 1.4);
          head.translate(x - Math.sin(lean) * h, gy + Math.cos(lean) * h, z);
          headGeos.push(head);
        }
      }
    }
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xcfa06b, roughness: 0.9 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb89a68, roughness: 0.9, side: THREE.DoubleSide });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95 });
    const stems = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(stemGeos), stemMat);
    const blades = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(bladeGeos), bladeMat);
    const heads = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(headGeos), headMat);
    stems.castShadow = blades.castShadow = true;
    this.scene.add(stems, blades, heads);
  }

  /** 落花瓣：梅树冠盖周遭，随风旋落 */
  _buildPetals() {
    const COUNT = Math.max(0, Math.round(this.config.plum?.petalCount ?? 220));
    this.petalCount = COUNT;
    const rand = makeRandom(606);
    this._petalSeeds = new Float32Array(COUNT * 4); // x,y,z,fallSpeed
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      this._petalSeeds[i * 4] = PLUM_TREE_POS.x + (rand() - 0.5) * 70;
      this._petalSeeds[i * 4 + 1] = rand() * 48;
      this._petalSeeds[i * 4 + 2] = PLUM_TREE_POS.z + (rand() - 0.5) * 70;
      this._petalSeeds[i * 4 + 3] = 0.5 + rand() * 0.6;
      positions[i * 3] = this._petalSeeds[i * 4];
      positions[i * 3 + 1] = this._petalSeeds[i * 4 + 1];
      positions[i * 3 + 2] = this._petalSeeds[i * 4 + 2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.petals = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xecc9c2, size: 0.3, transparent: true, opacity: 0.9,
      sizeAttenuation: true, depthWrite: false,
    }));
    this.scene.add(this.petals);
  }

  update(dt) {
    this.time += dt;
    const wind = this.config.plum?.wind ?? 0.25;
    const pos = this.petals.geometry.attributes.position;
    const seeds = this._petalSeeds;
    for (let i = 0; i < this.petalCount; i++) {
      let y = pos.getY(i) - dt * seeds[i * 4 + 3];
      let x = pos.getX(i) + dt * wind * 0.9 + dt * 0.6 * Math.sin(this.time * 1.2 + i * 1.7);
      let z = pos.getZ(i) + dt * 0.55 * Math.cos(this.time * 0.9 + i * 2.3);
      if (y < groundHeight(x, z) + 0.1) { // 触地回到冠盖
        y = 20 + Math.random() * 28;
        x = PLUM_TREE_POS.x + (Math.random() - 0.5) * 70;
        z = PLUM_TREE_POS.z + (Math.random() - 0.5) * 70;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }
}
