// =====================================================================
//  复古双配色有轨电车（高精版 · 加长压扁）
//  红车：基督城酒红；蓝车：海岸蓝。共用同一结构与可搭乘坐标。
//  驾驶室双窗 + 侧门 + 路牌/车号 + 双菱形集电弓 + 双转向架；全件墨线。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

const COPPER = 0xb87352; // 铜红（探照灯）
const STEEL_GRAY = 0x8a8f94; // 避震连杆灰
const O = 0.012;

export const TRAM_PALETTES = Object.freeze({
  red: Object.freeze({
    body: 0x721c24,
    roof: 0x54171d,
    cream: 0xfff8dc,
    trim: 0xcd853f,
    accent: 0xffd700,
    wheel: 0x5a1418,
    glass: 0x172838,
    sign: "#8A1C14",
  }),
  blue: Object.freeze({
    body: 0x2d6f91,
    roof: 0x174c6b,
    cream: 0xf4edda,
    trim: 0xd7b98b,
    accent: 0xf1c75b,
    wheel: 0x263d50,
    glass: 0x173b56,
    sign: "#245F80",
  }),
});

function box(w, h, d, mat, outline = O) {
  const m = new THREE.Mesh(facet(new THREE.BoxGeometry(w, h, d)), mat);
  m.castShadow = true;
  addOutline(m, outline);
  return m;
}

/** 路牌箱纹理：随车辆配色显示线路与方向。 */
function makeRouteTexture({ sign, routeNumber, destination }) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = sign;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#FFF8DC";
  ctx.font = "bold 26px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${destination} · ${routeNumber}`, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/** 车侧线路号微型牌。 */
function makeNumberTexture(routeNumber, accent) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = `#${new THREE.Color(accent).getHexString()}`;
  ctx.font = "bold 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(routeNumber, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function rodBetween(a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const rod = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(radius, radius, dir.length(), 6)),
    material
  );
  rod.position.copy(a).add(b).multiplyScalar(0.5);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  rod.castShadow = true;
  addOutline(rod, 0.005);
  return rod;
}

function addPantograph(group, centerX, material) {
  const y0 = 1.46;
  const y1 = 1.88;
  const leftBase = new THREE.Vector3(centerX - 0.25, y0, 0);
  const rightBase = new THREE.Vector3(centerX + 0.25, y0, 0);
  const leftTop = new THREE.Vector3(centerX - 0.18, y1, 0);
  const rightTop = new THREE.Vector3(centerX + 0.18, y1, 0);
  group.add(
    rodBetween(leftBase, rightTop, 0.014, material),
    rodBetween(rightBase, leftTop, 0.014, material),
    rodBetween(leftTop, rightTop, 0.018, material)
  );
  const shoe = box(0.58, 0.025, 0.04, material, 0.005);
  shoe.position.set(centerX, y1 + 0.015, 0);
  group.add(shoe);
}

