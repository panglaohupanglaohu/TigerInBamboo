// 第 101 轮 · WorldMesh 路由 setter 守卫（r100 next[3]）。
//
// 为什么要这条守卫：`buildTerrain(w) / buildBuildings(w)` 拿到的不是 MeshWriter，而是
// `src/world/worldmesh.js` 里的 `ChunkRouter`（按块把三角形路由到多个 MeshWriter）。
// 生成器写 `w.someSlot = v` 时，如果 ChunkRouter **没有同名 setter**，这次赋值只是挂在
// 路由对象自己身上 —— 真正的 MeshWriter 一点都收不到，而且**页面不报错、几何看不出来**：
//   · r53 `w.edgeTri = …` 漏了 → 逐边着色全 1；
//   · r99 `w.bandTri = k` 漏了 → 16616/16616 顶点倍率 = 1.000（一整个「逐三角带宽」白做）。
// 两次都是靠浏览器里读活几何才发现。这条测试把「漏 setter」变成静态检查，改代码时立刻红。
//
// 判据（三条，全部可静态求）：
//   A 槽位清单：从 `src/core/meshwriter.js` 抓所有 `this.<slot> = ` —— 那是生成器可能写的槽位；
//   B 写点清单：扫 `src/**/*.js`，凡是对「同一文件里被当 writer 用」的对象（出现过 `<x>.tri(` /
//     `<x>.quad(`）做的 `<x>.<slot> = …` 赋值，都是必须被路由的写点；
//   C 路由清单：`worldmesh.js` 里每个必须有 `set <slot>(` ，且 setter 体里必须写到 `this.cur.<slot>`
//     （只存到自己身上的 setter 同样是坑，r99 的教训）。
// 白名单只允许「确实不经路由的纯内部槽位」，且必须写明理由；空着就说明没有例外。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** 路由层不必转发的内部槽位（写在这里必须写理由）。 */
const ROUTER_INTERNAL = {
  colorCache: 'MeshWriter 内部的颜色缓存，生成器从不写',
  softTri: '逐三角软法线标记由 MeshWriter 自己 push，生成器只写 soft',
  pos: '位置数组由 MeshWriter 的 tri/quad 自己 push',
  col: '同上',
  glow: '同上',
  field: '同上',
  edge: '同上',
  band: '同上',
};

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const rows = [];
const ok = (c, m) => rows.push({ ok: !!c, m });

// ---- A 槽位清单 ----
const mwSrc = read(path.join(SRC, 'core/meshwriter.js'));
const slots = new Set();
for (const m of mwSrc.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=/g)) slots.add(m[1]);

// ---- C 路由清单（setter 名 + setter 体） ----
const wmSrc = read(path.join(SRC, 'world/worldmesh.js'));
const setters = new Map();
for (const m of wmSrc.matchAll(/set\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{([^}]*)\}/g)) setters.set(m[1], m[2]);

// ---- B 写点清单 ----
const writes = [];       // {file, recv, slot, line}
for (const file of walk(SRC)) {
  // MeshWriter 自己的定义文件：那些 `this.<slot> =` 就是它该干的事，不是路由写点
  if (/(^|\/)meshwriter\.js$/.test(file)) continue;
  const src = read(file);
  const writers = new Set();          // 本文件里被当 writer 调用的对象名
  for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\.(?:tri|quad)\s*\(/g)) writers.add(m[1]);
  if (!writers.size) continue;
  const lines = src.split('\n');
  lines.forEach((ln, i) => {
    for (const recv of writers) {
      // `this` = 类自己；`cur` = 本仓约定「已经是一个真 MeshWriter」（worldmesh 的 this.cur、
      // town-skin-layer 的 cur）。这两类不是路由对象，写它们不需要转发。
      if (recv === 'this' || recv === 'cur') continue;
      const re = new RegExp('\\b' + recv.replace(/\$/g, '\\$') + '\\.([A-Za-z_$][\\w$]*)\\s*=(?!=)', 'g');
      for (const m of ln.matchAll(re)) {
        const slot = m[1];
        if (slots.has(slot)) writes.push({ file: path.relative(ROOT, file), recv, slot, line: i + 1 });
      }
    }
  });
}

const needed = new Set();
let ignored = 0;
for (const w of writes) {
  if (ROUTER_INTERNAL[w.slot]) { ignored++; continue; }
  needed.add(w.slot);
}
const missing = [...needed].filter((s) => !setters.has(s));
const noForward = [...needed].filter((s) => setters.has(s) && !new RegExp(`this\\.cur\\.${s.replace(/\$/g, '\\$')}\\b`).test(setters.get(s)));

ok(slots.size >= 8, `MeshWriter 槽位 ${slots.size} 个：${[...slots].join(', ')}`);
ok(writes.length >= 4, `跨 ${new Set(writes.map((w) => w.file)).size} 个文件找到 ${writes.length} 处 writer 槽位赋值（${ignored} 处属内部槽位已豁免）`);
ok(missing.length === 0, missing.length
  ? `漏 setter：${missing.join(', ')} —— 路由对象收到赋值但真 MeshWriter 收不到（r53/r99 同款坑）`
  : `所有被写的槽位都有路由 setter：${[...needed].sort().join(', ')}`);
ok(noForward.length === 0, noForward.length
  ? `setter 未转发 this.cur.*：${noForward.join(', ')} —— 只存到路由对象自己身上，等于没写`
  : '每个 setter 都转发到 this.cur.*（不是只存自己身上）');

// 白名单本身要自洽：写了理由的槽位必须真的出现在 MeshWriter 里，别写错名字糊过去
const badWhite = Object.keys(ROUTER_INTERNAL).filter((s) => !slots.has(s));
const nWhite = Object.keys(ROUTER_INTERNAL).length;
ok(badWhite.length === 0, badWhite.length
  ? `白名单里有不存在的槽位：${badWhite.join(', ')}`
  : `白名单 ${nWhite} 项全部对应真实槽位`);
// 反向守卫：内部槽位不许被生成器当成路由槽位写（写了就该进 needed，这里报出来）
const wroteInternal = writes.filter((w) => ROUTER_INTERNAL[w.slot]);
ok(wroteInternal.length === 0, wroteInternal.length
  ? `生成器直接写了内部槽位：${wroteInternal.map((w) => `${w.file}:${w.line} .${w.slot}`).join(' / ')}`
  : '生成器没有直接写 MeshWriter 的内部数组槽位');

// 已知的两个历史坑必须永久覆盖（回归护栏：谁把 setter 删了立刻红）
for (const s of ['edgeTri', 'bandTri']) {
  ok(setters.has(s) && new RegExp(`this\\.cur\\.${s}\\b`).test(setters.get(s)),
    `${s} 的转发 setter 在位（r${s === 'edgeTri' ? 53 : 99} 的历史坑）`);
}

console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
if (writes.length) console.log('\n写点：\n' + writes.map((w) => `  ${w.file}:${w.line}  ${w.recv}.${w.slot} = …`).join('\n'));
const bad = rows.filter((r) => !r.ok).length;
console.log(bad ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
if (bad) process.exitCode = 1;
