/**
 * voxel-field.js — REACode src/lighting.js 剩余两件，接在 bake.js 的同一张分层占用上（bakeLighting({keepField:true}).field）：
 *
 * 1) 931196707236392960 "virtual voxel space … used for light baking, soft normals" /
 *    1062374549407350790 "extra smoothing to the island using my voxel normals":
 *    bakeVoxelSoftNormals —— 模糊占用的梯度当外法线，按 blend 混进几何法线（反向/凹角不混，避免翻面）。
 *    只改法线，不动顶点位置；与 MeshWriter 的按角度平均软法线是两回事（那是同位置面法线平均）。
 *
 * 2) 1168571866405097472 "reprojected to a texture at each change … blurred, and sampled in the vertex
 *    shader": packLayeredField 把各层模糊占用 + 反弹色叠成一张 RGBA 浮点纹理（层按行堆叠），
 *    LAYERED_FIELD_GLSL 是顶点着色器里的同一套双线性 + 层间线性采样；sampleLayeredTexture 是它的 JS 镜像，
 *    用来在 node 里证明 GPU 路径与 CPU bakeLighting 的取样一致（真正在 GPU 上编译/运行需浏览器验收）。
 */
export function bakeVoxelSoftNormals(mesh, field, { blend = 0.55, h = null, minDot = 0.05 } = {}) {
  if (!field?.sampleOcc) throw new RangeError('need bakeLighting({keepField:true}).field');
  if (!(blend >= 0 && blend <= 1)) throw new RangeError('blend');
  const pos = mesh.pos, nrm = mesh.nrm;
  if (!pos || !nrm || pos.length !== nrm.length) throw new RangeError('mesh {pos,nrm}');
  const step = h ?? field.res * 1.5, g = field.sampleOcc;
  let touched = 0, skippedFlip = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const gx = g(x + step, y, z) - g(x - step, y, z), gy = g(x, y + step, z) - g(x, y - step, z), gz = g(x, y, z + step) - g(x, y, z - step);
    const gl = Math.hypot(gx, gy, gz);
    if (gl < 1e-4) continue;
    const sx = -gx / gl, sy = -gy / gl, sz = -gz / gl;
    let nx = nrm[i], ny = nrm[i + 1], nz = nrm[i + 2];
    if (nx * sx + ny * sy + nz * sz <= minDot) { skippedFlip++; continue; }
    nx += (sx - nx) * blend; ny += (sy - ny) * blend; nz += (sz - nz) * blend;
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm[i] = nx / l; nrm[i + 1] = ny / l; nrm[i + 2] = nz / l;
    touched++;
  }
  return { touched, skippedFlip };
}

export function packLayeredField(field) {
  const { W, H, layers, occ, cr, cg, cb, minX, minZ, res, L } = field;
  if (!occ || !cr) throw new RangeError('need bakeLighting({keepField:true}).field');
  const size = W * H, data = new Float32Array(size * layers * 4);
  for (let k = 0; k < size * layers; k++) { data[k * 4] = occ[k]; data[k * 4 + 1] = cr[k]; data[k * 4 + 2] = cg[k]; data[k * 4 + 3] = cb[k]; }
  return { data, width: W, height: H * layers, uniforms: { origin: [minX, minZ], res, L, W, H, layers } };
}

export const LAYERED_FIELD_GLSL = /* glsl */`
uniform sampler2D uFieldTex; uniform vec2 uFieldOrigin; uniform float uFieldRes, uFieldL, uFieldW, uFieldH, uFieldLayers;
vec4 fieldTexel(float i, float j, float lv){ return texture2D(uFieldTex, vec2((i + .5) / uFieldW, (lv * uFieldH + j + .5) / (uFieldH * uFieldLayers))); }
vec4 fieldLayer(float lv, vec2 xz){
  if (lv < 1. || lv >= uFieldLayers) return vec4(0.);
  vec2 f = (xz - uFieldOrigin) / uFieldRes;
  if (f.x < 0. || f.y < 0. || f.x >= uFieldW - 1. || f.y >= uFieldH - 1.) return vec4(0.);
  vec2 i = floor(f), t = f - i;
  return mix(mix(fieldTexel(i.x, i.y, lv), fieldTexel(i.x + 1., i.y, lv), t.x), mix(fieldTexel(i.x, i.y + 1., lv), fieldTexel(i.x + 1., i.y + 1., lv), t.x), t.y);
}
vec4 sampleField(vec3 p){ float f = p.y / uFieldL + .5, l0 = floor(f); return mix(fieldLayer(l0, p.xz), fieldLayer(l0 + 1., p.xz), f - l0); }
`;

/** JS mirror of LAYERED_FIELD_GLSL sampleField (NEAREST texel fetch at centres, manual bilinear as in the shader). */
export function sampleLayeredTexture(pack, x, y, z) {
  const { data, uniforms: u } = pack, { W, H, layers } = u;
  const texel = (i, j, lv) => { const k = ((lv * H + j) * W + i) * 4; return [data[k], data[k + 1], data[k + 2], data[k + 3]]; };
  const mix = (a, b, t) => a.map((v, c) => v + (b[c] - v) * t);
  const layer = (lv) => {
    if (lv < 1 || lv >= layers) return [0, 0, 0, 0];
    const fx = (x - u.origin[0]) / u.res, fz = (z - u.origin[1]) / u.res;
    if (fx < 0 || fz < 0 || fx >= W - 1 || fz >= H - 1) return [0, 0, 0, 0];
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    return mix(mix(texel(i, j, lv), texel(i + 1, j, lv), tx), mix(texel(i, j + 1, lv), texel(i + 1, j + 1, lv), tx), tz);
  };
  const f = y / u.L + 0.5, l0 = Math.floor(f);
  return mix(layer(l0), layer(l0 + 1), f - l0);
}
