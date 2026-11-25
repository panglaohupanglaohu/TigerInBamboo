/**
 * meshmerge.js — 自己写 merge：把一堆小网格焊成一张，draw call 从 N 降到 1
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1401145625572425728（2021-06-05）：
 *     "Meshes in Townscaper are kept small to rely on Unity's dynamic mesh batching.
 *      This approach was not performant enough on the Switch though, so I wrote a
 *      **mesh merger** to do my own batching... **tripling the rendering speed**."
 *   2021-08-24 那条（1430224300003545091）又说 mesh exporter 是同一个合并器反过来用。
 *
 * ── 帧实测（512×512，f006 = 1.055s 那一帧）────────────────────────────────
 *   线框帧：整座镇**每个模块各自一套三角线**（盒子 6 面 + 屋顶坡面，白线 ~1px），
 *   线框只是叠加显示，底下的着色画面在合并前后**完全一样** —— 所以合并器的验收标准
 *   是"零像素差 + draw call 降低"，不是"画得更好看"。
 *   三角化方式：**每个面从面中心点扇形分三角**（同 paintblotch 的岛）。
 *   → 合并时不能按"顶点位置"粗暴去重：同一个位置在不同模块里法线/UV 不同，
 *     焊错了会把屋脊的硬边焊成圆角。键必须是 位置+法线+UV 三者量化后的元组。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **焊点键 = 位置/法线/UV 量化**。只焊位置的话，相邻两块墙共面处法线一致、
 *      焊了没事；但屋顶坡面与墙交界的同位置点法线差 90°，焊了就塌成斜角。
 *   ② **量化而非精确比较**：浮点顶点在 JS 里 1e-7 的差就分不开，用 1e4 量化
 *      （0.1mm 级）才能真的焊上，同时不会把 2mm 的东西焊一起。
 *   ③ **顺序必须稳定**：输出的三角形顺序 = 输入顺序，这样 A/B 才是纯像素比较，
 *      不会因为三角形重排导致 z-fighting 的边界像素差。
 *   ④ 原文说 Switch 上"动态合批不够快"，那是 CPU 侧每帧重建批次的开销；
 *     所以这里量的不只是 draw call，还有**每帧 CPU 时间**。
 */

export const MEASURED = {
  src: '1401145625572425728',
  claimedSpeedup: 3.0,     // 原文 "tripling the rendering speed"
  wireColor: '#ffffff',
  wireWidthPx: 1,
  fanTriangulated: true,
};

const Q = (v, q) => Math.round(v * q);

/**
 * 合并若干 { position:Float32Array|[x,y,z...], normal, uv, index } 成一份。
 * 不做 THREE 依赖 —— 引擎里可以把结果直接塞进 BufferGeometry，量测页也能用。
 *
 * opts:
 *   weld   是否焊点（默认 true）。false 时只做拼接，用来复现"没合并"的顶点数。
 *   quant  量化精度（默认 1e4）
 *   keepIndex  是否输出索引（默认 true）
 */
