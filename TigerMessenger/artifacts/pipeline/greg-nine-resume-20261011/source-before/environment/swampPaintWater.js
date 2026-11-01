import * as THREE from 'three';
import {SWAMP_WATER_Y} from './moebiusSwamp.js';
// 2026-10-11 湖沼目标图（artifacts/pipeline/swamp-target-20261011/target.png）：水体与整体配色。
// 目标：透亮、饱和的青绿水（近处 #3cc7c4–#5fd6cf，深处 #1f9aa6），能看清水下根与湖底；
// 坑缘顶面赭橙/陶土；坑壁灰紫石块，克制的不规则砌缝（色块为主，少量细线，远处退出）。
// 只改颜色、透明度、顶点色和在已有着色器链后面追加一段；不替换 swampWaterMarks 的波纹注入。
// ?swampPaintWater=0 关闭（整套恢复旧色）。
export const SWAMP_PAINT_WATER = Object.freeze({
  // 第 2 轮（组长量化：水区 L 偏高、a 偏淡）：更深更饱和。opacity 保持 < .5，swampAirHaze 仍跳过水面。
  surface: '#33b8b6', surfaceOpacity: .49,
  volumeTop: '#2cb0ae', volumeDeep: '#0f7686', volumeOpacity: .22,
  floor: '#3fb0a8',                                   // 湖底青绿沙（保留原三档明暗面）
  deepWall: '#1f9aa6', shallowWall: '#38bcb6',        // 水下坑壁：被水染成青绿，越深越沉
  ripple: '#e2f7ef',                                  // 涟漪笔触：淡白青，替代旧深蓝 #2c6f80
  // 第 2 轮：坑缘顶主体是深苔绿（目标图被植物盖住），赭橙只在坑内沿约 1–1.5 单位的唇边和零星露石。
  rimMoss: '#3f6f5a', rimMossMid: '#4a785e', rimMossLight: '#557f62', rimLipWidth: 1.25,
  rimTop: '#e29a6d', rimTopShade: '#d4835c', rimTopEdge: '#c97654', // 唇边/露石：赭橙/陶土
  wall: '#8a849a', wallShade: '#6f6a85', joint: '#4f4a63', // 坑壁灰紫与砌缝墨色
});
const C = hex => new THREE.Color(hex);
const glsl = hex => C(hex).toArray().map(v => v.toFixed(6)).join(',');

