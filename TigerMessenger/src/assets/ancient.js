// =====================================================================
//  东方水墨古风资产：扭曲古松 / 仙鹤 / 黑岩
//  参考雪舟《四季花鸟图屏风》：焦墨树干、墨绿松冠、丹顶鹤、加粗勾线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

const BARK = 0x2a2621; // 焦黑
const PINE = 0x1c3024; // 墨绿
const CRANE_WHITE = 0xf2ede2; // 乳白
const INK = 0x1c1a17; // 墨黑
const CINNABAR = 0xa63a2e; // 丹红
const BLACK_ROCK = 0x23211d; // 黑岩

const O_BOLD = 0.032; // 古风加粗勾线

// 黄金角：层间螺旋错开侧枝，避免正对重叠
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * 分形古松（自相似递归）：
 *  - 主轴分节上长，层与层之间用枝干圆柱连接
 *  - 每层按黄金角螺旋发出一级侧枝；侧枝再分叉二级小枝
 *  - 枝端 / 层节点挂多层扁平松针团（墨绿云片）
 *  - 加粗水墨描边；mesh 预算封顶，避免同屏过重
 */
export function createAncientPineTree() {
  const g = new THREE.Group();
  const barkMat = toonMat(BARK);
  const leafMat = toonMat(PINE);

  let meshBudget = 0;
  const MAX_MESH = 96;

  function ink(mesh, thick = O_BOLD) {
    mesh.castShadow = true;
    if (meshBudget < MAX_MESH) {
      addOutline(mesh, thick);
      meshBudget++;
    }
    return mesh;
  }

  /** 沿局部 +Y 的树干/枝干段，底部贴在 parent 原点 */
  function addStem(parent, len, rBot, rTop, thick = O_BOLD) {
    const m = new THREE.Mesh(
      facet(
        new THREE.CylinderGeometry(
          Math.max(0.018, rTop),
          Math.max(0.022, rBot),
          len,
          5
        )
      ),
      barkMat
    );
    m.position.y = len / 2;
    ink(m, thick);
    parent.add(m);
    return len;
  }

  /**
   * 松针团：多片扁平二十面体叠层（叶子「层」）
   * scale 控制团大小；layers 控制片数
   */
  function addNeedleTuft(parent, scale = 1, y0 = 0, layers = 2) {
    const n = Math.max(1, layers);
    for (let i = 0; i < n && meshBudget < MAX_MESH; i++) {
      const r = 0.2 * scale * (0.88 + Math.random() * 0.28);
      const b = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(r, 0)), leafMat);
      // 压扁成云片状松冠
      b.scale.set(1.2, 0.34 + Math.random() * 0.1, 1.2);
      b.position.set(
        (Math.random() - 0.5) * 0.26 * scale,
        y0 + i * 0.09 * scale + (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.26 * scale
      );
      b.rotation.set(
        (Math.random() - 0.5) * 0.35,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.35
      );
      ink(b, O_BOLD * 0.72);
      parent.add(b);
    }
  }

  /**
   * 分形侧枝：depth=0 一级，再递归到 maxDepth。
   * parent 局部 +Y 为父枝延伸方向；本枝先 yaw 再 pitch 下倾。
   */
  function fractalBranch(parent, opts) {
    const {
      length,
      rBot,
      depth,
      maxDepth,
      pitch,
      yaw,
    } = opts;
    if (meshBudget >= MAX_MESH || length < 0.08) return;

    const joint = new THREE.Group();
    joint.rotation.order = "YXZ";
    joint.rotation.y = yaw;
    joint.rotation.x = pitch;
    // 同层轻微扭转，增加苍劲感
    joint.rotation.z = (Math.random() - 0.5) * 0.18;
    parent.add(joint);

    const rTop = rBot * (0.58 + Math.random() * 0.1);
    const stemThick = depth === 0 ? O_BOLD * 0.9 : O_BOLD * 0.65;
    addStem(joint, length, rBot, rTop, stemThick);

    // 枝端松针（高层 depth 更小更密）
    const tip = new THREE.Group();
    tip.position.y = length;
    joint.add(tip);
    const tuftScale = (0.95 - depth * 0.22) * (0.85 + Math.random() * 0.25);
    addNeedleTuft(tip, tuftScale, 0, depth === 0 ? 3 : 2);

    // 一级枝中段再挂一层松针，强化「层」感
    if (depth === 0 && length > 0.35 && Math.random() > 0.3) {
      const mid = new THREE.Group();
      mid.position.y = length * (0.45 + Math.random() * 0.15);
      joint.add(mid);
      addNeedleTuft(mid, tuftScale * 0.62, 0, 2);
    }

    if (depth >= maxDepth) return;

    // 自相似分叉：2~3 枝，长度/半径按比例收缩
    const kids = 2 + ((Math.random() * 1.5) | 0);
    for (let k = 0; k < kids; k++) {
      fractalBranch(tip, {
        length: length * (0.38 + Math.random() * 0.2),
        rBot: rTop * (0.65 + Math.random() * 0.12),
        depth: depth + 1,
        maxDepth,
        pitch: 0.4 + Math.random() * 0.55,
        yaw: (k / kids) * Math.PI * 2 + Math.random() * 0.5,
      });
    }
  }

  // —— 主轴：基干 + 多层冠层（层间枝干连接）——
  const layerCount = 5 + ((Math.random() * 2) | 0); // 5~6 层松冠
  let cursor = g;
  let attachY = 0;
  let trunkR = 0.17 + Math.random() * 0.02;

  // 基干（无侧枝，略扭曲）
  {
    const baseH = 0.5 + Math.random() * 0.22;
    const joint = new THREE.Group();
    joint.rotation.set(
      (Math.random() - 0.5) * 0.22,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.22
    );
    g.add(joint);
    addStem(joint, baseH, trunkR + 0.035, trunkR, O_BOLD);
    cursor = joint;
    attachY = baseH;
  }

  let spiral = Math.random() * Math.PI * 2;
  for (let L = 0; L < layerCount; L++) {
    const t = layerCount <= 1 ? 0 : L / (layerCount - 1); // 0 底 → 1 顶
    const segH = 0.38 + (1 - t) * 0.2 + Math.random() * 0.08;
    const rBot = trunkR * (1 - t * 0.52);
    const rTop = Math.max(0.035, rBot * 0.76);

    // 层间主轴连接段（分节微弯）
    const joint = new THREE.Group();
    joint.position.y = attachY;
    joint.rotation.set(
      (Math.random() - 0.5) * 0.32,
      (Math.random() - 0.5) * 0.7,
      (Math.random() - 0.5) * 0.32
    );
    cursor.add(joint);
    addStem(joint, segH, rBot, rTop, O_BOLD);

    // 侧枝挂在段中部，形成层与层之间的「枝盘」
    const ring = new THREE.Group();
    ring.position.y = segH * (0.35 + Math.random() * 0.15);
    joint.add(ring);

    // 下层枝多且长、下倾大；上层枝少且短、略上收
    const arms = Math.max(3, 6 - ((L * 3) / 4) | 0);
    const armLenBase = (1.05 - t * 0.58) * (0.88 + Math.random() * 0.22);
    const armR = rBot * (0.38 + Math.random() * 0.08);
    const droop = 0.95 - t * 0.5; // 下倾角
    // 下层可分二级枝；顶两层只一级，避免过密
    const maxDepth = L < layerCount - 2 ? 1 : 0;

    for (let a = 0; a < arms; a++) {
      const yaw = spiral + a * GOLDEN_ANGLE + L * 0.41;
      fractalBranch(ring, {
        length: armLenBase * (0.72 + Math.random() * 0.4),
        rBot: armR * (0.85 + Math.random() * 0.25),
        depth: 0,
        maxDepth,
        pitch: droop + (Math.random() - 0.5) * 0.22,
        yaw,
      });
    }

    // 主轴节点再补一团松针，层心更饱满
    if (Math.random() > 0.25) {
      const nodeTuft = new THREE.Group();
      nodeTuft.position.y = segH * 0.7;
      joint.add(nodeTuft);
      addNeedleTuft(nodeTuft, 0.55 + (1 - t) * 0.35, 0, 2);
    }

    cursor = joint;
    attachY = segH;
    trunkR = rTop;
    spiral += GOLDEN_ANGLE * 1.65;
  }

  // 顶梢：短主干 + 双层针簇收尖
  {
    const tipH = 0.32 + Math.random() * 0.14;
    const tip = new THREE.Group();
    tip.position.y = attachY;
    tip.rotation.set(
      (Math.random() - 0.5) * 0.2,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.2
    );
    cursor.add(tip);
    addStem(tip, tipH, trunkR, trunkR * 0.35, O_BOLD * 0.8);
    const apex = new THREE.Group();
    apex.position.y = tipH;
    tip.add(apex);
    addNeedleTuft(apex, 0.72, 0, 3);
    addNeedleTuft(apex, 0.42, 0.14, 2);
  }

  g.scale.setScalar(1.15); // 全树约 4m 量级（小世界）
  g.userData.collideRadius = 0.42;
  return g;
}

