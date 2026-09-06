# -*- coding: utf-8 -*-
"""让 GPU 稳定性测试真正走到崩溃那条路：压缩之后、重合并之前先渲染一帧。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_gpu_buffer_stability.mjs")
s = io.open(P, encoding="utf-8").read()

anchor = "// ---- 连续挖格，每次编辑后「渲染一帧」 ----"
assert anchor in s

block = '''// ---- 0. 直击现场：压缩之后、重合并之前先渲染一帧 ----
//
// 线上崩的就是这个顺序。增量编辑分两步：先把 dirty 格从合并块里压缩掉
// （dropCellsFromMerged），再重建/重合并。这两步之间隔着至少一帧——
// 生长动画、debounce、或者干脆就是浏览器在两次 rAF 之间插了一帧。
// 那一帧渲染的就是**刚被压缩过、还没被替换掉**的合并块：
// 如果压缩换了 array（或换了 attribute 实例又复用旧 buffer），
// 这一帧就抛，而且此后每一帧都抛。
//
// 下面这段把这个中间状态单独拎出来验，不让重合并把证据洗掉。
{
  const { dropCellsFromMerged } =
    await import(new URL("src/world/citadel/mergedCellPatch.js", BASE).href);

  const merged = [];
  citadel.traverse((o) => {
    if (o.isMesh && Array.isArray(o.userData?.faceToCell) && o.userData.faceToCell.length > 2) {
      merged.push(o);
    }
  });
  assert.ok(merged.length > 0, "城堡里应该有带 faceToCell 的合并块，否则这条没测到东西");

  const local = makeGpu();
  assert.deepEqual(local.frame(citadel), [], "压缩前应当能正常建 buffer");

  let touched = 0;
  for (const mesh of merged.slice(0, 8)) {
    const first = mesh.userData.faceToCell[0];
    const removed = dropCellsFromMerged(mesh, (seg) => seg === first);
    if (removed > 0) touched++;
  }
  assert.ok(touched > 0, "至少要压缩掉一段，否则下面的断言是空的");

  const errs = local.frame(citadel);
  assert.deepEqual(errs, [],
    "压缩之后的那一帧就抛了 —— 之后每帧都会抛，画面从此不动、只剩声音在放：\\n" +
    `  ${errs.join("\\n  ")}\\n` +
    "  改法见 mergedCellPatch.js：原地压缩，不许换 attr.array，也不许换 attribute 实例。");
  assert.ok(local.uploads > 0,
    "压缩过的属性必须走「复用同一条 buffer 重新上传」这条路（uploads > 0）；" +
    "为 0 说明属性被换成了新实例——那会把旧 GPU buffer 甩成孤儿，越编辑显存越多");
  console.log(`  ✓ 压缩 ${touched} 块 → 中间态渲染零冲突 · 复用上传 ${local.uploads} 次`);
}

'''
s = s.replace(anchor, block + anchor, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_gpu_buffer_stability.mjs")
