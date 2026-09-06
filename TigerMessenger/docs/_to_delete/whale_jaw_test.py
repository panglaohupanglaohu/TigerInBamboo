# -*- coding: utf-8 -*-
"""test_whale_maw ③④：从「外挂三件套」改成「以鱼眼为轴掀开眼前的模型」。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_whale_maw.mjs")
s = io.open(P, encoding="utf-8").read()

old = """  const { maw } = w.maw.parts();
  assert.ok(Math.abs(maw.jawLower.rotation.z) < 1e-6, "没开吞时嘴是合着的");

  assert.equal(w.maw.swallow(), true, "开吞应成功");
  step(w, WHALE_MAW.gapeTime * 0.9, 0.05, 500);
  assert.ok(Math.abs(maw.jawLower.rotation.z) > WHALE_MAW.gapeLower * 0.3,
    `张嘴要张得开，实测下颌 ${maw.jawLower.rotation.z.toFixed(3)} 弧度`);
  assert.equal(maw.cavity.visible, true, "张开要露出口腔，不然只是嘴唇动了动");"""
new = """  const { maw } = w.maw.parts();

  // ---- 嘴 = 把**鲸自己的模型**从眼睛切开，前段绕眼睛掀起来 ----
  // 主人 2026-09-06：「只要是原来的模型在鱼眼前部的模型以鱼眼为轴张开即可」。
  // 上一版是在吻端外挂三件套（下颌碗 + 上颚盖 + 口腔球），主人否掉了。
  assert.ok(maw.hinge, "应当有一个铰链");
  assert.ok(Math.abs(maw.hinge.position.x - 27.5) < 1e-6
    && Math.abs(maw.hinge.position.y + 9.14) < 1e-6 && maw.hinge.position.z === 0,
    `铰链必须架在**两眼连线**上（27.5, −9.14, 0），实测 ` +
    `(${maw.hinge.position.x.toFixed(2)}, ${maw.hinge.position.y.toFixed(2)}, ${maw.hinge.position.z.toFixed(2)})`);
  assert.equal(w.body.visible, false, "原来那张整壳要退场，由切开的两半接手");

  // 切得对不对：前半段的顶点必须**全部**在眼睛前面，后半段全部在眼睛后面
  {
    const chk = (mesh, off, wantFront) => {
      const p = mesh.geometry.attributes.position;
      let worst = wantFront ? Infinity : -Infinity;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + off;
        worst = wantFront ? Math.min(worst, x) : Math.max(worst, x);
      }
      return worst;
    };
    // 前半段的坐标是**铰链系**的，要加回 eyeX 才是鲸的坐标
    const frontMin = chk(maw.front, 27.5, true);
    const backMax = chk(maw.back, 0, false);
    // 按三角形质心切，跨切面的三角形整块归一边，所以允许一个三角形的富余
    assert.ok(frontMin > 27.5 - 4, `前半段应当整体在眼前，实测最靠后 ${frontMin.toFixed(1)}`);
    assert.ok(backMax < 27.5 + 4, `后半段应当整体在眼后，实测最靠前 ${backMax.toFixed(1)}`);
  }

  // 眼前的**零件**也要跟着抬（吻背结节），眼后的不许动
  assert.equal(w.tubercle.parent, maw.hinge, "眼前的吻背结节要挂进铰链——主人说的是「鱼眼前部的模型」");
  assert.equal(w.dorsal.parent, w.whale, "眼后的背鳍不许跟着抬");
  const tubercleClosed = w.tubercle.getWorldPosition(new THREE.Vector3());

  assert.ok(Math.abs(maw.hinge.rotation.z) < 1e-6, "没开吞时嘴是合着的（铰链归零）");

  assert.equal(w.maw.swallow(), true, "开吞应成功");
  step(w, WHALE_MAW.gapeTime * 0.9, 0.05, 500);
  assert.ok(maw.hinge.rotation.z > WHALE_MAW.gape * 0.3,
    `张嘴要张得开，实测铰链 ${maw.hinge.rotation.z.toFixed(3)} 弧度`);
  assert.equal(maw.throat.visible, true, "张开要露出切面（口腔），不然能一眼望穿整条鲸");
  // 吻端确实**往上**掀了（绕 +Z 转正角：+X 抬向 +Y）
  const snout = new THREE.Vector3(43 - 27.5, -7 + 9.14, 0).applyMatrix4(maw.hinge.matrixWorld);
  const snoutFlat = new THREE.Vector3(43 - 27.5, -7 + 9.14, 0)
    .applyMatrix4(new THREE.Matrix4().copy(maw.hinge.matrixWorld)
      .multiply(new THREE.Matrix4().makeRotationZ(-maw.hinge.rotation.z)));
  const upW = w.up;
  assert.ok(snout.dot(upW) - snoutFlat.dot(upW) > 3,
    "吻端要往**上**掀（绕两眼轴正转），实测抬升不足");
  // 眼前的零件跟着走了
  assert.ok(w.tubercle.getWorldPosition(new THREE.Vector3()).distanceTo(tubercleClosed) > 1,
    "眼前的零件必须跟着铰链一起动，不能留在原地");"""
assert s.count(old) == 1
s = s.replace(old, new, 1)
s = s.replace("`  ✓ ③④ 张嘴 ${maw.jawLower.rotation.z.toFixed(2)} 弧度 · 吸入 ${eatenN} 人 · 一路挣扎（${rotChanges} 帧姿态在变）`",
              "`  ✓ ③④ 以鱼眼为轴掀开 ${maw.hinge.rotation.z.toFixed(2)} 弧度（眼前零件同步）· 吸入 ${eatenN} 人 · 一路挣扎（${rotChanges} 帧姿态在变）`")
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_whale_maw.mjs（③④ 铰链）")
