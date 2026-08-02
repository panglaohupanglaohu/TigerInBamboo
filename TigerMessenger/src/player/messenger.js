// =====================================================================
//  玩家模型：竹虎图「斑阑」风格低多边猛虎信使
//  - 狩野山乐《竹虎图》色：橙金底 + 焦墨斑 + 腹底留白
//  - Cel 卡通 + 黑边描边；userData 接口兼容 animation.js
//  - 四足：legL/legR 后肢，armL/armR 前肢；cape = 尾
// =====================================================================
import * as THREE from "three";
import { toonMat, outlineAs, getToonGradient } from "../assets/toon.js";

const ORANGE = 0xd27a24;
const ORANGE_DEEP = 0xb5621a;
const INK = 0x1d140d;
const CREAM = 0xf2e8d5;
const NOSE = 0x2a1a12;
const EYE = 0x1a1008;

/**
 * 给几何注入虎斑顶点色（沿体长波浪 + 腹底留白）
 * 假定局部：+Y 上、+Z 前、体长大致沿 Z
 */
function paintTigerStripes(geo, { alongAxis = "z", freq = 12 } = {}) {
  const pos = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(ORANGE);
  const deep = new THREE.Color(ORANGE_DEEP);
  const dark = new THREE.Color(INK);
  const cream = new THREE.Color(CREAM);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const along = alongAxis === "y" ? y : alongAxis === "x" ? x : z;
    const across = Math.atan2(x, y + 1e-4);
    const w1 = Math.sin(along * freq + Math.sin(across * 3 + along * 0.7) * 1.3);
    const w2 = Math.sin(across * 7 + along * 2.3);
    const wave = w1 + w2 * 0.4;
    const shade = THREE.MathUtils.clamp(0.45 + y * 0.55, 0, 1);
    c.copy(deep).lerp(base, shade);
    if (wave > 0.2) {
      const k = THREE.MathUtils.smoothstep(wave, 0.2, 0.85) * 0.85;
      c.lerp(dark, k);
    }
    const ny = nrm.getY(i);
    const belly = THREE.MathUtils.smoothstep(-ny, 0.15, 0.55) * 0.45;
    if (belly > 0) c.lerp(cream, belly);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function furMat(color = ORANGE) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
    vertexColors: true,
  });
}

function solidMat(color) {
  return toonMat(color);
}

function stripeMesh(geo, { alongAxis = "z", outline = "character" } = {}) {
  paintTigerStripes(geo, { alongAxis });
  const m = new THREE.Mesh(geo, furMat());
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline) outlineAs(m, outline);
  return m;
}

/**
 * 竹虎信使：约 1.55m 肩高量级，面朝 +Z
 */
