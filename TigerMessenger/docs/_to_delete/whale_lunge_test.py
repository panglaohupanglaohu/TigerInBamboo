# -*- coding: utf-8 -*-
"""test_whale_maw ③④：按参考图改成「下颌下沉 + 喉囊鼓起」的口径。

上一版验的是「眼前的模型整块绕眼睛掀起来」，连吻背结节都要跟着抬。
对着主人给的蓝鲸参考图，那是错的：**吻背不动，只有下颌沉下去**，
吻背结节长在上颚上，张嘴时必须留在原地。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_whale_maw.mjs")
s = io.open(P, encoding="utf-8").read()

a = s.index("  const { maw } = w.maw.parts();")
b = s.index("  // 进入吸入段：记录距离与「挣扎痕迹」")
new = '''  const { maw } = w.maw.parts();

  // ---- 嘴 = 沿**口裂线**把下颌切出来，绕眼轴往下沉，喉囊鼓成一个大兜 ----
  // 主人 2026-09-06 给了蓝鲸吞噬式摄食（lunge feeding）的参考图。图里：
  // 上颚（吻背）基本不动、下颌整个往下沉、喉囊鼓成布满纵向条纹的大口袋。
  // 我上一版拿**竖直平面**在眼睛处切，把吻背连同下颌一起往上掀了——那是错的。
  assert.ok(maw.hinge, "应当有一个铰链（= 颌关节）");
  assert.ok(Math.abs(maw.hinge.position.x - 27.5) < 1e-6
    && Math.abs(maw.hinge.position.y + 9.14) < 1e-6 && maw.hinge.position.z === 0,
    "铰链必须架在**两眼连线**上——须鲸的眼睛就长在嘴角，那正是颌关节");
  assert.equal(w.body.visible, false, "原来那张整壳要退场，由切开的两块接手");

  // 切得对不对：下颌的顶点必须**全部在口裂线以下**（而不只是「在眼前」）
  {
    const slope = 0.10; // WHALE_MAW.mouthSlope
    const p = maw.front.geometry.attributes.position;
    let worst = -Infinity;
    let minX = Infinity;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);            // 铰链系：x=0 就是眼睛
      const y = p.getY(i);
      worst = Math.max(worst, y - slope * x);
      minX = Math.min(minX, x);
    }
    // 按三角形质心切，跨切面的三角形整块归一边，允许一个环距的富余
    assert.ok(worst < 6,
      `下颌的顶点应当整体压在口裂线以下，实测最高越线 ${worst.toFixed(1)}——` +
      "越得多就说明吻背被切进了下颌（上一版就是这么错的）");
    assert.ok(minX > -6, `下颌不该长到嘴角后面去，实测最靠后 ${minX.toFixed(1)}`);
  }

  // 吻背上的零件（结节）在口裂线**以上**，张嘴时必须留在原地
  assert.equal(w.tubercle.parent, w.whale,
    "吻背结节长在**上颚**上——参考图里张嘴时吻背纹丝不动，它不该跟着下巴走");
  assert.equal(w.dorsal.parent, w.whale, "背鳍更不许动");

  assert.ok(Math.abs(maw.hinge.rotation.z) < 1e-6, "没开吞时下颌是合着的");
  assert.ok(Math.abs(maw.hinge.scale.y - 1) < 1e-6, "没开吞时喉囊不该鼓着");

  assert.equal(w.maw.swallow(), true, "开吞应成功");
  step(w, WHALE_MAW.gapeTime * 0.9, 0.05, 500);

  // ① 下颌**往下**沉（负角），不是往上掀
  assert.ok(maw.hinge.rotation.z < -WHALE_MAW.gape * 0.3,
    `下颌要往**下**沉，实测铰链 ${maw.hinge.rotation.z.toFixed(3)} 弧度——` +
    "正角是把下巴往上翻，那不是张嘴");
  // 下颌前端确实掉到了嘴角下方
  {
    const tip = new THREE.Vector3(maw.jawTipX - 27.5, 0, 0).applyMatrix4(maw.hinge.matrixWorld);
    const pivot = new THREE.Vector3(0, 0, 0).applyMatrix4(maw.hinge.matrixWorld);
    assert.ok(tip.clone().sub(pivot).dot(w.up) < -3,
      "下颌前端要明显低于嘴角——张开的嘴是往下豁开的");
  }
  // ② 喉囊鼓起来
  assert.ok(maw.hinge.scale.y > 1 + WHALE_MAW.pouchY * 0.3
    && maw.hinge.scale.z > 1 + WHALE_MAW.pouchZ * 0.3,
    `喉囊要鼓（纵 ${maw.hinge.scale.y.toFixed(2)} / 横 ${maw.hinge.scale.z.toFixed(2)}）——` +
    "参考图里那个占半张画面的大兜就是这么来的");
  // ③ 口内该看得见的东西
  assert.equal(maw.throat.visible, true, "张开要露出上腭，不然能一眼望穿整条鲸");
  assert.ok(maw.baleen.material.opacity > 0.2, "上腭内侧要挂出鲸须");
  assert.ok(maw.pleats.material.opacity > 0.2, "喉囊表面要显出纵向喉腹褶");
  assert.ok(maw.baleen.isLineSegments && maw.pleats.isLineSegments,
    "鲸须和喉腹褶都用 LineSegments，各一个 draw call");

'''
s = s[:a] + new + s[b:]
s = s.replace(
  "`  ✓ ③④ 以鱼眼为轴掀开 ${maw.hinge.rotation.z.toFixed(2)} 弧度（眼前零件同步）· 吸入 ${eatenN} 人 · 一路挣扎（${rotChanges} 帧姿态在变）`",
  "`  ✓ ③④ 下颌下沉 ${maw.hinge.rotation.z.toFixed(2)} 弧度 · 喉囊鼓 ${maw.hinge.scale.y.toFixed(2)}× · 鲸须/喉腹褶就位 · 吸入 ${eatenN} 人一路挣扎（${rotChanges} 帧姿态在变）`")
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_whale_maw.mjs（③④ 下颌下沉 + 喉囊）")
