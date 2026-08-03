// =====================================================================
//  阿狸（Classic AliFox）· 国漫治愈系重构
//  二头身：圆球大头嵌套卵圆身（消灭断层）；火焰微翘四节尾；
//  短小四足 + 眯眯眼/粗眉/腮红；全件 Cel 描边；行走四腿交替
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { groundLiftAt, worldToFlatXZ } from "../world/hills.js";
import { canyonOffsetDir } from "../world/canyon.js";
import { PLANET_RADIUS } from "../world/planet.js";

const ORANGE = 0xe96a36; // 动漫橙（主体/尾前 3 节）
const CREAM = 0xf4f7ed; // 乳白（尾尖/眉）
const INK = 0x2a2a2a; // 焦黑（眯眯眼/爪尖）
const BLUSH = 0xfadbd8; // 腮红粉
const FOX_SCALE = 0.32; // 整体缩放（成品 ~1.15 高）

const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _yUp = new THREE.Vector3(0, 1, 0);
const _m1 = new THREE.Matrix4();

function mesh(geo, color, outline = 0.04) {
  const m = new THREE.Mesh(facet(geo), toonMat(color));
  m.castShadow = true;
  addOutline(m, outline);
  return m;
}

/**
 * 经典阿狸（底部中心对齐局部原点，面朝 +z）。
 * @returns {THREE.Group} userData 含动画部件引用
 */
export function createClassicAliFox() {
  const g = new THREE.Group();
  g.name = "classic-ali-fox";

  // ---------- 浑圆卵身（比头略小） ----------
  const body = mesh(new THREE.SphereGeometry(1.15, 8, 6), ORANGE, 0.05);
  body.scale.set(1, 0.88, 1.12); // 横向卵形
  body.position.set(0, 1.15, 0);
  g.add(body);

  // ---------- 圆滚大头（前上方，嵌入身体 0.2+ 消灭断层） ----------
  const head = mesh(new THREE.SphereGeometry(1.5, 8, 6), ORANGE, 0.055);
  head.position.set(0, 2.15, 0.45); // 头底 0.65 < 身顶 2.13 → 深度嵌套
  g.add(head);

  // 尖耳（阿狸标志性）
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.42, 0.85, 5), ORANGE, 0.03);
    ear.scale.set(1, 1, 0.55);
    ear.position.set(side * 0.78, 3.42, 0.28);
    ear.rotation.z = -side * 0.28;
    g.add(ear);
    const inner = mesh(new THREE.ConeGeometry(0.22, 0.5, 4), CREAM, 0.012);
    inner.position.set(side * 0.72, 3.34, 0.44);
    inner.rotation.z = -side * 0.28;
    inner.scale.set(1, 1, 0.4);
    g.add(inner);
  }

  // ---------- 治愈系五官（贴脸微浮 0.01+） ----------
  for (const side of [-1, 1]) {
    // 弯弯眯眯眼（焦黑弧形贴片，闭眼温柔）
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.055, 5, 8, Math.PI),
      new THREE.MeshBasicMaterial({ color: INK })
    );
    eye.position.set(side * 0.56, 2.28, 1.86);
    eye.rotation.z = 0; // 弧口朝上 = 闭眼笑
    g.add(eye);
    // 无辜粗眉（乳白倒三角）
    const brow = mesh(new THREE.ConeGeometry(0.17, 0.24, 3), CREAM, 0.008);
    brow.scale.set(1, 1, 0.4);
    brow.position.set(side * 0.58, 2.68, 1.72);
    brow.rotation.z = Math.PI; // 倒三角
    brow.rotation.x = -0.2;
    g.add(brow);
    // 腮红
    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 8),
      new THREE.MeshBasicMaterial({ color: BLUSH })
    );
    cheek.position.set(side * 0.98, 1.92, 1.55);
    cheek.rotation.y = side * 0.5;
    g.add(cheek);
  }

  // ---------- 短小四足（焦黑爪尖） ----------
  const legs = [];
  for (const [lx, lz] of [[-0.55, 0.5], [0.55, 0.5], [-0.55, -0.55], [0.55, -0.55]]) {
    const legG = new THREE.Group();
    legG.position.set(lx, 0.62, lz); // 髋部枢轴
    const leg = mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.52, 5), ORANGE, 0.02);
    leg.geometry.translate(0, -0.26, 0); // 顶点在髋
    legG.add(leg);
    const paw = mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.14, 5), INK, 0.015);
    paw.position.y = -0.55;
    legG.add(paw);
    g.add(legG);
    legs.push(legG);
  }

  // ---------- 火焰微翘大尾（4 节串联，后臀起，上翘 ~35°） ----------
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 1.35, -1.05); // 后臀
  tailRoot.rotation.x = 0.6; // 整体向上微翘
  const tailSegs = [
    { r: 0.55, len: 0.85, color: ORANGE },
    { r: 0.48, len: 0.8, color: ORANGE },
    { r: 0.4, len: 0.75, color: ORANGE },
    { r: 0.28, len: 0.95, color: CREAM }, // 尾尖乳白修长
  ];
  let parent = tailRoot;
  const tailParts = [];
  for (let i = 0; i < tailSegs.length; i++) {
    const { r, len, color } = tailSegs[i];
    const joint = new THREE.Group();
    joint.position.z = i === 0 ? 0 : -tailSegs[i - 1].len; // 接上一节末端
    joint.rotation.x = -0.12 - i * 0.06; // 逐节回卷成火炬弧线
    const seg = mesh(new THREE.ConeGeometry(r, len, 5), color, 0.03);
    seg.scale.set(1, 1, 0.5); // 极扁
    seg.rotation.x = -Math.PI / 2; // 尖端朝后
    seg.position.z = -len / 2;
    joint.add(seg);
    parent.add(joint);
    parent = joint;
    tailParts.push(joint);
  }
  g.add(tailRoot);

  g.scale.setScalar(FOX_SCALE);
  g.userData = { body, head, legs, tailRoot, tailParts, animPhase: 0 };
  return g;
}

