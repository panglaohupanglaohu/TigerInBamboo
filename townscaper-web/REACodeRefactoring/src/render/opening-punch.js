/** 1205422438437273601: "For doors and windows, I use some stencil buffer shenanigans to
 * punch holes in the zbuffer." — 用模板缓冲在墙体上开口，而不是用 CSG 或贴片假窗。
 *
 * 本模块给出两条路线的可对照实现：
 *   decal —— 本仓现状：墙是一整面，门窗是贴在墙面外 6mm 的四边形（画上去的玻璃）
 *   punch —— 原作做法：先把门窗洞口写进 stencil，墙用 stencil NotEqual 拒绘，
 *            于是洞口区域的墙片不落色也不写深度，背后的室内几何直接透出来
 *
 * 纯几何/数学部分（planFacade / holePixelStats / isInsideOpening）不依赖 three，
 * 可以在 node 里直接测；渲染部分通过传入 THREE 构造，便于页面与测试共用。
 */

export const PUNCH_REF = 1;
const EPS = 1e-9;

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** 校验并规范化立面 + 洞口清单。洞口按世界单位给出，坐标原点在立面中心，+y 向上。 */
export function planFacade({ width, height, openings } = {}) {
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) throw new RangeError('Invalid facade size');
  if (!Array.isArray(openings) || !openings.length) throw new TypeError('Facade needs at least one opening');
  const hw = width / 2, hh = height / 2;
  const list = openings.map((o, i) => {
    const { u, v, w, h, door = false, rise = 0 } = o ?? {};
    if (![u, v, w, h, rise].every(finite)) throw new TypeError('Invalid opening ' + i);
    if (w <= 0 || h <= 0) throw new RangeError('Opening ' + i + ' has non-positive size');
    // rise = 拱顶高度（半椭圆短半轴）。0 表示矩形洞口，是拱门/高拱龛的特例。
    if (rise < 0 || rise >= h) throw new RangeError('Opening ' + i + ' has invalid rise');
    if (Math.abs(u) + w / 2 > hw + EPS || Math.abs(v) + h / 2 > hh + EPS) throw new RangeError('Opening ' + i + ' outside facade');
    return { u, v, w, h, rise, door: !!door };
  });
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const ox = Math.abs(a.u - b.u) < (a.w + b.w) / 2 - EPS;
      const oy = Math.abs(a.v - b.v) < (a.h + b.h) / 2 - EPS;
      if (ox && oy) throw new RangeError('Openings overlap: ' + i + ',' + j);
    }
  }
  // 面积占比用解析式算，测试拿它当断言基准（不做栅格化，避免采样偏差掩盖错误）
  const holeArea = list.reduce((s, o) => s + openingArea(o), 0);
  const area = width * height;
  return { width, height, openings: list, area, holeArea, coverage: holeArea / area, doorCount: list.filter((o) => o.door).length, archCount: list.filter((o) => o.rise > 0).length };
}

/** 洞口解析面积：矩形部分 + 半椭圆拱顶（rise=0 时退化为纯矩形）。 */
export function openingArea({ w, h, rise = 0 }) {
  if (![w, h, rise].every(finite) || w <= 0 || h <= 0 || rise < 0 || rise >= h) throw new RangeError('Invalid opening for area');
  return w * (h - rise) + (Math.PI * w * rise) / 4;
}

/** 点是否落在某个洞口内（含边界）。pad>0 时把洞口整体外扩（矩形向外扩，拱顶按半轴外扩）。 */
export function isInsideOpening(plan, u, v, pad = 0) {
  return plan.openings.some((o) => {
    const du = u - o.u, dv = v - o.v;
    if (Math.abs(du) > o.w / 2 + pad) return false;
    const rise = o.rise ?? 0;
    if (rise <= 0) return Math.abs(dv) <= o.h / 2 + pad;
    // 弹簧线（拱脚）以下按矩形，以上按半椭圆
    const spring = o.h / 2 - rise;
    if (dv <= spring + pad) return dv >= -o.h / 2 - pad;
    const a = o.w / 2 + pad, b = rise + pad;
    return ((du / a) ** 2 + ((dv - spring) / b) ** 2) <= 1 + EPS;
  });
}

/** 解析像素账：整幅栅格下，洞口像素 / 墙面像素各多少（用于和 GPU 读回对比）。拱顶按半椭圆面积计。 */
export function holePixelStats(plan, pixels) {
  if (!Number.isInteger(pixels) || pixels < 8) throw new RangeError('Invalid pixel size');
  const sx = pixels / plan.width, sy = pixels / plan.height;
  const holes = plan.openings.map((o) => ({ w: o.w * sx, h: o.h * sy, rise: (o.rise ?? 0) * sy, cx: (o.u + plan.width / 2) * sx, cy: (plan.height / 2 - o.v) * sy }));
  const holePixels = plan.openings.reduce((s, o) => s + openingArea(o) * sx * sy, 0);
  return { pixels, sx, sy, holes, holePixels, wallPixels: pixels * pixels - holePixels };
}

