/**
 * floatprobe.js — 给 1664565063552847873 那句怀疑做一次实测。
 *
 * 1664565063552847873  "I'm trying out using a shader based fluid simulation. But
 *   I'm skeptical. It seems to need 32 bit float render targets, and I don't trust
 *   that those will work across platforms. Might also be a challenge to tweak,
 *   stylize, and feed back to CPU if needed."
 *
 * 片子画面（0–7s）是整片海面上的流体解算结果：岛屿周围绕着青/洋红/黄的羽流，
 * 颜色是速度/密度的调试着色，不是美术颜色 —— 也就是说他看到的是"能不能跑"，
 * 不是"好不好看"。
 *
 * 这里不去重写他的流体，只把**他的担心**变成三个可测的数：
 *   1. RGBA16F / RGBA32F 能不能当渲染目标（跨平台的第一道坎）
 *   2. 浮点纹理能不能线性过滤（半拉格朗日平流要双线性采样；不能的话只能最近邻，解会碎）
 *   3. 60 步平流之后总质量漂多少（GPU vs 同算法的 CPU 参考）
 *
 * 结论写在返回值里，页面直接显示。跑不起来的格式会如实标 false，不做兜底假装。
 */

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS_ADVECT = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 texel; uniform float dt; uniform float advect;
in vec2 uv; out vec4 outColor;
vec2 vel(vec2 p){
  // 固定涡旋场：够用来压测精度，不需要真流体
  vec2 c = p - 0.5;
  return vec2(-c.y, c.x) * 0.35;
}
void main(){
  vec2 v = uv - vel(uv) * dt * advect;
  outColor = texture(src, v);
}`;

const FS_DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D src;
in vec2 uv; out vec4 outColor;
void main(){ float v = clamp(texture(src, uv).r, 0.0, 1.0); outColor = vec4(vec3(pow(v, 0.8)), 1.0); }`;

