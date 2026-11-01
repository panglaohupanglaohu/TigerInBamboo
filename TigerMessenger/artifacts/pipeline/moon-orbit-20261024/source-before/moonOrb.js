// =====================================================================
//  月亮湖的月亮：悬在湖面之外、贴着地平线的巨大**月牙**
//
//  主人 2026-09-06：「在地标月亮湖构建如图所示那么大的月亮模型」
//                  →「那个月亮是个月牙的模型」
//
//  第一版做成了满月的球。改成月牙之后，这个地标才算对上号——
//  湖本身就是「月牙形湖面」（lake.js 用外圆减偏心内圆切出来的），
//  月亮用**同一套做法**切出来，天上那弯和水里那弯是一对。
//
//  尺寸是照着**视角**定的，不是照着数字拍脑袋：
//    · 湖 rOuter = 3.5（局部单位，不乘 WORLD_SCALE），直径 7；
//    · 月牙外圆半径 3.4 → 外径 6.8，几乎就是湖宽（7）；
//    · 圆心放在离湖心 7.5 的切向外侧（环湖小径外沿 4.7 之外，不占动线）、
//      水面之上 5.6 → 底缘 2.2，高过人头，走到底下也不会穿模；
//    · 从对岸小径看过去，斜距约 12.8，张角 2·atan(3.4/12.8) ≈ 30°。
//
//  月牙是**片状**的，所以它必须转过来对着人看：绕当地的天做偏航跟随
//  （只转偏航，不翻滚——月亮不该躺下来）。真实的月亮在无穷远处，
//  本来就永远正对观察者，这个跟随在观感上是「对」的，不是取巧。
//
//  球面世界的规矩在这里自动满足：整个模型挂在湖的 group 下，
//  那个 group 已经把「径向 = 局部 +Y、切平面 = 局部 XZ」摆好了，
//  所以这里可以放心用平面坐标，不必再走一遍「先乘半径再切向平移」。
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";
import { P } from "../core/params.js";

export const MOON_ORB = Object.freeze({
  /** 月牙外圆半径（局部单位）。湖 rOuter = 3.5，所以它外径和整片湖差不多宽 */
  radius: 3.4,
  /** 圆心距湖心的切向距离。必须大于环湖小径外沿（LAKE.pathOuter = 4.7） */
  offset: 7.5,
  /** 切向方位：月牙开阔水面那一侧（湖的缺口在 +X/−Z，实体水面在 −X/+Z） */
  dirX: -0.83,
  dirZ: 0.55,
  /** 水面之上的高度。底缘 = height − radius = 2.2，高过人头（约 1.87） */
  height: 5.6,

  // ---- 月牙的形状（做法与 lake.js 的月牙湖面同源：外圆减偏心内圆）----
  /**
   * 挖去的内圆半径，占外圆的比例。
   * **等半径的两个圆错开**是月牙的经典画法（lune）：内外弧曲率一样，
   * 两只角自然收成尖。第一版照搬了湖面的 0.72 / 0.374——那两个圆几乎同心，
   * 切出来是个只缺了一小口的**圆环**（截图实锤），根本不是月牙。
   */
  holeRatio: 1.0,
  /** 内圆圆心的偏移，占外圆半径的比例。等半径时它就是月牙的**最厚处** */
  holeOffset: 0.46,
  /**
   * 月牙在自己平面内的倾角（弧度）：两只角斜着挑起来，别正着立成一个 C。
   * 缺口的方位**只由它决定**——轮廓是按「内圆在 +X 方向」画的（见 crescentShape），
   * 整体朝向靠这一个角度转，不再另设一个 holeAngle（两处各定一次，迟早对不上）。
   */
  tilt: -0.42,
  /** 厚度占外圆半径的比例。**要有厚度**——侧看时它是块实体，不是一张纸 */
  depthRatio: 0.16,
  /** 轮廓细分。月牙的弧线是这个地标的脸面，别省 */
  curveSegments: 72,

  /** 悬浮呼吸：振幅（米）与角频率 */
  bobAmp: 0.22,
  bobSpeed: 0.19,
  /** 偏航跟随的角速度上限（弧度/秒）：慢慢转过来，不要瞬时对准 */
  yawRate: 0.9,
  /** 月海（暗斑）数量 */
  maria: 5,
});

/** 月球本体 / 月海 / 光晕的颜色 */
const MOON_COLOR = 0xdde8ec;
const MARIA_COLOR = 0xa8bccb;
const GLOW_COLOR = 0xbcd8f0;

