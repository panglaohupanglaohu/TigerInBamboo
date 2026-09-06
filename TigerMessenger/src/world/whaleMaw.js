// =====================================================================
//  苔庭之鲸参战：渔网束缚 → 挣扎 → 张嘴吞下重甲兵 → 排出去
//
//  主人 2026-09-06：
//    「苔庭之鲸需要也参与战斗
//      1）你来模拟它被渔网束缚后的挣扎
//      2）它可以张开大嘴，将重甲兵吸入腹中，再拉粑粑一样拉出去，
//         这个过程需要动画，让重甲兵被吸入时，也要挣扎，
//         拉出去后，军服变成土黄色」
//
//  在此之前鲸是**被动**的：红盔用绳索把它往下拽（saihojiPhalanx 的绳索小队）、
//  机队用光束把它往上吸，它自己一句话都没有。现在它有两手：
//    · 被绳索拽住时**挣扎挣脱**——甩动 + 被拽沉再弹回 + 拍尾；
//    · 谁凑到嘴边就**吞下去**，在肚子里走一趟，从尾根底下排出来，
//      出来时军服已经是一身土黄。
//
//  ⚠️ 这里一度还有一张**渔网**（LineSegments 织的网罩在鲸背上）。
//  主人 2026-09-06：「不必出现网，有那种被拉扯挣脱的感觉即可」——
//  网是我自己加的道具，而场上本来就有拉扯它的东西（绳索小队的拔河，
//  拉力汇总在 saihojiPhalanx 的 root.userData.ropePull01）。
//  拿那股拉力当输入，「被拉扯」就有了真实来源，还省掉一整套网的开关与网线。
//
//  ---- 坐标系 ----
//  一切都挂在鲸的 group 下，用鲸的局部坐标：**+X 鲸头 / +Y 背上 / +Z 右舷**。
//  躯干是 SphereGeometry(8) × (4.5, 1.3, 2.2) 下沉 −4.4，也就是
//  半长 36 / 半高 10.4 / 半宽 17.6，中心在 y = −4.4。
//  这几个数在 leviathanIsland.js 里被 test_leviathan 锁死，这里照抄成常量，
//  不重新推导——两处各算一次，迟早对不上。
//
//  球面世界的规矩在这里自动满足：鲸的 group 已经把姿态摆好了，
//  子节点用局部坐标即可，不必再走一遍「先乘半径再切向平移」。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { soilVanguardUniform } from "./vanguardTrooper.js";

/** 鲸体几何（与 leviathanIsland.js 锁死一致，勿各算各的） */
const WHALE = Object.freeze({
  halfLen: 36,
  halfHi: 10.4,
  halfWide: 17.6,
  centerY: -4.4,
  snoutX: 33.0,   // 吻端（leviathan-snout 锚点在 33.2）
  ventX: -26.0,   // 排出口：尾根底下
});

export const WHALE_MAW = Object.freeze({
  // ---- 挣扎 ----
  /** 挣扎强度的衰减时间常数（秒）：一阵一阵的，不是永动 */
  struggleTau: 2.6,
  /** 每一阵挣扎的间隔（秒） */
  struggleGap: 3.4,
  /** 甩动幅度（弧度）：横滚 / 俯仰 / 偏航 */
  rollAmp: 0.075,
  pitchAmp: 0.05,
  yawAmp: 0.085,
  /**
   * 被拽沉的幅度（世界单位）：整条鲸被绳索拽下去一截，又挣着弹回来。
   * 这是「被拉扯」最直接的读法——只有转动的话，看起来像在原地扭，不像在被拽。
   */
  heaveAmp: 1.8,

  // ---- 吞吐 ----
  /**
   * 张嘴的最大开度（弧度）：**下颌绕眼轴往下沉**的角度。
   * 参考图（蓝鲸 lunge feeding）里下颌张到接近 90°；这里给 1.15（≈66°），
   * 再大下颌会穿进胸鳍。上颚不动——那是这一版和上一版最大的分别。
   */
  gape: 1.15,
  /**
   * 口裂线的斜率：从眼角（嘴角）往吻端微微上扬。
   * 切下颌用的就是这条线——不是一个竖直平面。上一版拿竖直平面切，
   * 结果把吻背也切进了下颌，整个头一起翻上去（主人否掉的那一版）。
   */
  mouthSlope: 0.10,
  /**
   * 喉囊鼓胀：下颌张开时的纵向 / 横向放大倍数。
   * 参考图里那个占半张画面的大兜就是这么来的——下颌不是一块硬板，
   * 喉腹褶一撑开，整个下巴鼓成一个口袋。
   */
  pouchY: 0.85,
  pouchZ: 0.55,
  /** 鲸眼的局部坐标（铰链轴）。实测值，与 leviathanIsland 的 eyeRoot 一致 */
  eyeX: 27.5,
  eyeY: -9.14,
  /** 吸力作用半径（世界单位，从嘴心量） */
  suckRange: 26,
  /** 一次最多吞几个 */
  capacity: 3,
  /** 各阶段时长（秒） */
  gapeTime: 0.9,
  suckTime: 2.6,
  holdTime: 2.4,
  expelTime: 1.8,
  /** 两次吞吐之间的冷却（秒）：不许变成绞肉机 */
  cooldown: 9,
  /** 排出后的呆滞时间（秒）：爬起来、抖一抖，再归队 */
  dazedTime: 2.2,
});

