/**
 * blobrelax.js — Marching Cubes 球堆 → "硬边橡皮筋、其余气球" 的迭代松弛。
 *
 * 原文（x.com/OskSta/status/1580162341668237312, 2022-10-12）：
 *
 *   "I start with a very basic Marching Cubes mesh from a bunch of spheres. I mark
 *    the edges between triangles that are closest to different spheres. Then I run
 *    an iterative relax algorithm where those hard edges are like rubber bands, and
 *    the rest is sort of a like a balloon."
 *
 * 画面观察（24 帧）：
 *   · 0.15~0.3s：一堆**线框球**（白/蓝），球与球交界处有**红线** —— 那就是
 *     "closest to different spheres" 的那些边被标出来的样子；
 *   · 0.6~9.5s：红线一直在，球堆没有明显变化（这段时间在做松弛，线框不好看）；
 *   · 10.2s 起切到实体：一坨**深绿色树冠**压在崖顶上，球与球的接缝处留下浅窝，
 *     外轮廓是圆润的团块 —— 气球把整体吹圆，橡皮筋把接缝拉住，于是"窝"就在那。
 *
 * 两个力必须分开算，这是这条的全部技术点：
 *   · **橡皮筋（hard edge）**：把接缝两侧的顶点**拉近**（强的边收缩）。效果是
 *     接缝不会在松弛中被抹平，反而更"紧"，形成一道凹槽。
 *   · **气球（其余边）**：顶点朝邻居重心走 —— 这是**等边化**，它会把球面拉平，
 *     所以必须再加一项沿法线的**外推**（pressure），否则整坨会缩成一团。
 * 只用其中任何一个都不对：只有橡皮筋 → 塌成一点；只有气球 → 接缝被吹平，看不出球。
 *
 * 等值面提取用的是 **surface nets**（对偶等值面），不是经典 MC —— 原因见下面
 * `surfaceNets()` 的注释：固定对角线的 marching tetrahedra 会在相邻立方体之间留洞。
 */

// ---------- 场与网格 ----------

/** metaball 场：三个球的和超过 1 就在内部（iso=0）。 */
export function makeField(blobs) {
  return (x, y, z) => {
    let sum = 0;
    for (const b of blobs) {
      const dx = x - b.x, dy = y - b.y, dz = z - b.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      sum += (b.r * b.r) / Math.max(d2, 1e-6);
    }
    return sum - 1;
  };
}

/** 某个位置"最靠近哪个球"（用来给顶点打标签）。 */
export function nearestBlob(blobs, x, y, z) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const d = (x - b.x) ** 2 + (y - b.y) ** 2 + (z - b.z) ** 2 - b.r * b.r;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * 提取球堆等值面。
 *
 * **踩坑记录（为什么不是 marching cubes/tetrahedra）**：第一版用的是
 * "每个立方体沿 0-6 对角线切 6 个四面体"的 marching tetrahedra。拓扑上它确实
 * 生成等值面，但**相邻立方体的公共面被切的方向不一致**（固定对角线在共享面上
 * 投影出的是两条不同对角线），于是两个立方体在公共面上插出的线段不重合 →
 * 网格全是洞。实测：17,700 条边里 **7,504 条只被 1 个三角形用到**（闭合曲面
 * 应该几乎全是 2）。修法有两种：按 (i+j+k) 奇偶交替对角线（要两套 tet 表，
 * 容易写反），或者换成**对偶**做法。这里选后者。
 *
 * 所以实际用的是 **surface nets**（对偶等值面）：
 *   · 每个"有符号变化"的立方体只产生**一个**顶点，位置 = 12 条边上交点的平均；
 *   · 每条"有符号变化"的格边，连接它周围的 4 个立方体顶点成一个四边形；
 *   · 因为顶点和立方体一一对应，公共面上的连接天然共享顶点 → **闭合、无洞**。
 * 代价是四边形要自己三角化，形状比 MC 稍钝（顶点数少一半），对"树冠"这种
 * 有机形状反而更合适 —— 参考片里那坨树冠就是圆钝的。
 */