/**
 * 月海分布（确定性常量表，禁 Math.random）。
 *
 * 坐标是**月牙自己平面里的**归一化位置（x, y ∈ 外圆半径的比例），r 是半径比例。
 * 每一块都必须落在月牙的实体内——既在外圆里，又在被挖掉的内圆外。
 * 坐标系与 crescentShape 一致：内圆在 +X 方向偏移 holeOffset，所以月牙的实体
 * 在 −X 那一侧——五块暗斑的 x 才全是负的。
 * 这五个位置是照着 holeRatio=1.0 / holeOffset=0.46 挑的，
 * 改了那两个参数就要重挑（test_moon_orb ⑤b 会当场把越界的抓出来）。
 */
const MARIA = Object.freeze([
  Object.freeze({ x: -0.72, y: 0.28, r: 0.17 }),
  Object.freeze({ x: -0.50, y: 0.66, r: 0.12 }),
  Object.freeze({ x: -0.74, y: -0.16, r: 0.13 }),
  Object.freeze({ x: -0.62, y: -0.52, r: 0.11 }),
  Object.freeze({ x: -0.70, y: 0.10, r: 0.075 }),
]);

/**
 * 光晕：**一张径向渐变的 Sprite**，不是几层同心球壳。
 *
 * 第一版用的是 BackSide + 加色的三层球壳，渲染出来是三道边界分明的多边形环
 * （截图实锤）：球壳只有 16×12 段，轮廓的折线看得一清二楚，而且三层之间
 * 有硬边——那是三个圈，不是一团光。渐变贴图一张就够，还只有一个 draw call，
 * 而且 Sprite 永远正对镜头，从环湖小径任何角度看都是同一团光。
 */
const GLOW_SPRITE_SCALE = 3.0;  // 相对月球**直径**（内圈被月球挡住，不必太大）
const GLOW_SPRITE_OPACITY = 0.78;

/** 光晕贴图（单例，全场景共用一张）：中心亮 → 边缘透明的径向渐变 */
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  const grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.10, size / 2, size / 2, size / 2);
  // 中心留得**透**一点：盘面自己就是亮的，光晕再压一层实心上去会把月海洗掉
  grd.addColorStop(0.00, "rgba(206,230,250,0.36)");
  grd.addColorStop(0.30, "rgba(184,218,246,0.34)");
  grd.addColorStop(0.46, "rgba(158,198,236,0.26)");
  grd.addColorStop(0.64, "rgba(130,175,222,0.13)");
  grd.addColorStop(0.80, "rgba(112,158,210,0.05)");
  grd.addColorStop(1.00, "rgba(100,145,200,0.0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.needsUpdate = true;
  return _glowTex;
}

/**
 * 月牙轮廓：**一条闭合的外轮廓**，不是「圆减圆」。
 *
 * 第一版按湖面那套写成 Shape + hole（外圆挖一个偏心内圆）。那是个陷阱：
 * ExtrudeGeometry / Earcut 要求洞**完全落在轮廓里**，而月牙恰恰要求那个洞
 * **捅出外圆**（不捅出来就只是个缺一小口的圆环）。两条边界一相交，
 * 三角剖分就崩了——截图上那道横贯月面的斜边就是崩出来的碎片。
 *
 * 正确的做法是把月牙当成一条简单闭合曲线来描：
 *   外弧（背离内圆那一侧的大弧）→ 内弧（凸进来的那一段）→ 闭合。
 * 两个交点（月牙的两只角）用圆-圆相交解出来：
 *   a = (d² + R² − r²) / 2d ，h = √(R² − a²)
 * 全程只有 lineTo，没有洞，任何剖分器都不会出错。
 *
 * @param {number} R 外圆半径
 * @param {number} r 内圆半径
 * @param {number} d 内圆圆心的偏移（沿 +X）
 * @param {number} seg 每条弧的采样段数
 */