export function buildMessenger() {
  const group = new THREE.Group();

  // —— 躯干（体长沿 Z）——
  const bodyGeo = new THREE.BoxGeometry(0.52, 0.48, 0.95, 2, 2, 4);
  const body = stripeMesh(bodyGeo, { outline: "character" });
  body.position.set(0, 0.92, 0);
  group.add(body);

  // 胸腹微鼓
  const chestGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const chest = stripeMesh(chestGeo, { outline: "characterDetail" });
  chest.scale.set(1.15, 0.95, 1.05);
  chest.position.set(0, 0.88, 0.28);
  group.add(chest);

  // —— 头（在身前上方）——
  const headG = new THREE.Group();
  headG.position.set(0, 1.22, 0.55);
  group.add(headG);

  const headGeo = new THREE.BoxGeometry(0.4, 0.36, 0.42, 2, 2, 2);
  const head = stripeMesh(headGeo, { outline: "character" });
  headG.add(head);

  // 吻部
  const snoutGeo = new THREE.BoxGeometry(0.22, 0.16, 0.22);
  paintTigerStripes(snoutGeo, { freq: 16 });
  const snout = new THREE.Mesh(snoutGeo, furMat());
  snout.position.set(0, -0.06, 0.28);
  snout.castShadow = true;
  outlineAs(snout, "characterDetail");
  headG.add(snout);

  // 鼻
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), solidMat(NOSE));
  nose.position.set(0, -0.02, 0.4);
  headG.add(nose);

  // 虎耳
  const earGeo = new THREE.ConeGeometry(0.1, 0.2, 4);
  const earL = new THREE.Mesh(earGeo, solidMat(ORANGE));
  earL.position.set(-0.14, 0.24, -0.02);
  earL.rotation.z = 0.28;
  earL.castShadow = true;
  outlineAs(earL, "characterDetail");
  headG.add(earL);
  const earR = earL.clone();
  earR.position.x = 0.14;
  earR.rotation.z = -0.28;
  headG.add(earR);
  // 耳内乳白
  const earInL = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.12, 4),
    solidMat(CREAM)
  );
  earInL.position.set(-0.14, 0.22, 0.02);
  earInL.rotation.z = 0.28;
  headG.add(earInL);
  const earInR = earInL.clone();
  earInR.position.x = 0.14;
  earInR.rotation.z = -0.28;
  headG.add(earInR);

  // 额心王字简笔（焦墨小块）
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), solidMat(INK));
  brow.position.set(0, 0.12, 0.2);
  headG.add(brow);

  // 眼
  const eyeMat = new THREE.MeshBasicMaterial({ color: EYE });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.04), eyeMat);
  eyeL.position.set(-0.11, 0.06, 0.2);
  headG.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.11;
  headG.add(eyeR);
  // 眼下泪腺白斑
  const tearL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), solidMat(CREAM));
  tearL.position.set(-0.12, -0.02, 0.2);
  headG.add(tearL);
  const tearR = tearL.clone();
  tearR.position.x = 0.12;
  headG.add(tearR);

  // —— 前肢（arm）枢轴在肩 ——
  const foreGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  foreGeo.translate(0, -0.28, 0);
  paintTigerStripes(foreGeo, { alongAxis: "y", freq: 18 });
  const armL = new THREE.Mesh(foreGeo, furMat());
  armL.position.set(-0.22, 0.9, 0.28);
  armL.castShadow = true;
  outlineAs(armL, "characterDetail");
  group.add(armL);
  const armR = new THREE.Mesh(foreGeo.clone(), furMat());
  paintTigerStripes(armR.geometry, { alongAxis: "y", freq: 18 });
  armR.position.set(0.22, 0.9, 0.28);
  armR.castShadow = true;
  outlineAs(armR, "characterDetail");
  group.add(armR);

  // 爪尖乳白
  for (const arm of [armL, armR]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), solidMat(CREAM));
    paw.position.set(0, -0.55, 0.02);
    arm.add(paw);
  }

  // —— 后肢（leg）枢轴在髋 ——
  const hindGeo = new THREE.BoxGeometry(0.16, 0.5, 0.18);
  hindGeo.translate(0, -0.25, 0);
  paintTigerStripes(hindGeo, { alongAxis: "y", freq: 16 });
  const legL = new THREE.Mesh(hindGeo, furMat());
  legL.position.set(-0.2, 0.78, -0.28);
  legL.castShadow = true;
  outlineAs(legL, "characterDetail");
  group.add(legL);
  const legR = new THREE.Mesh(hindGeo.clone(), furMat());
  paintTigerStripes(legR.geometry, { alongAxis: "y", freq: 16 });
  legR.position.set(0.2, 0.78, -0.28);
  legR.castShadow = true;
  outlineAs(legR, "characterDetail");
  group.add(legR);
  for (const leg of [legL, legR]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), solidMat(CREAM));
    paw.position.set(0, -0.5, 0.02);
    leg.add(paw);
  }

  // —— 尾（作用等同原披风 cape，跑跳后摆）——
  const tailG = new THREE.Group();
  tailG.position.set(0, 1.0, -0.48);
  group.add(tailG);
  const tailSegs = [];
  let parent = tailG;
  for (let i = 0; i < 4; i++) {
    const segGeo = new THREE.CylinderGeometry(0.07 - i * 0.012, 0.09 - i * 0.012, 0.22, 5);
    paintTigerStripes(segGeo, { alongAxis: "y", freq: 20 });
    const seg = new THREE.Mesh(segGeo, furMat());
    seg.position.y = i === 0 ? -0.05 : -0.2;
    // 尾沿 -Z 伸出：先放水平
    if (i === 0) {
      seg.rotation.x = Math.PI / 2;
    }
    seg.castShadow = true;
    outlineAs(seg, "characterDetail");
    parent.add(seg);
    tailSegs.push(seg);
    // 下一节挂在本节末端
    const joint = new THREE.Group();
    joint.position.set(0, -0.2, 0);
    seg.add(joint);
    parent = joint;
  }
  // cape 接口：整条尾根 Group，animation 旋 rotation.x
  const cape = tailG;

  // —— 信袋（背负小囊，替代人型背包）——
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.16),
    solidMat(0x3a322c)
  );
  pack.position.set(0, 1.12, -0.15);
  pack.castShadow = true;
  outlineAs(pack, "prop");
  group.add(pack);

  // —— 信件（持有时显示，叼在嘴侧 / 托于前胸）——
  const letter = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, 0.04),
    toonMat(0xfff4d6, { emissive: 0xaa8844, emissiveIntensity: 0.45 })
  );
  letter.position.set(0.28, 0.95, 0.45);
  letter.visible = false;
  group.add(letter);

  // 兼容 animation：body 用躯干 mesh；head 用头 mesh；ear 相对 headG 的本地旋转
  group.userData = {
    legL,
    legR,
    armL,
    armR,
    body,
    head,
    headG,
    earL,
    earR,
    cape,
    letter,
    eyeL,
    eyeR,
    tailSegs,
    isTiger: true,
    // 虎躯干 idle 基准高度（animation 用）
    bodyBaseY: 0.92,
    letterBaseY: 0.95,
  };

  // 整体略放大到信使量纲（肩高约 1.1~1.2，全高约 1.5）
  group.scale.setScalar(1.05);
  return group;
}
