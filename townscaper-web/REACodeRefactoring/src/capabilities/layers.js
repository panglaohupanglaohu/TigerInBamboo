/**
 * layers.js — 显示层能力的 three.js 实现（主线程）。
 * createLayer(name, host) → { refresh(world), update(dt), dispose() }
 * host：{ scene, world, index, levelHeight, uTime, uNight, chimneys() }
 */
import { Lighthouses } from '../build/lighthouse.js';
import { WaterVolume } from '../water/watervol.js';
import { Smoke } from '../life/smoke.js';
import * as THREE from 'three';
import { ContourOverlay } from '../world/contour-overlay.js';
import { SpaceVisibilityOverlay } from '../world/space-visibility.js';
import { top as topOf } from './ops.js';
import { BLOTCH_GLSL } from '../terrain/blotch-pattern.js';
import { SHRUB_LAYER_VERT, SHRUB_LAYER_FRAG, SHRUB_DEFAULT_STYLE } from '../terrain/shrub-texture.js';

const FACTORIES = {
  // 纯纹理灌木（1707490932017279035 / 1707497006640365880）：与世界网格共用几何的叠层，只画台地边的灌木带与小阴影
  shrubtex(host) {
    const mat = new THREE.ShaderMaterial({ vertexShader: SHRUB_LAYER_VERT, fragmentShader: BLOTCH_GLSL + SHRUB_LAYER_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uShrubStyle: { value: new THREE.Vector4(SHRUB_DEFAULT_STYLE.width, SHRUB_DEFAULT_STYLE.ragged, SHRUB_DEFAULT_STYLE.shadow, SHRUB_DEFAULT_STYLE.coverage) }, uShrubColor: { value: new THREE.Color(SHRUB_DEFAULT_STYLE.color) }, uSunDir: { value: new THREE.Vector3(-.5, .8, -.3) }, uShrubTooth: { value: SHRUB_DEFAULT_STYLE.tooth ?? 46 },
        uBlotchLevel: { value: 1 }, uBlotchStyleMode: { value: 0 }, uBlotchStyle: { value: new THREE.Vector4() } } });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); mesh.name = 'shrub-texture-layer'; mesh.renderOrder = 2; mesh.frustumCulled = false;
    host.scene.add(mesh);
    const find = () => { let g = null; host.scene.traverse((o) => { if (!g && o !== mesh && o.isMesh && o.geometry?.getAttribute?.('aEdge') && o.geometry.getAttribute('aField')) g = o; }); return g; };
    let edges = 0;
    return {
      refresh() { const src = find(); if (!src) { mesh.visible = false; edges = 0; return; } mesh.geometry = src.geometry; mesh.matrix.copy(src.matrixWorld); mesh.matrixAutoUpdate = false; mesh.visible = true; const a = src.geometry.getAttribute('aEdge').array; edges = 0; for (let i = 0; i < a.length; i++) if (a[i] < .5) edges++; },
      update() { const src = find(); if (src && mesh.geometry !== src.geometry) this.refresh(); },
      dispose: () => { host.scene.remove(mesh); mat.dispose(); },
      get count() { return edges; },
    };
  },
  lighthouse(host) {
    const l = new Lighthouses({ scene: host.scene, levelHeight: host.levelHeight, uTime: host.uTime, uNight: host.uNight });
    return { refresh: (w) => l.refresh(w), update: () => l.update(), dispose: () => { host.scene.remove(l.group); }, get count() { return l.list.length; } };
  },
  watervol(host) {
    const v = new WaterVolume({ scene: host.scene, uTime: host.uTime });
    v.visible = true;
    return { refresh: (w) => v.refresh(w, host.index), update() {}, dispose: () => { host.scene.remove(v.group); }, get count() { return v.group.children.length; } };
  },
  // 网格等值线与层区域边界（1120036868966502401）：直接用 ContourOverlay；宿主 World 没有 top() 时按体素位图取顶层
  contours(host) {
    const view = { get cells() { return host.world.cells; }, get version() { return host.world.version; }, isLand: (c) => host.world.isLand(c), top: (c) => (host.world.top ? host.world.top(c) : topOf(host.world, c.id)) };
    const o = new ContourOverlay(view, { levelHeight: host.levelHeight });
    o.mesh.name = 'grid-contour-layer'; host.scene.add(o.mesh); o.setVisible(true);
    return {
      refresh() { o.version = -1; o.refresh(); },
      update() { o.refresh(); if (host.camera) o.update(host.camera, host.viewportHeight?.(), host.viewportWidth?.()); },
      dispose: () => { host.scene.remove(o.mesh); o.dispose(); },
      get count() { return (o.regionStats || []).reduce((n, s) => n + s.segments, 0); },
    };
  },
  smoke(host) {
    const s = new Smoke({ scene: host.scene, uTime: host.uTime });
    return {
      refresh() { s.sources = (host.chimneys?.() || []).map((c) => ({ x: c.x, y: c.y + 0.05, z: c.z })); },
      update: (dt) => s.update(dt),
      dispose: () => { host.scene.remove(s.back, s.front); },
      get count() { return s.sources.length; },
    };
  },
  // 三维空间开阔度（798580832906739712）：黄色射线 + 整楼灰度场；宿主 world/index 就是库里的 World/索引，直接挂
  rayvis(host) {
    const o = new SpaceVisibilityOverlay(host.world, host.index, { levelHeight: host.levelHeight });
    host.scene.add(o.group);
    o.setVisible(true); o.setFieldVisible(true);
    return {
      refresh() { o.version = -1; o.bakedVersion = -1; o.setFieldVisible(true); o.refresh(); },
      update() { o.refresh(); },
      dispose() { host.scene.remove(o.group); o.dispose(); },
      get count() { return (o.baked?.samples.length || 0) + (o.result?.rays.length || 0); },
    };
  },
};

export function createLayer(name, host) {
  const f = FACTORIES[name];
  if (!f) throw new Error('未知显示层：' + name);
  return f(host);
}
export const LAYER_NAMES = Object.keys(FACTORIES);