function surfaceNets(field, { min = [-2, -1, -2], size = 4, res = 22 } = {}) {
  const step = size / res;
  const n = res + 1;
  const grid = new Float32Array(n * n * n);
  const at = (i, j, k) => (k * n + j) * n + i;
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        grid[at(i, j, k)] = field(min[0] + i * step, min[1] + j * step, min[2] + k * step);
      }
    }
  }

  const verts = [];
  const tags = [];
  const cubeVert = new Map();       // "i,j,k" -> 顶点索引
  const vpos = (i, j, k) => [min[0] + i * step, min[1] + j * step, min[2] + k * step];

  // 12 条边的两个端点（按 bit0=x, bit1=y, bit2=z 的角点编号）
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  for (let k = 0; k < res; k++) {
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const v = [];
        let neg = 0;
        for (let b = 0; b < 8; b++) {
          const val = grid[at(i + (b & 1), j + ((b >> 1) & 1), k + ((b >> 2) & 1))];
          v.push(val);
          if (val <= 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;      // 全内或全外
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          const va = v[a], vb = v[b];
          if ((va > 0) === (vb > 0)) continue;
          const t = va / (va - vb);
          const pa = [i + (a & 1), j + ((a >> 1) & 1), k + ((a >> 2) & 1)];
          const pb = [i + (b & 1), j + ((b >> 1) & 1), k + ((b >> 2) & 1)];
          sx += pa[0] + (pb[0] - pa[0]) * t;
          sy += pa[1] + (pb[1] - pa[1]) * t;
          sz += pa[2] + (pb[2] - pa[2]) * t;
          cnt++;
        }
        if (!cnt) continue;
        const p = vpos(sx / cnt, sy / cnt, sz / cnt);
        cubeVert.set(i + ',' + j + ',' + k, verts.length);
        verts.push(p);
        tags.push(nearestBlob(field.blobs || [], p[0], p[1], p[2]));
      }
    }
  }

  const tris = [];
  const cid = (i, j, k) => cubeVert.get(i + ',' + j + ',' + k);

  // 每条有符号变化的格边 → 一个四边形（4 个环绕的立方体）
  const quad = (a, b, c, d, flipTest) => {
    if (a === undefined || b === undefined || c === undefined || d === undefined) return;
    const A = verts[a], B = verts[b], C = verts[c], D = verts[d];
    // 用四边形法线与场梯度比对，保证绕向朝外（比按边方向推绕向稳）
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const g = flipTest();
    const dot = nx * g[0] + ny * g[1] + nz * g[2];
    if (dot >= 0) tris.push([a, b, c], [a, c, d]);
    else tris.push([a, d, c], [a, c, b]);
  };

  // 梯度：用立方体中心附近的三点差分
  const grad = (x, y, z) => {
    const e = step * 0.5;
    return [
      field(x + e, y, z) - field(x - e, y, z),
      field(x, y + e, z) - field(x, y - e, z),
      field(x, y, z + e) - field(x, y, z - e),
    ];
  };

  for (let k = 0; k < res; k++) {
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        // x 方向的格边：(i,j,k) —— (i+1,j,k)，四个环绕立方体在 j/k 平面上
        if (i < res - 0 && j > 0 && k > 0 && i < res) {
          const a = grid[at(i, j, k)];
          const b = i + 1 < n ? grid[at(i + 1, j, k)] : a;
          if ((a > 0) !== (b > 0) && j - 1 >= 0 && k - 1 >= 0 && i < res) {
            quad(
              cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k),
              () => grad(min[0] + i * step, min[1] + (j - 0.5) * step, min[2] + (k - 0.5) * step),
            );
          }
        }
        if (j < res && i > 0 && k > 0) {
          const a = grid[at(i, j, k)];
          const b = j + 1 < n ? grid[at(i, j + 1, k)] : a;
          if ((a > 0) !== (b > 0) && i - 1 >= 0 && k - 1 >= 0) {
            quad(
              cid(i, j, k - 1), cid(i, j, k), cid(i - 1, j, k), cid(i - 1, j, k - 1),
              () => grad(min[0] + (i - 0.5) * step, min[1] + j * step, min[2] + (k - 0.5) * step),
            );
          }
        }
        if (k < res && i > 0 && j > 0) {
          const a = grid[at(i, j, k)];
          const b = k + 1 < n ? grid[at(i, j, k + 1)] : a;
          if ((a > 0) !== (b > 0) && i - 1 >= 0 && j - 1 >= 0) {
            quad(
              cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k), cid(i - 1, j - 1, k),
              () => grad(min[0] + (i - 0.5) * step, min[1] + (j - 0.5) * step, min[2] + k * step),
            );
          }
        }
      }
    }
  }

  // 硬边：两个端点"最靠近的球"不同 → 原文说的
  // "the edges between triangles that are closest to different spheres"
  const edgeSet = new Set();
  const hardEdges = [];
  for (const [a, b, cc] of tris) {
    for (const [u, v] of [[a, b], [b, cc], [cc, a]]) {
      const key = u < v ? u + '_' + v : v + '_' + u;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      if (tags[u] !== tags[v]) hardEdges.push([u, v]);
    }
  }

  return { verts, tris, tags, hardEdges, edges: [...edgeSet].map((k) => k.split('_').map(Number)) };
}

