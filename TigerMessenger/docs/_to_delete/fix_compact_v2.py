# -*- coding: utf-8 -*-
"""压缩：原地搬数据 + 换 attribute 实例（而不是换同一实例的 array）。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, "%s 未匹配：%s" % (rel, why)
        assert s.count(old) == 1, "%s 多处匹配：%s" % (rel, why)
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

OLD = """  // 压缩必须**原地**做，绝不能换掉 attr.array（主人 2026-09-05："""
assert True

p = R + "TigerMessenger/src/world/citadel/mergedCellPatch.js"
s = io.open(p, encoding="utf-8").read()
start = s.index("  // 压缩必须**原地**做")
end = s.index("  // 保留段重编号")
new_block = """  // ⚠️ 绝不能保留同一个 attribute 实例、只换它的 array（主人 2026-09-05：
  // 「系统播放声音，但是无法继续编辑，画面不动了」，控制台每帧刷
  //  THREE.WebGLAttributes: The size of the buffer attribute's array buffer
  //  does not match the original size. Resizing buffer attributes is not supported.）
  //
  // 原因：three 的 WebGLAttributes 用 WeakMap 按 **attribute 实例** 记住 GPU
  // buffer，并在首次上传时存下 array.byteLength。之后每次 needsUpdate 都拿
  // `data.size !== attribute.array.byteLength` 校验——同一个实例换上更短的
  // 数组，这条永远不相等，于是 **每一帧 render 都 throw**。异常抛在
  // projectObject 里，render 半途中断：音频线程照跑（有声音），画面停在最后
  // 一帧、编辑器也点不动。这就是主人看到的「冻住」，不是掉帧、不是死循环。
  //
  // 正解是给几何**换一个新的 attribute 实例**：新实例在 WeakMap 里没有旧记录，
  // three 直接按新长度建一条新 buffer，校验根本不参与。
  //
  // 数据搬运仍然原地做（head <= from 恒成立，前向压缩），只在最后用
  // subarray 交给新实例，所以整个压缩只有一次拷贝——增量编辑是热路径，
  // 每次 edit 重开几 MB 才是真浪费。
  //
  // 另一条同样重要：新实例必须是**紧的**（array.length === count * itemSize）。
  // 合并块压缩完还会被 mergeCitadelTownLevels 重新烘焙/合并，那边按
  // array 长度批量 set；留一条带尾巴的数组过去，会直接 RangeError: offset is
  // out of bounds（2026-09-05 实测）。所以这里不留尾巴。
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
    // Float32BufferAttribute 等子类的构造器会把 subarray 复制成独立数组（紧的）；
    // 裸 BufferAttribute 则直接持有这个视图，byteLength 同样等于 head——两条路都紧。
    const next = new attr.constructor(attr.array.subarray(0, head), size, attr.normalized);
    if (attr.usage !== undefined) next.usage = attr.usage;
    geometry.setAttribute(name, next);
  }

"""
s = s[:start] + new_block + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("patched mergedCellPatch.js")

# ---------------- 测试：把不变量改成「紧 + 换实例」 ----------------
P = R + "tools/test_merged_cell_patch.mjs"
t = io.open(P, encoding="utf-8").read()

old_live = t[t.index("/**\n * 属性里「活着」的那一段。"):t.index("const live = (attr) =>")]
t = t.replace(old_live, """/**
 * 属性里「活着」的那一段。压缩后属性应当是紧的，这个助手只是把这条断言
 * 写得更明白：切片与整条数组必须完全一致（见下面第 7b 组）。
 */
""", 1)

start = t.index("// ---- 7b. 缓冲区长度不许变（画面冻死的那条根因） ----")
end = t.index("// ---- 8. 跨格构件")
t = t[:start] + """// ---- 7b. 换实例 + 紧数组（画面冻死 / 重合并崩溃的两条根因） ----
//
// (1) three 的 WebGLAttributes 按 **attribute 实例** 记住 GPU buffer，并存下
//     首次上传时的 array.byteLength；之后每次 needsUpdate 都校验
//     `data.size !== attribute.array.byteLength`。保留同一实例、只换更短的
//     array，这条校验每一帧都失败并 throw，抛在 projectObject 里 = render
//     半途中断：声音照放、画面停住、编辑器点不动
//     （主人 2026-09-05：「系统播放声音，但是无法继续编辑，画面不动了」）。
//     所以压缩必须换新实例。
// (2) 新实例必须是紧的。合并块压缩完还会被 mergeCitadelTownLevels 重新
//     烘焙合并，那边按 array 长度批量 set；留尾巴过去就是
//     RangeError: offset is out of bounds。
{
  const m = makeMerged(layout);
  const posBefore = m.geometry.attributes.position;
  const colBefore = m.geometry.attributes.color;

  dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");

  const pos = m.geometry.attributes.position;
  const col = m.geometry.attributes.color;
  assert.notEqual(pos, posBefore,
    "必须换新的 attribute 实例——沿用旧实例换 array 会让 three 每帧 throw，画面冻死");
  assert.notEqual(col, colBefore, "color 同理");
  assert.equal(pos.count, (TOTAL - 2) * 3, "count 应为压缩后的顶点数");
  assert.equal(pos.array.length, pos.count * pos.itemSize,
    "position 必须是紧数组——留尾巴会让重合并 RangeError");
  assert.equal(col.array.length, col.count * col.itemSize, "color 必须是紧数组");
  assert.equal(m.geometry.drawRange.count, (TOTAL - 2) * 3,
    "drawRange 必须跟着 count 收");
}

""" + t[end:]
io.open(P, "w", encoding="utf-8").write(t)
print("patched test_merged_cell_patch.mjs")