/**
 * 阿狸伴侣：尾随玩家 + 行走动画（四腿交替 + 身体轻颠）。
 * @returns {{ group, update }}
 */
export function createAliFoxCompanion(scene, player) {
  const fox = createClassicAliFox();
  scene.add(fox);
  const state = { moving: false };

  function groundR(pos) {
    _dir.copy(pos).normalize();
    const flat = worldToFlatXZ(_dir, PLANET_RADIUS);
    const lift = flat ? groundLiftAt(flat.x, flat.z) : 0;
    return PLANET_RADIUS + (lift || 0) + canyonOffsetDir(_dir);
  }

  function update(dt, t) {
    // 目标：玩家身后 ~2.2 单位
    _tmp.copy(player.forward || _yUp).multiplyScalar(-2.2);
    _tmp.add(player.position);
    _tmp.setLength(groundR(player.position));
    const d0 = fox.position.length() < 1 ? player.position.clone() : null;
    if (d0) fox.position.copy(d0); // 首帧就位
    const dist = fox.position.distanceTo(_tmp);
    const blend = 1 - Math.exp(-3.2 * dt);
    fox.position.lerp(_tmp, blend);
    fox.position.setLength(groundR(fox.position));

    state.moving = dist > 0.6;
    const u = fox.userData;

    // 朝向：行进方向（贴球面切向）
    _up.copy(fox.position).normalize();
    if (state.moving && player.forward) {
      _dir.copy(player.forward).addScaledVector(_up, -player.forward.dot(_up)).normalize();
      const xAxis = new THREE.Vector3().crossVectors(_up, _dir).normalize();
      _m1.makeBasis(xAxis, _up, _dir); // 局部 +z = 行进方向
      _quat.setFromRotationMatrix(_m1);
      fox.quaternion.slerp(_quat, 1 - Math.exp(-8 * dt));
    } else {
      _quat.setFromUnitVectors(_yUp, _up);
      fox.quaternion.slerp(_quat, 1 - Math.exp(-4 * dt));
    }

    // 行走动画：四腿对角交替 + 身体轻颠
    if (state.moving) {
      u.animPhase += dt * 9;
      const s = Math.sin(u.animPhase) * 0.55;
      u.legs[0].rotation.x = s; // 左前
      u.legs[3].rotation.x = s; // 右后（对角）
      u.legs[1].rotation.x = -s; // 右前
      u.legs[2].rotation.x = -s; // 左后
      u.body.position.y = 1.15 + Math.abs(Math.sin(u.animPhase)) * 0.08; // 轻颠
      u.head.position.y = 2.15 + Math.abs(Math.sin(u.animPhase)) * 0.06;
    } else {
      for (const leg of u.legs) leg.rotation.x *= 0.85;
      u.body.position.y = 1.15 + Math.sin(t * 1.6) * 0.03; // 呼吸
    }
    // 尾巴火焰飘逸（微风摆动）
    u.tailRoot.rotation.x = 0.6 + Math.sin(t * 1.8) * 0.06;
    for (let i = 0; i < u.tailParts.length; i++) {
      u.tailParts[i].rotation.y = Math.sin(t * 2.2 + i * 0.7) * 0.08;
    }
  }

  return { group: fox, update, isMoving: () => state.moving };
}
