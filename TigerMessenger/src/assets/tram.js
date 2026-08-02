// =====================================================================
//  基督城 11 号复古有轨电车（高精版 · 加长压扁）
//  长 5.2（原 2 倍）/ 高 ~1.37（原 2/3）/ 贴轨行驶
//  三层分色车身 + 黄金标线"11" + 探照灯/路牌箱/防撞栏/双层集电弓
//  + 外露避震轮组；全件 addOutline 墨线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

const WINE = 0x721c24; // 深酒红（车身下半）
const CREAM = 0xfff8dc; // 奶黄（窗框带）
const WOOD = 0xcd853f; // 原木色（门窗边缘线）
const GOLD = 0xffd700; // 黄金标线
const COPPER = 0xb87352; // 铜红（探照灯）
const STEEL_GRAY = 0x8a8f94; // 避震连杆灰
const WHEEL = 0x5a1418; // 车轮暗红
const O = 0.012;

function box(w, h, d, mat, outline = O) {
  const m = new THREE.Mesh(facet(new THREE.BoxGeometry(w, h, d)), mat);
  m.castShadow = true;
  addOutline(m, outline);
  return m;
}

/** 路牌箱纹理：红底白字 CITY TOUR · 11 */
function makeRouteTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#8A1C14";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#FFF8DC";
  ctx.font = "bold 26px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CITY TOUR · 11", 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/** 车侧"11"号黑色微型牌 */
function makeNumberTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("11", 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function createChristchurchTram() {
  const g = new THREE.Group();
  g.name = "christchurch-tram-11";
  const wine = toonMat(WINE);
  const cream = toonMat(CREAM);
  const wood = toonMat(WOOD);

  // ---------- 车身三层分色（长 5.2 / 总高 ~1.37） ----------
  const lower = box(5.2, 0.5, 1.1, wine); // 下半：深酒红
  lower.position.y = 0.62;
  g.add(lower);
  const band = box(5.22, 0.43, 1.12, cream); // 中部：奶黄窗框带
  band.position.y = 1.09;
  g.add(band);
  const roof = box(5.3, 0.14, 1.16, wine); // 车顶
  roof.position.y = 1.36;
  g.add(roof);

  // 原木色门窗边缘线（窗带上下两条 + 门框）
  for (const y of [0.85, 1.32]) {
    for (const z of [-0.57, 0.57]) {
      const trim = box(5.24, 0.04, 0.03, wood, 0.006);
      trim.position.set(0, y, z);
      g.add(trim);
    }
  }
  const doorFrame = box(0.05, 0.44, 0.03, wood, 0.006); // 侧门木线
  doorFrame.position.set(0.7, 1.09, 0.57);
  g.add(doorFrame);

  // 车窗：加长车身两侧各 9 扇黑色扁窗
  for (const z of [-0.575, 0.575]) {
    for (let i = 0; i < 9; i++) {
      const win = box(0.36, 0.3, 0.03, toonMat(0x1c2430), 0.008);
      win.position.set(-2.05 + i * 0.51, 1.09, z);
      g.add(win);
    }
  }

  // 黄金标线（两侧正中极扁长条） + "11"号黑色微牌
  for (const z of [-0.565, 0.565]) {
    const stripe = box(4.3, 0.06, 0.02, toonMat(GOLD, { emissive: 0x6a5400, emissiveIntensity: 0.4 }), 0.006);
    stripe.position.set(0, 0.63, z);
    g.add(stripe);
    const num = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ map: makeNumberTexture(), transparent: true })
    );
    num.position.set(0, 0.63, z * 1.01);
    if (z < 0) num.rotation.y = Math.PI;
    g.add(num);
  }

  // ---------- 车头复古机械（车头朝 +x） ----------
  // 探照灯：横向铜红圆柱 + 淡黄自发光圆片
  const lampBody = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.12, 0.12, 0.11, 8)),
    toonMat(COPPER)
  );
  lampBody.rotation.z = Math.PI / 2;
  lampBody.position.set(2.66, 1.4, 0);
  lampBody.castShadow = true;
  addOutline(lampBody, O);
  g.add(lampBody);
  const lampFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xfffacd })
  );
  lampFace.position.set(2.72, 1.4, 0);
  lampFace.rotation.y = Math.PI / 2;
  g.add(lampFace);

  // 路牌箱（红底白字 CITY TOUR · 11，大灯下方）
  const routeBox = box(0.06, 0.2, 0.52, wine, O);
  routeBox.position.set(2.63, 1.16, 0);
  g.add(routeBox);
  const routeFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.16),
    new THREE.MeshBasicMaterial({ map: makeRouteTexture(), transparent: true })
  );
  routeFace.position.set(2.665, 1.16, 0);
  routeFace.rotation.y = Math.PI / 2;
  g.add(routeFace);

  // 黑色防撞栏（车头最底部半环排障器）
  const guard = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.42, 12, 1, 0, Math.PI),
    toonMat(0x16181c, { side: THREE.DoubleSide })
  );
  guard.position.set(2.64, 0.26, 0);
  guard.rotation.set(0, Math.PI / 2, Math.PI / 2);
  guard.castShadow = true;
  addOutline(guard, O);
  g.add(guard);

  // 拱形集电弓：双层连环白环 + 斜伸黑细柱
  for (let i = 0; i < 2; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.22 - i * 0.05, 0.018, 5, 10, Math.PI),
      toonMat(0xf5f5f0)
    );
    arc.position.set(-0.5 + i * 1.0, 1.5 + i * 0.08, 0);
    arc.rotation.x = Math.PI / 2;
    arc.castShadow = true;
    addOutline(arc, 0.008);
    g.add(arc);
  }
  const pole = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.014, 0.018, 0.55, 5)),
    toonMat(0x16181c)
  );
  pole.position.set(-0.5, 1.72, 0);
  pole.rotation.z = -0.5; // 斜向上伸
  pole.castShadow = true;
  addOutline(pole, 0.006);
  g.add(pole);

  // ---------- 外露避震轮组（两侧各 2 轮，移至长车两端） ----------
  for (const z of [-0.52, 0.52]) {
    for (const x of [-1.7, 1.7]) {
      const wheel = new THREE.Mesh(
        facet(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 8)),
        toonMat(WHEEL)
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.24, z);
      wheel.castShadow = true;
      addOutline(wheel, O);
      g.add(wheel);
    }
    // 避震连杆：横 1 斜 2 灰色细条
    const bar1 = box(3.4, 0.05, 0.04, toonMat(STEEL_GRAY), 0.005);
    bar1.position.set(0, 0.34, z * 1.06);
    g.add(bar1);
    for (const s of [-1, 1]) {
      const bar2 = box(0.55, 0.04, 0.035, toonMat(STEEL_GRAY), 0.005);
      bar2.position.set(s * 1.15, 0.42, z * 1.06);
      bar2.rotation.z = s * 0.5;
      g.add(bar2);
    }
    const spring = box(0.06, 0.22, 0.05, toonMat(STEEL_GRAY), 0.005);
    spring.position.set(0, 0.44, z * 1.06);
    g.add(spring);
  }

  // 底架
  const chassis = box(4.7, 0.12, 0.9, toonMat(0x2a2024), O);
  chassis.position.y = 0.42;
  g.add(chassis);

  g.userData.collideRadius = 2.8;
  return g;
}