/**
 * 把 whaleMaw 发布的挣扎甩动应用到鲸身上。
 *
 * **必须在鲸自己的 update 之后调用**——leviathanIsland 的 update 每帧
 * `group.quaternion.copy(poseQ)` 把姿态复位，在它之前写的甩动会被整条抹掉。
 * saihojiGarden 里紧跟 `leviathan.update(dt, t)` 调一次即可（那儿本来就有
 * 一处「落地震颤」的 rotateX/rotateZ，排在同一个位置）。
 *
 * 幂等的前提是「中间隔着一次复位」：连着调两次会叠加，别那么用。
 *
 * @param {THREE.Object3D|null} whaleGroup
 * @returns {boolean} 这一帧有没有挣扎
 */
export function applyWhaleCombatShake(whaleGroup) {
  const sh = whaleGroup?.userData?.combatShake;
  if (!sh) return false;
  // 用 rotateX/Y/Z（在**当前**姿态上叠加），不是写 rotation.x——
  // 鲸的姿态是 quaternion 摆的，直接写欧拉角会把它整条覆盖掉。
  whaleGroup.rotateZ(sh.roll);
  whaleGroup.rotateX(sh.pitch);
  whaleGroup.rotateY(sh.yaw);
  // 拽沉：沿径向（当地的天）把整条鲸拉下去一截又弹回来。
  // 只有转动的话看起来像在原地扭；被拽下去再挣回来，才读得出「有东西在拉它」。
  if (sh.heave) {
    _shakeUp.copy(whaleGroup.position);
    if (_shakeUp.lengthSq() > 1e-8) {
      whaleGroup.position.addScaledVector(_shakeUp.normalize(), sh.heave);
    }
  }
  // 拍尾：挣扎时尾巴甩得最凶（尾柄本来就有慢摆，这里叠上去）
  const tail = whaleGroup.getObjectByName("leviathan-tail-root");
  if (tail) tail.rotation.y += sh.tailY;
  return true;
}

const _shakeUp = new THREE.Vector3();
const _wmA = new THREE.Vector3();
const _wmB = new THREE.Vector3();
const _wmC = new THREE.Vector3();
const _wmQ = new THREE.Quaternion();
const _wmMat = new THREE.Matrix4();

/** 鲸身在 x 处的截面缩放（椭球剖面），x 用局部坐标 */
function sectionK(x) {
  const u = Math.min(1, Math.abs(x) / WHALE.halfLen);
  return Math.sqrt(Math.max(0, 1 - u * u));
}

/**
 * 造嘴：**沿口裂线把下颌切出来，绕眼轴往下沉，喉囊鼓成一个大兜**。
 *
 * 主人 2026-09-06 给了一张蓝鲸吞噬式摄食（lunge feeding）的参考图。
 * 对着图看，上一版错在一个很具体的地方：我拿一个**竖直平面**在眼睛处切，
 * 把吻背连同下颌**一起往上掀**了。图里根本不是这样：
 *   · 上颚（吻背）基本不动，还是那条顺着背脊的线；
 *   · 下颌整个往下沉，张到接近 90°；
 *   · 主角是**喉囊**——下颌一沉，喉腹褶撑开，鼓成一个布满纵向条纹的大口袋；
 *   · 张开的上颚内侧挂着一排鲸须。
 *
 * 铰链的位置主人说对了：须鲸的**眼睛就长在嘴角**，「以鱼眼为轴」正是解剖学上
 * 的那个颌关节。要改的是**切法**——沿口裂线切（眼角往吻端一条微微上扬的线），
 * 线**以下、且在眼前**的那一块才是下颌。
 *
 * 合上（rotation 0、scale 1）时下颌严丝合缝扣回去：**不张嘴的时候鲸和以前一样**。
 *
 * @param {THREE.Object3D} whale leviathanGroup
 */