// ---------- 松弛 ----------

function buildAdjacency(edges, n) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  return adj;
}

/** 顶点法线（面法线按面积加权累加）。 */
export function computeNormals(verts, tris) {
  const nrm = verts.map(() => [0, 0, 0]);
  for (const [a, b, c] of tris) {
    const A = verts[a], B = verts[b], C = verts[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const id of [a, b, c]) { nrm[id][0] += nx; nrm[id][1] += ny; nrm[id][2] += nz; }
  }
  return nrm.map(([x, y, z]) => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  });
}

/**
 * 迭代松弛。
 *
 * @param {object} mesh marchingTets 的输出
 * @param {object} opts
 *   passes        轮数
 *   softStiff     气球项：朝邻居重心走的比例（等边化）
 *   pressure      气球项：沿法线外推的距离（不推就会缩成一团）
 *   hardStiff     橡皮筋项：硬边的两端互相拉近的比例
 *   hardSmooth    硬边顶点仍然接受一点重心平滑（0 = 完全硬，接缝会锯齿）
 */
export function relaxBlobMesh(mesh, {
  passes = 14,
  softStiff = 0.55,
  pressure = 0.012,
  hardStiff = 0.35,
  hardSmooth = 0.12,
} = {}) {
  const verts = mesh.verts.map((v) => v.slice());
  const adj = buildAdjacency(mesh.edges, verts.length);
  const hardSet = new Set(mesh.hardEdges.map(([a, b]) => (a < b ? a + '_' + b : b + '_' + a)));

  // 每个顶点的"硬邻居"（橡皮筋的另一端）
  const hardAdj = verts.map(() => []);
  for (const [a, b] of mesh.hardEdges) { hardAdj[a].push(b); hardAdj[b].push(a); }

  const before = edgeStats(verts, mesh.edges);
  const creaseBefore = creaseDepth({ verts, hardEdges: mesh.hardEdges, edges: mesh.edges });

  for (let p = 0; p < passes; p++) {
    const nrm = computeNormals(verts, mesh.tris);
    const next = verts.map((v) => v.slice());
    for (let i = 0; i < verts.length; i++) {
      const v = verts[i];
      const nb = adj[i];
      if (!nb.length) continue;
      let ax = 0, ay = 0, az = 0;
      for (const j of nb) { ax += verts[j][0]; ay += verts[j][1]; az += verts[j][2]; }
      ax /= nb.length; ay /= nb.length; az /= nb.length;

      const isHard = hardAdj[i].length > 0;
      const stiff = isHard ? hardSmooth : softStiff;

      let tx = v[0] + (ax - v[0]) * stiff;
      let ty = v[1] + (ay - v[1]) * stiff;
      let tz = v[2] + (az - v[2]) * stiff;

      if (!isHard) {
        // 气球：沿法线往外吹。没有这一项，等边化会把整坨缩成一个球
        tx += nrm[i][0] * pressure;
        ty += nrm[i][1] * pressure;
        tz += nrm[i][2] * pressure;
      } else {
        // 橡皮筋：朝"硬邻居的中点"拉。硬边因此缩短，接缝被拉成一道凹槽
        let hx = 0, hy = 0, hz = 0;
        for (const j of hardAdj[i]) { hx += verts[j][0]; hy += verts[j][1]; hz += verts[j][2]; }
        hx /= hardAdj[i].length; hy /= hardAdj[i].length; hz /= hardAdj[i].length;
        tx += (hx - v[0]) * hardStiff;
        ty += (hy - v[1]) * hardStiff;
        tz += (hz - v[2]) * hardStiff;
      }
      next[i] = [tx, ty, tz];
    }
    for (let i = 0; i < verts.length; i++) verts[i] = next[i];
  }

  return {
    verts,
    tris: mesh.tris,
    stats: {
      verts: verts.length,
      tris: mesh.tris.length,
      hardEdges: mesh.hardEdges.length,
      edgeBefore: before,
      edgeAfter: edgeStats(verts, mesh.edges),
      creaseBefore: +creaseBefore.toFixed(4),
      creaseAfter: +creaseDepth({ verts, hardEdges: mesh.hardEdges, edges: mesh.edges }).toFixed(4),
      softVerts: verts.length - new Set(mesh.hardEdges.flat()).size,
      hardVerts: new Set(mesh.hardEdges.flat()).size,
    },
  };
}

