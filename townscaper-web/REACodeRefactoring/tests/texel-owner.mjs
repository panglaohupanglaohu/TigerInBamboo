// 1481661852887265288（第 50 轮，迁自 REACode src/megatex.js）：面片烘进共享图集（core/atlas.js）+ owner 表反查。
// ① 每个内框像素都能反查回自己的面，u,v ∈ (0,1)，texelOf(反查结果) 回到同一像素；② 垫边 0 时内框边缘的双线性采样会串到别的面，
// 垫边 2 时一个都不串；③ mip 1 级的混面比例随垫边下降。
import assert from 'node:assert/strict';
import { TexelOwnerAtlas } from '../src/light/texel-owner.js';
const hash = (i, s) => { let h = (i * 374761393 + s * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const faces = Array.from({ length: 150 }, (_, i) => ({ key: 'f' + i, w: 18 + Math.floor(hash(i, 8) * 54), h: 12 + Math.floor(hash(i, 9) * 40) }));
const out = {};
for (const pad of [0, 2]) {
  const A = new TexelOwnerAtlas(1024, 1024, { pad }); let placed = 0;
  for (const f of [...faces].sort((a, b) => b.w * b.h - a.w * a.h)) if (A.add(f.key, f.w, f.h)) placed++;
  assert.equal(placed, faces.length, `pad ${pad} 全部放下`);
  let checked = 0, edgeBleed = 0, edgeSamples = 0;
  for (const [id, r] of A.entries.entries()) {
    for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y + r.h - 1], [r.x + (r.w >> 1), r.y + (r.h >> 1)]]) {
      const q = A.resolveTexel(x, y); assert.ok(q && q.id === id && !q.pad && q.u > 0 && q.u < 1 && q.v > 0 && q.v < 1, '内框像素反查回本面'); checked++;
      const [tx, ty] = A.texelOf(q.id, q.u, q.v); assert.ok(Math.floor(tx) === x && Math.floor(ty) === y, 'texelOf 回到同一像素');
    }
    // 内框四条边上逐像素：在像素外缘（离边 0.5 像素）做双线性采样，看有没有别的面 / 空白混进来
    for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y, r.y + r.h]) { edgeSamples++; const ids = A.bilinearOwners(x + 0.5, y); if ([...ids].some((k) => k !== id)) edgeBleed++; }
  }
  out['pad' + pad] = { placed, checked, edgeBleed: +(edgeBleed / edgeSamples).toFixed(3), mip1: +A.mipBleed(1).toFixed(3), mip2: +A.mipBleed(2).toFixed(3) };
}
assert.ok(out.pad0.edgeBleed > 0.3, '无垫边：边缘双线性串色');
assert.equal(out.pad2.edgeBleed, 0, '垫边 2：一个都不串');
assert.ok(out.pad2.mip1 < out.pad0.mip1, 'mip 1 混面比例随垫边下降');
console.log('PASS 图集 owner 反查 + 垫边防串色（共享 Atlas）', JSON.stringify(out));
