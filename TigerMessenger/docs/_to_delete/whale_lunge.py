# -*- coding: utf-8 -*-
"""按主人给的须鲸张嘴参考图重做：**下颌下沉 + 喉囊鼓成一个大兜**。

主人 2026-09-06 发来一张蓝鲸吞噬式摄食（lunge feeding）的图。对着图看，
我上一版错在一个很具体的地方：**我把整个头（吻背连同下颌）一起往上掀了**。
参考图里根本不是这样——

  · **上颚（吻背）基本不动**，还是那条顺着背脊的直线；
  · **下颌整个往下沉**，张到快 90°；
  · 真正的主角是**喉囊**：下颌一沉，喉腹褶撑开，鼓成一个巨大的、
    布满纵向条纹的口袋——图里那个占了半张画面的圆囊；
  · 张开的上颚内侧挂着一排**鲸须**。

铰链的位置主人说对了：须鲸的**眼睛就长在嘴角**，所以「以鱼眼为轴」正是解剖学
上的那个颌关节。要改的不是轴，是**切法**——不能拿一个竖直平面在眼睛处切，
要沿**口裂线**切：眼角往吻端拉一条微微上扬的线，线**以下、且在眼前**的那一块
才是下颌，其余（吻背、躯干）全留在原地。

所以：
  · 分类判据从 `x > eyeX` 改成 `x > eyeX && y < 口裂线`；
  · 下颌绕眼轴**往下**转（负角），同时**纵向/横向放大**——那就是喉囊鼓起来；
  · 补一片暗色的**上腭**（口裂线那个面）和一排**鲸须**；
  · 喉囊表面加一组纵向**喉腹褶**线条（LineSegments，一个 draw call）。

吻背结节和藤壶都在口裂线**以上**，按新判据自动留在原地——正合参考图：
那些东西长在上颚上，张嘴时不该跟着下巴走。
"""
import io, os

P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/whaleMaw.js")
s = io.open(P, encoding="utf-8").read()

# ---------------- 参数 ----------------
old_par = """  /**
   * 张嘴的最大开度（弧度）：**眼前那一整段绕眼睛抬起来**的角度。
   * 头从眼睛（x=27.5）到吻端（x=43）有 15.5 长，0.8 弧度（≈46°）
   * 把吻端掀起 11 个单位——一条 72 长的鲸张这么大，才吞得下人。
   */
  gape: 0.8,"""
new_par = """  /**
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
  pouchZ: 0.55,"""
assert s.count(old_par) == 1
s = s.replace(old_par, new_par, 1)

# ---------------- buildJawSplit 全量重写 ----------------
a = s.index("/**\n * 造嘴：**把鲸自己的模型从眼睛这条线切开，前段挂进铰链**。")
b = s.index("/**\n * 苔庭之鲸的战斗行为。")
new_fn = '''/**
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

'''
s = s[:a] + new_fn + s[b:]

# ---------------- openTo：下沉 + 鼓胀 ----------------
old_open = """    const openTo = (k) => {
      if (!maw) return;
      maw.hinge.rotation.z = WHALE_MAW.gape * k;
      maw.throat.visible = k > 0.04; // 切面（口腔）只在张开时露出来
    };"""
new_open = """    /**
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
    };"""
assert s.count(old_open) == 1
s = s.replace(old_open, new_open, 1)

io.open(P, "w", encoding="utf-8").write(s)
print("patched whaleMaw.js（下颌下沉 + 喉囊 + 鲸须）")