function buildJawSplit(whale) {
  const body = whale.getObjectByName("leviathan-body");
  if (!body) return null;

  // 铰链轴 = 颌关节 = 两眼连线。优先问鲸自己要，问不到才用常量兜底
  const eyes = whale.userData?.leviathanEyes || [];
  const eyeX = Number.isFinite(eyes[0]?.eyeRoot?.position?.x)
    ? eyes[0].eyeRoot.position.x : WHALE_MAW.eyeX;
  const eyeY = Number.isFinite(eyes[0]?.eyeRoot?.position?.y)
    ? eyes[0].eyeRoot.position.y : WHALE_MAW.eyeY;

  const hinge = new THREE.Group();
  hinge.name = "whale-jaw-hinge";
  hinge.position.set(eyeX, eyeY, 0);
  whale.add(hinge);

  /** 口裂线：眼角往吻端微微上扬。点在线下 = 属于下颌 */
  const belowMouthLine = (x, y) => y < eyeY + WHALE_MAW.mouthSlope * (x - eyeX);

  // ---------- 1. 沿口裂线把下颌切出来 ----------
  // 判据是三角形**质心**，不是逐顶点：按顶点切会把跨切面的三角形撕开，
  // 留下一圈锯齿缝；按质心切，跨切面的那一圈整块归一边，两半仍然扣得回去。
  body.updateMatrix();
  const src = body.geometry;
  const pos = src.attributes.position;
  const col = src.attributes.color || null;
  const idx = src.index;
  const triN = idx ? idx.count / 3 : pos.count / 3;
  const m = body.matrix;
  const v = new THREE.Vector3();
  const jp = []; const jc = [];   // 下颌
  const rp = []; const rc = [];   // 其余（吻背 + 躯干）
  const tri = [0, 0, 0];
  let jawTipX = eyeX;
  for (let t = 0; t < triN; t++) {
    tri[0] = idx ? idx.getX(t * 3) : t * 3;
    tri[1] = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    tri[2] = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    let cx = 0; let cy = 0;
    for (const i of tri) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      cx += v.x; cy += v.y;
    }
    cx /= 3; cy /= 3;
    const isJaw = cx > eyeX && belowMouthLine(cx, cy);
    if (isJaw) jawTipX = Math.max(jawTipX, cx);
    for (const i of tri) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (isJaw) {
        // 下颌的坐标换算到**铰链原点**，转起来才是绕眼睛转
        jp.push(v.x - eyeX, v.y - eyeY, v.z);
        if (col) jc.push(col.getX(i), col.getY(i), col.getZ(i));
      } else {
        rp.push(v.x, v.y, v.z);
        if (col) rc.push(col.getX(i), col.getY(i), col.getZ(i));
      }
    }
  }
  const half = (p, c, name) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    if (c.length) g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, body.material); // 材质照用原来的（含顶点色）
    mesh.name = name;
    mesh.castShadow = body.castShadow;
    mesh.receiveShadow = body.receiveShadow;
    addOutline(mesh, 0.055); // 与 leviathanIsland 的 OUTLINE_W 同值
    return mesh;
  };
  const front = half(jp, jc, "whale-jaw-lower");   // 下颌（会沉、会鼓）
  const back = half(rp, rc, "whale-jaw-rest");     // 吻背 + 躯干（不动）
  hinge.add(front);
  whale.add(back);
  // 原来那张整壳（连同它自己的描边）退场；名字还在，外部按名取仍然找得到
  body.visible = false;

  // ---------- 2. 喉腹褶：下颌表面的纵向条纹 ----------
  // 参考图里那个大兜之所以一眼认得出是鲸，就靠这一组纵向条纹。
  // 用 LineSegments 一个 draw call 画完，挂在下颌上，跟着一起沉、一起鼓。
  const pleatPts = [];
  {
    const x0 = 1.5;                    // 从嘴角稍前
    const x1 = jawTipX - eyeX;         // 到下颌前端
    for (let j = -6; j <= 6; j++) {
      const zf = j / 6;
      for (let i = 0; i < 12; i++) {
        const ax = x0 + (x1 - x0) * (i / 12);
        const bx = x0 + (x1 - x0) * ((i + 1) / 12);
        const at = (xx) => {
          const gx = xx + eyeX;
          const k = sectionK(gx);
          const ry = WHALE.halfHi * k;
          const rz = WHALE.halfWide * k;
          // 贴在下颌腹面：z 按 zf 铺开，y 取该处腹面的深度
          const zz = rz * zf * 0.92;
          const yy = WHALE.centerY - ry * Math.sqrt(Math.max(0, 1 - zf * zf)) * 0.98 - eyeY;
          return [xx, yy, zz];
        };
        pleatPts.push(...at(ax), ...at(bx));
      }
    }
  }
  const pleatGeo = new THREE.BufferGeometry();
  pleatGeo.setAttribute("position", new THREE.Float32BufferAttribute(pleatPts, 3));
  const pleats = new THREE.LineSegments(
    pleatGeo,
    new THREE.LineBasicMaterial({ color: 0x93a5a8, transparent: true, opacity: 0 })
  );
  pleats.name = "whale-throat-pleats";
  hinge.add(pleats);

  // ---------- 3. 上腭 + 鲸须 ----------
  // 下颌沉下去之后，口裂线那个面就露出来了——不补的话能一眼望穿整条鲸
  // （放样壳是单面的，里面是空的）。这一片就是上腭。
  const roofMat = new THREE.MeshBasicMaterial({ color: 0x2a1a1e, side: THREE.DoubleSide });
  const roofPts = [];
  {
    const N = 12;
    const push = (x, z) => {
      roofPts.push(x, eyeY + WHALE_MAW.mouthSlope * (x - eyeX) - 0.1, z);
    };
    // 一条从嘴角铺到吻端的带子，宽度按鲸身剖面收窄
    for (let i = 0; i < N; i++) {
      const xa = eyeX - 1 + (jawTipX + 1 - (eyeX - 1)) * (i / N);
      const xb = eyeX - 1 + (jawTipX + 1 - (eyeX - 1)) * ((i + 1) / N);
      const wa = WHALE.halfWide * sectionK(xa) * 0.92;
      const wb = WHALE.halfWide * sectionK(xb) * 0.92;
      push(xa, -wa); push(xa, wa); push(xb, wb);
      push(xa, -wa); push(xb, wb); push(xb, -wb);
    }
  }
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(roofPts, 3));
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.name = "whale-mouth-roof";
  roof.visible = false;
  whale.add(roof);

  // 鲸须：上腭两侧垂下来的一排白帘。参考图里张开的嘴内侧就是这个。
  const baleenPts = [];
  {
    const N = 26;
    for (let i = 0; i < N; i++) {
      const x = eyeX + (jawTipX - eyeX) * (i / N);
      const w = WHALE.halfWide * sectionK(x) * 0.88;
      const y = eyeY + WHALE_MAW.mouthSlope * (x - eyeX) - 0.15;
      const len = 2.2 + 1.6 * Math.sin((i / N) * Math.PI); // 中段最长
      for (const sd of [-1, 1]) {
        baleenPts.push(x, y, sd * w, x, y - len, sd * w * 0.94);
      }
    }
  }
  const baleenGeo = new THREE.BufferGeometry();
  baleenGeo.setAttribute("position", new THREE.Float32BufferAttribute(baleenPts, 3));
  const baleen = new THREE.LineSegments(
    baleenGeo,
    new THREE.LineBasicMaterial({ color: 0xe8eee6, transparent: true, opacity: 0 })
  );
  baleen.name = "whale-baleen";
  whale.add(baleen);

  /** 口腔内壁 + 鲸须 + 喉腹褶的统一开关 */
  const throat = {
    name: "whale-throat",
    parts: [roof, baleen, pleats],
    set visible(vv) {
      roof.visible = vv;
      baleen.visible = vv;
      pleats.visible = vv;
    },
    get visible() { return roof.visible; },
    /** 开度 0..1：条纹与鲸须随张嘴渐显 */
    fade(k) {
      baleen.material.opacity = 0.85 * k;
      pleats.material.opacity = 0.75 * k;
    },
  };

  return { hinge, front, back, throat, roof, baleen, pleats, eyeX, eyeY, jawTipX };
}

