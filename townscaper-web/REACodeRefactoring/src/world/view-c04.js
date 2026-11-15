/**
 * view-c04.js — 第 56 批 C04（Bad North 网格 / 光照 / 地形）接进 View 的开关。全部默认关。
 * View 构造末尾一行 installC04(this)；打开方式：URL `?c04=a,b` 或 `view.c04.set(name, on)`。
 *
 *   dualcells  959752525867036672「pulsating vertex cells; a dual to the triangular grid and a suitable place to start with
 *              foliage placement」：core/vertex-dual.js gridVertexDual（共享 World 顶点对偶格，白线随时间脉动收放）挂进主场景；
 *              与 ?fx=dualflora（r55：植被落在对偶格上）一起开就是片子的两半。
 *   rayvis     798580832906739712「dirt cheap (and highly inaccurate) ray marching ... visibility when indoors」：
 *              core/vertex-openness.js 把固定步长射线开阔度烘到 WorldMesh 每个顶点，主网格换成灰度材质（黑背景、
 *              室内暗外墙亮），黄线是 SpaceVisibilityOverlay 的单点射线。World 变了自动重烘。
 *   ssao       793557992931266561 五阶段里的第 4 步「SSAO」：屏幕空间 AO（深度重建视空间位置 + 法线，半球 16 采样），
 *              乘在主画面上；ao-stages.html 的阶段选择用它补上 flat → up → voxel AO →【SSAO】→ directional 这一格。
 *   dustao     823848950553780226 尘粒 AO（badnorth/battle-c04.js）。
 *   hexslots   815236105079398400「irregular is the new hex」命令落点的不规则六边形（badnorth/battle-c04.js）。
 */
import * as THREE from 'three';
import { gridVertexDual } from '../core/vertex-dual.js';
import { bakeVertexOpenness } from '../core/vertex-openness.js';
import { BattleC04 } from '../badnorth/battle-c04.js';

export const C04_KEYS = Object.freeze(['dualcells', 'rayvis', 'ssao', 'dustao', 'hexslots']);
export function parseC04(search) {
  const p = new URLSearchParams(search || '');
  return new Set((p.get('c04') || '').split(',').map((s) => s.trim()).filter((s) => C04_KEYS.includes(s)));
}

/* ---------------- 顶点对偶格脉动 ----------------
 * world/vertex-dual-overlay.js 用"格扇三角 → vertexDual"，在真实地形 World 上遇到只有部分邻格是陆地的顶点会抛
 * disconnected vertex fan（实测 terrain 场景）。这里改用同一模块的 gridVertexDual（共享多边形网格、每格楔块各带自己的
 * 台地高度），所以跨崖的对偶格自然分在两层，不需要扇形闭合。每个楔块画两条对偶边（下一边中点 → 格心 → 上一边中点），
 * 顶点着色器按 uPulse 把它们向源顶点收放 —— 片子里白线一呼一吸的样子。 */
export function dualCellSegments(world, dual, levelHeight = .5) {
  const pos = [], origin = [];
  for (const d of dual.cells) for (const w of d.wedges) {
    const c = world.cells[w.cell], top = world.top(c);
    if (top <= 0 || world.river?.[c.id]) continue;
    const y = top * levelHeight + .03, [v, a, m, b] = w.poly;
    for (const [p, q] of [[a, m], [m, b]]) { pos.push(p.x, y, p.z, q.x, y, q.z); origin.push(v.x, y, v.z, v.x, y, v.z); }
  }
  return { pos, origin, segments: pos.length / 6 };
}
class DualCellsC04 {
  constructor(view) {
    this.view = view; this.version = -1; this.pulse = { value: 1 };
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPulse: this.pulse },
      vertexShader: 'uniform float uPulse; attribute vec3 aOrigin; void main(){ vec3 p=position; p.xz=mix(aOrigin.xz,p.xz,uPulse); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader: 'void main(){ gl_FragColor=vec4(.93,1.,.95,.92); }' }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 4; this.group = new THREE.Group(); this.group.add(this.lines); view.scene.add(this.group);
  }
  refresh() {
    const w = this.view.town; if (this.version === w.version) return;
    const dual = gridVertexDual(w.grid), s = dualCellSegments(w, dual, this.view.levelHeight), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3)); g.setAttribute('aOrigin', new THREE.Float32BufferAttribute(s.origin, 3));
    this.lines.geometry.dispose(); this.lines.geometry = g; this.version = w.version; this.stats = { dualCells: dual.cells.length, segments: s.segments };
  }
  update(t) { this.refresh(); this.pulse.value = .7 + .3 * (.5 + .5 * Math.cos(t * 3)); }
}

