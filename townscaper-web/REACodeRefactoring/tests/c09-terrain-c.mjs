// 第 56 批 C09-C（地形 / 生命 · 子分队 C）：5 条片子的 node 验收。
//   1707490274425884929 灌木贴「东西的边上」：崖顶 + 崖脚 + 墙根（shrub-edges-c09.js）
//   1699038611125985317 宽窄层柱沉积层理（sediment-bands-c09.js，sediment mode 3/4）
//   1696896119794479541 色块翻崖舌头（blotch-tongue-c09.js，view-shading setBlotchTongue / ?tongue=1）
//   1669315384619540487 每个种子都出好岛（island-quality-c09.js consistentIsland + islands-c09.html）
//   1584623053061099520 任意轮廓房屋拼进地形三角网 + 周边重网格（splice-polygon-c09.js，terrainmesh 挂钩）
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { buildHalfEdge, checkHalfEdge } = await import('../src/core/halfedge.js');
const SH = await import('../src/terrain/shrub-edges-c09.js');
const SB = await import('../src/core/sediment-bands-c09.js');
const { SEDIMENT_GLSL } = await import('../src/core/sediment.js');
const TG = await import('../src/terrain/blotch-tongue-c09.js');
const { createBlotchAtlasData, sampleBlotchAtlas, swirlUV } = await import('../src/terrain/blotch-atlas.js');
const IQ = await import('../src/terrain/island-quality-c09.js');
const SP = await import('../src/build/splice-polygon-c09.js');
const L = 0.5, GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };
const out = {};
const mesh = (w, shape) => { const m = new MeshWriter(); buildTerrain(m, w, { L, shape }); return m; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- ① 1707490274425884929 灌木：默认 = 旧式；开后崖脚 / 墙根也是 aEdge=0 ----------
for (const kind of ['quad', 'mixed']) {
  const w = new World(decorateCells(GRIDS[kind]())); generateTerrain(w, { seed: 7 });
  // 盖几栋房：选几个 ground≥2 的平格，往上加 2 层建筑（墙根在邻格顶面）
  let houses = 0; for (const c of w.cells) { const g = w.ground(c); if (g >= 2 && g <= 5 && !w.river[c.id] && houses < 12 && c.id % 9 === 0) { w.setSolid(c, g + 1, true); w.setSolid(c, g + 2, true); houses++; } }
  let diff = 0, superset = true;
  for (const c of w.cells) {
    const g = w.ground(c); if (!g || w.isSolid(c, g + 1)) continue;
    // 第 68 轮改口径：`og >= 1 && og < g` → `og < g`（临水边也长带，见 shrub-edges-c09.js）；
    // 这里仍是「默认不开崖脚」的等价性检查，只是基准公式跟着改。
    const old = c.pts.map((_, i) => { const o = w.neighbor(c, i), og = o ? w.top(o) : 0; return og < g; });
    assert.ok(same(SH.shrubEdgeFlags(w, c, g, true), old), '默认关 = 旧公式（cell ' + c.id + '）');
    assert.ok(same(SH.shrubEdgeFlags(w, c, g, false), old.map(() => false)), '非灌木格全 false');
    w.shrubFootC09 = true; const on = SH.shrubEdgeFlags(w, c, g, true); w.shrubFootC09 = undefined;
    on.forEach((v, i) => { if (old[i] && !v) superset = false; if (v !== old[i]) diff++; });
  }
  assert.ok(superset, '开后是旧集合的超集');
  const st = SH.shrubEdgeStats(w); assert.ok(st.houseFoot > 0 && st.cliffFoot > 0, '有墙根和崖脚边 ' + JSON.stringify(st));
  const shape = shapeTerrain(w, {}), m0 = mesh(w, shape); w.shrubFootC09 = true; const m1 = mesh(w, shape);
  w.shrubFootC09 = { cliffFoot: false, houseFoot: true }; const m2 = mesh(w, shape); delete w.shrubFootC09;
  assert.ok(same(m0.pos, m1.pos) && same(m0.col, m1.col), '只改 aEdge，几何 / 顶点色不变');
  const zeros = (m) => m.edge.filter((e) => e === 0).length;
  assert.ok(zeros(m1) > zeros(m0) && zeros(m2) > zeros(m0) && zeros(m2) < zeros(m1), `aEdge=0 顶点 旧 ${zeros(m0)} / 全开 ${zeros(m1)} / 仅墙根 ${zeros(m2)}`);
  assert.ok(SH.SHRUB_FOOT_STYLE.width < 0.5 && SH.SHRUB_FOOT_STYLE.width > 0.2);
  out['shrub-' + kind] = { flipped: diff, ...st, zeros: [zeros(m0), zeros(m1), zeros(m2)] };
}

// ---------- ② 1699038611125985317 层柱：宽窄不一、交界细线、mode 0–2 GLSL 不变 ----------
{
  const runs = SB.bandRuns(0, 10 * 0.5, { period: 0.5 }), widths = runs.map((r) => r.slots);
  assert.ok(runs.length >= 15, '10 层里有足够多的层带 ' + runs.length);
  assert.ok(Math.min(...widths) === 1 && Math.max(...widths) >= 3, '带宽宽窄相间 ' + widths.join(','));
  assert.ok(new Set(runs.map((r) => r.type)).size === 4, '四种岩性都出现');
  const lines = runs.filter((r) => r.line).length; assert.ok(lines > runs.length * 0.3 && lines < runs.length, '一部分交界有细深线 ' + lines + '/' + runs.length);
  for (const r of runs.slice(1)) assert.ok(SB.bandType(r.start) !== SB.bandType(r.start - 1), '每条带的起点就是岩性变化处');
  // 直层：只看 y（世界 XZ 不进 sedimentBandAt）；同一高度不同面上同一层
  assert.deepEqual(SB.sedimentBandAt(1.234), SB.sedimentBandAt(1.234));
  assert.equal(SB.sedimentBandAt(0.33).slot, Math.floor(0.33 / 0.5 * SB.BAND_SLOTS));
  assert.ok(SB.BAND_TONES[2] < 0.8 && SB.BAND_TONES[0] > 1.05, '褐带更暗、浅带更亮');
  assert.ok(SEDIMENT_GLSL.includes('if(uStrataMode>2.5) return sedimentBandsColor(color,p);') && SEDIMENT_GLSL.includes('vec3 sedimentBandsColor('), 'mode≥3 分支');
  assert.ok(SEDIMENT_GLSL.includes('float phase=(p.y+(uStrataMode>1.5?sedimentOffset(p.xz,uStrata.y):0.0))/uStrata.x;'), 'mode 1/2 原式保留');
  assert.ok(SEDIMENT_GLSL.indexOf('float sedimentOffset(') < SEDIMENT_GLSL.indexOf('vec3 sedimentBandsColor('), '弯层模式用到的 sedimentOffset 在前面声明');
  assert.ok(/mode<0\|\|mode>4/.test(readFileSync(join(root, 'src/world/view.js'), 'utf8')), 'View.setStrataStyle 接受 mode 3/4');
  assert.throws(() => SB.sedimentBandAt(NaN));
  out.sediment = { runs: runs.length, widths: [Math.min(...widths), Math.max(...widths)], lines };
}

// ---------- ③ 1696896119794479541 舌头：沿崖边长短不一、圆头；顶面带与崖面舌头同一 amt ----------
{
  const atlas = createBlotchAtlasData(), sample = (u, v) => sampleBlotchAtlas(atlas, u, v);
  const D = TG.TONGUE_DEFAULTS, amts = [];
  for (let k = 0; k <= 400; k++) amts.push(TG.tongueAmount(sample, k * 0.05, 3.1, { lobe: D.lobe }));
  let tongues = 0, inT = false; for (const a of amts) { if (a > 0.02 && !inT) { tongues++; inT = true; } if (a <= 0.02) inT = false; }
  assert.ok(tongues >= 4, '20 单位长的崖边上有多条分开的舌头 ' + tongues);
  assert.ok(Math.max(...amts) > 0.9 && amts.some((a) => a === 0), '有长舌头也有空档');
  let maxJump = 0; for (let k = 1; k < amts.length; k++) maxJump = Math.max(maxJump, Math.abs(amts[k] - amts[k - 1])); assert.ok(maxJump < 0.5, '沿边连续（圆头，不是方块）' + maxJump.toFixed(3));
  for (const amt of [0.3, 1]) {
    const d = D.depth * amt;
    assert.equal(TG.tongueWallMask({ below: d * 0.5, amt, normalY: 0 }), 1, '舌头内');
    assert.equal(TG.tongueWallMask({ below: d * 1.01 + 1e-3, amt, normalY: 0 }), 0, '舌头以下是岩');
    assert.equal(TG.tongueWallMask({ below: d * 0.5, amt, normalY: 1 }), 0, '平面不算崖面');
    assert.equal(TG.tongueTopMask({ edge: D.topReach * amt * 0.5, amt, normalY: 1 }), 1, '顶面靠边一条同色带');
    assert.equal(TG.tongueTopMask({ edge: 1, amt, normalY: 1 }), 0, '格心不画');
  }
  assert.equal(TG.tongueWallMask({ below: 0.01, amt: 0, normalY: 0 }), 0, 'amt=0 的地方完全没有（受控）');
  assert.ok(TG.BLOTCH_TONGUE_GLSL.includes('uBlotchTongue') && !/\bflat\b\s*=/.test(TG.BLOTCH_TONGUE_GLSL), 'GLSL 无保留字 flat 变量');
  const vs = readFileSync(join(root, 'src/world/view-shading.js'), 'utf8');
  assert.ok(vs.includes('BLOTCH_RIM_GLSL + BLOTCH_TONGUE_GLSL') && vs.includes('setBlotchTongue(') && vs.includes("get('tongue')"), 'view-shading 挂钩 / URL');
  out.tongue = { tongues, maxJump: +maxJump.toFixed(3) };
}

// ---------- ④ 1669315384619540487 每个种子都出好岛 ----------
{
  const opts = (seed) => ({ seed, softSlopes: true, riverRelax: true, lakes: true, basins: 1 });
  for (const kind of ['quad', 'mixed']) {
    const w = new World(decorateCells(GRIDS[kind]()));
    let rawCool = 0, cool = 0, tries = 0;
    for (let seed = 1; seed <= 16; seed++) {
      w.reset(); generateTerrain(w, opts(seed)); if (IQ.islandVerdict(IQ.islandReport(w)).cool) rawCool++;
      const r = IQ.consistentIsland(w, generateTerrain, opts(seed)); tries += r.tries;
      assert.ok(r.verdict.cool, `${kind} seed ${seed} 体检通过 ${JSON.stringify(r.verdict.failed)}`);
      const rep = IQ.islandReport(w); assert.deepEqual(rep, r.report, '返回的体检就是 World 当前状态');
      assert.ok(rep.mainFrac >= 0.85 && rep.levels >= 4 && rep.cliffEdges > 0 && rep.stepEdges > 0);
      cool++;
    }
    // 确定性：同一种子两次结果相同
    const a = IQ.consistentIsland(w, generateTerrain, opts(4)), s1 = w.solid.slice(); const b = IQ.consistentIsland(w, generateTerrain, opts(4));
    assert.equal(a.seed, b.seed); assert.ok(same(Array.from(s1), Array.from(w.solid)), '确定性');
    assert.ok(rawCool < 16, '原生成器确有不达标的种子（本轮要补的「consistently」）');
    out['islands-' + kind] = { rawCool, cool, avgTries: +(tries / 16).toFixed(2) };
  }
  assert.throws(() => IQ.consistentIsland(new World(decorateCells(GRIDS.quad())), null, {}));
}

// ---------- ⑤ 1584623053061099520 任意轮廓插入 + 周边重网格 ----------
{
  // 合成网格：8×8 方格每格切两个三角
  const N = 8, verts = [], tris = [];
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) verts.push([x + (z % 2) * 0.13 * Math.sin(x), z + 0.11 * Math.cos(x * 1.7 + z)]);
  const id = (x, z) => z * (N + 1) + x;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { tris.push([id(x, z), id(x + 1, z), id(x + 1, z + 1)]); tris.push([id(x, z), id(x + 1, z + 1), id(x, z + 1)]); }
  const Lshape = [[2.3, 2.2], [5.6, 2.4], [5.5, 4.1], [4.1, 4.0], [4.2, 5.7], [2.4, 5.5]];   // 凹多边形
  const r = SP.spliceFootprint({ verts, tris }, Lshape);
  assert.ok(Math.abs(r.areaR - r.areaNew - r.areaPoly) < 1e-9, '面积守恒');
  const H = buildHalfEdge(SP.trisAsCells(r.verts, r.fresh));
  assert.deepEqual(checkHalfEdge(H), [], '新三角半边一致');
  assert.equal(H.boundaryLoops.length, 2, '外环 + 占地洞'); assert.equal(H.euler, 0, '环形域 Euler = 0');
  const Hall = buildHalfEdge(SP.trisAsCells(r.verts, r.tris)); assert.deepEqual(checkHalfEdge(Hall), [], '整网仍是流形（无 T 形接点 / 无重叠边）');
  assert.equal(Hall.boundaryLoops.length, 2, '整网 = 原外框 + 房子洞');
  // 外环上的原顶点全部保留（R 外三角的边原样匹配）
  const used = new Set(r.fresh.flat()); for (const v of r.outer) assert.ok(used.has(v), '外环顶点 ' + v + ' 保留');
  for (const t of r.fresh) { const c = [(r.verts[t[0]][0] + r.verts[t[1]][0] + r.verts[t[2]][0]) / 3, (r.verts[t[0]][1] + r.verts[t[1]][1] + r.verts[t[2]][1]) / 3]; assert.ok(!SP.pointInPoly(c, Lshape), '新三角都在占地外'); }
  assert.throws(() => SP.spliceFootprint({ verts, tris }, [[1, 1], [3, 3], [3, 1], [1, 3]]), /self-intersects/);
  assert.throws(() => SP.spliceFootprint({ verts, tris }, [[-5, -5], [-4, -5], [-4, -4]]), /off mesh/);
  out.spliceSynthetic = { removed: r.removed.length, fresh: r.fresh.length, flips: r.flips, minAngleDeg: +r.minAngleDeg.toFixed(2) };

  for (const kind of ['quad', 'mixed']) {
    const w = new World(decorateCells(GRIDS[kind]())); generateTerrain(w, { seed: 7 });
    const shape = shapeTerrain(w, {}), at = (p, s) => shape.at(p, s);
    let home = null;
    for (const c of w.cells) { const g = w.ground(c); if (g < 2 || w.isSolid(c, g + 1) || w.river[c.id]) continue; let ok = true; const ring = new Set([c.id]);
      for (let k = 0; k < 2 && ok; k++) for (const i of [...ring]) for (const n of w.cells[i].edgeNeighbors) { if (n < 0) { ok = false; break; } const o = w.cells[n]; if (w.ground(o) !== g || w.isSolid(o, g + 1) || w.river[n]) { ok = false; break; } ring.add(n); }
      if (ok) { home = c; break; } }
    assert.ok(home, kind + ' 有平台');
    const g = w.ground(home), ctr = [home.pts.reduce((s, p) => s + at(p, g)[0], 0) / home.n, home.pts.reduce((s, p) => s + at(p, g)[1], 0) / home.n], a = 0.35;
    const poly = [[-0.8, -0.55], [0.8, -0.55], [0.8, 0.1], [0.25, 0.1], [0.25, 0.55], [-0.8, 0.55]].map(([x, z]) => [ctr[0] + x * Math.cos(a) - z * Math.sin(a), ctr[1] + x * Math.sin(a) + z * Math.cos(a)]);
    const base = mesh(w, shape); assert.equal(w.footprintSplicesC09, undefined, '默认不写');
    w.spliceFootprintsC09 = [{ poly, stories: 1 }]; const m = mesh(w, shape), info = w.footprintSplicesC09, it = info.items[0];
    assert.deepEqual(info.errors, []); assert.ok(it && it.res.fresh.length > 0 && info.emitted[0].roofTris > 0, '重网格 + 屋顶');
    const walls = poly.length * 2, expect = base.pos.length / 9 - info.skip.size + it.res.fresh.length + walls + info.emitted[0].roofTris;
    assert.equal(m.pos.length / 9, expect, '三角数 = 原 − 跳过扇形 + 新三角 + 墙 + 屋顶');
    assert.ok(Math.abs(it.res.areaR - it.res.areaNew - it.res.areaPoly) < 1e-9, '真实台地上面积守恒');
    const Hf = buildHalfEdge(SP.trisAsCells(it.res.verts, it.res.fresh)); assert.deepEqual(checkHalfEdge(Hf), [], '真实台地新三角半边一致'); assert.equal(Hf.boundaryLoops.length, 2);
    // 同层格的并本身可能有「两格只碰一个角」的夹点（顶点扇不全）；拼接后不能多出新的问题
    const e0 = new Set(checkHalfEdge(buildHalfEdge(SP.trisAsCells(it.res.source.verts, it.res.source.tris)))), e1 = checkHalfEdge(buildHalfEdge(SP.trisAsCells(it.res.verts, it.res.tris)));
    for (const e of e1) assert.ok(e0.has(e), '拼接前就有的夹点 ' + e);
    assert.ok(info.cells.size > 0 && info.cells.has(home.id), '受影响格列表（植被避让用）');
    w.spliceFootprintsC09 = null; const m3 = mesh(w, shape); assert.ok(same(base.pos, m3.pos) && same(base.edge, m3.edge), '撤掉后与原网格逐位一致'); assert.equal(w.footprintSplicesC09, undefined);
    // 越过崖边的占地被拒（errors 里），不影响其它
    w.spliceFootprintsC09 = [{ poly: poly.map(([x, z]) => [x + 40, z]) }]; mesh(w, shape); assert.equal(w.footprintSplicesC09.items.length, 0); assert.ok(w.footprintSplicesC09.errors.length === 1);
    w.spliceFootprintsC09 = null;
    out['splice-' + kind] = { removed: it.res.removed.length, fresh: it.res.fresh.length, minAngleDeg: +it.res.minAngleDeg.toFixed(2), roofTris: info.emitted[0].roofTris };
  }
}
console.log(JSON.stringify(out));
console.log('PASS c09-terrain-c');