function edgeStats(verts, edges) {
  let sum = 0, min = Infinity, max = 0;
  for (const [a, b] of edges) {
    const d = Math.hypot(verts[a][0] - verts[b][0], verts[a][1] - verts[b][1], verts[a][2] - verts[b][2]);
    sum += d; min = Math.min(min, d); max = Math.max(max, d);
  }
  const mean = sum / Math.max(1, edges.length);
  let varSum = 0;
  for (const [a, b] of edges) {
    const d = Math.hypot(verts[a][0] - verts[b][0], verts[a][1] - verts[b][1], verts[a][2] - verts[b][2]);
    varSum += (d - mean) ** 2;
  }
  return {
    mean: +mean.toFixed(4),
    min: +min.toFixed(4),
    max: +max.toFixed(4),
    cv: +(Math.sqrt(varSum / Math.max(1, edges.length)) / mean).toFixed(4),   // 变异系数：越小越均匀
  };
}

/**
 * 接缝有多深：硬边顶点相对"它们的软邻居重心"的平均内陷距离。
 * 这个数就是画面里那些浅窝的可量化版本 —— 松弛前 ≈ 0（还在球面上），
 * 松弛后应该变正（被橡皮筋拉进去了）。
 */
function creaseDepth(mesh) {
  const { verts, hardEdges, edges } = mesh;
  if (!hardEdges.length) return 0;
  const adj = buildAdjacency(edges, verts.length);
  const hardVerts = new Set(hardEdges.flat());
  let sum = 0, n = 0;
  for (const i of hardVerts) {
    const nb = adj[i].filter((j) => !hardVerts.has(j));
    if (!nb.length) continue;
    let ax = 0, ay = 0, az = 0;
    for (const j of nb) { ax += verts[j][0]; ay += verts[j][1]; az += verts[j][2]; }
    ax /= nb.length; ay /= nb.length; az /= nb.length;
    // 内陷 = 硬顶点比软邻居更靠里（朝团块中心）多少
    const cx = 0, cy = 0.55, cz = 0;
    const toCentre = [cx - verts[i][0], cy - verts[i][1], cz - verts[i][2]];
    const tl = Math.hypot(...toCentre) || 1;
    const inward = ((ax - verts[i][0]) * toCentre[0] + (ay - verts[i][1]) * toCentre[1] + (az - verts[i][2]) * toCentre[2]) / tl;
    sum += -inward;
    n++;
  }
  return n ? sum / n : 0;
}

/** 一整套：球堆 → 网格 → 松弛。 */
export function buildBlobCanopy({
  seed = 1,
  blobs = null,
  res = 22,
  size = 4,
  min = [-2, -1.05, -2],
  relax = true,
  relaxOpts = {},
} = {}) {
  let s = seed * 22695477 + 1;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const list = blobs || (() => {
    const out = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 0.42 + rnd() * 0.26;
      out.push({
        x: Math.cos(a) * (0.75 + rnd() * 0.35),
        y: 0.55 + rnd() * 0.5,
        z: Math.sin(a) * (0.75 + rnd() * 0.35),
        r,
      });
    }
    out.push({ x: 0, y: 0.75, z: 0, r: 0.62 });
    return out;
  })();

  const field = makeField(list);
  field.blobs = list;
  const mesh = surfaceNets(field, { min, size, res });
  if (!relax) return { mesh, raw: mesh, stats: { ...relaxBlobMesh(mesh, { passes: 0, ...relaxOpts }).stats, relaxed: false }, blobs: list };
  const out = relaxBlobMesh(mesh, relaxOpts);
  return { mesh: { verts: out.verts, tris: out.tris, hardEdges: mesh.hardEdges, edges: mesh.edges, tags: mesh.tags }, raw: mesh, stats: { ...out.stats, relaxed: true }, blobs: list };
}
