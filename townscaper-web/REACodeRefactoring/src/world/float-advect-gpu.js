/**
 * float-advect-gpu.js — 第 55 批（G2）：1664565063552847873 "a shader based fluid simulation … It seems to need
 * 32 bit float render targets, and I don't trust that those will work across platforms. Might also be a challenge
 * to … feed back to CPU" —— 把 core/float-advect.js 的 CPU 仿真搬到**真 GPU**上跑一遍再对表。
 *
 * 同一个固定涡旋、同一个半拉格朗日公式（clamp-to-edge、纹素中心采样）、同一个初值 seedBlob，
 * 在 WebGL2 上用 RGBA32F / RGBA16F / RGBA8 三种渲染目标 ping-pong N 步，再 readPixels 回 CPU：
 *   · vsReference：GPU 结果 vs CPU f64 参考（这是"精度够不够"）
 *   · vsEmulated ：GPU 结果 vs CPU 按同一存储格式仿真（这是"CPU 仿真能不能代表 GPU"）
 *   · massDrift  ：总量漂移
 * 自己建一个临时 WebGL2 上下文，不碰游戏渲染器。结果只代表**当前浏览器 + GPU**（headless 下是 SwiftShader），
 * 不是跨平台矩阵。
 */
import { seedBlob, advect } from '../core/float-advect.js';

export const GPU_VARIANTS = Object.freeze([
  Object.freeze({ storage: 'f32', internal: 'RGBA32F', filter: 'linear' }),
  Object.freeze({ storage: 'f16', internal: 'RGBA16F', filter: 'linear' }),
  Object.freeze({ storage: 'u8', internal: 'RGBA8', filter: 'linear' }),
  Object.freeze({ storage: 'f32', internal: 'RGBA32F', filter: 'nearest' }),
]);

const mass = (a) => { let s = 0; for (const v of a) s += v; return s; };
function compare(out, ref) { let l1 = 0, max = 0, bad = 0; for (let i = 0; i < out.length; i++) { if (!Number.isFinite(out[i])) { bad++; continue; } const d = Math.abs(out[i] - ref[i]); l1 += d; if (d > max) max = d; } return { meanAbsError: l1 / out.length, maxAbsError: max, nonFinite: bad }; }

/** 在当前浏览器的 WebGL2 上实跑。返回 { scope, renderer, rows:[{storage, internal, filter, ok, vsReference, vsEmulated, massDrift, ms}] }。 */
export function gpuAdvectionQuality({ size = 32, steps = 60, dt = 0.02, spin = 0.35, variants = GPU_VARIANTS } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) return { webgl2: false, rows: [], scope: 'no-webgl2' };
  const ext = { colorFloat: !!gl.getExtension('EXT_color_buffer_float'), floatLinear: !!gl.getExtension('OES_texture_float_linear') };
  const res = { tex: [], fb: [], prog: [], sh: [], buf: [] };
  const sh = (type, src) => { const s = gl.createShader(type); res.sh.push(s); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram(); res.prog.push(prog);
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nlayout(location=0) in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D src; uniform float N, dt, spin; out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / N;
  vec2 vel = vec2(-(uv.y - .5) * spin, (uv.x - .5) * spin);
  o = vec4(texture(src, uv - vel * dt).r, 0., 0., 1.);
}`));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  const buf = gl.createBuffer(); res.buf.push(buf); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog); gl.uniform1i(gl.getUniformLocation(prog, 'src'), 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'N'), size); gl.uniform1f(gl.getUniformLocation(prog, 'dt'), dt); gl.uniform1f(gl.getUniformLocation(prog, 'spin'), spin);
  gl.viewport(0, 0, size, size); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
  const start = seedBlob(size), m0 = mass(start);
  const ref = advect(start, { size, steps, dt, spin, storage: 'f64', filter: 'linear' });
  const rows = [];
  for (const v of variants) {
    const row = { storage: v.storage, internal: v.internal, filter: v.filter, ok: false };
    try {
      const internal = gl[v.internal], isF = v.internal !== 'RGBA8', lin = v.filter === 'linear' ? gl.LINEAR : gl.NEAREST;
      if (isF && !ext.colorFloat) throw Error('EXT_color_buffer_float missing');
      if (v.internal === 'RGBA32F' && v.filter === 'linear' && !ext.floatLinear) throw Error('OES_texture_float_linear missing');
      const init = isF ? new Float32Array(size * size * 4) : new Uint8Array(size * size * 4);
      for (let i = 0; i < size * size; i++) { init[i * 4] = isF ? start[i] : Math.round(Math.min(1, Math.max(0, start[i])) * 255); init[i * 4 + 3] = isF ? 1 : 255; }
      const pair = [0, 1].map(() => {
        const t = gl.createTexture(); res.tex.push(t); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, lin); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, size, size, 0, gl.RGBA, isF ? gl.FLOAT : gl.UNSIGNED_BYTE, init);
        const f = gl.createFramebuffer(); res.fb.push(f); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('framebuffer incomplete');
        return { t, f };
      });
      const t0 = performance.now();
      let a = 0;
      gl.activeTexture(gl.TEXTURE0);
      for (let s = 0; s < steps; s++) { gl.bindFramebuffer(gl.FRAMEBUFFER, pair[1 - a].f); gl.bindTexture(gl.TEXTURE_2D, pair[a].t); gl.drawArrays(gl.TRIANGLES, 0, 3); a = 1 - a; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, pair[a].f);
      const out = new Float64Array(size * size);
      if (isF) { const px = new Float32Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, px); for (let i = 0; i < out.length; i++) out[i] = px[i * 4]; }
      else { const px = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px); for (let i = 0; i < out.length; i++) out[i] = px[i * 4] / 255; }
      row.ms = +(performance.now() - t0).toFixed(2);
      const err = gl.getError(); if (err) throw Error('GL error ' + err);
      const emu = advect(start, { size, steps, dt, spin, storage: v.storage, filter: v.filter });
      row.vsReference = compare(out, ref); row.vsEmulated = compare(out, emu);
      row.emulatedVsReference = compare(emu, ref);
      row.massDrift = m0 ? (mass(out) - m0) / m0 : 0; row.emulatedMassDrift = m0 ? (mass(emu) - m0) / m0 : 0;
      row.ok = true;
    } catch (e) { row.error = e.message; }
    rows.push(row);
  }
  const info = { renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) };
  for (const x of res.tex) gl.deleteTexture(x); for (const x of res.fb) gl.deleteFramebuffer(x); for (const x of res.prog) gl.deleteProgram(x); for (const x of res.sh) gl.deleteShader(x); for (const x of res.buf) gl.deleteBuffer(x);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { webgl2: true, ...info, extensions: ext, size, steps, dt, spin, referenceMassDrift: m0 ? (mass(ref) - m0) / m0 : 0, rows, scope: 'current-browser-gpu-only; not a cross-platform matrix' };
}
