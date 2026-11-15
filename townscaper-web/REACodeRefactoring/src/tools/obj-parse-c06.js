/**
 * obj-parse-c06.js — 第 56 批 C06：独立的 OBJ 读取（不依赖导出端的任何数据结构），给「第三方查看器」式回看用。
 * 1430224300003545091：游戏里点 Export (Obj)，文件拖进另一个 3D 软件，看到灰白模型 + 地面网格。
 * 支持 v / vn / f（v、v/vt、v//vn、v/vt/vn，负索引，多边形扇形三角化）；忽略 vt、o、g、s、usemtl、注释。
 */
export function parseOBJ(text) {
  if (typeof text !== 'string') throw new TypeError('OBJ text required');
  const v = [], vn = [], pos = [], nor = [];
  let faces = 0, polys = 0, objects = [], line = 0, badRefs = 0;
  const ref = (s, arr) => { const k = parseInt(s, 10); if (!Number.isFinite(k) || k === 0) return -1; const i = k > 0 ? k - 1 : arr.length + k; return i >= 0 && i < arr.length ? i : -1; };
  for (const raw of text.split(/\r?\n/)) {
    line++;
    const s = raw.trim(); if (!s || s[0] === '#') continue;
    const parts = s.split(/\s+/), tag = parts[0];
    if (tag === 'v') { const p = parts.slice(1, 4).map(Number); if (!p.every(Number.isFinite)) throw new Error('bad vertex at line ' + line); v.push(p); }
    else if (tag === 'vn') { const p = parts.slice(1, 4).map(Number); if (!p.every(Number.isFinite)) throw new Error('bad normal at line ' + line); vn.push(p); }
    else if (tag === 'o' || tag === 'g') objects.push(parts.slice(1).join(' '));
    else if (tag === 'f') {
      const corners = parts.slice(1).map((c) => { const [a, , n] = c.split('/'); return { vi: ref(a, v), ni: n ? ref(n, vn) : -1 }; });
      if (corners.length < 3 || corners.some((c) => c.vi < 0)) { badRefs++; continue; }
      polys++;
      for (let k = 1; k + 1 < corners.length; k++) {
        const tri = [corners[0], corners[k], corners[k + 1]];
        const P = tri.map((c) => v[c.vi]);
        const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
        let fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...fn) || 1; fn = fn.map((x) => x / l);
        for (const c of tri) { pos.push(...v[c.vi]); nor.push(...(c.ni >= 0 ? vn[c.ni] : fn)); }
        faces++;
      }
    }
  }
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < pos.length; i += 3) for (let d = 0; d < 3; d++) { box.min[d] = Math.min(box.min[d], pos[i + d]); box.max[d] = Math.max(box.max[d], pos[i + d]); }
  return { position: new Float32Array(pos), normal: new Float32Array(nor), vertices: v.length, normals: vn.length, faces, polys, objects, badRefs, box };
}
