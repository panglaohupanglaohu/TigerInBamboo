import * as THREE from 'three';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';
// 湖沼目标图：坑壁上 3–4 道细细的白青色瀑布从坑缘落到水面，底部一小团白色水花和涟漪。
// Greg 团队·异星生态：水从森林地表渗下坑壁——克制、细、半透明，只是"有水在动"的提示，不抢巨树和鲸。
// 瀑布贴着真实坑壁表面（逐高度向外射线找岩面，再往里退 0.35），避开台阶入口（0.5±0.4 rad）和下坑步道。
// 瀑布带 + 水花环 + 水雾合并在一个网格、一个着色器里 = 1 次绘制。?swampWaterfalls=0 关闭。
const flag = k => new URLSearchParams(globalThis.location?.search || '').get(k) !== '0';
export const SWAMP_ENTRANCE_ANGLE = .5;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function makeWallSampler(inner) {
  const targets = [];
  inner.traverse(o => { if (o.isMesh && o.visible && /swamp-sinkhole-wall|natural-cliff-rock|coral-rim-rock/.test(o.name)) targets.push(o); });
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  return (a, y) => {
    o.set(0, y, 0); inner.localToWorld(o); d.set(Math.cos(a), y, Math.sin(a)); inner.localToWorld(d); d.sub(o).normalize();
    rc.set(o, d);
    const hit = rc.intersectObjects(targets, false)[0];
    if (!hit) return null;
    p.copy(hit.point); inner.worldToLocal(p); return Math.hypot(p.x, p.z);
  };
}

