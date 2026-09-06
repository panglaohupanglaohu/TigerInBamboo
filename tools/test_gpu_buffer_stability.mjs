// =====================================================================
// GPU 缓冲区稳定性（主人 2026-09-05：「系统播放声音，但是无法继续编辑，
// 画面不动了」；控制台每帧刷同一条 THREE.WebGLAttributes 报错）
//
// three 的 WebGLAttributes 是这样管 GPU buffer 的：
//   · 用 WeakMap 按 **attribute 实例** 记住 {buffer, version, size}，
//     size = 首次上传时的 array.byteLength；
//   · 每次 attribute.version 变大（needsUpdate 干的）就校验
//     `data.size !== attribute.array.byteLength`，不等就 throw：
//     "The size of the buffer attribute's array buffer does not match the
//      original size. Resizing buffer attributes is not supported."
//
// 这条异常抛在 WebGLRenderer.render → projectObject 里，等于**整帧渲染半途
// 中断**。rAF 在 animate 函数头就排好了下一帧，所以逻辑、音频全都还在跑，
// 只有画面再也不更新——用户看到的是「死机」，实际是每帧都在同一处抛。
//
// 单元测试（test_merged_cell_patch 第 7b 组）已经钉住了合并块压缩本身。
// 这里补的是**集成**那一层：跑一次真实的增量编辑，把 three 的规则原样模拟
// 一遍，确保整条管线（压缩 + 重合并 + 窗口/描边重建）里没有任何一个属性
// 违反「实例复用 ⇒ 长度不变」。
//
// 运行：node tools/test_gpu_buffer_stability.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

await import(new URL("vendor/three.module.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

/**
 * three 的 WebGLAttributes 的最小复刻：只保留会 throw 的那条规则。
 * upload() 相当于渲染一帧——遍历场景里所有几何的属性，该建的建、该校验的校验。
 */
function makeGpu() {
  const cache = new WeakMap(); // attribute -> { size, version }
  let uploads = 0;
  let creates = 0;
  return {
    get uploads() { return uploads; },
    get creates() { return creates; },
    /** @returns {string[]} 本帧的致命错误（空 = 这一帧画得出来） */
    frame(root) {
      const errors = [];
      root.traverse((o) => {
        const geo = o.geometry;
        if (!geo) return;
        const attrs = [...Object.values(geo.attributes || {})];
        if (geo.index) attrs.push(geo.index);
        for (const attr of attrs) {
          if (!attr?.array) continue;
          const data = cache.get(attr);
          if (data === undefined) {
            cache.set(attr, { size: attr.array.byteLength, version: attr.version });
            creates++;
          } else if (data.version < attr.version) {
            if (data.size !== attr.array.byteLength) {
              errors.push(
                `${o.name || o.type}.${attr.itemSize}x${attr.count}：` +
                `建 buffer 时 ${data.size} 字节，现在 ${attr.array.byteLength} 字节`
              );
              continue;
            }
            data.version = attr.version;
            uploads++;
          }
        }
      });
      return errors;
    },
  };
}

const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec0 = JSON.parse(JSON.stringify(citadel.userData.townSpec));
const gpu = makeGpu();

// 第 1 帧：建城之后先把所有 buffer 建起来（等于游戏里第一次 render）
{
  const errs = gpu.frame(citadel);
  assert.deepEqual(errs, [], "建城后的第一帧就不该有尺寸冲突");
  assert.ok(gpu.creates > 0, "第一帧应该建出 buffer，否则这个测试什么也没测");
}

// ---- 0. 直击现场：压缩之后、重合并之前先渲染一帧 ----
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
    "压缩之后的那一帧就抛了 —— 之后每帧都会抛，画面从此不动、只剩声音在放：\n" +
    `  ${errs.join("\n  ")}\n` +
    "  改法见 mergedCellPatch.js：原地压缩，不许换 attr.array，也不许换 attribute 实例。");
  assert.ok(local.uploads > 0,
    "压缩过的属性必须走「复用同一条 buffer 重新上传」这条路（uploads > 0）；" +
    "为 0 说明属性被换成了新实例——那会把旧 GPU buffer 甩成孤儿，越编辑显存越多");
  console.log(`  ✓ 压缩 ${touched} 块 → 中间态渲染零冲突 · 复用上传 ${local.uploads} 次`);
}

// ---- 连续挖格，每次编辑后「渲染一帧」 ----
const charAt = (lv, ix, iy, iz) => {
  const rows = lv[iy];
  if (!rows) return ".";
  const row = rows[iz];
  return typeof row === "string" ? (row[ix] ?? ".") : ".";
};

let spec = spec0;
let edits = 0;
const EDITS = 6;
for (let n = 0; n < EDITS; n++) {
  const next = JSON.parse(JSON.stringify(spec));
  const levels = next.terraces[0].levels;
  // 找一格实心的挖掉（每轮换一个位置）
  let target = null;
  outer:
  for (let iy = 1; iy < 9; iy++) {
    for (let iz = 2 + n; iz < 20; iz++) {
      for (let ix = 2 + n; ix < 20; ix++) {
        if (charAt(levels, ix, iy, iz) !== ".") { target = { ix, iy, iz }; break outer; }
      }
    }
  }
  if (!target) break;
  const rows = levels[target.iy];
  const row = rows[target.iz].split("");
  row[target.ix] = ".";
  rows[target.iz] = row.join("");

  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  assert.ok(r.ok, `第 ${n + 1} 次增量失败：${r.error ?? ""}`);
  edits++;
  spec = next;

  const errs = gpu.frame(citadel);
  assert.deepEqual(errs, [],
    `第 ${n + 1} 次编辑后渲染就抛了 —— 这一抛就是每帧都抛，画面从此不动：\n` +
    `  ${errs.join("\n  ")}\n` +
    `  改法见 mergedCellPatch.js：压缩必须原地做，不许换 attr.array，也不许换 attribute 实例。`);
}

assert.ok(edits >= 3, `应至少完成 3 次编辑，实得 ${edits}`);
console.log(`  ✓ ${edits} 次增量编辑 · 每次编辑后模拟渲染一帧 · 零尺寸冲突`);
console.log(`  ✓ buffer 建 ${gpu.creates} 条 · 复用上传 ${gpu.uploads} 次（复用说明没在偷偷换实例）`);
console.log("✅ test_gpu_buffer_stability（编辑后仍能渲染，不再画面冻死）");