/* ---------------- SSAO ---------------- */
const SSAO_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes; uniform mat4 uProj; uniform mat4 uInvProj;
uniform float uRadius; uniform float uStrength; uniform float uShow; uniform vec3 uKernel[16];
varying vec2 vUv;
vec3 viewPos(vec2 uv){ float d=texture2D(tDepth,uv).x; vec4 p=uInvProj*vec4(uv*2.-1., d*2.-1., 1.); return p.xyz/p.w; }
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec4 col=texture2D(tColor,vUv); float d=texture2D(tDepth,vUv).x;
  float ao=1.;
  if(d<1.){
    vec3 P=viewPos(vUv), px=viewPos(vUv+vec2(1./uRes.x,0.)), py=viewPos(vUv+vec2(0.,1./uRes.y));
    vec3 N=normalize(cross(px-P,py-P)); if(dot(N,P)>0.) N=-N;
    float a=hash(vUv*uRes)*6.2831853; vec3 rv=vec3(cos(a),sin(a),0.);
    vec3 T=normalize(rv-N*dot(rv,N)), B=cross(N,T); mat3 TBN=mat3(T,B,N);
    float occ=0.;
    for(int i=0;i<16;i++){
      vec3 S=P+TBN*uKernel[i]*uRadius; vec4 o=uProj*vec4(S,1.); vec2 suv=o.xy/o.w*.5+.5;
      if(suv.x<0.||suv.x>1.||suv.y<0.||suv.y>1.) continue;
      float sz=viewPos(suv).z, range=smoothstep(0.,1.,uRadius/abs(P.z-sz));
      occ+=(sz>=S.z+.02?1.:0.)*range;
    }
    ao=1.-occ/16.;
  }
  float k=mix(1.,ao,uStrength);
  gl_FragColor=uShow>.5?vec4(vec3(k),1.):vec4(col.rgb*k,col.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
/** 半球核：z>0，越靠近中心越密（与 CPU 对照测试共用） */
export function ssaoKernel(n = 16, seed = 7) {
  let s = seed >>> 0; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: n }, (_, i) => { let x = r() * 2 - 1, y = r() * 2 - 1, z = r(); const l = Math.hypot(x, y, z) || 1; let k = i / n; k = .1 + .9 * k * k; return [x / l * k, y / l * k, z / l * k]; });
}
class SSAOPass {
  constructor(renderer) {
    this.renderer = renderer; const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(size.x, size.y); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.u = { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: size.clone() }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
      uRadius: { value: .45 }, uStrength: { value: 1 }, uShow: { value: 0 }, uKernel: { value: ssaoKernel().map((v) => new THREE.Vector3(...v)) } };
    const quad = new THREE.BufferGeometry(); quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }', fragmentShader: SSAO_FRAG, depthTest: false, depthWrite: false });
    this.scene = new THREE.Scene(); this.scene.add(new THREE.Mesh(quad, this.mat)); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(raw, scene, camera) {
    const r = this.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== this.u.uRes.value.x || size.y !== this.u.uRes.value.y) { this.rt.setSize(size.x, size.y); this.u.uRes.value.copy(size); }
    this.u.uProj.value.copy(camera.projectionMatrix); this.u.uInvProj.value.copy(camera.projectionMatrixInverse);
    const prev = r.getRenderTarget(); r.setRenderTarget(this.rt); r.clear(); raw(scene, camera); r.setRenderTarget(prev); raw(this.scene, this.cam);
  }
  dispose() { this.rt.depthTexture.dispose(); this.rt.dispose(); this.mat.dispose(); }
}