const VERT = /* glsl */`
attribute float aKind; attribute float aSeed;
varying vec2 vUv; varying float vKind; varying float vSeed;
void main(){ vUv=uv; vKind=aKind; vSeed=aSeed; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FRAG = /* glsl */`
uniform float uTime; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uFoam; uniform float uOpacity;
varying vec2 vUv; varying float vKind; varying float vSeed;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec3 c; float a;
  if(vKind<0.5){                       // 瀑布带：v=0 坑缘，v=1 水面
    float edge=smoothstep(0.0,0.16,vUv.x)*smoothstep(1.0,0.84,vUv.x);
    float s=n2(vec2(vUv.x*5.0+vSeed*7.0, vUv.y*9.0-uTime*2.2));
    s=smoothstep(0.35,0.8,s);
    a=edge*(0.62+0.36*s);
    c=mix(uColB,uColA,s);
    // Narrow broken core separates flowing threads from the translucent veil.
    float core=(1.-smoothstep(.045,.14,abs(vUv.x-.5-.04*sin(vUv.y*18.-uTime*1.4+vSeed))))*(.45+.55*s);
    c=mix(c,uFoam,core*.45);a=max(a,core*.94);
    float lip=1.0-smoothstep(0.0,0.07,vUv.y);       // 坑缘处一道亮唇
    float foot=smoothstep(0.86,1.0,vUv.y);          // 落水处变白
    c=mix(c,uFoam,max(lip,foot)*.72); a=max(a,edge*0.78*max(lip,foot));
  } else if(vKind<1.5){                // 水面：白水花 + 两圈向外扩散的涟漪
    float d=length(vUv*2.0-1.0);
    float foam=1.0-smoothstep(0.12,0.32+0.05*sin(uTime*3.0+vSeed*9.0),d+0.08*n2(vUv*9.0+uTime));
    float r1=fract(uTime*0.32+vSeed), r2=fract(uTime*0.32+vSeed+0.5);
    float ring=(1.0-smoothstep(0.0,0.045,abs(d-(0.26+r1*0.68))))*(1.0-r1)+(1.0-smoothstep(0.0,0.045,abs(d-(0.26+r2*0.68))))*(1.0-r2);
    float arc=atan(vUv.y-.5,vUv.x-.5);
    float gap=smoothstep(.16,.43,n2(vec2(arc*2.1+vSeed*4.,d*1.7-uTime*.17)));
    a=max(foam*0.72,ring*gap*0.62)*(1.0-smoothstep(0.92,1.0,d)); c=uFoam;
  } else {                             // 落点水雾
    vec2 q=vUv*2.0-1.0; float d=length(q*vec2(1.0,1.3));
    float n=n2(vec2(vUv.x*4.0+vSeed*3.0, vUv.y*3.0-uTime*0.9));
    a=(1.0-smoothstep(0.25,1.0,d))*(0.30+0.35*n)*0.65; c=uFoam;
  }
  gl_FragColor=vec4(c,a*uOpacity);
}`;

export function installSwampWaterfalls({swamp, enabled = flag('swampWaterfalls'), angles = [2.45, 2.95, 3.5, 3.85]} = {}) {
  const target = flag('gregTargetFalls');
  const report = {enabled, version: target ? 5 : 1, restrained: target, falls: [], skipped: [], triangles: 0, drawCalls: 0};
  const inner = swamp?.userData?.inner || swamp;
  if (!enabled || !inner?.getObjectByName?.('swamp-sinkhole-wall')) return {report, update() {}};
  (swamp.parent || swamp).updateWorldMatrix(true, true);
  const waterY = inner.userData.waterY ?? 25, rimY = inner.userData.groundY ?? 40;
  const wallR = makeWallSampler(inner);
  const route = createSwampLivingPathConstraints(inner)?.route || [];
  const pos = [], uv = [], kind = [], seed = [], idx = [];
  const quad = (a, b, c, d, k, s) => { // a,b 上边 / c,d 下边
    const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(0, 0, 1, 0, 0, 1, 1, 1);
    kind.push(k, k, k, k); seed.push(s, s, s, s); idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  };
  angles.forEach((a, fi) => {
    if (Math.abs(angDiff(a, SWAMP_ENTRANCE_ANGLE)) < .4) { report.skipped.push({angle: a, reason: 'entrance'}); return; }
    const ROWS = 16, rows = [];
    let last = null;
    for (let j = ROWS; j >= 0; j--) {            // 自下而上，坑缘以上没打中就沿用下一行
      const y = waterY + (rimY + .4 - waterY) * (j / ROWS);
      const w = target ? .48 + .30 * (1 - j / ROWS) : 1.2 + .8 * (1 - j / ROWS);
      let r = null;
      for (const da of [-1, 0, 1]) { const rr = wallR(a + da * (w * .5) / 28, Math.min(y, rimY - .3)); if (rr != null) r = r == null ? rr : Math.min(r, rr); }
      if (r == null) r = last ?? (12.5 + (y - 10) * .73);
      last = r; rows[j] = {y, w, r};
    }
    for (let pass = 0; pass < 2; pass++) for (let j = 1; j < ROWS; j++) rows[j].r = (rows[j - 1].r + rows[j].r * 2 + rows[j + 1].r) / 4;
    const base = rows[0];
    // 步道可能在瀑布下方经过：检查整条瀑布每行到步道折线点的距离
    let minRoute = Infinity;
    for (const row of rows) { const x = Math.cos(a) * (row.r - .35), z = Math.sin(a) * (row.r - .35); for (const p of route) if (Math.abs(p[1] - row.y) < 5) minRoute = Math.min(minRoute, Math.hypot(p[0] - x, p[2] - z)); }
    if (minRoute < 3.5) { report.skipped.push({angle: a, reason: 'walkway', distance: +minRoute.toFixed(2)}); return; }
    const t = [-Math.sin(a), 0, Math.cos(a)], s = fi * .173 + .11;
    for (let j = ROWS; j > 0; j--) {
      const A = rows[j], B = rows[j - 1];
      const ra = A.r - .35, rb = B.r - .35;
      const pa = [Math.cos(a) * ra, A.y, Math.sin(a) * ra], pb = [Math.cos(a) * rb, B.y, Math.sin(a) * rb];
      const i = pos.length / 3;
      pos.push(pa[0] - t[0] * A.w / 2, pa[1], pa[2] - t[2] * A.w / 2, pa[0] + t[0] * A.w / 2, pa[1], pa[2] + t[2] * A.w / 2,
        pb[0] - t[0] * B.w / 2, pb[1], pb[2] - t[2] * B.w / 2, pb[0] + t[0] * B.w / 2, pb[1], pb[2] + t[2] * B.w / 2);
      const va = 1 - j / ROWS, vb = 1 - (j - 1) / ROWS;
      uv.push(0, va, 1, va, 0, vb, 1, vb); kind.push(0, 0, 0, 0); seed.push(s, s, s, s);
      idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
    // 水花：贴水面的方片（中心往湖里挪 0.9）+ 一片竖立水雾
    const fx = Math.cos(a) * (base.r - 1.4), fz = Math.sin(a) * (base.r - 1.4), S = target ? 1.65 : 3.0, y = waterY + .05;
    quad([fx - S, y, fz - S], [fx + S, y, fz - S], [fx - S, y, fz + S], [fx + S, y, fz + S], 1, s);
    const mx = Math.cos(a) * (base.r - .7), mz = Math.sin(a) * (base.r - .7), mw = target ? .8 : 1.7, mh = target ? .85 : 1.8;
    quad([mx - t[0] * mw, y + mh, mz - t[2] * mw], [mx + t[0] * mw, y + mh, mz + t[2] * mw], [mx - t[0] * mw, y - .05, mz - t[2] * mw], [mx + t[0] * mw, y - .05, mz + t[2] * mw], 2, s);
    report.falls.push({angle: a, topY: +rows[ROWS].y.toFixed(2), bottomY: +base.y.toFixed(2), baseRadius: +base.r.toFixed(2), topRadius: +rows[ROWS].r.toFixed(2), walkwayDistance: +minRoute.toFixed(2)});
  });
  if (!report.falls.length) return {report, update() {}};
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setIndex(idx); geo.computeBoundingSphere();
  const uniforms = {uTime: {value: 0}, uOpacity: {value: target ? .58 : 1}, uColA: {value: new THREE.Color(target ? 0xc5e3dc : 0xffffff)}, uColB: {value: new THREE.Color(target ? 0x6d9d9f : 0xb4eeea)}, uFoam: {value: new THREE.Color(target ? 0xcce2d4 : 0xffffff)}};
  const mat = new THREE.ShaderMaterial({uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'swamp-wall-waterfalls'; mesh.renderOrder = 3; mesh.raycast = () => {};
  inner.add(mesh);
  report.triangles = idx.length / 3; report.drawCalls = 1;
  let disposed=false;return {report, mesh, update(t) { uniforms.uTime.value = t; },dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geo.dispose();mat.dispose();report.disposed=true;}};
}
