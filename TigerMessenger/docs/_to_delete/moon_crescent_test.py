# -*- coding: utf-8 -*-
"""test_moon_orb：从「球」改成「月牙」之后的断言（主人 2026-09-06：
「那个月亮是个月牙的模型」）。

⑤ 换成两条真正管用的：
  · **它确实是个月牙**——本体的每一个顶点都同时满足「在外圆内」和
    「在被切掉的内圆外」。这一条比看截图可靠：第一版按湖面那套写成
    Shape+hole，洞捅出了外圆，Earcut 直接崩出一道横贯月面的碎三角，
    而那种碎片是**顶点跑进内圆里**，这条断言当场就能抓住。
  · **月海在月牙的实体上**——五块暗斑连边缘都不许越出月牙，
    否则会飘在缺口的空气里。
⑨ 新增：月牙是片状的，必须转过来对着人。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_moon_orb.mjs")
s = io.open(P, encoding="utf-8").read()

old = s[s.index("// ---- ⑤ 月海"):s.index("// ---- ⑥ 昼夜")]
new = '''// ---- ⑤ 它确实是个月牙（不是圆环、不是碎片）----
{
  // 月牙 = 外圆内 ∩ 内圆外。把这两条直接套在**每一个顶点**上，
  // 是比看截图可靠得多的判据：
  //  · 第一版按湖面那套写成 Shape + hole，而月牙要求那个洞**捅出外圆**，
  //    Earcut 于是崩出一道横贯月面的碎三角——碎片的顶点会落进内圆里，
  //    这条断言当场抓住；
  //  · 洞要是没捅出去，切出来的是个「缺一小口的圆环」，
  //    下面「最厚处 / 缺口宽度」那两条会把它挡下来。
  const R = MOON_ORB.radius;
  const r = R * MOON_ORB.holeRatio;
  const d = R * MOON_ORB.holeOffset;
  const pos = orb.body.geometry.attributes.position;
  let worstOuter = 0;
  let worstInner = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    worstOuter = Math.max(worstOuter, Math.hypot(x, y));
    worstInner = Math.min(worstInner, Math.hypot(x - d, y));
  }
  assert.ok(worstOuter <= R + 1e-3,
    `月牙不许长到外圆之外，实测最远顶点 ${worstOuter.toFixed(4)}（外圆 ${R}）`);
  assert.ok(worstInner >= r - 1e-3,
    `月牙里不许有顶点掉进被切掉的内圆，实测最深 ${worstInner.toFixed(4)}（内圆 ${r}）——` +
    "掉进去就说明三角剖分崩了（Shape+hole 那版就是这么崩的）");

  // 缺口必须真的**捅出去**：内圆最远端要越过外圆，否则切出来是个圆环
  assert.ok(r + d > R + 1e-6,
    `内圆必须捅出外圆（r + d = ${(r + d).toFixed(3)} > R = ${R}），` +
    "不然是个缺一小口的圆环，不是月牙");
  // 最厚处：等半径时就是偏移量本身。太薄看不见，太厚又成了半圆
  const thick = R - (r - d);
  assert.ok(thick > R * 0.25 && thick < R * 0.62,
    `月牙最厚处应在外圆半径的 0.25~0.62 之间，实测 ${(thick / R).toFixed(2)}`);
  console.log(`  ✓ ⑤ 月牙：顶点全在外圆内(${worstOuter.toFixed(2)}≤${R})、内圆外(${worstInner.toFixed(2)}≥${r})· 最厚 ${(thick / R).toFixed(2)}R`);
}

// ---- ⑤b 月海落在月牙的实体上 ----
{
  const R = MOON_ORB.radius;
  const r = R * MOON_ORB.holeRatio;
  const d = R * MOON_ORB.holeOffset;
  const patches = orb.maria.children;
  assert.ok(patches.length >= 4, `月海应有 4 块以上，实得 ${patches.length}`);
  for (const p of patches) {
    // 圆盘半径从几何里取，别信参数表——参数改了这里要跟着响
    p.geometry.computeBoundingSphere();
    const cr = p.geometry.boundingSphere.radius;
    const x = p.position.x;
    const y = p.position.y;
    assert.ok(Math.hypot(x, y) + cr <= R,
      `月海连边缘都要在外圆内：中心 (${x.toFixed(2)}, ${y.toFixed(2)}) 半径 ${cr.toFixed(2)}`);
    assert.ok(Math.hypot(x - d, y) - cr >= r,
      `月海不许探进缺口里（那儿是空气）：中心 (${x.toFixed(2)}, ${y.toFixed(2)}) 半径 ${cr.toFixed(2)}`);
  }
  console.log(`  ✓ ⑤b 月海 ${patches.length} 块 · 整块都压在月牙的实体上`);
}

'''
s = s.replace(old, new, 1)

# ---- ⑨ 偏航跟随 ----
anchor = 'console.log("✅ test_moon_orb'
block = '''// ---- ⑨ 月牙是片状的：必须转过来对着人 ----
{
  // 真实的月亮在无穷远处，本来就永远正对观察者——所以这个跟随是「对」的，
  // 不是取巧。少了它，绕湖走到侧面时月牙会薄成一条线。
  const gx = MOON_ORB.dirX * MOON_ORB.offset;
  const gz = MOON_ORB.dirZ * MOON_ORB.offset;
  const settle = (vx, vz) => {
    // 转速有上限（yawRate），要喂够帧才转得到位
    for (let i = 0; i < 400; i++) orb.update(20 + i * 0.05, 0.05, new THREE.Vector3(vx, 1.7, vz));
    return orb.face.rotation.y;
  };
  for (const [vx, vz] of [[0, 4.4], [4.4, 0], [-3, -3.2]]) {
    const yaw = settle(vx, vz);
    // 月牙脸的局部 +Z 转到世界后应当指向观察者
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const wx = vx - gx;
    const wz = vz - gz;
    const n = Math.hypot(wx, wz);
    const dot = (fx * wx + fz * wz) / n;
    assert.ok(dot > 0.999,
      `月牙必须正面朝向观察者（观察者 ${vx},${vz}），实测点积 ${dot.toFixed(4)}`);
  }
  // 只转偏航，不许翻滚：月亮不该躺下来
  assert.equal(orb.face.rotation.x, 0, "月牙不许俯仰");
  assert.equal(orb.face.rotation.z, 0, "月牙不许翻滚——倾角是在脸**内部**给的（body.rotation.z）");
  assert.ok(Math.abs(orb.body.rotation.z - MOON_ORB.tilt) < 1e-9,
    "两只角的斜度由 MOON_ORB.tilt 定，跟随转动时不该跟着变");
  console.log("  ✓ ⑨ 偏航跟随：走到哪一侧，月牙就转过来正对哪一侧（不俯仰、不翻滚）");
}

'''
assert anchor in s
s = s.replace(anchor, block + anchor, 1)
s = s.replace("✅ test_moon_orb（月亮湖的月亮：和湖同宽 · 对岸看 30° · 走不进去 · 确定性 · 月海贴面 · 昼夜 · 月光路朝人）",
              "✅ test_moon_orb（月亮湖的月牙：和湖同宽 · 对岸看 30° · 走不进去 · 确定性 · 真月牙 · 昼夜 · 月光路朝人 · 正面朝人）")
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_moon_orb.mjs（⑤ 月牙 / ⑤b 月海 / ⑨ 偏航跟随）")