// Appended after the coral weathering block (it owns coralWeatherP and cwHash).
// Stone-coloured (low-saturation) pixels are pulled to a two-tone grey-violet;
// moss and vines keep their hue. Joints are inner-frame, AA'd, sparse, and fade
// by pixel footprint so the far wall stays a quiet colour field.
function masonryChunk({exterior, underwater}) {
  const P = SWAMP_PAINT_WATER;
  return `
  {
   vec3 pwP=coralWeatherP;
   float pwL=dot(outgoingLight,vec3(.299,.587,.114));
   float pwMx=max(outgoingLight.r,max(outgoingLight.g,outgoingLight.b)),pwMn=min(outgoingLight.r,min(outgoingLight.g,outgoingLight.b));
   float pwStone=1.-smoothstep(.16,.32,(pwMx-pwMn)/max(pwMx,.001));
   vec3 pwRamp=mix(vec3(${glsl(P.wallShade)}),vec3(${glsl(P.wall)}),smoothstep(.12,.34,pwL));
   outgoingLight=mix(outgoingLight,pwRamp*(.86+.32*pwL),pwStone*.78);
   float pwA=atan(pwP.z,pwP.x),pwS=pwA*max(length(pwP.xz),1.);
   float pwYc=pwP.y+.35*sin(pwS*.21)+.2*sin(pwS*.53+1.7);
   float pwRowF=pwYc/2.3,pwRow=floor(pwRowF);
   float pwLen=2.8+1.8*cwHash(vec3(pwRow,1.3,7.1));
   float pwColF=(pwS+cwHash(vec3(pwRow,5.,2.))*9.+.25*(pwYc-pwRow*2.3))/pwLen,pwCol=floor(pwColF);
   float pwAaH=max(fwidth(pwYc),1e-4),pwAaV=max(fwidth(pwS),1e-4);
   float pwH=1.-smoothstep(.05,.05+pwAaH,min(fract(pwRowF),1.-fract(pwRowF))*2.3);
   float pwV=1.-smoothstep(.05,.05+pwAaV,min(fract(pwColF),1.-fract(pwColF))*pwLen);
   float pwKeepH=step(.3,cwHash(vec3(floor(pwS/2.1),pwRow,3.))),pwKeepV=step(.22,cwHash(vec3(pwCol,pwRow,9.)));
   float pwLod=1.-smoothstep(.10,.30,max(pwAaH,min(pwAaV,1.)));
   float pwJoint=max(pwH*pwKeepH,pwV*pwKeepV)*pwLod;
   outgoingLight*=mix(1.,.93+.12*cwHash(vec3(pwCol,pwRow,4.2)),pwStone);
   float pwZone=smoothstep(${(SWAMP_WATER_Y - .4).toFixed(2)},${(SWAMP_WATER_Y + .6).toFixed(2)},pwP.y)${exterior ? '*(1.-smoothstep(39.3,39.8,pwP.y))' : ''};
   outgoingLight=mix(outgoingLight,vec3(${glsl(P.joint)}),pwJoint*pwZone*(.18+.24*pwStone));
   ${underwater ? `float pwDeep=1.-smoothstep(${(SWAMP_WATER_Y - 13).toFixed(2)},${SWAMP_WATER_Y.toFixed(2)},pwP.y);
   float pwUnder=1.-smoothstep(${(SWAMP_WATER_Y - .2).toFixed(2)},${(SWAMP_WATER_Y + .2).toFixed(2)},pwP.y);
   outgoingLight=mix(outgoingLight,mix(vec3(${glsl(P.shallowWall)}),vec3(${glsl(P.deepWall)}),pwDeep),pwUnder*(.55+.3*pwDeep));` : ''}
  }
  #include <opaque_fragment>`;
}

function paintWallMaterial(material, options, undo) {
  if (material.userData.swampPaintWall) return false;
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    if (!shader.fragmentShader.includes('coralWeatherP') || shader.fragmentShader.includes('pwJoint')) return;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', masonryChunk(options));
  };
  material.customProgramCacheKey = () => prevKey() + '|swamp-paint-wall-1' + (options.underwater ? 'u' : '') + (options.exterior ? 'e' : '');
  material.userData.swampPaintWall = {version: 1, ...options};
  material.needsUpdate = true;
  undo.push(() => { material.onBeforeCompile = prev; material.customProgramCacheKey = prevKey; delete material.userData.swampPaintWall; material.needsUpdate = true; });
  return true;
}

// Deterministic smooth value field (shared vertices get identical colours).
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7 + 19.3) * 43758.5453; return n - Math.floor(n); };
const smooth = t => t * t * (3 - 2 * t);
function field(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz), l = (a, b, t) => a + (b - a) * t;
  return l(l(hash(ix, iz), hash(ix + 1, iz), u), l(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}

function recolor(mesh, fn, undo) {
  const old = mesh.geometry?.getAttribute('color'), pos = mesh.geometry?.getAttribute('position');
  if (!old || !pos) return 0;
  const next = old.clone(), m = mesh.matrix.clone(), p = new THREE.Vector3(), c = new THREE.Color();
  let changed = 0;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(m); c.fromBufferAttribute(old, i);
    if (fn(p, c, i)) { next.setXYZ(i, c.r, c.g, c.b); changed++; }
  }
  mesh.geometry.setAttribute('color', next);
  undo.push(() => mesh.geometry.setAttribute('color', old));
  return changed;
}