/**
 * 仙鹤（丹顶鹤）：基础几何体实时拼接。
 * 长脖 S 曲、乳白身体、墨黑尾羽与喙、丹红头顶。
 */
export function createCraneNPC() {
  const g = new THREE.Group();
  const white = toonMat(CRANE_WHITE);
  const ink = toonMat(INK);
  const red = toonMat(CINNABAR);

  // 身体：压扁球（朝 +x 为首）
  const body = new THREE.Mesh(facet(new THREE.SphereGeometry(0.32, 7, 5)), white);
  body.scale.set(1.25, 0.78, 0.85);
  body.position.y = 0.62;
  body.castShadow = true;
  addOutline(body, 0.024);
  g.add(body);

  // 翅膀：两侧扁平盒，乳白
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(facet(new THREE.BoxGeometry(0.34, 0.07, 0.2)), white);
    wing.position.set(-0.02, 0.7, side * 0.3);
    wing.rotation.x = side * 0.35;
    wing.castShadow = true;
    addOutline(wing, 0.02);
    g.add(wing);
  }

  // 尾羽：墨黑锥簇（向后上方）
  for (let i = 0; i < 3; i++) {
    const tail = new THREE.Mesh(facet(new THREE.ConeGeometry(0.07, 0.5, 4)), ink);
    tail.position.set(-0.42, 0.66 + i * 0.03, (i - 1) * 0.09);
    tail.rotation.z = 1.15 + (i - 1) * 0.18; // 指向 -x 并略上扬
    tail.castShadow = true;
    addOutline(tail, 0.018);
    g.add(tail);
  }

  // 脖子：两段 S 曲细圆柱
  const neck1 = new THREE.Group();
  neck1.position.set(0.3, 0.72, 0);
  neck1.rotation.z = -0.35; // 前倾
  const n1 = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 5)), white);
  n1.position.y = 0.21;
  n1.castShadow = true;
  addOutline(n1, 0.016);
  neck1.add(n1);
  const neck2 = new THREE.Group();
  neck2.position.y = 0.42;
  neck2.rotation.z = 0.75; // 回勾成 S
  const n2 = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.04, 0.045, 0.4, 5)), white);
  n2.position.y = 0.2;
  n2.castShadow = true;
  addOutline(n2, 0.016);
  neck2.add(n2);
  neck1.add(neck2);
  g.add(neck1);

  // 头 + 喙 + 丹红顶（挂在颈二顶端）
  const headG = new THREE.Group();
  headG.position.y = 0.42;
  const head = new THREE.Mesh(facet(new THREE.SphereGeometry(0.1, 6, 5)), white);
  head.castShadow = true;
  addOutline(head, 0.014);
  headG.add(head);
  const beak = new THREE.Mesh(facet(new THREE.ConeGeometry(0.035, 0.24, 4)), ink);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.2, 0, 0);
  addOutline(beak, 0.01);
  headG.add(beak);
  const crown = new THREE.Mesh(facet(new THREE.SphereGeometry(0.05, 5, 4)), red);
  crown.scale.set(1, 0.6, 1);
  crown.position.set(-0.02, 0.09, 0);
  addOutline(crown, 0.008);
  headG.add(crown);
  neck2.add(headG);

  // 腿：两根细墨柱
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 4)), ink);
    leg.position.set(0.06, 0.25, side * 0.1);
    addOutline(leg, 0.01);
    g.add(leg);
  }

  g.userData.collideRadius = 0.45;
  return g;
}

/**
 * 黑岩：顶点扰动二十面体，焦墨色（仙鹤立岩用）。
 */
export function createBlackRock() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.55, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!cache.has(key)) cache.set(key, 0.75 + Math.random() * 0.5);
    v.multiplyScalar(cache.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const rock = new THREE.Mesh(facet(geo), toonMat(BLACK_ROCK));
  rock.scale.set(1.1, 0.55, 0.95);
  rock.position.y = 0.26;
  rock.castShadow = true;
  rock.receiveShadow = true;
  addOutline(rock, O_BOLD);
  g.add(rock);
  g.userData.topY = 0.55; // 岩顶近似高度（仙鹤站立面）
  g.userData.collideRadius = 0.7;
  return g;
}

/** 组合：仙鹤立于黑岩之上（单 Group，底部原点） */
export function createCraneOnRock() {
  const g = new THREE.Group();
  const rock = createBlackRock();
  g.add(rock);
  const crane = createCraneNPC();
  crane.position.y = rock.userData.topY;
  crane.rotation.y = Math.random() * Math.PI * 2;
  g.add(crane);
  g.userData.collideRadius = 0.7;
  return g;
}
