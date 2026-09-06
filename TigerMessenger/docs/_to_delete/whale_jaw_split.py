# -*- coding: utf-8 -*-
"""重做鲸嘴：**用鲸自己的模型，以鱼眼为轴，把眼前那一整段掀开**。

主人 2026-09-06：「这个鲸鱼嘴不好，只要是原来的模型在鱼眼前部的模型
以鱼眼为轴张开即可」。

我上一版是在吻端外挂三件套（下颌碗 + 上颚盖 + 口腔球）。那是**另做了一张嘴**
贴在鲸头上——尺寸、颜色、轮廓都要去对，对不准就是一坨补丁。主人的做法干净得多：
不要新零件，把**已经在那儿的模型**从眼睛这条线切开，前段绕眼睛转起来就是张嘴。

具体做法：
  · 眼睛在鲸的局部坐标 (27.5, −9.14, ±13.63)，两只眼连成的那条线就是 **Z 轴**，
    铰链就架在 (27.5, −9.14, 0)；
  · 躯干是一整张放样壳，按三角形质心的 x 切成前后两半——
    前半段挂进铰链，后半段留在原地；两半都补上自己的描边壳；
  · 眼前的**所有零件**（5 对吻背结节、5 颗藤壶）一并 attach 进铰链——
    主人说的是「鱼眼前部的模型」，不是「躯干的前半段」；
  · 切口补一片暗色截面（口腔），不然张开嘴能一眼望穿整条鲸。

合上（rotation 0）时，两半严丝合缝拼回原样，零件也都在原位——
也就是说**不张嘴的时候鲸和以前一模一样**。
"""
import io, os

P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/whaleMaw.js")
s = io.open(P, encoding="utf-8").read()

# ---------------- import addOutline ----------------
old_imp = 'import { toonMat } from "../assets/toon.js";'
assert s.count(old_imp) == 1
s = s.replace(old_imp, 'import { toonMat, addOutline } from "../assets/toon.js";', 1)

# ---------------- 参数 ----------------
old_par = """  // ---- 吞吐 ----
  /** 张嘴的最大开度（弧度，下颌） */
  gapeLower: 0.78,
  gapeUpper: 0.20,"""
new_par = """  // ---- 吞吐 ----
  /**
   * 张嘴的最大开度（弧度）：**眼前那一整段绕眼睛抬起来**的角度。
   * 头从眼睛（x=27.5）到吻端（x=43）有 15.5 长，0.55 弧度（≈31°）
   * 就能把吻端掀起 8 个单位——对一条 72 长的鲸来说已经是血盆大口。
   */
  gape: 0.55,
  /** 鲸眼的局部坐标（铰链轴）。实测值，与 leviathanIsland 的 eyeRoot 一致 */
  eyeX: 27.5,
  eyeY: -9.14,"""
assert s.count(old_par) == 1
s = s.replace(old_par, new_par, 1)