/**
 * 苔庭之鲸的战斗行为。
 *
 * @param {{
 *   scene: THREE.Object3D,
 *   getWhale: () => THREE.Object3D|null,
 *   getTroopers: () => THREE.Object3D[],
 *   groundHeightAt?: (dir: THREE.Vector3) => number,
 *   spawnSmoke?: (pos: THREE.Vector3) => void,
 * }} opts
 */
export function createWhaleMaw({
  scene,
  getWhale,
  getTroopers = () => [],
  groundHeightAt = null,
  spawnSmoke = null,
} = {}) {
  let whale = null;
  let maw = null;
  let bulge = null;

  const st = {
    /** 0..1，外面每帧喂进来的拉扯强度（绳索小队的拔河拉力） */
    tug: 0,
    struggle: 0,
    struggleClock: 0,
    phase: "idle",      // idle | gape | suck | hold | expel
    phaseT: 0,
    cooldown: 0,
    eaten: [],          // { tr, t, from, spin }
    clock: 0,
    swallowedTotal: 0,
    expelledTotal: 0,
  };

  /** 把三件套挂到鲸身上（鲸可能比本模块晚进场，所以每帧懒挂） */
  function attach() {
    const w = typeof getWhale === "function" ? getWhale() : null;
    if (!w || !w.parent) {
      whale = null;
      return false;
    }
    if (whale === w && maw?.hinge?.parent === w) return true;
    whale = w;
    // 切嘴是**一次性**的：把鲸自己的模型切开、零件重挂。
    // 只在第一次遇到这条鲸时做；重复切会把已经挂进铰链的东西再切一遍。
    if (!maw || maw.hinge.parent !== whale) maw = buildJawSplit(whale);
    if (!bulge) {
      // 肚子里那一坨：贴着皮下往后走的一个鼓包
      bulge = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 9),
        toonMat(0x7b8b90, { flatShading: true })
      );
      bulge.name = "whale-belly-bulge";
      bulge.visible = false;
      bulge.scale.set(3.2, 2.4, 3.0);
    }
    if (bulge.parent !== whale) whale.add(bulge);
    return true;
  }

  /** 嘴心的世界坐标。**先 attach**：外部不该被迫先跑一帧 update 才问得到嘴在哪 */
  function mouthWorld(out = new THREE.Vector3()) {
    if (!attach() || !maw) return out.set(0, 0, 0);
    whale.updateWorldMatrix(true, false);
    // 喉口：切面往前一点。张开时前段绕眼睛抬起来，这个点正好在张开的口中央
    return out
      .set((maw?.eyeX ?? WHALE_MAW.eyeX) + 5, (maw?.eyeY ?? WHALE_MAW.eyeY) - 1.2, 0)
      .applyMatrix4(whale.matrixWorld);
  }

  /** 排出口的世界坐标（尾根底下） */
  function ventWorld(out = new THREE.Vector3()) {
    if (!attach()) return out.set(0, 0, 0);
    whale.updateWorldMatrix(true, false);
    const k = sectionK(WHALE.ventX);
    return out
      .set(WHALE.ventX, WHALE.centerY - WHALE.halfHi * k * 0.86, 0)
      .applyMatrix4(whale.matrixWorld);
  }

  /**
   * 喂拉扯强度（0..1）。绳索小队的拔河拉力直接接到这里。
   * 从「没被拉」到「被拉住」的那一下，先给一记猛挣——被套住的第一反应。
   */
  function setTug(k) {
    const next = Math.max(0, Math.min(1, Number(k) || 0));
    if (next > 0.05 && st.tug <= 0.05) {
      st.struggle = 1;        // 刚被拽住：猛地一挣
      st.struggleClock = 0;
    }
    st.tug = next;
    return st.tug;
  }

  /** 开吞：把够得着的重甲兵吸进来 */
  function swallow() {
    if (st.phase !== "idle" || st.cooldown > 0) return false;
    if (!attach()) return false;
    st.phase = "gape";
    st.phaseT = 0;
    return true;
  }

  /** 挑出这一口能吞下的人：在嘴前方、够得着、还没被吞过 */
  function pickPrey() {
    mouthWorld(_wmA);
    // 嘴的朝向（鲸头方向）在世界系里的样子
    whale.getWorldQuaternion(_wmQ);
    _wmB.set(1, 0, 0).applyQuaternion(_wmQ).normalize();
    const out = [];
    for (const tr of getTroopers()) {
      const u = tr?.userData;
      if (!tr?.parent || !u || u.dead || u.aboard || u.swallowed || u.soiled) continue;
      if (!tr.visible) continue;
      tr.getWorldPosition(_wmC);
      const d = _wmC.distanceTo(_wmA);
      if (d > WHALE_MAW.suckRange) continue;
      // 只吞**嘴前面**的：绕到尾巴后头的人吞不到
      _wmC.sub(_wmA);
      if (_wmC.lengthSq() > 1e-6 && _wmC.normalize().dot(_wmB) < 0.15) continue;
      out.push({ tr, d });
    }
    out.sort((a, b) => a.d - b.d); // 近的先吞
    return out.slice(0, WHALE_MAW.capacity).map((x) => x.tr);
  }

  function beginSuck() {
    const prey = pickPrey();
    st.eaten = prey.map((tr, i) => {
      tr.userData.swallowed = true;
      tr.userData._swallowFrom = tr.getWorldPosition(new THREE.Vector3());
      return {
        tr,
        t: -i * 0.28,                 // 依次被吸进去，不是三个一起「啪」
        spin: 5.4 + i * 1.7,          // 挣扎的翻滚角速度（各人不同相）
        phase: i * 1.9,
      };
    });
    st.swallowedTotal += st.eaten.length;
    return st.eaten.length;
  }

  /** 吸入动画：沿一条抛物线飞向嘴心，一路挣扎（翻滚 + 抽搐），到嘴边就消失 */
  function updateSuck(dt) {
    mouthWorld(_wmA);
    for (const e of st.eaten) {
      e.t += dt / Math.max(0.001, WHALE_MAW.suckTime * 0.62);
      const k = Math.max(0, Math.min(1, e.t));
      if (k <= 0) continue;
      const from = e.tr.userData._swallowFrom;
      if (!from) continue;
      // 位置：直线插值 + 一个把人往上抛起来的鼓包（被卷进气流的感觉）
      e.tr.position.copy(from).lerp(_wmA, k);
      const lift = Math.sin(k * Math.PI) * 3.4;
      _wmB.copy(e.tr.position).normalize();
      e.tr.position.addScaledVector(_wmB, lift);
      if (e.tr.parent && e.tr.parent !== scene) {
        e.tr.parent.worldToLocal(e.tr.position);
      }
      // ---- 挣扎（主人点名要的）----
      // 翻滚 + 高频抽搐：越靠近嘴挣扎越剧烈，被吞进去前一刻最凶。
      const panic = 0.35 + 0.65 * k;
      e.tr.rotation.x = Math.sin(st.clock * e.spin + e.phase) * 0.9 * panic;
      e.tr.rotation.z = Math.cos(st.clock * e.spin * 0.77 + e.phase) * 0.7 * panic;
      e.tr.rotation.y += dt * e.spin * 0.5 * panic;
      // 进了嘴就收起来（缩一下再消失，像被吸进去的）
      const shrink = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
      e.tr.scale.setScalar(Math.max(0.05, shrink));
      if (k >= 1 && e.tr.visible) {
        e.tr.visible = false;
        if (spawnSmoke) spawnSmoke(_wmA.clone());
      }
    }
  }

  /** 排出：从尾根底下掉出来，翻滚落地，军服已经一身土黄 */
  function beginExpel() {
    ventWorld(_wmA);
    for (const e of st.eaten) {
      const tr = e.tr;
      tr.visible = true;
      tr.scale.setScalar(1);
      tr.userData._expelFrom = _wmA.clone();
      // 落点：排出口正下方地面，三个人横着散开一点，别叠成一坨
      whale.getWorldQuaternion(_wmQ);
      _wmB.set(0, 0, 1).applyQuaternion(_wmQ).normalize(); // 鲸的右舷
      _wmC.copy(_wmA).addScaledVector(_wmB, (st.eaten.indexOf(e) - 1) * 3.2);
      const dir = _wmC.clone().normalize();
      const gh = groundHeightAt ? groundHeightAt(dir) : null;
      tr.userData._expelTo = dir.multiplyScalar(
        Number.isFinite(gh) ? gh + 0.02 : _wmC.length()
      );
      // ---- 军服变土黄（主人点名）----
      soilVanguardUniform(tr);
      tr.userData.soiled = true;
      if (spawnSmoke) spawnSmoke(_wmA.clone());
    }
    st.expelledTotal += st.eaten.length;
  }

  function updateExpel(dt, k01) {
    for (const e of st.eaten) {
      const tr = e.tr;
      const from = tr.userData._expelFrom;
      const to = tr.userData._expelTo;
      if (!from || !to) continue;
      // 抛物线：往后下方甩出去，再落到地上
      _wmA.copy(from).lerp(to, k01);
      _wmB.copy(_wmA).normalize();
      _wmA.addScaledVector(_wmB, Math.sin(k01 * Math.PI) * 2.2);
      tr.position.copy(_wmA);
      if (tr.parent && tr.parent !== scene) tr.parent.worldToLocal(tr.position);
      // 一路翻滚，落地才停
      const spin = (1 - k01) * e.spin;
      tr.rotation.x = Math.sin(st.clock * spin) * 0.8 * (1 - k01);
      tr.rotation.z = Math.cos(st.clock * spin * 0.8) * 0.6 * (1 - k01);
      tr.rotation.y += dt * spin * 0.6;
    }
  }

  /** 落地之后：把姿态摆正，交还给战斗逻辑 */
  function finishExpel() {
    for (const e of st.eaten) {
      const tr = e.tr;
      tr.rotation.set(0, 0, 0);
      tr.scale.setScalar(1);
      tr.userData.swallowed = false;
      tr.userData.dazed = WHALE_MAW.dazedTime; // 爬起来、抖一抖，再归队
      delete tr.userData._swallowFrom;
      delete tr.userData._expelFrom;
      delete tr.userData._expelTo;
    }
    st.eaten = [];
  }

  /**
   * 逐帧。**必须在鲸自己的 update 之后调用**——
   * leviathanIsland 的 update 每帧都会 `group.quaternion.copy(poseQ)` 把姿态复位，
   * 挣扎的甩动写在它前面会被整条抹掉（saihojiGarden 里那两行抖动也是这么排的）。
   *
   * @param {number} dt
   * @param {number} t
   */
  function update(dt, t) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    st.clock += dt;
    if (!attach()) return;
    if (st.cooldown > 0) st.cooldown -= dt;

    // ---------- 挣扎 ----------
    // 被绳索拽住 = 一阵一阵地挣：猛地一挣（struggle→1），指数衰减下去，
    // 隔 struggleGap 秒再来一阵。永远匀速抖动的东西读起来像机器，不像活物。
    // 挣的力度乘上当前的拉扯强度：拉得越狠挣得越凶，松了就平息。
    if (st.tug > 0.05) {
      st.struggleClock += dt;
      if (st.struggleClock >= WHALE_MAW.struggleGap) {
        st.struggleClock = 0;
        st.struggle = 1;
      }
      st.struggle *= Math.exp(-dt / WHALE_MAW.struggleTau);
    } else {
      st.struggle *= Math.exp(-dt / (WHALE_MAW.struggleTau * 0.5));
    }
    const s = st.struggle * (0.35 + 0.65 * st.tug);
    // ⚠️ 挣扎不能只在这里写一次就完事，会被鲸自己的 update 抹掉。
    // 场景按 sceneHandles 顺序更新，默认 ["messenger", "saihoji"]：
    //   messenger → saihojiPhalanx → 本函数（写甩动）
    //   saihoji   → leviathan.update → `group.quaternion.copy(poseQ)`（复位）
    // 后者在后面。所以这里把甩动量**发布**到 whale.userData.combatShake，
    // 由 saihojiGarden 在 leviathan.update **之后**再应用一次
    // （见 applyWhaleCombatShake）。这里自己也先应用一次：
    // 没有别人接手时（测试桩、只加载 messenger）这一次就够了，
    // 而有人接手时中间隔着一次复位，不会叠加成两倍。
    whale.userData.combatShake = s > 0.005
      ? {
          roll: Math.sin(st.clock * 7.3) * WHALE_MAW.rollAmp * s,
          pitch: Math.sin(st.clock * 5.1 + 1.1) * WHALE_MAW.pitchAmp * s,
          yaw: Math.sin(st.clock * 3.7 + 0.4) * WHALE_MAW.yawAmp * s,
          tailY: Math.sin(st.clock * 6.2) * 0.22 * s,
          // 拽沉：被拉下去一截又弹回来。基准偏下（−0.55），叠一层挣扎的回弹，
          // 读起来是「一直被往下拽、时不时挣起来一下」。
          heave: WHALE_MAW.heaveAmp * s * (-0.55 + 0.45 * Math.sin(st.clock * 4.1)),
        }
      : null;
    applyWhaleCombatShake(whale);

    // ---------- 吞吐状态机 ----------
    st.phaseT += dt;
    /**
     * 张嘴 = **眼前那一整段绕眼睛（+Z 轴）抬起来**。
     * +Z 是右舷，绕它转正角把 +X（鲸头）抬向 +Y（背上）——吻端往上掀。
     * k=0 时铰链归零，两半严丝合缝拼回原样，鲸和没被切过一模一样。
     */
    /**
     * 张嘴 = **下颌绕眼轴往下沉 + 喉囊鼓起来**（参考图：蓝鲸 lunge feeding）。
     *
     * 负角：绕 +Z（右舷）转负角把 +X（鲸头）压向 −Y（腹下），下巴掉下去。
     * 同时把下颌纵向/横向放大——下颌不是一块硬板，喉腹褶一撑开就鼓成口袋。
     * k=0 时 rotation 归零、scale 归一，下颌严丝合缝扣回去，鲸和没切过一样。
     */
    const openTo = (k) => {
      if (!maw) return;
      maw.hinge.rotation.z = -WHALE_MAW.gape * k;
      maw.hinge.scale.set(1, 1 + WHALE_MAW.pouchY * k, 1 + WHALE_MAW.pouchZ * k);
      maw.throat.visible = k > 0.04; // 上腭 / 鲸须 / 喉腹褶只在张开时露出来
      maw.throat.fade(k);
    };
    switch (st.phase) {
      case "gape": {
        const k = Math.min(1, st.phaseT / WHALE_MAW.gapeTime);
        openTo(k * k * (3 - 2 * k));
        if (k >= 1) {
          st.phase = "suck";
          st.phaseT = 0;
          if (beginSuck() === 0) {
            // 一个都够不着：合上嘴，进冷却，别空张着
            st.phase = "idle";
            st.cooldown = WHALE_MAW.cooldown * 0.4;
            openTo(0);
          }
        }
        break;
      }
      case "suck": {
        updateSuck(dt);
        if (st.phaseT >= WHALE_MAW.suckTime) {
          for (const e of st.eaten) { e.tr.visible = false; }
          st.phase = "hold";
          st.phaseT = 0;
        }
        break;
      }
      case "hold": {
        // 嘴合上；肚子里那一坨从头往尾走一趟
        const k = Math.min(1, st.phaseT / WHALE_MAW.holdTime);
        openTo(Math.max(0, 1 - k * 3));
        if (bulge) {
          bulge.visible = st.eaten.length > 0;
          const x = THREE.MathUtils.lerp(24, WHALE.ventX, k);
          const sk = sectionK(x);
          bulge.position.set(x, WHALE.centerY - WHALE.halfHi * sk * 0.62, 0);
          const wob = 1 + 0.18 * Math.sin(st.clock * 8.4);
          bulge.scale.set(3.2 * wob, 2.4, 3.0 * wob);
        }
        if (k >= 1) {
          if (bulge) bulge.visible = false;
          beginExpel();
          st.phase = "expel";
          st.phaseT = 0;
        }
        break;
      }
      case "expel": {
        const k = Math.min(1, st.phaseT / WHALE_MAW.expelTime);
        updateExpel(dt, k * k * (3 - 2 * k));
        if (k >= 1) {
          finishExpel();
          st.phase = "idle";
          st.phaseT = 0;
          st.cooldown = WHALE_MAW.cooldown;
        }
        break;
      }
      default:
        openTo(0);
        if (bulge) bulge.visible = false;
        break;
    }

    // 呆滞计时（排出来的人抖一抖再归队）交给各自的战斗逻辑读
    for (const tr of getTroopers()) {
      const u = tr?.userData;
      if (u && u.dazed > 0) u.dazed = Math.max(0, u.dazed - dt);
    }
  }

  return {
    update,
    setTug,
    swallow,
    tug: () => st.tug,
    phase: () => st.phase,
    mouthWorld,
    ventWorld,
    parts: () => { attach(); return { maw, bulge, hinge: maw?.hinge || null }; },
    stats: () => ({
      tug: +st.tug.toFixed(3),
      struggle: +st.struggle.toFixed(3),
      phase: st.phase,
      inBelly: st.eaten.length,
      swallowed: st.swallowedTotal,
      expelled: st.expelledTotal,
      cooldown: +Math.max(0, st.cooldown).toFixed(2),
    }),
  };
}