/* ---------------- 顶点开阔度灰度 ---------------- */
const RAYVIS_MAT = () => new THREE.ShaderMaterial({ toneMapped: false,
  vertexShader: 'attribute float aOpen; varying float vO; void main(){ vO=aOpen; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying float vO; void main(){ float g=pow(smoothstep(.18,.92,vO),1.6); gl_FragColor=vec4(vec3(g*.9+.03),1.);\n#include <colorspace_fragment>\n}',
});

export function installC04(view, { search = globalThis.location?.search ?? '' } = {}) {
  if (view.c04) return view.c04;
  const state = Object.fromEntries(C04_KEYS.map((k) => [k, false])), stats = {};
  let dual = null, battleFx = null, ssao = null, rayMat = null, savedMat = null, savedBg = null, bakedGeo = null, t = 0;
  const r = view.renderer, raw = r.render.bind(r);
  // 只接管 (主场景, 主相机, 屏幕) 那一次；其它（阴影、反射、烘焙、postExtras 内部的离屏遍）原样通过
  let busy = false;
  r.render = (scene, camera) => {
    if (!state.ssao || busy || scene !== view.scene || camera !== view.camera || r.getRenderTarget() !== null) return raw(scene, camera);
    busy = true; try { ssao ??= new SSAOPass(r); ssao.render(raw, scene, camera); } finally { busy = false; }
  };
  function bakeRayvis() {
    const g = view.worldMesh.geometry, pos = g.getAttribute('position'), nor = g.getAttribute('normal');
    if (!pos || !nor) return;
    const t0 = performance.now(), res = bakeVertexOpenness(view.town, view.index, pos.array, nor.array, { levelHeight: view.levelHeight });
    g.setAttribute('aOpen', new THREE.BufferAttribute(res.values, 1)); bakedGeo = g;
    stats.rayvis = { ...res.stats, ms: Math.round(performance.now() - t0) };
  }
  const origRender = view.render.bind(view);
  // rayvis 时藏掉共用主网格几何的描边外壳 / 水中倒影（外壳是放大的背面壳，会盖住不受光的灰度材质）
  const twins = () => { const out = []; view.scene.traverse((o) => { if (o.isMesh && o !== view.mesh && o.geometry === view.mesh.geometry) out.push(o); }); return out; };
  let hidden = [];
  view.render = (dt) => {
    if (state.rayvis) { for (const o of twins()) if (o.visible) { o.visible = false; hidden.push(o); } }
    origRender(dt); t += dt || 0;
    if (state.dualcells) dual.update(t);
    if (state.rayvis && view.mesh.geometry !== bakedGeo && view.worldMesh.geometry === view.mesh.geometry) { bakeRayvis(); view.mesh.material = rayMat; }
    if (state.dustao || state.hexslots) { battleFx.update(dt || 0, view.battle); stats.battle = battleFx.stats; }
  };
  function set(name, on) {
    if (!C04_KEYS.includes(name)) throw new RangeError('unknown c04 switch ' + name);
    on = !!on; if (state[name] === on) return on; state[name] = on;
    switch (name) {
      case 'dualcells': dual ??= new DualCellsC04(view); dual.group.visible = on; if (on) { dual.refresh(); stats.dualcells = dual.stats; } break;
      case 'rayvis':
        rayMat ??= RAYVIS_MAT();
        if (on) { savedMat = view.mesh.material; savedBg = view.scene.background; view.scene.background = new THREE.Color(0x0c0c0c); bakeRayvis(); view.mesh.material = rayMat; view.vegetation.visible = false; view.setDebug('rayvis', true); }
        else { view.mesh.material = savedMat; view.scene.background = savedBg; view.vegetation.visible = true; view.setDebug('rayvis', false); bakedGeo = null; for (const o of hidden) o.visible = true; hidden = []; }
        break;
      case 'ssao': if (!on) { ssao?.dispose(); ssao = null; } break;
      case 'dustao': battleFx ??= new BattleC04(view); battleFx.setDust(on); break;
      case 'hexslots': battleFx ??= new BattleC04(view); battleFx.setHex(on); break;
    }
    view.changed?.(); return on;
  }
  const api = { set, state, stats, keys: C04_KEYS, get battleFx() { return battleFx; }, get ssao() { return ssao; }, get dual() { return dual; }, bakeRayvis };
  view.c04 = api;
  for (const k of parseC04(search)) set(k, true);
  return api;
}