# ---------------- buildMaw → buildJawSplit ----------------
a = s.index("/**\n * 造嘴：下颌 + 上颚 + 口腔。")
b = s.index("/**\n * 苔庭之鲸的战斗行为。")
new_fn = '''/**
 * 造嘴：**把鲸自己的模型从眼睛这条线切开，前段挂进铰链**。
 *
 * 主人 2026-09-06：「只要是原来的模型在鱼眼前部的模型以鱼眼为轴张开即可」。
 *
 * 上一版是在吻端外挂三件套（下颌碗 + 上颚盖 + 口腔球）——那是**另做了一张嘴**
 * 贴在鲸头上，尺寸、颜色、描边都要去对，对不准就是一坨补丁（两次截图都是）。
 * 这一版不做新零件：
 *   · 铰链架在两眼连线上（局部 (27.5, −9.14, 0)，轴 = +Z）；
 *   · 躯干那张放样壳按三角形质心的 x 切成两半，前半挂进铰链、后半留在原地，
 *     两半各自补描边壳（原来的整壳连同它的描边一起隐藏）；
 *   · 眼前的所有零件（吻背结节、藤巴）用 attach 移进铰链——保世界变换，
 *     所以合上嘴时它们一动没动；
 *   · 切口补一片暗色截面当口腔，不然张开能一眼望穿整条鲸。
 *
 * 合上（rotation.z = 0）时两半严丝合缝拼回原样：**不张嘴的时候鲸和以前一模一样**。
 *
 * @param {THREE.Object3D} whale leviathanGroup
 * @returns {{ hinge: THREE.Group, front: THREE.Mesh, back: THREE.Mesh, throat: THREE.Group }|null}
 */
function buildJawSplit(whale) {
  const body = whale.getObjectByName("leviathan-body");
  if (!body) return null;

  // 铰链轴：两眼连线。优先问鲸自己要（eyeRoot 的实际坐标），问不到才用常量兜底
  const eyes = whale.userData?.leviathanEyes || [];
  const eyeX = Number.isFinite(eyes[0]?.eyeRoot?.position?.x)
    ? eyes[0].eyeRoot.position.x : WHALE_MAW.eyeX;
  const eyeY = Number.isFinite(eyes[0]?.eyeRoot?.position?.y)
    ? eyes[0].eyeRoot.position.y : WHALE_MAW.eyeY;

  const hinge = new THREE.Group();
  hinge.name = "whale-jaw-hinge";
  hinge.position.set(eyeX, eyeY, 0);
  whale.add(hinge);

  // ---------- 1. 把躯干那张壳切成两半 ----------
  // 判据是三角形**质心**的 x，不是逐顶点：按顶点切会把跨切面的三角形撕开，
  // 留下一圈锯齿缝。按质心切，切面是一条整齐的锯齿线，两半仍然拼得回去。
  body.updateMatrix();
  const src = body.geometry;
  const pos = src.attributes.position;
  const col = src.attributes.color || null;
  const idx = src.index;
  const triN = idx ? idx.count / 3 : pos.count / 3;
  const m = body.matrix;
  const v = new THREE.Vector3();
  const fp = []; const fc = [];
  const bp = []; const bc = [];
  const tri = [0, 0, 0];
  for (let t = 0; t < triN; t++) {
    tri[0] = idx ? idx.getX(t * 3) : t * 3;
    tri[1] = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    tri[2] = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    let cx = 0;
    for (const i of tri) { v.fromBufferAttribute(pos, i).applyMatrix4(m); cx += v.x; }
    const isFront = cx / 3 > eyeX;
    for (const i of tri) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (isFront) {
        // 前半段的坐标换算到**铰链原点**，转起来才是绕眼睛转
        fp.push(v.x - eyeX, v.y - eyeY, v.z);
        if (col) fc.push(col.getX(i), col.getY(i), col.getZ(i));
      } else {
        bp.push(v.x, v.y, v.z);
        if (col) bc.push(col.getX(i), col.getY(i), col.getZ(i));
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
  const front = half(fp, fc, "whale-jaw-front");
  const back = half(bp, bc, "whale-jaw-back");
  hinge.add(front);
  whale.add(back);
  // 原来那张整壳（连同它自己的描边）退场；名字还在，外部按名取仍然找得到
  body.visible = false;

  // ---------- 2. 眼前的零件一并挂进铰链 ----------
  // 主人说的是「鱼眼前部的**模型**」，不只是躯干：吻背结节、藤壶都要跟着抬。
  // attach 保世界变换，所以合上嘴时它们一动没动。
  const keep = new Set(["whale-jaw-hinge", "whale-jaw-back", "whale-net", "whale-belly-bulge",
    "leviathan-body", "leviathan-tail-root"]);
  for (const child of [...whale.children]) {
    if (child === hinge || child === back) continue;
    if (keep.has(child.name)) continue;
    if (child.name.startsWith("leviathan-eye-root")) continue; // 眼睛是轴，不跟着转
    if (!child.isMesh && !child.isGroup && !child.isObject3D) continue;
    if (child.position.x <= eyeX) continue;
    hinge.attach(child);
  }

  // ---------- 3. 切口的暗色截面（口腔）----------
  // 不补这一片，张开嘴能一眼望穿整条鲸——放样壳是单面的，里面是空的。
  // 尺寸照 x≈28 处的实测剖面：y ∈ [−15.3, −0.3]、|z| ≤ 14.2。
  const throatMat = new THREE.MeshBasicMaterial({ color: 0x1a1014, side: THREE.DoubleSide });
  /** 一片切面圆盘：先按 (y 半高, z 半宽) 做椭圆，再把盘面法线转到 ±X */
  const disc = (host, x, y, sign) => {
    const d = new THREE.Mesh(new THREE.CircleGeometry(1, 24), throatMat);
    d.name = "whale-throat-disc";
    d.scale.set(7.5, 14.2, 1);
    d.rotation.y = sign * Math.PI / 2;
    d.position.set(x, y, 0);
    d.visible = false;
    host.add(d);
    return d;
  };
  // 两片各留在自己那一半上（切面得跟着各自的半边走），
  // throat 只是个「开关句柄」，持有它们的引用。
  const throat = {
    name: "whale-throat",
    discs: [
      disc(back, eyeX - 0.15, -7.8, 1),          // 后半段的切面（局部 = 鲸的坐标系）
      disc(hinge, -0.15, -7.8 - eyeY, -1),       // 前半段的切面（局部 = 铰链系）
    ],
    set visible(v) { for (const d of this.discs) d.visible = v; },
    get visible() { return !!this.discs[0]?.visible; },
  };

  return { hinge, front, back, throat, eyeX, eyeY };
}

'''
s = s[:a] + new_fn + s[b:]
io.open(P, "w", encoding="utf-8").write(s)
print("patched whaleMaw.js（buildJawSplit）")