export function createChristchurchTram({
  variant = "red",
  routeNumber = variant === "blue" ? "12" : "11",
  destination = variant === "blue" ? "COAST LINE" : "CITY TOUR",
} = {}) {
  const g = new THREE.Group();
  const palette = TRAM_PALETTES[variant] || TRAM_PALETTES.red;
  g.name = `heritage-tram-${variant}-${routeNumber}`;
  const bodyMat = toonMat(palette.body);
  const roofMat = toonMat(palette.roof);
  const cream = toonMat(palette.cream);
  const trimMat = toonMat(palette.trim);
  const glassMat = toonMat(palette.glass, { emissive: palette.glass, emissiveIntensity: 0.12 });

  // ---------- 车身三层分色（长 5.2 / 总高 ~1.37） ----------
  const lower = box(5.2, 0.5, 1.1, bodyMat); // 下半：主配色
  lower.position.y = 0.62;
  g.add(lower);
  const band = box(5.22, 0.43, 1.12, cream); // 中部：奶黄窗框带
  band.position.y = 1.09;
  g.add(band);
  const roof = box(5.3, 0.14, 1.16, roofMat); // 车顶
  roof.position.y = 1.36;
  g.add(roof);

  // 原木色门窗边缘线（窗带上下两条 + 门框）
  for (const y of [0.85, 1.32]) {
    for (const z of [-0.57, 0.57]) {
      const trim = box(5.24, 0.04, 0.03, trimMat, 0.006);
      trim.position.set(0, y, z);
      g.add(trim);
    }
  }
  // 两侧滑门：实体门板、观察窗、竖向门框。
  for (const z of [-0.582, 0.582]) {
    const door = box(0.46, 0.72, 0.035, bodyMat, 0.008);
    door.position.set(0.68, 0.96, z);
    g.add(door);
    const doorWindow = box(0.3, 0.3, 0.018, glassMat, 0.006);
    doorWindow.position.set(0.68, 1.16, z * 1.012);
    g.add(doorWindow);
    for (const dx of [-0.25, 0.25]) {
      const frame = box(0.035, 0.76, 0.025, trimMat, 0.005);
      frame.position.set(0.68 + dx, 0.96, z * 1.014);
      g.add(frame);
    }
  }

  // 车窗：加长车身两侧各 9 扇黑色扁窗
  for (const z of [-0.575, 0.575]) {
    for (let i = 0; i < 9; i++) {
      if (i === 5) continue; // 给侧门留一格
      const win = box(0.36, 0.3, 0.03, glassMat, 0.008);
      win.position.set(-2.05 + i * 0.51, 1.09, z);
      g.add(win);
    }
  }

  // 黄金标线（两侧正中极扁长条） + "11"号黑色微牌
  for (const z of [-0.565, 0.565]) {
    const stripe = box(4.3, 0.06, 0.02, toonMat(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.18 }), 0.006);
    stripe.position.set(0, 0.63, z);
    g.add(stripe);
    const num = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ map: makeNumberTexture(routeNumber, palette.accent), transparent: true })
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
  lampBody.position.set(2.66, 1.52, 0);
  lampBody.castShadow = true;
  addOutline(lampBody, O);
  g.add(lampBody);
  const lampFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xfffacd })
  );
  lampFace.position.set(2.72, 1.52, 0);
  lampFace.rotation.y = Math.PI / 2;
  g.add(lampFace);

  // 路牌箱（红底白字 CITY TOUR · 11，大灯下方）
  const routeBox = box(0.06, 0.2, 0.52, bodyMat, O);
  routeBox.position.set(2.63, 1.28, 0);
  g.add(routeBox);
  const routeFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.16),
    new THREE.MeshBasicMaterial({
      map: makeRouteTexture({ ...palette, routeNumber, destination }),
      transparent: true,
    })
  );
  routeFace.position.set(2.665, 1.28, 0);
  routeFace.rotation.y = Math.PI / 2;
  g.add(routeFace);

  // 驾驶室正面：左右双窗、中央立柱与角灯，轮廓更接近参考图。
  for (const end of [-1, 1]) {
    for (const z of [-0.27, 0.27]) {
      const cabWindow = box(0.025, 0.34, 0.4, glassMat, 0.007);
      cabWindow.position.set(end * 2.615, 1.08, z);
      g.add(cabWindow);
    }
    const centerPost = box(0.035, 0.42, 0.04, trimMat, 0.005);
    centerPost.position.set(end * 2.635, 1.08, 0);
    g.add(centerPost);
    const bumper = box(0.16, 0.08, 1.0, toonMat(0x24282d), 0.007);
    bumper.position.set(end * 2.68, 0.31, 0);
    g.add(bumper);
    for (const z of [-0.34, 0.34]) {
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(0.045, 10),
        new THREE.MeshBasicMaterial({ color: end > 0 ? 0xffe7a0 : 0xd94d4d })
      );
      marker.position.set(end * 2.704, 0.63, z);
      marker.rotation.y = end > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(marker);
    }
  }

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

  // 参考图式双菱形集电弓 + 屋顶电气箱。
  const pantographMat = toonMat(0x20262c);
  addPantograph(g, -0.95, pantographMat);
  addPantograph(g, 0.95, pantographMat);
  for (const x of [-0.95, 0.95]) {
    const equipment = box(0.7, 0.09, 0.48, toonMat(0x454c53), 0.006);
    equipment.position.set(x, 1.49, 0);
    g.add(equipment);
  }

  // ---------- 外露避震轮组（两侧各 2 轮，移至长车两端） ----------
  for (const z of [-0.52, 0.52]) {
    for (const x of [-1.7, 1.7]) {
      const wheel = new THREE.Mesh(
        facet(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 8)),
        toonMat(palette.wheel)
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
  g.userData.variant = variant;
  g.userData.routeNumber = routeNumber;
  g.userData.destination = destination;
  return g;
}
