# -*- coding: utf-8 -*-
"""压缩定稿：原地搬 + 只收 count/drawRange，缓冲区一个字节都不重开。

v2 用「换一个新的 attribute 实例」绕开 three 的尺寸校验，能跑，但每次编辑都会
把旧实例连同它的 GPU buffer 甩成孤儿——three 只在 geometry.dispose() 时释放
buffer，而这块几何还活着，所以旧 buffer 只能等浏览器 GC WebGLBuffer 包装对象。
一次编辑几 MB，连续编辑一小时就是几百 MB 显存漂在那里——主人报的「老是崩溃」
正是这种攒法。

定稿改回原地：同一个 attribute、同一条 array，只把要留的三角形往前搬，然后收
count 与 drawRange。byteLength 从头到尾不变 → three 的校验永远通过 → 不抛异常、
不换 buffer、不分配内存。代价只有一条：数组尾部留着上一版的残数据，所以所有
下游消费者都必须按 count 读，不能按 array.length 读（geometryMerge 就踩了这条）。
"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

# ------------------------------------------------ ① mergedCellPatch：改回原地
p = R + "TigerMessenger/src/world/citadel/mergedCellPatch.js"
s = io.open(p, encoding="utf-8").read()
start = s.index("  // ⚠️ 绝不能保留同一个 attribute 实例")
end = s.index("  // 保留段重编号")
s = s[:start] + """  // 压缩必须**原地**做：同一个 attribute、同一条 array，只收 count。
  //
  // 两条互相拉扯的约束，缺一条就出事：
  //
  // (1) 不许换 array（保留同一实例、换更短的数组）。three 的 WebGLAttributes
  //     用 WeakMap 按 attribute 实例记住 GPU buffer，并存下首次上传时的
  //     array.byteLength；此后每次 needsUpdate 都校验
  //     `data.size !== attribute.array.byteLength`，换短数组这条永远不相等，
  //     于是**每一帧 render 都 throw**。异常抛在 projectObject 里 = render
  //     半途中断：音频线程照跑（有声音），画面停在最后一帧、编辑器点不动。
  //     主人 2026-09-05：「系统播放声音，但是无法继续编辑，画面不动了」。
  //
  // (2) 也不许换 attribute 实例（那样能绕开校验，three 会给新实例建新 buffer）。
  //     旧实例连同它的 GPU buffer 会变成孤儿——three 只在 geometry.dispose()
  //     时释放 buffer，而这块几何还活着。一次编辑几 MB，连续编辑攒到几百 MB
  //     显存，就是主人说的「老是崩溃」。
  //
  // 同时满足两条的写法只有一个：缓冲区原封不动，只把要留的三角形往前搬，
  // 然后收 count 与 drawRange。byteLength 全程不变 → 校验通过；实例不变 →
  // 不产生孤儿 buffer；不分配 → 增量编辑这条热路径上零 GC 压力。
  //
  // 代价是数组尾部留着上一版的残数据。**所有下游都必须按 count 读几何，
  // 不能按 array.length 读**——geometryMerge.mergeGroup 就踩过这条（批量 set
  // 时按整条 array 长度算偏移，直接 RangeError: offset is out of bounds）。
  //
  // 前向压缩天然安全：head <= from 恒成立；且 TypedArray.prototype.set 对同
  // buffer 的重叠拷贝有规范定义（等价于先克隆源）。
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const size = attr.itemSize;
    let head = 0;
    for (const [a, b] of keep) {
      const from = a * 3 * size;
      const to = b * 3 * size;
      if (head !== from) attr.array.set(attr.array.subarray(from, to), head);
      head += to - from;
    }
    attr.count = keptTris * 3;
    attr.needsUpdate = true;
  }

""" + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("patched mergedCellPatch.js（改回原地）")

# ------------------------------------------------ ② geometryMerge：按 count 读
p = R + "TigerMessenger/src/world/geometryMerge.js"
s = io.open(p, encoding="utf-8").read()
old = """        const src = attr.count === count ? attr.array : attr.array.subarray(0, count * attr.itemSize);"""
assert old in s and s.count(old) == 1
new = """        // 一律按 count 切片，不能按「count 是否等于 pos.count」来决定。
        // 被 dropCellsFromMerged 压缩过的合并块，count 已经收小、array 仍是
        // 原长（原地压缩不重开缓冲区，见 mergedCellPatch.js 的长注释）：
        // 这时 attr.count === count 成立，但 attr.array 比 count 长一大截，
        // 拿整条 array 去 set 就是 RangeError: offset is out of bounds
        // ——2026-09-05 实测，删格后的第一次重合并当场炸。
        // subarray 只是个视图，不分配，没有省下来的余地可惜。
        const len = count * attr.itemSize;
        const src = attr.array.length === len ? attr.array : attr.array.subarray(0, len);"""
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("patched geometryMerge.js（按 count 切片）")

# ------------------------------------------------ ③ 测试：不变量改回「不换实例 + 长度不变」
P = R + "tools/test_merged_cell_patch.mjs"
t = io.open(P, encoding="utf-8").read()

old_help = t[t.index("/**\n * 属性里「活着」的那一段。"):t.index("const C = (ix, iy, iz)")]
t = t.replace(old_help, """/**
 * 属性里「活着」的那一段。
 *
 * 压缩是**原地**做的：缓冲区长度永远不变，只有 count 收小，尾巴留着上一版的
 * 残数据。所以读几何一律按 count 切片，别直接 [...attr.array]——下游代码同理，
 * 按 array.length 读就会读到残数据（geometryMerge 踩过，见第 7b 组）。
 */
const live = (attr) => [...attr.array.subarray(0, attr.count * attr.itemSize)];

""", 1)

start = t.index("// ---- 7b.")
end = t.index("// ---- 8. 跨格构件")
t = t[:start] + """// ---- 7b. 同一个实例、同一条缓冲区（画面冻死 + 显存漂移的两条根因） ----
//
// (1) 不许换 array。three 的 WebGLAttributes 按 attribute 实例记住 GPU buffer，
//     并存下首次上传的 array.byteLength，此后每次 needsUpdate 都校验
//     `data.size !== attribute.array.byteLength`。同一实例换更短的数组 →
//     每一帧 render 都 throw，抛在 projectObject 里 = render 半途中断：
//     声音照放、画面停住、编辑器点不动
//     （主人 2026-09-05：「系统播放声音，但是无法继续编辑，画面不动了」）。
// (2) 也不许换 attribute 实例。那样能绕开校验，但旧实例的 GPU buffer 成了孤儿
//     ——three 只在 geometry.dispose() 释放 buffer，而这块几何还活着。
//     一次编辑几 MB，连续编辑攒成几百 MB 显存，就是「老是崩溃」。
//
// 所以这一组把两头都钉死：实例不变、array 不变、只有 count 与 drawRange 收小。
{
  const m = makeMerged(layout);
  const pos = m.geometry.attributes.position;
  const col = m.geometry.attributes.color;
  const posArr = pos.array;
  const posBytes = posArr.byteLength;
  const colBytes = col.array.byteLength;

  dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");

  assert.equal(m.geometry.attributes.position, pos,
    "attribute 实例必须原样保留——换实例会把旧 GPU buffer 甩成孤儿，显存越编越多");
  assert.equal(m.geometry.attributes.position.array, posArr,
    "array 实例也必须原样保留——换 array 会让 three 每帧 throw，画面冻死");
  assert.equal(pos.array.byteLength, posBytes, "position 缓冲区长度必须不变");
  assert.equal(col.array.byteLength, colBytes, "color 缓冲区长度必须不变");
  assert.equal(pos.count, (TOTAL - 2) * 3, "只有 count 收小");
  assert.equal(col.count, (TOTAL - 2) * 3, "所有属性同步收 count");
  assert.equal(m.geometry.drawRange.count, (TOTAL - 2) * 3,
    "drawRange 必须跟着 count 收——否则尾巴上的残三角会被画出来");
  assert.ok(pos.array.length > pos.count * pos.itemSize,
    "尾巴确实留着（这正是下游必须按 count 读的原因）");
}

""" + t[end:]
io.open(P, "w", encoding="utf-8").write(t)
print("patched test_merged_cell_patch.mjs")
