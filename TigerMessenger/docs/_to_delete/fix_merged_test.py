# -*- coding: utf-8 -*-
"""压缩改成原地之后，测试要按 count 读「活着的那一段」，并钉死缓冲长度不变。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_merged_cell_patch.mjs")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""const C = (ix, iy, iz) => ({ ix, iy, iz });""",
"""/**
 * 属性里「活着」的那一段。
 *
 * 压缩是**原地**做的：缓冲区长度永远不变，只有 count 变小，尾巴留着上一版的
 * 残数据。必须这样——换掉 attr.array 会让 three 的 WebGLAttributes 每帧抛
 * 「The size of the buffer attribute's array buffer does not match the original
 * size」，render 半途中断，画面冻死而声音照放（主人 2026-09-05 报的编辑器卡死）。
 * 所以读几何一律按 count 切片，别直接 [...attr.array]。
 */
const live = (attr) => [...attr.array.subarray(0, attr.count * attr.itemSize)];

const C = (ix, iy, iz) => ({ ix, iy, iz });""", "live 助手")

rep("""  const expect = [...src.slice(0, 5 * 9), ...src.slice(7 * 9)];
  assert.deepEqual([...m.geometry.attributes.position.array], expect,""",
"""  const expect = [...src.slice(0, 5 * 9), ...src.slice(7 * 9)];
  assert.deepEqual(live(m.geometry.attributes.position), expect,""", "case2")

rep("""  const a = m.geometry.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) tags.add(a[i]);""",
"""  const a = live(m.geometry.attributes.position);
  for (let i = 0; i < a.length; i += 3) tags.add(a[i]);""", "case3")

rep("""  const before = [...m.geometry.attributes.position.array];
  const f0 = m.userData.faceToCell;
  assert.equal(dropCellsFromMerged(m, () => false), 0);
  assert.deepEqual([...m.geometry.attributes.position.array], before);""",
"""  const before = [...m.geometry.attributes.position.array];
  const f0 = m.userData.faceToCell;
  assert.equal(dropCellsFromMerged(m, () => false), 0);
  assert.deepEqual([...m.geometry.attributes.position.array], before);
  // 没命中时整条缓冲区（含尾巴）都不许动——这条仍然按 array 比，是故意的""", "case5 注释")

rep("""  const after = [...m.geometry.attributes.position.array];
  assert.equal(dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0"), 0);
  assert.deepEqual([...m.geometry.attributes.position.array], after);""",
"""  const after = live(m.geometry.attributes.position);
  assert.equal(dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0"), 0);
  assert.deepEqual(live(m.geometry.attributes.position), after);""", "case7")

# 新增：缓冲长度不变的硬门
rep("""// ---- 8. 跨格构件：按 cells 列表命中（屋顶分量/花园/晾衣绳） ----""",
"""// ---- 7b. 缓冲区长度不许变（画面冻死的那条根因） ----
//
// three 在首次上传时按 array.byteLength 记住 GPU buffer 的大小，此后每次
// needsUpdate 都拿 `data.size !== attribute.array.byteLength` 校验；一旦我们
// 换上一条更短的数组，这条校验**每一帧**都失败并 throw，抛在 projectObject
// 里 = render 半途中断：音频线程照跑（有声音），画面停在最后一帧、编辑器点不动。
// 主人 2026-09-05：「系统播放声音，但是无法继续编辑，画面不动了」。
// 所以这里钉死：可以改 count、改 drawRange，就是不许换 array。
{
  const m = makeMerged(layout);
  const pos = m.geometry.attributes.position;
  const col = m.geometry.attributes.color;
  const posArr = pos.array;
  const posBytes = posArr.byteLength;
  const colArr = col.array;
  const colBytes = colArr.byteLength;

  dropCellsFromMerged(m, (s) => key(s.cell) === "2,0,0");

  assert.equal(m.geometry.attributes.position.array, posArr,
    "position 的 array 实例必须原样保留——换实例就是那个每帧 throw 的写法");
  assert.equal(m.geometry.attributes.position.array.byteLength, posBytes,
    "position 缓冲区长度必须不变（three 不支持 resize buffer attribute）");
  assert.equal(m.geometry.attributes.color.array, colArr, "color 同理");
  assert.equal(m.geometry.attributes.color.array.byteLength, colBytes, "color 同理");
  assert.equal(m.geometry.attributes.position.count, (TOTAL - 2) * 3,
    "只有 count 变小");
  assert.equal(m.geometry.drawRange.count, (TOTAL - 2) * 3,
    "drawRange 必须跟着 count 收——否则尾巴上的残三角会被画出来");
}

// ---- 8. 跨格构件：按 cells 列表命中（屋顶分量/花园/晾衣绳） ----""", "case7b")

io.open(P, "w", encoding="utf-8").write(s)
print("patched test_merged_cell_patch.mjs")