export function mergeGeometries(list, opts = {}) {
  const weld = opts.weld !== false;
  const quant = opts.quant ?? 1e4;

  const pos = [], nrm = [], uvs = [], idx = [];
  const map = new Map();
  let vIn = 0, tris = 0, welded = 0;

  for (const g of list) {
    const p = g.position, n = g.normal, u = g.uv, ind = g.index;
    const count = p.length / 3;
    vIn += count;
    const local = new Array(count);  // 输入顶点 → 输出顶点下标

    for (let i = 0; i < count; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const nx = n ? n[i * 3] : 0, ny = n ? n[i * 3 + 1] : 0, nz = n ? n[i * 3 + 2] : 1;
      const tu = u ? u[i * 2] : 0, tv = u ? u[i * 2 + 1] : 0;

      if (!weld) {
        local[i] = pos.length / 3;
        pos.push(x, y, z); nrm.push(nx, ny, nz); uvs.push(tu, tv);
        continue;
      }
      // ① 三件套一起进键：同位置不同法线/UV 的点必须分开
      const key = `${Q(x, quant)},${Q(y, quant)},${Q(z, quant)}|` +
                  `${Q(nx, quant)},${Q(ny, quant)},${Q(nz, quant)}|` +
                  `${Q(tu, quant)},${Q(tv, quant)}`;
      let out = map.get(key);
      if (out === undefined) {
        out = pos.length / 3;
        map.set(key, out);
        pos.push(x, y, z); nrm.push(nx, ny, nz); uvs.push(tu, tv);
      } else welded++;
      local[i] = out;
    }

    // ③ 三角形顺序照抄输入
    if (ind) {
      for (let i = 0; i < ind.length; i++) idx.push(local[ind[i]]);
      tris += ind.length / 3;
    } else {
      for (let i = 0; i < count; i++) idx.push(local[i]);
      tris += count / 3;
    }
  }

  return {
    position: new Float32Array(pos),
    normal: new Float32Array(nrm),
    uv: new Float32Array(uvs),
    index: new Uint32Array(idx),
    stats: {
      modules: list.length,
      drawsBefore: list.length,
      drawsAfter: 1,
      vertsIn: vIn,
      vertsOut: pos.length / 3,
      welded,
      weldRatio: vIn ? +(welded / vIn).toFixed(3) : 0,
      tris,
    },
  };
}

/**
 * 生成一个"一个模块一个网格"的镇子（用来复现未合并的基线）。
 * 每个模块 = 盒身 + 两个坡面（跟片子里屋子的构成一致）。
 */
export function moduleGeometry(THREE, { w = 1, h = 0.9, d = 1, roof = 0.45 } = {}) {
  const geos = [];
  const box = new THREE.BoxGeometry(w, h, d);
  box.translate(0, h / 2, 0);
  geos.push(box);
  // 双坡屋顶：两片斜四边形（每片两个三角）
  const rw = w * 0.58, rd = d * 0.55;
  for (const s of [-1, 1]) {
    const g = new THREE.BufferGeometry();
    const y0 = h, y1 = h + roof;
    const v = new Float32Array([
      -rw, y0, s * rd, rw, y0, s * rd, rw, y1, 0,
      -rw, y0, s * rd, rw, y1, 0, -rw, y1, 0,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    const nrm = new Float32Array([0, 0.7, s * 0.7, 0, 0.7, s * 0.7, 0, 0.7, s * 0.7,
      0, 0.7, s * 0.7, 0, 0.7, s * 0.7, 0, 0.7, s * 0.7]);
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geos.push(g);
  }
  // 合成一个模块的 geometry（内部仍是一个模块一份）
  const merged = mergeModule(THREE, geos);
  geos.forEach((g) => g.dispose && g.dispose());
  return merged;
}

function mergeModule(THREE, geos) {
  const list = geos.map((g) => ({
    position: g.attributes.position.array,
    normal: g.attributes.normal ? g.attributes.normal.array : null,
    uv: g.attributes.uv ? g.attributes.uv.array : null,
    index: g.index ? g.index.array : null,
  }));
  const m = mergeGeometries(list);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  return g;
}

/** 把 THREE.BufferGeometry 的合并结果包一层 */
export function toBufferGeometry(THREE, merged) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(merged.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(merged.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(merged.uv, 2));
  g.setIndex(new THREE.BufferAttribute(merged.index, 1));
  return g;
}

/** 一张网格里的 (x,z) 布局：跟片子里的"镇子"同密度，cols×rows 个模块 */
export function townLayout(cols = 30, rows = 30, spacing = 1.06) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((c * 7 + r * 13) % 11 === 0) continue;   // 留点空地，别做成满格棋盘
      out.push([(c - cols / 2) * spacing, 0, (r - rows / 2) * spacing]);
    }
  }
  return out;
}
