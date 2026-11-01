/**
 * scene.js — renderer, camera rig, water and picking.
 *
 * The water is a shallow animated shader; picking is an analytic ray march over
 * the column heightfield (raycast-per-cell would be the same result at a much
 * higher cost, since every cube shares one merged mesh).
 */

import * as THREE from 'three';
import { Birds } from './birds.js';
import { TownMesh } from './townmesh.js';
import { buildShore, makeSkirtMaterial, makeWaveMaterial } from './shore.js';
import { buildHalfEdge, ringArrows, boundaryLines, halfEdgeReport, mixedTopologyCheck, mixedWire } from './halfedge.js';
import { traceStraightRuns, runGeometry, runThrough, runAtCell } from './trace.js';
import { MAX_HEIGHT, pointInQuad } from './town.js';

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

    this.townMesh = new TownMesh(town, grid, { levelHeight });
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0 });
    // Night: window glass glows (aGlow is baked per vertex by the mesher).
    this.nightUniform = { value: 0 };
    // 风：树冠沿着风场摆。权重 `aWind` 是烘焙时写进顶点的（根部 0 → 树冠 1），
    // 而且已经被体素场按"这棵树有多避风"缩过一次 —— 院子里的树摆得比临水的小。
    // 原文 926903893866541057 "wind vectors … can be used by all kinds of systems,
    // including shaders"。
    this.windUniform = { value: 0.10 };
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = this.nightUniform;
      shader.uniforms.uSwayTime = this.waterUniforms.uTime;
      shader.uniforms.uWind = this.windUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nattribute float aWind;\nvarying float vGlow;\nuniform float uSwayTime;\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vGlow = aGlow;
          if (aWind > 0.001) {
            // 两个不同频率的正弦叠一点相位漂移，避免整片树同步摆（看着像扇子）
            float ph = position.x * 1.7 + position.z * 1.3;
            float s1 = sin(uSwayTime * 1.6 + ph);
            float s2 = sin(uSwayTime * 0.7 + ph * 0.5 + 1.9);
            // 0.4 的常数项 = 顺着风向的**倾**，加在摆动上；没有它树只是原地抖，
            // 有它才像"一直被风吹着"。主风向取 (0.86, 0.5)（src/wind.js 的默认 u）。
            float osc = s1 * 0.75 + s2 * 0.25;
            transformed.x += (0.40 + osc) * aWind * uWind * 0.86;
            transformed.z += (0.40 + cos(uSwayTime * 1.1 + ph * 0.8) * 0.6) * aWind * uWind * 0.50;
          }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * vGlow * uNight * 1.6;');
    };
    this.mesh = new THREE.Mesh(this.townMesh.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

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
    this.reflection = new THREE.Mesh(this.townMesh.geometry, this.reflectMaterial);
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

    // 海鸥：成排停在屋脊上、只有停着有描边、会挪动、扇翅 / 滑翔绕镇飞、有倒影
    this.birds = new Birds({ scene: this.scene, town, grid, index, levelHeight, water: this.waterUniforms.uShallow });

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
    const s = 18;
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
      for (let i = 0; i < 4; i++) {
        const a = c.pts[i], b = c.pts[(i + 1) % 4];
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

    // Half-edge view (1458921394855718917 / 1584623053061099520): a chevron fan
    // drawn by walking `he.twin.next` around sampled verts. The yellow pinwheels
    // *are* the rotation order, so a wrong twin or a ring that does not close
    // shows up as a mangled fan rather than as a silent wrong number.
    this.halfEdge = buildHalfEdge(this.grid.cells);
    this.halfEdgeStats = halfEdgeReport(this.halfEdge);

    const rings = ringArrows(this.halfEdge, this.grid.verts);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rings.positions, 3));
    this.ringLines = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({
      color: 0xffd23a, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false,
    }));
    this.ringLines.renderOrder = 7;
    this.ringLines.visible = false;
    this.ringLines.frustumCulled = false;
    this.scene.add(this.ringLines);
    this.halfEdgeArrows = rings.arrows;

    // the rim: every boundary loop the half-edge walk found
    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.BufferAttribute(boundaryLines(this.halfEdge, this.grid.verts), 3));
    this.rimLines = new THREE.LineSegments(rimGeo, new THREE.LineBasicMaterial({
      color: 0x3ad9d2, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false,
    }));
    this.rimLines.renderOrder = 7;
    this.rimLines.visible = false;
    this.rimLines.frustumCulled = false;
    this.scene.add(this.rimLines);

    // Mixed tri + quad lattice (1447494168448753667): the same cell set with a
    // share of the quads cut along a diagonal. Same half-edge structure, so the
    // pinwheels above still close — the wireframe is the visual half of the
    // "one picture can hold triangles and squares" claim.
    const mixed = mixedWire(this.grid.cells, { share: 0.45, seed: 7 });
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mixed.positions, 3));
    this.mixedLines = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({
      color: 0x7ad16b, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false,
    }));
    this.mixedLines.renderOrder = 6;
    this.mixedLines.visible = false;
    this.mixedLines.frustumCulled = false;
    this.scene.add(this.mixedLines);
    this.mixedWireStats = { cells: mixed.cells, tris: mixed.tris, quads: mixed.quads, edges: mixed.edges };

    // Topologically straight runs (1384958097542819845): walk cell to cell,
    // always leaving through the edge most parallel to the one just crossed.
    // The `line` paint tool uses the same runs.
    this.trace = traceStraightRuns(this.grid, { minCos: 0.6, dirCos: 0.7, minLength: 3, limit: 240 });
    this.traceStats = this.trace.stats;
    const traceGeo = new THREE.BufferGeometry();
    traceGeo.setAttribute('position', new THREE.BufferAttribute(runGeometry(this.trace, { minLength: 4 }), 3));
    this.traceLines = new THREE.LineSegments(traceGeo, new THREE.LineBasicMaterial({
      // depth-tested on purpose: the runs are a ground read, so letting the town
      // occlude them keeps the overlay from looking like scribble on the roofs
      color: 0xff9f45, transparent: true, opacity: 0.9, depthWrite: false,
    }));
    this.traceLines.renderOrder = 6;
    this.traceLines.visible = false;
    this.traceLines.frustumCulled = false;
    this.scene.add(this.traceLines);

    // shoreline (yellow) and the pushed-out smoothed line (blue), 1849732997945110651
    const lineMat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
    this.shoreLine = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(0xffd23a));
    this.seaLine = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(0x3a6dff));
    for (const l of [this.shoreLine, this.seaLine]) { l.renderOrder = 6; l.visible = false; l.frustumCulled = false; this.scene.add(l); }

    // Virtual voxel space (931196707236392960 "my generated levels all keep a
    // virtual voxel space ... light baking, soft normals, 3D textures, collision,
    // wind"). 它不是渲染技巧，是所有管线共用的那份数据。这个视图把**原始占用**
    // 画成一格格方块：方块要是正好贴在墙上，就说明烘焙确实在采样这张栅格。
    this.voxelMesh = null;
    this.voxelViewOn = false;
  }

  /**
   * 把共享体素空间画成"一格一个方块"。
   *
   * 注意这里画的是**格 × 层**，不是烘焙用的 0.08 细栅格：0.08 的体素在这个机位
   * 只有 1 像素宽，几百个叠在一起看着像雾（第一次就是这样，截图像蒙了层灰）。
   * 参考片里的"虚拟体素空间"也是格级的：一格一个方块，正好把岛包成一层壳。
   * 细栅格是 AO 用的，格级方块才是给人看的。
   */
  #buildVoxelView() {
    const town = this.town;
    if (!town) return null;
    const L = this.townMesh.levelHeight;
    if (this.voxelMesh) {
      this.scene.remove(this.voxelMesh);
      this.voxelMesh.geometry.dispose();
      this.voxelMesh.material.dispose();
      this.voxelMesh = null;
    }
    const boxes = [];
    const stone = new THREE.Color('#8d8f95');
    const maxLv = 3;   // 只画下面三层，再高就糊住屋顶了
    for (const cell of this.grid.cells) {
      const top = town.top(cell);
      if (!top) continue;
      let e = 0;
      for (let i = 0; i < 4; i++) {
        const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
        e += Math.hypot(b.x - a.x, b.z - a.z);
      }
      // 1.14 倍：方块必须比格子**大一点**，才能从墙里探出头来。等于格子尺寸
      // 时方块整个埋在自己那格里，从外面一个都看不见（第三次踩这个坑）。
      const s = (e / 4) * 1.14;
      const c = this.townMesh.wallColor(cell);
      for (let lv = 1; lv <= Math.min(top, maxLv); lv++) {
        if (!town.isSolid(cell, lv)) continue;
        // 只画**壳**：上表面、以及有邻居缺格的那几面。全画的话几十层方块
        // 互相半透明叠加，看着像雾（第二次就是这样），壳才是"把岛包起来"。
        let shell = !town.isSolid(cell, lv + 1);
        if (!shell) {
          for (let i = 0; i < 4 && !shell; i++) {
            const nb = cell.edgeNeighbors[i] >= 0 ? this.grid.cells[cell.edgeNeighbors[i]] : null;
            if (!nb || !town.isSolid(nb, lv)) shell = true;
          }
        }
        if (!shell) continue;
        const col = lv === 1 ? stone : c;
        boxes.push([cell.cx, (lv - 0.5) * L, cell.cz, s, col.r, col.g, col.b]);
      }
    }
    if (!boxes.length) return null;
    const geo = new THREE.BoxGeometry(1, L * 1.02, 1);
    // depthTest: false —— 方块在实体里面，正常深度测试会被墙全挡住（第一次
    // 打开就是这么空的）。这是数据视图，X 光式叠在画面上才有意义。
    // wireframe：实心方块叠在一起会把城糊掉，线框才看得见"一格一格"。
    // depthWrite: false 让它不参加深度写入，画在墙上但不会遮住后面的方块边。
    const mat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.55, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < boxes.length; i++) {
      const [x, y, z, s, r, g, b] = boxes[i];
      v.set(x, y, z); sc.set(s, 1, s);
      m.compose(v, q, sc);
      mesh.setMatrixAt(i, m);
      col.setRGB(r, g, b);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = 8;
    mesh.frustumCulled = false;
    mesh.visible = this.voxelViewOn;
    this.scene.add(mesh);
    this.voxelMesh = mesh;
    const f = this.townMesh.voxelField;
    this.voxelViewStats = {
      cubes: boxes.length,
      grid: f ? `${f.W}×${f.L}×${f.H}` : '',
      solid: f ? f.voxels : 0,
      res: f ? f.res : 0,
    };
    return mesh;
  }

  /** Learning-panel switches. */
  setDebug(name, on) {
    switch (name) {
      case 'grid': this.gridLines.visible = on; break;
      case 'mixedgrid': this.mixedLines.visible = on; break;
      case 'trace':
        this.traceLines.visible = on;
        if (on && !this.traceLogged) {
          this.traceLogged = true;
          console.log('[trace]', JSON.stringify(this.traceStats));
        }
        break;
      case 'halfedge':
        this.ringLines.visible = on;
        this.rimLines.visible = on;
        if (on && !this.halfEdgeLogged) {
          this.halfEdgeLogged = true;
          this.mixedStats = mixedTopologyCheck(this.grid.cells, { share: 0.45, seed: 7 });
          console.log('[halfedge]', JSON.stringify(this.halfEdgeStats));
          console.log('[halfedge · mixed tri+quad]', JSON.stringify(this.mixedStats));
        }
        break;
      case 'shorelines': this.shoreLine.visible = on; this.seaLine.visible = on; break;
      case 'wavewire': this.waveMaterial.wireframe = on; this.skirt.visible = !on; break;
      case 'waves': this.waves.visible = on; this.skirt.visible = on; break;
      case 'reflection': this.reflection.visible = on; this.birds.reflections = on; break;
      case 'birds': this.birds.visible = on; break;
      case 'shadows': this.sun.castShadow = on; this.shadowCatcher.visible = on; break;
      case 'ao': this.townMesh.bake = on; this.townMesh.invalidate(); break;
      // 共享体素空间：画出占用栅格本身（931196707236392960）
      case 'voxels':
        this.voxelViewOn = on;
        if (on) {
          if (!this.voxelMesh) this.#buildVoxelView();
          if (this.voxelMesh) this.voxelMesh.visible = true;
        } else if (this.voxelMesh) this.voxelMesh.visible = false;
        break;
      // 多次反弹：1 = 老行为（一遍模糊色），3 = 体素间 3 跳扩散（1580846877855338497）
      case 'bounce':
        this.townMesh.bouncePasses = on ? 3 : 1;
        this.townMesh.invalidate();
        break;
      // 光线步进反弹：能走过巷子，不再限制在一格内（1580845127207387137）
      case 'raybounce':
        this.townMesh.rayBounce = on;
        this.townMesh.invalidate();
        break;
      // 软法线：占用场梯度混合几何法线，把台阶的硬明暗打散（1062374549407350790）
      case 'softnormals':
        this.townMesh.softNormals = on;
        this.townMesh.invalidate();
        break;
      // 风：树冠摆动（权重已按体素场的曝露度烘进 aWind）
      case 'wind':
        this.windUniform.value = on ? 0.10 : 0;
        break;
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

  setTown(town, grid, index) {
    this.town = town;
    this.grid = grid;
    this.index = index;
    this.townMesh.town = town;
    this.townMesh.grid = grid;
    this.townMesh.builtVersion = -1;
    this.changed();
  }

  changed() { this.dirty = true; }

  /**
   * Longest topologically straight run through a cell (1384958097542819845).
   * This is the "drag-to-paint mode" the note is describing: the run is what
   * gets painted, not the cell.
   */
  runForCell(cellId) {
    const pre = runThrough(this.trace, cellId);
    if (pre) return pre;
    // interior cells are not covered by a rim-seeded run; trace on demand and
    // cache, because a drag paints the same line many times in a row
    if (!this.cellRuns) this.cellRuns = new Map();
    let run = this.cellRuns.get(cellId);
    if (!run) {
      run = runAtCell(this.grid, cellId, { minCos: 0.6, dirCos: 0.7 });
      this.cellRuns.set(cellId, run);
    }
    return run;
  }

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
      pos.setXYZ(i, cell.pts[i].x, y, cell.pts[i].z);
    }
    pos.needsUpdate = true;
    this.hover.geometry.computeVertexNormals();
    this.hover.material.opacity = mode === 'erase' ? 0.34 : 0.26;
    this.hover.visible = true;
  }

  /** 海鸥（src/birds.js，1244892370392489989）：小镇网格重建、编辑停下来 450ms 后重新找屋脊。 */
  #scheduleBirdRefresh() {
    if (this.birdTimer) clearTimeout(this.birdTimer);
    this.birdTimer = setTimeout(() => {
      this.birdTimer = null;
      this.birds.refresh(this.townMesh.geometry);
    }, this.birdsReady ? 450 : 0);
    this.birdsReady = true;
  }

  render(dt) {
    this.waterUniforms.uTime.value += dt;
    this.birds.update(dt);
    if (this.townMesh.rebuild()) {
      this.mesh.geometry = this.townMesh.geometry;
      this.reflection.geometry = this.townMesh.geometry;
      const t0 = performance.now();
      const shore = buildShore(this.town, this.grid, this.index, { posts: this.townMesh.posts });
      this.skirt.geometry.dispose();
      this.waves.geometry.dispose();
      this.skirt.geometry = shore.skirt;
      this.shoreLine.geometry.dispose();
      this.seaLine.geometry.dispose();
      this.shoreLine.geometry = shore.shoreLine;
      this.seaLine.geometry = shore.seaLine;
      this.waves.geometry = shore.waves;
      this.townMesh.stats.shoreMs = +(performance.now() - t0).toFixed(1);
      // 体素视图开着的时候，城一变就要跟着重建（否则方块会留在旧位置）
      if (this.voxelViewOn) this.#buildVoxelView();
      // 屋顶变了：等编辑停下来再重新找屋脊（拖动时不每帧重算）
      this.#scheduleBirdRefresh();
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export { DEFAULT_LEVEL };