const FS_COPY = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 texel;
in vec2 uv; out vec4 outColor;
void main(){ outColor = texture(src, uv); }`;

/** 线性过滤是否真的在插值：造 2×1（左 0，右 1），采样正中，双线性得 0.5，最近邻得 0 或 1。 */
const FS_FILTER = `#version 300 es
precision highp float;
uniform sampler2D src;
in vec2 uv; out vec4 outColor;
void main(){ outColor = texture(src, vec2(0.5, 0.5)); }`;

export function probeFloat({ canvas = null, size = 32, steps = 60 } = {}) {
  const cv = canvas || document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const gl = cv.getContext('webgl2', { antialias: false, depth: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) return { webgl2: false, note: 'no webgl2' };

  const ext = {
    colorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'),
    colorBufferHalfFloat: !!gl.getExtension('EXT_color_buffer_half_float'),
    floatLinear: !!gl.getExtension('OES_texture_float_linear'),
    floatBlend: !!gl.getExtension('EXT_float_blend'),
  };

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const advProg = program(VS, FS_ADVECT);
  const copyProg = program(VS, FS_COPY);
  const dispProg = program(VS, FS_DISPLAY);
  const filtProg = program(VS, FS_FILTER);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const makeTex = (internal, format, type, filter) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, size, size);
    return t;
  };

  const formats = [
    { name: 'RGBA16F', internal: gl.RGBA16F, type: gl.HALF_FLOAT },
    { name: 'RGBA32F', internal: gl.RGBA32F, type: gl.FLOAT },
  ].map((f) => {
    try {
      const tex = makeTex(f.internal, gl.RGBA, f.type, gl.NEAREST);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const renderable = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

      // 线性过滤探测：源纹理一格宽 2 个 texel，左边 0 右边 1，采样正中
      const probe = makeTex(f.internal, gl.RGBA, f.type, gl.LINEAR);
      const pfb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pfb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, probe, 0);
      gl.viewport(0, 0, size, size);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // 左半 0、右半 1：用一个采样在 x 方向 1/4 处画 0、3/4 处画 1 的小 shader 太绕，
      // 直接用像素上传：一列 0 一列 1，用 texelFetch 写进去。
      const one = new Float32Array(4).fill(0);
      one[0] = 1;
      const zero = new Float32Array(4);
      const half = Math.max(1, size >> 1);
      gl.bindTexture(gl.TEXTURE_2D, probe);
      // 先整体清 0，再把右半边填 1（RGBA32F 直接上传 FLOAT；RGBA16F 用 HALF_FLOAT 数组）
      if (f.type === gl.FLOAT) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, half, size, gl.RGBA, gl.FLOAT, new Float32Array(half * size * 4));
        gl.texSubImage2D(gl.TEXTURE_2D, 0, half, 0, size - half, size, gl.RGBA, gl.FLOAT, new Float32Array((size - half) * size * 4).fill(1));
      } else {
        const toHalf = (v) => {
          const f32 = new Float32Array([v]);
          const u32 = new Uint32Array(f32.buffer);
          const x = u32[0];
          const s = (x >> 16) & 0x8000;
          let e = ((x >> 23) & 0xff) - 127 + 15;
          let m = x & 0x7fffff;
          if (e <= 0) return s;
          if (e >= 31) return s | 0x7c00;
          return s | (e << 10) | (m >> 13);
        };
        const buf = new Uint16Array(half * size * 4);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, half, size, gl.RGBA, gl.HALF_FLOAT, buf);
        const buf2 = new Uint16Array((size - half) * size * 4).fill(toHalf(1));
        gl.texSubImage2D(gl.TEXTURE_2D, 0, half, 0, size - half, size, gl.RGBA, gl.HALF_FLOAT, buf2);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.useProgram(filtProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, probe);
      gl.uniform1i(gl.getUniformLocation(filtProg, 'src'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Float32Array(4);
      const canReadFloat = f.type === gl.FLOAT;
      let mid = null;
      if (canReadFloat) {
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px);
        mid = px[0];
      }
      // 画回屏幕用的纹理也顺便验证：能不能把浮点纹理画到默认帧缓冲（它自己就是一次 copy）
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(copyProg);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(copyProg, 'src'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const err = gl.getError();
      gl.deleteFramebuffer(pfb);
      gl.deleteTexture(probe);
      return {
        name: f.name,
        renderable,
        linearWorks: mid === null ? null : Math.abs(mid - 0.5) < 0.15,
        midSample: mid,
        glError: err,
      };
    } catch (e) {
      return { name: f.name, renderable: false, linearWorks: false, error: String(e.message || e) };
    }
  });

  /* ---------------- 60 步半拉格朗日平流：GPU 总质量 vs 同算法 CPU 参考 ---------------- */
  const dt = 0.02;
  const seedField = () => {
    const a = new Float32Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const d = Math.hypot(u - 0.5, v - 0.5);
        a[(y * size + x) * 4] = Math.max(0, 1 - d * 2) ** 2;
      }
    }
    return a;
  };
  const field = seedField();
  const gpu = (() => {
    const texA = makeTex(gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.LINEAR);
    const texB = makeTex(gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, field);
    const fb = gl.createFramebuffer();
    let src = texA;
    let dst = texB;
    let ok = true;
    for (let i = 0; i < steps && ok; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dst, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { ok = false; break; }
      gl.viewport(0, 0, size, size);
      gl.useProgram(advProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(gl.getUniformLocation(advProg, 'src'), 0);
      gl.uniform2f(gl.getUniformLocation(advProg, 'texel'), 1 / size, 1 / size);
      gl.uniform1f(gl.getUniformLocation(advProg, 'dt'), dt);
      gl.uniform1f(gl.getUniformLocation(advProg, 'advect'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const t = src; src = dst; dst = t;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, src, 0);
    const out = new Float32Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, out);
    // 把解算结果画到画布上（否则 ④ 那格是黑的：前面那趟 copy 用的是从没填过的 tex）
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, size, size);
    gl.useProgram(dispProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(gl.getUniformLocation(dispProg, 'src'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const mass = (a) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i]; return s; };
    let nan = 0;
    for (let i = 0; i < out.length; i++) if (!Number.isFinite(out[i])) nan++;
    return { ok, massStart: mass(field), massEnd: mass(out), nan, buf: out };
  })();

  const cpu = (() => {
    let a = field.slice();
    const bil = (arr, x, y) => {
      const x0 = Math.floor(x - 0.5);
      const y0 = Math.floor(y - 0.5);
      const fx = x - 0.5 - x0;
      const fy = y - 0.5 - y0;
      const at = (i, j) => {
        const ii = Math.max(0, Math.min(size - 1, i));
        const jj = Math.max(0, Math.min(size - 1, j));
        return arr[(jj * size + ii) * 4];
      };
      return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
    };
    for (let s = 0; s < steps; s++) {
      const b = new Float32Array(a.length);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = (x + 0.5) / size;
          const v = (y + 0.5) / size;
          const vx = -(v - 0.5) * 0.35;
          const vy = (u - 0.5) * 0.35;
          const px = (u - vx * dt) * size;
          const py = (v - vy * dt) * size;
          b[(y * size + x) * 4] = bil(a, px, py);
        }
      }
      a = b;
    }
    let mass = 0;
    for (let i = 0; i < a.length; i += 4) mass += a[i];
    return { massEnd: mass };
  })();

  const drift = (m0, m1) => (m0 > 0 ? (m1 - m0) / m0 : 0);
  const res = {
    webgl2: true,
    ext,
    formats,
    advect: {
      steps,
      dt,
      gpuMass: gpu.massEnd,
      gpuDrift: drift(gpu.massStart, gpu.massEnd),
      cpuMass: cpu.massEnd,
      cpuDrift: drift(gpu.massStart, cpu.massEnd),
      nan: gpu.nan,
      ok: gpu.ok,
    },
    verdict: [],
  };
  const f32 = formats.find((f) => f.name === 'RGBA32F');
  const f16 = formats.find((f) => f.name === 'RGBA16F');
  res.verdict.push(`RGBA32F 渲染目标：${f32 && f32.renderable ? '可写' : '不可写'}`);
  res.verdict.push(`浮点线性过滤：${ext.floatLinear ? '有扩展' : '无扩展'}${f32 && f32.linearWorks === false ? '，实测非双线性' : ''}`);
  res.verdict.push(`RGBA16F 渲染目标：${f16 && f16.renderable ? '可写' : '不可写'}`);
  res.verdict.push(`60 步后总质量漂移 GPU ${(res.advect.gpuDrift * 100).toFixed(2)}% / CPU ${(res.advect.cpuDrift * 100).toFixed(2)}%`);
  return res;
}