export function installSwampPaintWater({swamp, enabled = new URLSearchParams(globalThis.location?.search || '').get('swampPaintWater') !== '0'} = {}) {
  const P = SWAMP_PAINT_WATER;
  const report = {enabled, version: 2, palette: P, water: false, volume: false, floor: false, ripple: false,
    wallMaterials: 0, rimTopVertices: 0, rimSideVertices: 0, soilVertices: 0, soilOchreVertices: 0, rimLipShader: false};
  const inner = swamp?.userData?.inner || swamp;
  if (!enabled || !inner?.getObjectByName) return {report, update() {}, dispose() {}};
  if (inner.userData.swampPaintWater) return inner.userData.swampPaintWater;
  const undo = [];
  inner.updateMatrixWorld(true);

  // 1) Water surface: colour + opacity only. The ripple hook (swampWaterMarks) stays attached.
  const water = inner.getObjectByName('swamp-underground-waterline');
  if (water?.material) {
    const m = water.material, was = {color: m.color.clone(), opacity: m.opacity};
    m.color.set(P.surface); m.opacity = P.surfaceOpacity; m.transparent = true;
    undo.push(() => { m.color.copy(was.color); m.opacity = was.opacity; });
    report.water = true;
    const marks = water.userData.swampWaterMarkUniforms;
    if (marks?.uMark) { const old = marks.uMark.value.clone(); marks.uMark.value.set(P.ripple); report.ripple = true; undo.push(() => marks.uMark.value.copy(old)); }
  }

  // 2) Water body: inner-height gradient deep teal -> turquoise, thinner so the bed reads through.
  const volume = inner.getObjectByName('swamp-water-volume');
  if (volume?.material && volume.geometry?.getAttribute('color')) {
    const m = volume.material, wasOpacity = m.opacity, top = C(P.volumeTop), deep = C(P.volumeDeep);
    m.opacity = P.volumeOpacity; undo.push(() => { m.opacity = wasOpacity; });
    const toInner = new THREE.Matrix4().copy(inner.matrixWorld).invert().multiply(volume.matrixWorld);
    const old = volume.geometry.getAttribute('color'), next = old.clone(), pos = volume.geometry.getAttribute('position'), p = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(toInner);
      c.copy(deep).lerp(top, smooth(THREE.MathUtils.clamp((p.y - (SWAMP_WATER_Y - 15)) / 15, 0, 1)));
      next.setXYZ(i, c.r, c.g, c.b);
    }
    volume.geometry.setAttribute('color', next); undo.push(() => volume.geometry.setAttribute('color', old));
    report.volume = true;
  }

  // 3) Lake bed: light turquoise sand; the authored three plane values (vertex shades) remain.
  const floor = inner.getObjectByName('swamp-lake-floor');
  if (floor?.material?.color) {
    const m = floor.material, was = m.color.clone(); m.color.set(P.floor); undo.push(() => m.color.copy(was)); report.floor = true;
  }

  // 4) Wall stone: grey-violet two-tone + sparse masonry joints, appended to every coral-weathered material.
  const wall = inner.getObjectByName('swamp-sinkhole-wall');
  const seen = new Set();
  inner.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const w = m?.userData?.coralWeathering; if (!w || seen.has(m)) continue; seen.add(m);
      if (paintWallMaterial(m, {exterior: !!w.exterior, underwater: o === wall}, undo)) report.wallMaterials++;
    }
  });

  // 5) Rim crown: moss-green walking top (vertex colours), a narrow ochre lip along the pit edge and a few
  // bare ochre stones (shader, from a per-vertex distance-to-inner-edge attribute), grey-violet sides.
  const rim = inner.getObjectByName('greg-coral-rim-rock-batch');
  if (rim) {
    rim.geometry.computeBoundingBox();
    const g = rim.geometry, pos = g.getAttribute('position'), ny = g.getAttribute('normal'), topY = g.boundingBox.max.y;
    const m0 = C(P.rimMoss), m1 = C(P.rimMossMid), m2 = C(P.rimMossLight), wa = C(P.wall), wb = C(P.wallShade);
    const isTop = i => (ny ? Math.abs(ny.getY(i)) > .7 : true) && pos.getY(i) > topY - .08;
    recolor(rim, (p, c, i) => {
      if (isTop(i)) {
        const f = field(p.x * .14 + 3.1, p.z * .14 - 1.7), k = field(p.x * .37 - 7.3, p.z * .37 + 2.2);
        c.copy(m0).lerp(m1, f).lerp(m2, .45 * k);
        report.rimTopVertices++; return true;
      }
      const l = c.r * .299 + c.g * .587 + c.b * .114;
      c.copy(wb).lerp(wa, THREE.MathUtils.clamp((l - .12) / .25, 0, 1)); report.rimSideVertices++; return true;
    }, undo);
    // Distance from the pit-side edge, per triangle: the inner vertices are the ones nearest the axis.
    const lip = new Float32Array(pos.count).fill(99), v = new THREE.Vector3(), mtx = rim.matrix;
    for (let t = 0; t < pos.count; t += 3) {
      if (![0, 1, 2].every(k => isTop(t + k))) continue;
      const r = [0, 1, 2].map(k => { v.fromBufferAttribute(pos, t + k).applyMatrix4(mtx); return Math.hypot(v.x, v.z); }), min = Math.min(...r);
      for (let k = 0; k < 3; k++) lip[t + k] = r[k] - min < .5 ? 0 : r[k] - min;
    }
    g.setAttribute('swampLipDist', new THREE.BufferAttribute(lip, 1));
    undo.push(() => g.deleteAttribute('swampLipDist'));
    const mat = rim.material, prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      prev?.call(mat, shader, renderer);
      if (shader.fragmentShader.includes('swLip')) return;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float swampLipDist;\nvarying float swLip;\nvarying vec3 swLipP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nswLip=swampLipDist;swLipP=position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float swLip;\nvarying vec3 swLipP;\nfloat swLipH(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\nfloat swLipN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(swLipH(i),swLipH(i+vec2(1,0)),f.x),mix(swLipH(i+vec2(0,1)),swLipH(i+vec2(1,1)),f.x),f.y);}')
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float swW=${P.rimLipWidth.toFixed(2)}+.3*(swLipN(swLipP.xz*.45)-.5);
          float swAa=max(fwidth(swLip),.02);
          float swEdge=1.-smoothstep(swW-swAa,swW+swAa,swLip);
          float swN=swLipN(swLipP.xz*.33+vec2(5.1,-2.7));
          float swStone=smoothstep(.80,.84,swN)*step(swLip,50.);
          vec3 swOchre=mix(vec3(${glsl(P.rimTop)}),vec3(${glsl(P.rimTopShade)}),swLipN(swLipP.xz*.6));
          diffuseColor.rgb=mix(diffuseColor.rgb,swOchre,max(swEdge,swStone*.9));
        }`);
    };
    mat.customProgramCacheKey = () => prevKey() + '|swamp-paint-rim-lip-2';
    mat.needsUpdate = true; report.rimLipShader = true;
    undo.push(() => { mat.onBeforeCompile = prev; mat.customProgramCacheKey = prevKey; mat.needsUpdate = true; });
  }
  const outer = inner.getObjectByName('greg-coral-outer-cliff-rock');
  if (outer) {
    const soil = C(0xd98d86), a = C(P.rimTop), b = C(P.rimTopShade), m0 = C(P.rimMoss), m2 = C(P.rimMossLight);
    recolor(outer, (p, c) => {
      if (Math.abs(c.r - soil.r) + Math.abs(c.g - soil.g) + Math.abs(c.b - soil.b) > .02) return false;
      const f = field(p.x * .14 + 3.1, p.z * .14 - 1.7);
      // Green soil skin, ochre only where the field peaks (about a fifth of the strip).
      if (f > .68) { c.copy(a).lerp(b, field(p.x * .5, p.z * .5)); report.soilOchreVertices++; }
      else c.copy(m0).lerp(m2, f / .68);
      report.soilVertices++; return true;
    }, undo);
  }

  const handle = {report, update(t) { report.time = t; },
    dispose() { while (undo.length) undo.pop()(); delete inner.userData.swampPaintWater; report.disposed = true; }};
  inner.userData.swampPaintWater = handle;
  return handle;
}