/** 纯逻辑侧的四条绘制通道与顺序（punch 依赖这个顺序：先室内，再洞口模板，最后墙体拒绘）。 */
export function passOrder() {
  return ['interior', 'mask', 'wall', 'decal'];
}

/** 构造可渲染的立面场景。THREE 从外部注入，node 侧只需 planFacade 即可测试。 */
export function createFacadeScene(THREE, plan, {
  wallColor = 0xd8426b, interiorColor = 0x93a9ba, floorColor = 0x3d5566, glassColor = 0x18303e,
  propColor = 0xf2c14e, maskOffset = 0.002, decalOffset = 0.006, roomDepth = 0.9,
} = {}) {
  if (!THREE?.WebGLRenderer) throw new TypeError('createFacadeScene needs THREE');
  const { width, height } = plan;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.05, 10);
  camera.position.set(0, 0, 3);

  const wallPlain = new THREE.MeshBasicMaterial({ color: wallColor });
  // 洞口区域被模板拒绝：stencil != PUNCH_REF 才画
  const wallPunch = new THREE.MeshBasicMaterial({
    color: wallColor,
    stencilWrite: true, stencilRef: PUNCH_REF, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
  });
  // 只写模板不落色、不写深度
  const maskMat = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilRef: PUNCH_REF, stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  const decalMat = new THREE.MeshBasicMaterial({ color: glassColor });

  const interior = new THREE.Group();
  interior.name = 'interior';
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.98, height * 0.96, roomDepth),
    new THREE.MeshBasicMaterial({ color: interiorColor, side: THREE.BackSide }),
  );
  room.position.z = -roomDepth / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, roomDepth * 0.9), new THREE.MeshBasicMaterial({ color: floorColor }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -height * 0.46 + 0.02, -roomDepth * 0.45);
  // 室内放一个球当"看得见的东西"：透过洞口能数出它的位置，才叫真透空
  const prop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshBasicMaterial({ color: propColor }));
  prop.position.set(0.5, -0.16, -roomDepth * 0.55);
  interior.add(room, floor, prop);

  const mask = new THREE.Group();
  mask.name = 'mask';
  const decal = new THREE.Group();
  decal.name = 'decal';
  // rise>0 的洞口（拱门 / 跨两层的高拱龛）用轮廓形状挡模板，否则沿用矩形片
  const shapeFor = (o, k = 1) => {
    const w = o.w * k, h = o.h * k, rise = (o.rise ?? 0) * k, hw = w / 2, hh = h / 2, spring = hh - rise;
    const s = new THREE.Shape();
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, spring);
    if (rise > 0) s.absellipse(0, spring, hw, rise, 0, Math.PI, false);
    s.lineTo(-hw, -hh);
    return s;
  };
  const plateGeo = (o, k = 1) => ((o.rise ?? 0) > 0 ? new THREE.ShapeGeometry(shapeFor(o, k), 24) : new THREE.PlaneGeometry(o.w * k, o.h * k));
  for (const o of plan.openings) {
    const quad = new THREE.Mesh(plateGeo(o), maskMat);
    quad.position.set(o.u, o.v, maskOffset);
    quad.renderOrder = 1;
    mask.add(quad);
    const pane = new THREE.Mesh(plateGeo(o, 0.94), decalMat);
    pane.position.set(o.u, o.v, decalOffset);
    pane.renderOrder = 3;
    decal.add(pane);
  }

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallPlain);
  wall.position.z = 0;
  wall.renderOrder = 2;

  interior.renderOrder = 0;
  scene.add(interior, mask, wall, decal);

  const setMode = (mode) => {
    if (!['decal', 'punch', 'wallsOff'].includes(mode)) throw new RangeError('Unknown mode ' + mode);
    interior.visible = mode !== 'wallsOff' ? true : true;
    mask.visible = mode === 'punch';
    wall.visible = mode !== 'wallsOff';
    wall.material = mode === 'punch' ? wallPunch : wallPlain;
    decal.visible = mode === 'decal';
    scene.userData.mode = mode;
    return mode;
  };
  setMode('punch');

  return { scene, camera, interior, mask, wall, decal, wallPlain, wallPunch, maskMat, decalMat, setMode, plan };
}