function crescentShape(R, r, d, seg) {
  const a = (d * d + R * R - r * r) / (2 * d);
  const h = Math.sqrt(Math.max(1e-6, R * R - a * a));
  const th = Math.atan2(h, a);       // 角点在外圆上的方位
  const ps = Math.atan2(h, a - d);   // 角点在内圆上的方位
  const shape = new THREE.Shape();
  // 外弧：从 +th 逆时针绕到 2π−th（经过 π，也就是背离内圆的那一整段）
  for (let i = 0; i <= seg; i++) {
    const t = th + (Math.PI * 2 - th * 2) * (i / seg);
    const x = R * Math.cos(t);
    const y = R * Math.sin(t);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  // 内弧：从 −ps 反向绕到 ps−2π（经过 −π，也就是凸进月牙里的那一段）
  for (let i = 0; i <= seg; i++) {
    const t = -ps + (ps * 2 - Math.PI * 2) * (i / seg);
    shape.lineTo(d + r * Math.cos(t), r * Math.sin(t));
  }
  shape.closePath();
  return shape;
}

const _mvUp = new THREE.Vector3();

/**
 * 白天/夜里的强度。P.timeOfDay：0 午夜 / 0.5 正午 / 1 午夜。
 * 月亮本体白天照样在（它是个实体模型），但**光晕和水面月光路**要退场——
 * 大中午湖面上铺一条月光，比没有月亮还假。
 */
function nightK() {
  const tod = Number.isFinite(P?.timeOfDay) ? P.timeOfDay : 0.5;
  // 到午夜的距离（考虑 0/1 是同一个时刻）
  const d = Math.min(Math.abs(tod), Math.abs(1 - tod));
  // d = 0（午夜）→ 1；d ≥ 0.32（约上午 8 点 / 下午 4 点）→ 0
  const k = 1 - Math.min(1, Math.max(0, (d - 0.10) / 0.22));
  return k * k * (3 - 2 * k); // smoothstep，别在黄昏那几帧闪一下
}

/**
 * 造月亮。挂进湖的 group（局部 +Y = 天，XZ = 切平面）。
 *
 * @param {THREE.Object3D} parent 湖的 group
 * @param {{ radius?:number, offset?:number, height?:number }} [opts]
 * @returns {{ group, body, glows, reflect, update:(t:number, dt:number, viewerLocal:THREE.Vector3|null)=>void }}
 */
export function createMoonOrb(parent, opts = {}) {
  const R = opts.radius ?? MOON_ORB.radius;
  const off = opts.offset ?? MOON_ORB.offset;
  const hgt = opts.height ?? MOON_ORB.height;

  const group = new THREE.Group();
  group.name = "moon-lake-orb";
  const baseX = MOON_ORB.dirX * off;
  const baseZ = MOON_ORB.dirZ * off;
  group.position.set(baseX, hgt, baseZ);

  // ---- 月牙本体 ----
  // 做法与月亮湖的湖面同源（lake.js）：外圆减一个偏心内圆。
  // 天上那一弯和水里那一弯是同一把刀切出来的，这个地标才算自洽。
  const holeR = R * MOON_ORB.holeRatio;
  const holeD = R * MOON_ORB.holeOffset;
  const shape = crescentShape(holeR === 0 ? R : R, holeR, holeD, MOON_ORB.curveSegments);

  const depth = R * MOON_ORB.depthRatio;
  // 不倒角：月牙的两只角是尖的，倒角在尖角上会自交，又是一批碎三角。
  // 厚度全靠 depth，侧面是一圈干净的直壁——卡通渲染要的就是这种硬边。
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: MOON_ORB.curveSegments,
    bevelEnabled: false,
  });
  // 挤出是沿 +Z 从 0 长到 depth：挪到以自己为中心，转起来才不会绕着背面甩
  bodyGeo.translate(0, 0, -depth / 2);

  // 「脸」：月牙是**片状**的，必须转过来对着人。整张脸挂在这个组里，
  // 组绕当地的天做偏航跟随（见 update）。倾角在组**内**给，
  // 这样跟随转动时两只角的斜度不会跟着变。
  const face = new THREE.Group();
  face.name = "moon-lake-orb-face";
  group.add(face);

  const body = new THREE.Mesh(
    bodyGeo,
    // 月亮是**发光体**：只靠场景光去照它，夜里会沉成一块灰板（第一版截图实锤）。
    // 但也不能给满：emissive 顶到本色就会过曝成一张白纸，月海全被洗掉
    // （第二版截图实锤）。0.62 是两次之间试出来的。
    toonMat(MOON_COLOR, { emissive: 0xa9c4d6, emissiveIntensity: 0.62, side: THREE.DoubleSide })
  );
  body.name = "moon-lake-orb-body";
  body.rotation.z = MOON_ORB.tilt;
  body.castShadow = false;   // 一个天体不该在湖边投出一块方影子
  body.receiveShadow = false;
  face.add(body);

  // ---- 地球反照（earthshine）----
  // 只有一弯亮边的话，读起来像根香蕉。真月牙的暗部会被地球反射的光照亮
  // 一点点，隐隐能看见整个圆盘的轮廓——补上这一层，它才立刻读成「月亮」。
  const earthshine = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.99, MOON_ORB.curveSegments),
    new THREE.MeshBasicMaterial({
      color: 0x8fa8bd,
      transparent: true,
      opacity: 0.065,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  earthshine.name = "moon-lake-orb-earthshine";
  earthshine.position.z = -depth * 0.55; // 压在月牙背面，不和它抢深度
  earthshine.rotation.z = MOON_ORB.tilt;
  earthshine.renderOrder = 0;
  face.add(earthshine);

  // ---- 月海：贴在月牙正面的暗斑 ----
  const mariaGroup = new THREE.Group();
  mariaGroup.name = "moon-lake-orb-maria";
  mariaGroup.rotation.z = MOON_ORB.tilt;
  mariaGroup.position.z = depth / 2 + 0.004; // 浮在正面之上一丝，避免 z-fighting
  const mariaMat = toonMat(MARIA_COLOR, { emissive: 0x8399ad, emissiveIntensity: 0.62 });
  const mariaGeoCache = new Map();
  for (let i = 0; i < Math.min(MOON_ORB.maria, MARIA.length); i++) {
    const m = MARIA[i];
    const cr = +(m.r * R).toFixed(3);
    let geo = mariaGeoCache.get(cr);
    if (!geo) {
      geo = new THREE.CircleGeometry(cr, 14);
      mariaGeoCache.set(cr, geo);
    }
    const patch = new THREE.Mesh(geo, mariaMat);
    patch.position.set(m.x * R, m.y * R, 0);
    mariaGroup.add(patch);
  }
  face.add(mariaGroup);

  // ---- 光晕 ----
  const glows = [];
  // ⚠️ 这里曾经有一层 BackSide 的「边缘轮廓光」壳。截图实锤它是反效果：
  // 加色混合在**已经很亮**的盘面外侧几乎加不动，露在夜空里那一圈反而读成
  // 一道脏灰边，像给月亮描了个轮廓。删掉，辉光全交给下面那张渐变贴图。
  // 大光晕：径向渐变 Sprite（永远正对镜头，一个 draw call）
  {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(),
      color: GLOW_COLOR,
      transparent: true,
      opacity: GLOW_SPRITE_OPACITY,
      depthWrite: false,
      // depthTest 保持开着：让月亮自己的深度挡住晕的内圈，
      // 盘面才不会被加色洗成一块白板（第一版关掉了，月海全被洗没了）。
      // 副作用是远岸的树会切一下月晕——那正是真实的样子。
      //
      // ⚠️ 但光晕是个**正对镜头的四边形**，而月牙是有厚度的实体：
      // 两者会相交，交线在画面上是一道生硬的斜边（截图实锤，像给月亮
      // 劈了一刀）。解法是每帧把光晕沿「背离观察者」的方向推到月亮身后
      // （见 update），让它整片都在月亮后面，深度测试就只剩正常的遮挡。
      blending: THREE.AdditiveBlending,
    }));
    halo.name = "moon-lake-orb-halo";
    halo.renderOrder = 1;
    halo.scale.setScalar(R * 2 * GLOW_SPRITE_SCALE);
    halo.userData.baseOpacity = GLOW_SPRITE_OPACITY;
    group.add(halo);
    glows.push(halo);
  }

  parent.add(group);

  // ---- 水面月光路 ----
  // 单独挂在 parent（湖 group）下，不进 group：它要贴着水面，
  // 不能跟着月亮的浮沉一起上下动。
  const reflect = new THREE.Group();
  reflect.name = "moon-lake-orb-reflection";
  reflect.position.set(0, 0.05, 0); // 水面之上一点点，压住 z-fighting
  const streak = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: 0xdcecf6,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  streak.rotation.x = -Math.PI / 2;
  streak.scale.set(R * 0.55, 1, R * 1.9); // 沿视线方向拉长 = 月光路
  streak.renderOrder = 1;
  reflect.add(streak);

  // 月光路上的碎光：四道横向短划，各自错相上下浮动
  const dashes = [];
  for (let i = 0; i < 4; i++) {
    const dash = new THREE.Mesh(
      new THREE.CircleGeometry(1, 12),
      new THREE.MeshBasicMaterial({
        color: 0xf2fbff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.scale.set(R * (0.34 - i * 0.05), 1, 0.11);
    dash.position.set(0, 0.01, -R * (0.5 + i * 0.62));
    dash.renderOrder = 2;
    dash.userData = { phase: i * 1.31, drift: 0.22 + i * 0.06, baseZ: dash.position.z };
    reflect.add(dash);
    dashes.push(dash);
  }
  parent.add(reflect);

  const state = { baseX, baseZ, hgt, R };

  /**
   * 逐帧：浮沉呼吸 + 昼夜强度 + 月光路朝着观察者铺开。
   *
   * @param {number} t 场景时间（秒）
   * @param {number} _dt
   * @param {THREE.Vector3|null} viewerLocal 观察者在**湖局部坐标**里的位置
   */
  function update(t, _dt, viewerLocal = null) {
    // 悬浮呼吸：很慢、很小，只是让它不像贴在天上的一张纸
    group.position.y = state.hgt + Math.sin(t * MOON_ORB.bobSpeed) * MOON_ORB.bobAmp;
    // 偏航跟随：月牙是片状的，得转过来对着人，否则侧面看只剩一条线。
    // 真实的月亮在无穷远处，本来就永远正对观察者——所以这不是取巧。
    // 只转偏航（绕当地的天），绝不翻滚：月亮不该躺下来。
    // 转速有上限，慢慢摆过去；玩家绕湖走一圈时看得出它在跟，但不突兀。
    if (viewerLocal) {
      const wantYaw = Math.atan2(viewerLocal.x - state.baseX, viewerLocal.z - state.baseZ);
      let d = wantYaw - face.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;   // 取最短弧，别绕远路
      while (d < -Math.PI) d += Math.PI * 2;
      const step = MOON_ORB.yawRate * Math.max(0, _dt || 0);
      face.rotation.y += step > 0 ? Math.max(-step, Math.min(step, d)) : d;
    }

    // 光晕整片推到月亮身后：不这么做，正对镜头的光晕四边形会和有厚度的
    // 月牙相交，交线在画面上是一道生硬的斜边。
    if (viewerLocal) {
      const ax = state.baseX - viewerLocal.x;
      const az = state.baseZ - viewerLocal.z;
      const an = Math.hypot(ax, az);
      if (an > 1e-4) {
        for (const shell of glows) {
          shell.position.set((ax / an) * state.R * 1.35, 0, (az / an) * state.R * 1.35);
        }
      }
    }

    const k = nightK();
    for (const shell of glows) {
      shell.material.opacity = shell.userData.baseOpacity * (0.25 + 0.75 * k)
        * (0.92 + 0.08 * Math.sin(t * 0.45));
    }

    // ---- 月光路：从月亮的地面投影朝观察者铺过来 ----
    // 真实的月光路永远指向观察者（每个人看到的都是朝自己来的那一条），
    // 所以这里每帧对着玩家转，而不是钉死一个方向。
    const gx = state.baseX;
    const gz = state.baseZ;
    let dirX = -gx;
    let dirZ = -gz;
    if (viewerLocal) {
      dirX = viewerLocal.x - gx;
      dirZ = viewerLocal.z - gz;
    }
    const len = Math.hypot(dirX, dirZ);
    if (len > 1e-4) {
      dirX /= len;
      dirZ /= len;
      // 月光路的起点压在湖缘那一侧，往观察者方向铺
      reflect.position.x = gx * 0.42 + dirX * state.R * 1.2;
      reflect.position.z = gz * 0.42 + dirZ * state.R * 1.2;
      // 局部 -Z 是拉长方向（streak 的 scale.z 那一轴）
      reflect.rotation.y = Math.atan2(-dirX, -dirZ);
    }
    streak.material.opacity = 0.16 * k;
    for (const dash of dashes) {
      const ud = dash.userData;
      dash.position.z = ud.baseZ + Math.sin(t * ud.drift + ud.phase) * 0.28;
      dash.material.opacity = 0.22 * k * (0.55 + 0.45 * Math.sin(t * 0.8 + ud.phase));
    }
    reflect.visible = k > 0.01;
  }

  return { group, face, body, earthshine, maria: mariaGroup, glows, reflect, streak, dashes, update };
}
