/**
 * outline-pass.js — 第 53 批（G5）迁自 REACode/engine/outline.js（屏幕空间描边：颜色 + 法线/深度两个渲染目标，
 * 全屏合成时对**线性深度**和**法线**各做一次邻域差分，深度边负责剪影、法线边负责剪影内部的折痕；
 * 1482011744843223042「pixel thin lines from contrasts in my procedural normal map」= uDepthMix 0（只用法线反差）；
 * 1017355723171344385「thicker outlines for all you 4k high ballers」= 线宽按 CSS 像素记、上传时乘 DPR。
 * 朝上的深度边带一点暖色亮边（只在低饱和的岩面上）。
 *
 * 着色器与类照搬原版（GPU 路径）；另给一份 CPU 参考实现 screenEdges() 逐像素复刻同一套判据，供 node 测试与调参。
 * 重构版现有渲染（src/world/view.js，本组不可改）仍用 world/outline.js 的反向外壳描边；这里是可选的另一条后处理路径，
 * 第 55 批：已由 src/world/view-post-extras.js 接进 View 渲染循环（`?fx=outline` / view.postExtras.set('outline',true)，默认关），
 * headless Chromium(SwiftShader WebGL2) 截图验收。
 */
import * as THREE from 'three';
import {paintedNormalMaterial} from './outline-painted-normal.js';

const compositeVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const compositeFrag = /* glsl */ `
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform vec3 uLine;
uniform float uDepthMix;   // 1 = depth+normal (only depth joins in); 0 = normals alone
uniform vec3 uGlow;       // warm HDR colour used on upward-facing edges
uniform vec3 uUpVS;       // world up, in view space
uniform float uThickness;
uniform float uStrength;
uniform vec2 uNormalThreshold;
uniform float uFade;      // 0 = never fade out, 1 = fade steeply with distance

varying vec2 vUv;

float linearDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

vec3 normalAt(vec2 uv) {
  return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);
}

void main() {
  vec2 texel = uThickness / uResolution;

  // ---- depth edges: silhouettes and hard steps -------------------------
  float c = linearDepth(vUv);
  float dz = 0.0;
  dz = max(dz, abs(linearDepth(vUv + vec2(texel.x, 0.0)) - c));
  dz = max(dz, abs(linearDepth(vUv - vec2(texel.x, 0.0)) - c));
  dz = max(dz, abs(linearDepth(vUv + vec2(0.0, texel.y)) - c));
  dz = max(dz, abs(linearDepth(vUv - vec2(0.0, texel.y)) - c));
  dz = max(dz, abs(linearDepth(vUv + texel) - c));
  dz = max(dz, abs(linearDepth(vUv - texel) - c));
  // relative to the pixel's own depth, so far geometry does not turn solid line
  float depthEdge = smoothstep(0.03, 0.13, dz / max(c, 0.001));

  // ---- normal edges: creases within one surface ------------------------
  vec3 n = normalAt(vUv);
  float nd = 0.0;
  nd = max(nd, 1.0 - dot(n, normalAt(vUv + vec2(texel.x, 0.0))));
  nd = max(nd, 1.0 - dot(n, normalAt(vUv - vec2(texel.x, 0.0))));
  nd = max(nd, 1.0 - dot(n, normalAt(vUv + vec2(0.0, texel.y))));
  nd = max(nd, 1.0 - dot(n, normalAt(vUv - vec2(0.0, texel.y))));
  float normalEdge = smoothstep(uNormalThreshold.x, uNormalThreshold.y, nd);

  // Two line sources, switchable.
  //
  // The default takes the max of depth and normal discontinuities, which is what
  // makes a silhouette against the sky and a crease inside one surface both get
  // a line.
  //
  // Source note (1482011744843223042): "I'm creating pixel thin lines from
  // contrasts in my procedural normal map." Normal contrast alone keeps the line
  // one pixel wide and ignores depth steps, so it draws creases but no halo
  // around objects that merely sit closer to the camera. uDepthMix = 0 selects
  // that behaviour.
  float depthOnly = smoothstep(0.03, 0.13, dz / max(c, 0.001));
  float edge = clamp(mix(normalEdge, max(depthOnly, normalEdge), uDepthMix), 0.0, 1.0);

  // Sampling past the frame edge returns zero depth, which paints a line along
  // the border of the window; fade the effect out in the outer two pixels.
  vec2 edgeDist = min(vUv, 1.0 - vUv) * uResolution;
  edge *= smoothstep(0.0, 2.0, min(edgeDist.x, edgeDist.y));
  edge *= mix(1.0, 0.55, clamp(c / (uFar * 0.45), 0.0, 1.0) * uFade);

  vec3 col = texture2D(tColor, vUv).xyz;

  // Upward-facing edges are not ink: in the reference they carry a warm amber
  // rim, brightest along every plateau lip. Deciding it here, from the normal
  // buffer, is why no extra geometry is needed for the glow.
  float up = dot(n, normalize(uUpVS));

  // Amber rim light belongs on rock only.
  //
  // Two things had to be excluded, and both were visible before this test:
  //   - near-white objects (birds): an orange contour instead of the thin dark
  //     line the reference draws on them;
  //   - vegetation: tree canopies and grass are up-facing too, so each one got a
  //     full amber ring — the leftover item in STUDY-INDEX line 180.
  //
  // Rock is desaturated, foliage is not, so saturation is the cheapest separator
  // available in screen space (no extra mask render target needed).
  vec3 under = texture2D(tColor, vUv).xyz;
  float bright = dot(under, vec3(0.299, 0.587, 0.114));
  float sat = max(max(under.r, under.g), under.b) - min(min(under.r, under.g), under.b);
  float rocky = 1.0 - smoothstep(0.085, 0.20, sat);
  float glowAllowed = (1.0 - smoothstep(0.72, 0.90, bright)) * rocky;
  // Only edges that actually step in depth get the glow. Creases inside one
  // surface (roof courses, wall joints) stay ink — otherwise every tile seam
  // lights up and the roof turns into an orange wireframe.
  float rim = smoothstep(0.36, 0.88, up) * smoothstep(0.55, 1.0, depthEdge) * glowAllowed;

  // keep a little of the surface in the ink, the way ink over gouache does
  vec3 line = mix(uLine, col * 0.32, 0.18);
  // Only tint the ink warm, do not replace it: at rim = 1 the whole silhouette
  // turned pure amber, which is not the reference's thin warm lip over a dark
  // line. 0.6 keeps ink in the line and lets the glow read as a highlight.
  vec3 lineColour = mix(line, uGlow, rim * 0.6);
  col = mix(col, lineColour, edge * uStrength * mix(1.0, 1.15, rim));

  gl_FragColor = vec4(col, 1.0);
  // 第 55 批：颜色目标是线性、未色调映射的；直接画到屏幕时补上与主渲染相同的色调映射
  // （渲染到另一个目标时 three 不定义 TONE_MAPPING，这一行是空操作，交给下一道合成）。
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class ScreenOutlinePass {
  constructor(renderer, {
    color = '#16242c',
    glow = '#ffb45e',
    thickness = 1.0,
    strength = 1.0,
    fade = 0.65,
  } = {}) {
    this.renderer = renderer;
    // 线宽记的是**CSS 像素**，不是设备像素（原文 1017355723171344385：
    // "给 4k 玩家做的更粗的描边"）。`uThickness / uResolution` 里的分辨率是
    // 设备像素，所以 4k / DPR2 时同一条线在屏幕上只剩一半粗 —— 肉眼就是
    // "高分辨率下描边消失"。所以真正上传的厚度 = CSS 厚度 × DPR。
    this.thickness = thickness;
    this._dpr = Math.max(1, renderer.getPixelRatio() || 1);
    this.strength = strength;
    this.fade = fade;
    this.lineColor = new THREE.Color(color).convertSRGBToLinear();

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());

    this.colorTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      // 第 55 批：线性 HDR 颜色（色调映射在合成时做），8 位会在暗部出色带
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.colorTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.colorTarget.depthTexture.type = THREE.UnsignedIntType;

    this.normalTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });

    this.uniforms = {
      tColor: { value: this.colorTarget.texture },
      tNormal: { value: this.normalTarget.texture },
      tDepth: { value: this.colorTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
      uNear: { value: 0.1 },
      uNormalThreshold: {value:new THREE.Vector2(.55,.98)},
      uFar: { value: 500 },
      uLine: { value: this.lineColor },
      uDepthMix: { value: 1.0 },
      uGlow: { value: new THREE.Color(glow).convertSRGBToLinear().multiplyScalar(1.75) },
      uUpVS: { value: new THREE.Vector3(0, 1, 0) },
      uThickness: { value: this.thickness },
      uStrength: { value: this.strength },
      uFade: { value: this.fade },
    };

    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: compositeVert,
      fragmentShader: compositeFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(quad, this.material));
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // normal material for the geometry pass; overridden material ignores lights
    this.normalMaterial = new THREE.MeshNormalMaterial({ flatShading: false });
    this.paintUniforms={uOutlinePaintMap:{value:null},uOutlinePaintScale:{value:4},uOutlinePaintStrength:{value:1}};
    this.paintedMaterial=paintedNormalMaterial(this.paintUniforms);this.paintedMesh=null;

  }

  /** Only this live source mesh receives the map; caller retains texture ownership. */
  setPaintedNormals(mesh,texture,{scale=4,strength=1,threshold=[.04,.2]}={}){
    if(mesh&&(!mesh.isMesh||!texture?.isTexture))throw new TypeError('source mesh and normal texture required');
    if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(strength)||strength<0||strength>1||!Array.isArray(threshold)||threshold.length!==2||!threshold.every(Number.isFinite)||threshold[0]<0||threshold[0]>=threshold[1]||threshold[1]>2)throw new RangeError('painted normal options');
    this.paintedMesh=mesh||null;this.paintUniforms.uOutlinePaintMap.value=texture||null;this.paintUniforms.uOutlinePaintScale.value=scale;this.paintUniforms.uOutlinePaintStrength.value=strength;
    this.uniforms.uNormalThreshold.value.set(...(mesh?threshold:[.55,.98]));
  }
  dispose(){this.colorTarget.dispose();this.normalTarget.dispose();this.normalMaterial.dispose();this.paintedMaterial.dispose();this.material.dispose();this.quadScene.children[0].geometry.dispose();}

  /** 改线宽（CSS 像素）；内部会乘当前 DPR。 */
  setThickness(v) {
    this.thickness = v;
    this.uniforms.uThickness.value = v * this._dpr;
  }

  setSize(width, height) {
    const dpr = this.renderer.getPixelRatio();
    this._dpr = Math.max(1, dpr || 1);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.colorTarget.setSize(w, h);
    this.colorTarget.depthTexture.image.width = w;
    this.colorTarget.depthTexture.image.height = h;
    this.colorTarget.depthTexture.needsUpdate = true;
    this.normalTarget.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
    // 分辨率变了要按新的 DPR 重新换算线宽，否则改窗口大小/换屏后描边粗细会跳
    this.uniforms.uThickness.value = this.thickness * this._dpr;
  }

  /** Renders `scene` with outlines. Sky/background is taken from scene.background. */
  render(scene, camera) {
    const renderer=this.renderer,prevTarget=renderer.getRenderTarget(),prevOverride=scene.overrideMaterial,hidden=[],swapped=[];
    this.uniforms.uNear.value=camera.near;this.uniforms.uFar.value=camera.far;
    this.uniforms.uUpVS.value.set(0,1,0).transformDirection(camera.matrixWorldInverse);
    try{
      renderer.setRenderTarget(this.colorTarget);renderer.clear();renderer.render(scene,camera);
      scene.traverse(o=>{if(!o.visible)return;const m=o.material,see=Array.isArray(m)?m[0]:m;if(o.userData?.overlayOnly||o.isLine||o.isPoints||o.isSprite||see?.transparent&&!see.depthWrite){o.visible=false;hidden.push(o);}});
      if(this.paintedMesh){scene.overrideMaterial=null;scene.traverse(o=>{if(!o.isMesh)return;swapped.push([o,o.material]);o.material=o===this.paintedMesh?this.paintedMaterial:this.normalMaterial;});}
      else scene.overrideMaterial=this.normalMaterial;
      renderer.setRenderTarget(this.normalTarget);renderer.clear();renderer.render(scene,camera);
      for(const [o,m]of swapped)o.material=m;swapped.length=0;
      scene.overrideMaterial=prevOverride;for(const o of hidden)o.visible=true;hidden.length=0;
      renderer.setRenderTarget(prevTarget);renderer.render(this.quadScene,this.quadCamera);
    }finally{for(const [o,m]of swapped)o.material=m;for(const o of hidden)o.visible=true;scene.overrideMaterial=prevOverride;renderer.setRenderTarget(prevTarget);}
  }

}


const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** CPU 参考：normals = Float32Array(w*h*3)（单位向量），depth = Float32Array(w*h)（线性深度）。返回每像素描边强度 0..1。
 * 与片元着色器同一套判据：深度边 smoothstep(.03,.13, Δz/z)（6 邻）、法线边 smoothstep(.55,.98, 1-n·n')（4 邻）、
 * depthMix 混合、画面外圈 2px 淡出、按距离淡出（fade）。thickness 是**设备像素**偏移（= CSS 线宽 × DPR）。 */
export function screenEdges({ normals, depth, w, h }, { depthMix = 1, thickness = 1, fade = .65, far = 500, normalThreshold = [.55,.98] } = {}) {
  if (!(w > 0 && h > 0) || normals.length !== w * h * 3 || depth.length !== w * h) throw new RangeError('buffer size');
  if(!Array.isArray(normalThreshold)||normalThreshold.length!==2||!normalThreshold.every(Number.isFinite)||normalThreshold[0]<0||normalThreshold[0]>=normalThreshold[1])throw new RangeError('normal thresholds');
  const out = new Float32Array(w * h), k = Math.max(1, Math.round(thickness));
  const D = (x, y) => depth[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const N = (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 3; return [normals[i], normals[i + 1], normals[i + 2]]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = D(x, y);
    let dz = 0; for (const [a, b] of [[k, 0], [-k, 0], [0, k], [0, -k], [k, k], [-k, -k]]) dz = Math.max(dz, Math.abs(D(x + a, y + b) - c));
    const depthEdge = smooth(.03, .13, dz / Math.max(c, .001));
    const n = N(x, y); let nd = 0;
    for (const [a, b] of [[k, 0], [-k, 0], [0, k], [0, -k]]) { const m = N(x + a, y + b); nd = Math.max(nd, 1 - (n[0] * m[0] + n[1] * m[1] + n[2] * m[2])); }
    const normalEdge = smooth(normalThreshold[0], normalThreshold[1], nd);
    let e = Math.min(1, Math.max(0, normalEdge + (Math.max(depthEdge, normalEdge) - normalEdge) * depthMix));
    e *= smooth(0, 2, Math.min(x + .5, w - x - .5, y + .5, h - y - .5));
    e *= 1 + (.55 - 1) * Math.min(1, Math.max(0, c / (far * .45))) * fade;
    out[y * w + x] = e;
  }
  return out;
}
