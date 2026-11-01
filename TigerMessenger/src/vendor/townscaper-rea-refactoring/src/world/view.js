/**
 * scene.js — renderer, camera rig, water and picking.
 *
 * The water is a shallow animated shader; picking is an analytic ray march over
 * the column heightfield (raycast-per-cell would be the same result at a much
 * higher cost, since every cube shares one merged mesh).
 */

import * as THREE from 'three';
import { WorldMesh } from './worldmesh.js';
import { buildShore, makeSkirtMaterial, makeWaveMaterial } from '../water/shore.js';
import { OutlineLayers } from './outline.js';
import { Birds } from '../life/birds.js';
import { Vegetation } from '../life/vegetation.js';
import { Atmosphere } from '../life/atmosphere.js';
import { Effects, popShaderChunk } from '../life/effects.js';
import { Sound } from '../life/sound.js';
import { NavLayer } from './navlayer.js';
import { Decor } from '../life/decor.js';
import { MAX_LEVEL as MAX_HEIGHT } from '../core/world.js';
import { pointInQuad } from '../core/spatial.js';

const DEFAULT_LEVEL = 0.5;

export class View {
  constructor(canvas, town, grid, index, { levelHeight = DEFAULT_LEVEL } = {}) {
    this.canvas = canvas;
    this.town = town;
    this.grid = grid;
    this.index = index;
    this.levelHeight = levelHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
    this.time = 0;

    // camera rig
    this.target = new THREE.Vector3(0, 1.2, 0);
    this.yaw = Math.PI * 0.28;
    this.pitch = 0.62;
    this.distance = 30;

    this.#setupLights();
    this.#setupWater();

    this.worldMesh = new WorldMesh(town, { levelHeight });
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0 });
    // Night: window glass glows (aGlow is baked per vertex by the mesher).
    this.nightUniform = { value: 0 };
    this.pop = popShaderChunk();          // 出现动画（1246074663546916873）
    this.snowUniform = { value: 0 };      // 积雪（943230624369868800）
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = this.nightUniform;
      shader.uniforms.uTime = this.waterUniforms.uTime;
      shader.uniforms.uSnow = this.snowUniform;
      Object.assign(shader.uniforms, this.pop.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;\nvarying float vUp;\nuniform float uTime;\n' + this.pop.pars)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;\nvUp = normalize(objectNormal).y;\n' + this.pop.body);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uSnow;\nvarying float vGlow;\nvarying float vUp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * smoothstep(0.55, 0.85, vUp));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * vGlow * uNight * 1.6;');
    };
    this.mesh = new THREE.Mesh(this.worldMesh.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    // 墨线 + 逆光亮边（1751945034851570056）
    this.outline = new OutlineLayers(this.worldMesh.geometry);
    this.scene.add(this.outline.group);

    // 海鸥（1244892370392489989）：停在屋脊上、只有停着有描边、挪动、扇翅 / 滑翔绕镇飞、有倒影
    this.birds = new Birds({ scene: this.scene, town, grid, index, levelHeight, water: this.waterUniforms.uShallow });
    // 植被管线：草丛、崖边 / 墙根灌木、树林（src/life/vegetation.js）
    this.vegetation = new Vegetation({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime });
    this.vegetation.initImpostors(this.renderer);   // 八方位 impostor + 云（启动时烘一次）
    // 环境（风场、雪、雾）、建造反馈（水花、出现动画、火）、小镇装饰（旗子、彩旗绳、蝴蝶）
    this.atmosphere = new Atmosphere({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime });
    this.effects = new Effects({ scene: this.scene, uTime: this.waterUniforms.uTime, popUniforms: this.pop.uniforms });
    this.navLayer = new NavLayer({ scene: this.scene, levelHeight });   // 简化导航图 + 楼梯
    this.sound = new Sound();   // 建造音效（WebAudio 合成：咕咚入水 / 磕石头 / 啵）
    this.decor = new Decor({ scene: this.scene, uTime: this.waterUniforms.uTime, uWind: this.atmosphere.uWind, levelHeight });

    // Reflection: the town mirrored under the water line, flattened toward a
    // colour halfway between itself and the sea (1215644531221311488: "the
    // bright colors wouldn't let me get away with a monochrome reflection, so
    // I had to figure out this somewhat abstract flat colored mid point").
    this.reflectMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: { uTime: this.waterUniforms.uTime, uWater: this.waterUniforms.uShallow, uNight: this.nightUniform },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aGlow;
        varying vec3 vCol;
        varying float vDepth;
        varying float vGlow;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vDepth = -w.y;
          w.x += sin(w.y * 9.0 + uTime * 1.3 + w.z * 0.7) * 0.018 * vDepth;
          w.z += cos(w.y * 7.0 - uTime * 1.1 + w.x * 0.5) * 0.012 * vDepth;
          vCol = color;
          vGlow = aGlow;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uWater;
        uniform float uNight;
        varying vec3 vCol;
        varying float vDepth;
        varying float vGlow;
        void main() {
          vec3 mid = mix(uWater, vCol * 1.25 + 0.04, 0.5);
          mid += vec3(1.0, 0.7, 0.3) * vGlow * uNight * 0.6;
          float fade = exp(-vDepth * 0.9);
          gl_FragColor = vec4(mid, 0.82 * fade);
          #include <colorspace_fragment>
        }`,
    });
    this.reflection = new THREE.Mesh(this.worldMesh.geometry, this.reflectMaterial);
    this.reflection.scale.y = -1;
    this.reflection.renderOrder = 1;
    this.scene.add(this.reflection);

    // Shore: static skirt (foam rim + pale halo) and the looping wave ribbons.
    this.skirtMaterial = makeSkirtMaterial(new THREE.Color('#9fd0d3'));
    this.skirt = new THREE.Mesh(new THREE.BufferGeometry(), this.skirtMaterial);
    this.skirt.renderOrder = 2;
    this.scene.add(this.skirt);
    this.waveMaterial = makeWaveMaterial();
    this.waveMaterial.uniforms.uTime = this.waterUniforms.uTime;
    this.waves = new THREE.Mesh(new THREE.BufferGeometry(), this.waveMaterial);
    this.waves.renderOrder = 3;
    this.waves.frustumCulled = false;
    this.scene.add(this.waves);

    this.#setupHover();
    this.#setupDebug();
    this.resize();
    this.updateCamera();
    this.setTimeOfDay('day');
  }

  #setupLights() {
    this.ambient = new THREE.AmbientLight(0xfffbf2, 1.05);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0xf2fbff, 0x9fb9b4, 1.25);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xfff3e2, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 22;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 5;
    this.sun = sun;
    this.sunDir = new THREE.Vector3(13, 24, 17).normalize();
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.fill = new THREE.DirectionalLight(0xd9ecf6, 0.75);
    this.fill.position.set(-16, 10, -12);
    this.scene.add(this.fill);
  }

  #setupWater() {
    // "There is no main ocean mesh!" — the sea is just the clear colour plus a
    // large flat plane that catches shadows and fades into the horizon.
    const uniforms = {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color('#5f9fa8') },
      uDeep: { value: new THREE.Color('#4f8f99') },
      uSky: { value: new THREE.Color('#78b1b8') },
    };
    this.waterUniforms = uniforms;
    this.scene.background = new THREE.Color('#6aa8b0');

    const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSky;
        varying vec3 vWorld;
        void main() {
          // barely-there drift so the flat sea is not dead (1991103578011029507:
          // "a dynamic ocean without being too distractive")
          vec2 p = vWorld.xz;
          float n = sin(p.x * 0.35 + uTime * 0.21) * sin(p.y * 0.29 - uTime * 0.17)
                  + 0.5 * sin((p.x - p.y) * 0.8 + uTime * 0.37);
          vec3 col = mix(uDeep, uShallow, 0.55 + 0.08 * n);
          float far = smoothstep(25.0, 140.0, length(vWorld.xz - cameraPosition.xz));
          col = mix(col, uSky, far);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.water = new THREE.Mesh(geo, material);
    this.water.renderOrder = -2;
    this.scene.add(this.water);

    // soft cast shadows on the water
    this.shadowCatcher = new THREE.Mesh(geo.clone(), new THREE.ShadowMaterial({ opacity: 0.2, depthWrite: false }));
    this.shadowCatcher.position.y = 0.002;
    this.shadowCatcher.receiveShadow = true;
    this.shadowCatcher.renderOrder = 4;
    this.scene.add(this.shadowCatcher);
  }

  /** 'day' | 'dusk' | 'night' — 1313840428685447170: sun gizmo + lit windows at night. */
  setTimeOfDay(mode) {
    this.timeOfDay = mode;
    const P = {
      day: { sun: [0xfff1dc, 2.7], dir: [-9, 21, 15], amb: 0.5, hemi: 0.95, fill: 0.45, night: 0, exp: 1.08, bg: '#6aa8b0', sea: ['#5f9fa8', '#4f8f99', '#78b1b8'] },
      dusk: { sun: [0xffb37a, 2.2], dir: [22, 7, 6], amb: 0.35, hemi: 0.6, fill: 0.3, night: 0.25, exp: 1.05, bg: '#c58f86', sea: ['#7b8f9e', '#5d7787', '#c79a8f'] },
      night: { sun: [0x9fb4ff, 0.45], dir: [-8, 20, 12], amb: 0.18, hemi: 0.25, fill: 0.12, night: 1, exp: 1.0, bg: '#24414f', sea: ['#2c4c5a', '#223f4c', '#2b4855'] },
    }[mode];
    this.sun.color.setHex(P.sun[0]);
    this.sun.intensity = P.sun[1];
    this.sunDir.set(...P.dir).normalize();
    this.ambient.intensity = P.amb;
    this.hemi.intensity = P.hemi;
    this.fill.intensity = P.fill;
    this.nightUniform.value = P.night;
    this.outline?.setTimeOfDay(mode);
    this.vegetation?.setTimeOfDay(mode);
    this.atmosphere?.setFogColor(P.bg);
    this.renderer.toneMappingExposure = P.exp;
    this.scene.background.set(P.bg);
    this.waterUniforms.uShallow.value.set(P.sea[0]);
    this.waterUniforms.uDeep.value.set(P.sea[1]);
    this.waterUniforms.uSky.value.set(P.sea[2]);
    this.updateCamera();
    this.onTimeOfDay?.();
  }

  /* ---------------------------------------------------- learning overlays */
  #setupDebug() {
    // the grid itself (1147881669350891521): every cell edge, once
    const seen = new Set();
    const arr = [];
    for (const c of this.grid.cells) {
      for (let i = 0; i < c.n; i++) {
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        const k = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
        if (seen.has(k)) continue;
        seen.add(k);
        arr.push(a.x, 0.015, a.z, b.x, 0.015, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    this.gridLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.gridLines.renderOrder = 5;
    this.gridLines.visible = false;
    this.scene.add(this.gridLines);

    // shoreline (yellow) and the pushed-out smoothed line (blue), 1849732997945110651
    const lineMat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
    this.shoreLine = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(0xffd23a));
    this.seaLine = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(0x3a6dff));
    for (const l of [this.shoreLine, this.seaLine]) { l.renderOrder = 6; l.visible = false; l.frustumCulled = false; this.scene.add(l); }
  }

  /** Learning-panel switches. */
  setDebug(name, on) {
    (this.debugState ??= {})[name] = on;   // 面板和管线示例都读这个，保持勾选框同步
    switch (name) {
      case 'grid': this.gridLines.visible = on; break;
      case 'shorelines': this.shoreLine.visible = on; this.seaLine.visible = on; break;
      case 'wavewire': this.waveMaterial.wireframe = on; this.skirt.visible = !on; break;
      case 'waves': this.waves.visible = on; this.skirt.visible = on; break;
      case 'reflection': this.reflection.visible = on; this.birds.reflections = on; break;
      case 'birds': this.birds.visible = on; break;
      case 'vegetation': this.vegetation.visible = on; break;
      case 'grass': case 'shrubs': case 'trees': case 'flowers': this.vegetation.setLayer(name, on); break;
      case 'leafy': this.vegetation.leafyOn = on; break;
      case 'impostor': this.vegetation.impostor = on; break;
      case 'clouds': this.vegetation.clouds = on; break;
      case 'moody': this.vegetation.moody = on; break;
      case 'wind': this.atmosphere.showArrows = on; break;
      case 'snow': this.atmosphere.showSnow = on; this.snowUniform.value = on ? 1 : 0; break;
      case 'fog': this.atmosphere.showFog = on; break;
      case 'fire': this.effects.showFire = on; break;
      case 'sound': this.sound.enabled = on; break;
      case 'nav': this.navLayer.showGraph = on; break;
      case 'modules': this.worldMesh.debugModules = on; this.worldMesh.invalidate(); break;
      case 'stairs': this.navLayer.showStairs = on; break;
      case 'flags': case 'wires': case 'butterflies': this.decor.setLayer(name, on); break;
      case 'shadows': this.sun.castShadow = on; this.shadowCatcher.visible = on; break;
      case 'ao': this.worldMesh.bake = on; this.worldMesh.invalidate(); break;
      case 'smooth': this.worldMesh.smooth = on; this.worldMesh.invalidate(); break;
      case 'outline': this.outline.inkVisible = on; this.vegetation.ink = on; break;
      case 'backlit': this.outline.rimVisible = on; break;
      case 'lightonly':
        this.material.vertexColors = !on;
        this.material.color.set(on ? 0xf2efe8 : 0xffffff);
        this.material.needsUpdate = true;
        break;
      case 'wire': this.material.wireframe = on; break;
      default: break;
    }
  }

  #setupHover() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide,
    });
    this.hover = new THREE.Mesh(geo, mat);
    this.hover.visible = false;
    this.hover.renderOrder = 3;
    this.scene.add(this.hover);
  }


  changed() { this.dirty = true; }

  /** Aim the camera at whatever is actually built, with a sane zoom. */
  frameTown() {
    const town = this.town;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
    for (const cell of town.cells) {
      const top = town.top(cell);
      if (top === 0) continue;
      if (cell.minX < minX) minX = cell.minX;
      if (cell.maxX > maxX) maxX = cell.maxX;
      if (cell.minZ < minZ) minZ = cell.minZ;
      if (cell.maxZ > maxZ) maxZ = cell.maxZ;
      if (top > maxH) maxH = top;
    }
    if (!Number.isFinite(minX)) return;
    const span = Math.max(maxX - minX, maxZ - minZ, 4);
    this.target.set((minX + maxX) / 2, Math.max(0.6, maxH * this.levelHeight * 0.45), (minZ + maxZ) / 2);
    this.distance = span * 1.62;
    this.updateCamera();
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  updateCamera() {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * cp * this.distance,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    if (this.sun) {
      this.sun.target.position.copy(this.target);
      this.sun.position.copy(this.target).addScaledVector(this.sunDir, 30);
    }
  }

  /** March the cursor ray until it hits a column; returns {cell, level} or null. */
  pick(ndcX, ndcY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const o = ray.ray.origin;
    const d = ray.ray.direction;

    // Clip the march to the town's vertical slab.
    const maxY = MAX_HEIGHT * this.levelHeight + 1.5;
    let tStart = 0;
    let tEnd = 220;
    if (Math.abs(d.y) > 1e-6) {
      const t1 = (0 - o.y) / d.y;
      const t2 = (maxY - o.y) / d.y;
      const lo = Math.min(t1, t2);
      const hi = Math.max(t1, t2);
      tStart = Math.max(tStart, Math.min(lo, hi));
      tEnd = Math.min(tEnd, Math.max(lo, hi));
    }
    if (tEnd <= tStart) return null;

    const step = Math.max(0.035, this.levelHeight * 0.14);
    const p = new THREE.Vector3();
    const inside = (x, y, z) => {
      const level = Math.min(MAX_HEIGHT, Math.max(1, Math.floor(y / this.levelHeight) + 1));
      for (const cell of this.index.at(x, z)) {
        if (!pointInQuad(cell.pts, x, z)) continue;
        if (!this.town.isSolid(cell, level)) continue;
        if (y >= 0) return { cell, level };
      }
      return null;
    };

    let prevT = tStart;
    for (let t = tStart; t <= tEnd; t += step) {
      p.copy(o).addScaledVector(d, t);
      const hit = inside(p.x, p.y, p.z);
      if (hit) {
        // Refine the entry point between prevT and t.
        let a = prevT;
        let b = t;
        for (let i = 0; i < 12; i++) {
          const m = (a + b) * 0.5;
          p.copy(o).addScaledVector(d, m);
          if (inside(p.x, p.y, p.z)) b = m;
          else a = m;
        }
        p.copy(o).addScaledVector(d, b);
        return { cell: hit.cell, level: hit.level, point: p.clone() };
      }
      prevT = t;
    }

    // Nothing above the waterline: fall back to the sea surface, so clicking open
    // water still picks the tile under the cursor (and can raise it into land).
    if (Math.abs(d.y) > 1e-6) {
      const tWater = (0 - o.y) / d.y;
      if (tWater > 0 && tWater < 220) {
        p.copy(o).addScaledVector(d, tWater);
        for (const cell of this.index.at(p.x, p.z)) {
          if (pointInQuad(cell.pts, p.x, p.z)) {
            return { cell, level: 0, point: p.clone(), water: true };
          }
        }
      }
    }
    return null;
  }

  updateHover(hit, mode) {
    if (!hit) { this.hover.visible = false; return; }
    const cell = hit.cell;
    let y;
    if (mode === 'erase') {
      const level = hit.level || this.town.top(cell);
      if (!level) { this.hover.visible = false; return; }
      y = level * this.levelHeight + 0.008;
    } else {
      const top = this.town.top(cell);
      const empty = hit.level >= 1 && !this.town.isSolid(cell, hit.level);
      const level = empty ? hit.level : Math.min(MAX_HEIGHT, top + 1);
      y = (level - 1) * this.levelHeight + 0.008;
    }
    if (y < 0.008) { this.hover.visible = false; return; }

    const pos = this.hover.geometry.getAttribute('position');
    for (let i = 0; i < 4; i++) {
      const p = cell.pts[Math.min(i, cell.n - 1)];   // 三角格：第 4 个点与第 3 个重合
      pos.setXYZ(i, p.x, y, p.z);
    }
    pos.needsUpdate = true;
    this.hover.geometry.computeVertexNormals();
    this.hover.material.opacity = mode === 'erase' ? 0.34 : 0.26;
    this.hover.visible = true;
  }

  render(dt) {
    this.waterUniforms.uTime.value += dt;
    if (this.worldMesh.rebuild()) {
      this.mesh.geometry = this.worldMesh.geometry;
      this.reflection.geometry = this.worldMesh.geometry;
      this.outline.setGeometry(this.worldMesh.geometry);
      for (const e of this.worldMesh.edits || []) { this.effects.onEdit(e.cell, e.before, e.after, this.levelHeight); this.sound.onEdit(e.cell, e.before, e.after); }
      // 屋顶变了：等编辑停下来再重新找屋脊（拖动时不每帧重算）
      clearTimeout(this.birdTimer);
      this.birdTimer = setTimeout(() => {
        this.birds.refresh(this.worldMesh.geometry);
        this.vegetation.refresh(this.town, this.worldMesh.shape, this.worldMesh.garden);
        this.atmosphere.rebuild(this.town, this.index);
        this.decor.refresh(this.town, this.index, this.birds.perches, this.vegetation.flowerSpots || []);
        this.effects.setFireSources(this.worldMesh.chimneys || []);
        this.navLayer.refresh(this.town, this.worldMesh.shape);
      }, this.birdsReady ? 450 : 0);
      this.birdsReady = true;
      const t0 = performance.now();
      // 岸浪只在陆地 / 钢柱 / 海岸形状变了时重建（盖高楼、刷颜色不用）
      if (this.worldMesh.shoreDirty) {
      const shore = buildShore(this.town, this.grid, this.index, { posts: this.worldMesh.posts, shape: this.worldMesh.shape });
      this.skirt.geometry.dispose();
      this.waves.geometry.dispose();
      this.skirt.geometry = shore.skirt;
      this.shoreLine.geometry.dispose();
      this.seaLine.geometry.dispose();
      this.shoreLine.geometry = shore.shoreLine;
      this.seaLine.geometry = shore.seaLine;
      this.waves.geometry = shore.waves;
      }
      this.worldMesh.stats.shoreMs = +(performance.now() - t0).toFixed(1);
    }
    this.birds.update(dt);
    this.atmosphere.update(dt);
    this.effects.update(dt, this.atmosphere.uWind.value);
    this.decor.update(dt);
    this.outline.update(this.renderer, this.camera, this.sunDir);
    this.renderer.render(this.scene, this.camera);
  }
}

export { DEFAULT_LEVEL };
