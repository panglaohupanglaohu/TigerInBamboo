/**
 * scene.js — renderer, camera rig, water and picking.
 *
 * The water is a shallow animated shader; picking is an analytic ray march over
 * the column heightfield (raycast-per-cell would be the same result at a much
 * higher cost, since every cube shares one merged mesh).
 */

import * as THREE from 'three';
import {NORMAL_CONTRAST_GLSL} from '../core/normal-contrast.js';
import {cameraAngularSpeed,smearHistoryWeight} from '../core/camera-motion.js';
import {makePalettePatch,PALETTE_PATCH_GLSL} from '../core/palette-patch.js';
import {makeColorVolume,COLOR_VOLUME_GLSL} from '../core/color-volume.js';
import {GroundSurfaceShadow, SURFACE_SHADOW_GLSL} from '../light/surface-shadow.js';
import {SEDIMENT_GLSL} from '../core/sediment.js';
import { BLOTCH_GLSL } from '../terrain/blotch-pattern.js';
import { FIELD_GLSL } from '../terrain/field-pattern.js';
import { PenumbraLayer } from './penumbra-layer.js';
import { DoodleOverlay } from './doodle-overlay.js';
import { VisibilityOverlay } from './visibility.js';
import { ContourOverlay } from './contour-overlay.js';
import { WorldMesh } from './worldmesh.js';
import { makeReflectionMaterial, setReflectionStyle } from '../water/reflection.js';
import { buildShore, makeSkirtMaterial, makeWaveMaterial } from '../water/shore.js';
import { OutlineLayers } from './outline.js';
import { Birds } from '../life/birds.js';
import { Vegetation } from '../life/vegetation.js';
import { Atmosphere } from '../life/atmosphere.js';
import { Effects, popShaderChunk } from '../life/effects.js';
import { Sound } from '../life/sound.js';
import { NavLayer } from './navlayer.js';
import { Waterfalls } from '../water/waterfall.js';
import { WaterVolume } from '../water/watervol.js';
import { Lighthouses } from '../build/lighthouse.js';
import { Boats } from '../life/boats.js';
import { Smoke } from '../life/smoke.js';
import { bakeLightVolume } from '../light/lightvolume.js';
import { Decor } from '../life/decor.js';
import { MAX_LEVEL as MAX_HEIGHT } from '../core/world.js';
import { pointInQuad } from '../core/spatial.js';

const DEFAULT_LEVEL = 0.5;

/**
 * 地面笔触（1480635131614355459 "these big paint blotches. They hide the polys well"；1703750394164199473 "the swirly blobbyness"；
 * 1696864977171189980 "draw with much bigger blotches without the blotches bleeding across"）：
 * 世界坐标的域扭曲噪声量化成三档明暗，只画在明确标记的地形顶面草色上，排除屋顶/河床/岩壁；每层高度按实际levelHeight换偏移。
 * 本地近似，不等于原版距离场、atlas及受控跨崖采样管线；草边几何另由terrainmesh保留。
 * 贴图实验室（textures.html「地面笔触」）里有平面版和另外两种风格。
 */


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
    this.normMix = { value: 0.8 };        // 平滑 / 硬法线混合（929417420921556993）：1 = 全平滑，0 = 全硬
    this.voxOn = { value: 0 };            // 逐顶点体素阴影（1190191289922465793）
    this.giOn = { value: 0 };             // 光体积 GI（1580835075629133825 等）
    this.fieldOn = { value: 0 };
    this.mountainMode = {value:0}; // 0 existing, 1 base colour, 2 local vertex bake, 3 runtime normal
    this.normalContrast = {value:new THREE.Vector4(0,1.25,.35,1)};
    this.strataMode = {value:0};
    this.strataUniform = {value:new THREE.Vector3(levelHeight,.14,1)};
    this.palettePatchUniforms=Array.from({length:4},()=>({value:new THREE.Vector3(.5,.5,.5)}));
    this.colorVolumeOn={value:0};
    this.colorVolumeMin={value:new THREE.Vector3(.18,.2,.35)};
    this.colorVolumeMax={value:new THREE.Vector3(.35,.5,.65)};
    this.groundSurfaceShadow = new GroundSurfaceShadow(this);
    this.blotchLevel = { value: levelHeight };
    this.blotchStyleMode = { value: 0 };
    this.blotchStyle = { value: new THREE.Vector4(2.3,.55,.9,1) };
    this.blotchOn = { value: 0 };         // 地面笔触（1480635131614355459 / 1703750394164199473 / 1696864977171189980）
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = this.nightUniform;
      shader.uniforms.uTime = this.waterUniforms.uTime;
      shader.uniforms.uSnow = this.snowUniform;
      shader.uniforms.uNormMix = this.normMix;
      shader.uniforms.uVoxOn = this.voxOn;
      for(const [i,key]of ['uPaletteA','uPaletteB','uPaletteC','uPaletteD'].entries())shader.uniforms[key]=this.palettePatchUniforms[i];
      shader.uniforms.uColorVolumeOn=this.colorVolumeOn;
      shader.uniforms.uColorVolumeMin=this.colorVolumeMin;
      shader.uniforms.uColorVolumeMax=this.colorVolumeMax;
      shader.uniforms.uSurfaceShadowMap=this.groundSurfaceShadow.map;
      shader.uniforms.uSurfaceShadowXform=this.groundSurfaceShadow.xform;
      shader.uniforms.uSurfaceShadowStrength=this.groundSurfaceShadow.strength;
      shader.uniforms.uBlotch = this.blotchOn;
      shader.uniforms.uBlotchLevel = this.blotchLevel;
      shader.uniforms.uBlotchStyleMode = this.blotchStyleMode;
      shader.uniforms.uBlotchStyle = this.blotchStyle;
      shader.uniforms.uFields = this.fieldOn;
      shader.uniforms.uNormalContrast = this.normalContrast;
      shader.uniforms.uMountainMode = this.mountainMode;
      shader.uniforms.uStrataMode = this.strataMode;
      shader.uniforms.uStrata = this.strataUniform;
      shader.uniforms.uGI = this.giOn;
      Object.assign(shader.uniforms, this.pop.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aMountainTone;\nvarying float vMountainTone;\nattribute vec3 aField;\nvarying vec3 vField;\nattribute float aGlow;\nattribute float aVox;\nattribute vec3 aGI;\nvarying vec3 vGI;\nvarying float vGlow;\nvarying float vVox;\nvarying float vUp;\nvarying vec3 vWPos;\nuniform float uTime;\n' + this.pop.pars)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMountainTone=aMountainTone;\nvField = aField;\nvGlow = aGlow;\nvVox = aVox;\nvGI = aGI;\nvUp = normalize(objectNormal).y;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n' + this.pop.body);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uMountainMode;\nvarying float vMountainTone;\nuniform float uFields;\nvarying vec3 vField;\nuniform float uNight;\nuniform float uSnow;\nuniform float uNormMix;\nuniform float uVoxOn;\nuniform float uBlotch;\nuniform float uGI;\nvarying vec3 vGI;\nvarying float vGlow;\nvarying float vVox;\nvarying float vUp;\nvarying vec3 vWPos;\n' + BLOTCH_GLSL + FIELD_GLSL + SEDIMENT_GLSL + SURFACE_SHADOW_GLSL + COLOR_VOLUME_GLSL + PALETTE_PATCH_GLSL + NORMAL_CONTRAST_GLSL)
        // 平滑法线和硬法线在最终光照里混合：硬法线由屏幕空间导数算（每个面一个），和插值来的平滑法线按 uNormMix 混
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nvec3 hardN = normalize(cross(dFdx(-vViewPosition), dFdy(-vViewPosition)));\nif (dot(hardN, normal) < 0.0) hardN = -hardN;\nnormal = normalize(mix(hardN, normal, uNormMix));')
        // 逐顶点体素阴影：顶点朝太阳在体素里走，被挡住就暗
        .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>\n')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.directDiffuse *= 1.0 - uVoxOn * vVox * 0.75;\nreflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vGI * diffuseColor.rgb * 0.9, uGI * 0.7);')
        .replace('#include <color_fragment>', '#include <color_fragment>\nif(uColorVolumeOn>.5 && vField.z>.5 && vField.z<1.5) diffuseColor.rgb=uColorVolumeOn>1.5?palettePatch(vec2(bn(vWPos.xz*.3),clamp(vWPos.y/6.,0.,1.))):colorVolumeSample(vec3(bn(vWPos.xz*.3),.5,clamp(vWPos.y/6.,0.,1.)));\nif(uStrataMode>.5 && vField.z< -1.5) discard;\nif(uStrataMode>.5 && vField.z< -.5) diffuseColor.rgb=sedimentColor(diffuseColor.rgb,vWPos);\nif(uSurfaceShadowStrength>0. && vField.z>.5 && vField.z<1.5 && vUp>.8) diffuseColor.rgb*=surfaceShadowTone(vWPos);\nif (uFields > 0.5) diffuseColor.rgb *= fieldTone(vField);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * smoothstep(0.55, 0.85, vUp));\nif (uBlotch > 0.5 && vField.z > 0.5 && vField.z < 1.5 && vUp > 0.8 && diffuseColor.g > diffuseColor.r * 0.82 && diffuseColor.g > diffuseColor.b * 1.05) diffuseColor.rgb *= blotchTone(vWPos);')
        .replace('#include <opaque_fragment>', 'if(uMountainMode>.5 && vField.z<-.5){float tone=1.;if(uMountainMode>1.5)tone=uMountainMode<2.5?vMountainTone:.66+.42*max(0.,dot(normal,normalize((viewMatrix*vec4(-.62,.62,-.48,0.)).xyz)));outgoingLight=diffuseColor.rgb*tone;}\nif(uNormalContrast.x>.5 && abs(vField.z)>.5) outgoingLight=mix(outgoingLight,vec3(.025,.045,.05),normalContrastInk(vWPos)*.85);\n#include <opaque_fragment>')
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
    this.navLayer = new NavLayer({ scene: this.scene, levelHeight });
    this.waterfalls = new Waterfalls({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime });   // 1007587812462530561
    this.waterVol = new WaterVolume({ scene: this.scene, uTime: this.waterUniforms.uTime });   // 1758251637280268481 SDF 叠层浅水
    this.lighthouses = new Lighthouses({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime, uNight: this.nightUniform });   // 1331905048801144836
    this.boats = new Boats({ scene: this.scene, uTime: this.waterUniforms.uTime });
    this.smoke = new Smoke({ scene: this.scene, uTime: this.waterUniforms.uTime });   // 1015140880666300416 等四段                            // 901469409579061248   // 简化导航图 + 楼梯
    this.sound = new Sound();   // 建造音效（WebAudio 合成：咕咚入水 / 磕石头 / 啵）
    this.decor = new Decor({ scene: this.scene, uTime: this.waterUniforms.uTime, uWind: this.atmosphere.uWind, levelHeight });

    // Reflection: the town mirrored under the water line, flattened toward a
    // colour halfway between itself and the sea (1215644531221311488: "the
    // bright colors wouldn't let me get away with a monochrome reflection, so
    // I had to figure out this somewhat abstract flat colored mid point").
    this.reflectMaterial = makeReflectionMaterial({time:this.waterUniforms.uTime,water:this.waterUniforms.uShallow,night:this.nightUniform});
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
    this.contourOverlay = new ContourOverlay(this.town);
    this.scene.add(this.contourOverlay.mesh);
    this.visibilityOverlay = new VisibilityOverlay(this.town, { levelHeight });
    this.scene.add(this.visibilityOverlay.group);
    this.doodleOverlay = new DoodleOverlay(this.town, { levelHeight });
    this.scene.add(this.doodleOverlay.mesh);
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
      uFar: { value: new THREE.Vector2(25, 140) },   // 远处溶进天色的距离（Bad North 主题更近：没有地平线）
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
        uniform vec2 uFar;
        varying vec3 vWorld;
        void main() {
          // Local background color treatment. Clip 1991103578011029507 shows
          // restrained coastal motion; it does not establish this drift formula.
          vec2 p = vWorld.xz;
          float n = sin(p.x * 0.35 + uTime * 0.21) * sin(p.y * 0.29 - uTime * 0.17)
                  + 0.5 * sin((p.x - p.y) * 0.8 + uTime * 0.37);
          vec3 col = mix(uDeep, uShallow, 0.55 + 0.08 * n);
          float far = smoothstep(uFar.x, uFar.y, length(vWorld.xz - cameraPosition.xz));
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

  /**
   * 逐顶点体素阴影（1190191289922465793 "per vertex voxel based shadows. Not great not terrible"）：
   * 每个顶点从自己出发朝太阳在虚拟体素空间里走（931196707236392960 "My generated levels all keep a virtual voxel
   * space"——这里就是 World 的 solid 位），碰到实心体素就算在阴影里。存成顶点属性 aVox，着色器里压暗直射光。
   * 只在勾选时算（一次约 100 万次体素查询）。
   */
  computeVoxelShadows() {
    const g = this.mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    const n = pos.count, out = new Float32Array(n);
    const L = this.levelHeight, S = this.sunDir, w = this.town, step = 0.16, maxT = 5;
    const solidAt = (x, y, z) => {
      if (y < 0) return false;
      const c = this.index.cellAt(x, z);
      if (!c) return false;
      const lv = Math.floor(y / L) + 1;
      return w.isSolid(c, lv);
    };
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      let x = pos.getX(i) + nor.getX(i) * 0.04, y = pos.getY(i) + nor.getY(i) * 0.04, z = pos.getZ(i) + nor.getZ(i) * 0.04;
      if (nor.getX(i) * S.x + nor.getY(i) * S.y + nor.getZ(i) * S.z <= 0) { out[i] = 0; continue; }   // 背光面交给普通光照
      let hit = 0;
      for (let t = step; t < maxT; t += step) { if (solidAt(x + S.x * t, y + S.y * t, z + S.z * t)) { hit = 1; break; } }
      out[i] = hit;
    }
    g.setAttribute('aVox', new THREE.BufferAttribute(out, 1));
    this.voxStats = { verts: n, ms: +(performance.now() - t0).toFixed(0) };
    return this.voxStats;
  }

  /**
   * 光体积 GI（src/light/lightvolume.js）：体素化 → 直射 → 3 次 6 向反弹 → 每个顶点取间接光（aGI）。
   * 点光源（1582757294672314368）：放在最高那栋楼顶上，暖橙色、大而软。
   */
  /** Markers are created in this renderer's realm, including iframe editors. */
  showGIPointMarkers(points=[]) {
    if(!Array.isArray(points)||points.length>16||points.some(p=>!Array.isArray(p.pos)||p.pos.length!==3||!p.pos.every(Number.isFinite)||!Array.isArray(p.color)||p.color.length!==3||!p.color.every(Number.isFinite)))throw new RangeError('Invalid point markers');
    this.giPointMarkers??=new THREE.Group();if(!this.giPointMarkers.parent)this.scene.add(this.giPointMarkers);
    for(const m of [...this.giPointMarkers.children]){m.geometry.dispose();m.material.dispose();this.giPointMarkers.remove(m)}
    for(const p of points){const m=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(...p.color)}));m.position.fromArray(p.pos);this.giPointMarkers.add(m)}
    return this.giPointMarkers.children.length;
  }

  bakeGI() {
    const w = this.town, L = this.levelHeight;
    const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
    const grass = [0.5, 0.6, 0.34], rock = [0.6, 0.58, 0.55], plaster = hex('#efe6d4');
    const albedoOf = (c, lv) => {
      if (w.isRock(c, lv)) return lv === w.top(c) ? grass : rock;
      const k = w.color[c.id];
      return k >= 0 && w.palette?.colors?.[k] ? hex(w.palette.colors[k]) : plaster;
    };
    let point = null;
    if (this.giPoint) {
      let best = null;
      for (const c of w.cells) if (!best || w.top(c) > w.top(best)) best = c;
      if (best) point = { pos: [best.cx, (w.top(best) + 0.8) * L, best.cz], color: [1.0, 0.55, 0.25], intensity: 2.2, radius: 4.5 };
    }
    const points=this.giPoint?(this.giPointLights??(point?[point]:[])):[];
    const vol = bakeLightVolume(w, this.index, { L, sun: this.sunDir.toArray(), points, albedoOf, bounces:this.giBounces??3, directional:!!this.giDirectional,distanceField:!!this.giDistance });
    if (!vol) return null;
    const g = this.mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const coords=[pos.getX(i)+nor.getX(i)*.14,pos.getY(i)+nor.getY(i)*.14,pos.getZ(i)+nor.getZ(i)*.14];
      const normal=[nor.getX(i),nor.getY(i),nor.getZ(i)];
      const s=this.giDirectional&&Math.hypot(...normal)>0?vol.sampleDirectional(...coords,normal):vol.sample(...coords);
      const p=vol.samplePoint(pos.getX(i)+nor.getX(i)*.14,pos.getY(i)+nor.getY(i)*.14,pos.getZ(i)+nor.getZ(i)*.14);
      out[i * 3] = s[0]+p[0]; out[i * 3 + 1] = s[1]+p[1]; out[i * 3 + 2] = s[2]+p[2];
    }
    if(g.attributes.aGI?.array.length===out.length){g.attributes.aGI.array.set(out);g.attributes.aGI.needsUpdate=true;}else g.setAttribute('aGI',new THREE.BufferAttribute(out,3));
    this.giStats = { voxels: vol.nx * vol.ny * vol.nz, ms: vol.ms, bounceChange: vol.bounceChange, point: points.length>0,pointCount:points.length,directional:!!vol.directional,bounceStats:vol.bounceStats,estimatedWorkingBytes:vol.estimatedWorkingBytes,sdf:!!vol.sdf,rayStats:vol.sdf?{...vol.sdf.stats}:null };
    this.giVolume = vol;
    return this.giStats;
  }

  setGroundPalettePatch(corners=null) {
    if(corners===null){this.colorVolumeOn.value=0;return;}
    const patch=makePalettePatch(corners);
    patch.forEach((c,i)=>this.palettePatchUniforms[i].value.fromArray(c));
    this.colorVolumeOn.value=2;
  }

  setGroundColorVolume(options=null) {
    if(options===null){this.colorVolumeOn.value=0;return;}
    const vol=makeColorVolume(options);
    this.colorVolumeMin.value.set(vol.h[0],vol.s[0],vol.l[0]);
    this.colorVolumeMax.value.set(vol.h[1],vol.s[1],vol.l[1]);
    this.colorVolumeOn.value=1;
  }

  setBlotchStyle({mode=this.blotchStyleMode.value,swirl=this.blotchStyle.value.x,density=this.blotchStyle.value.y,scale=this.blotchStyle.value.z,strength=this.blotchStyle.value.w}={}) {
    if(!Number.isInteger(mode)||mode<0||mode>1 || ![swirl,density,scale,strength].every(Number.isFinite) || swirl<0||swirl>6||density<0||density>1||scale<.05||scale>4||strength<0||strength>1)throw new RangeError('blotch style bounds');
    this.blotchStyleMode.value=mode; this.blotchStyle.value.set(swirl,density,scale,strength);
  }

  setReflectionStyle(options) { setReflectionStyle(this.reflectMaterial,options); }

  setPenumbra(on) {
    if(on&&!this.penumbra){this.penumbra=new PenumbraLayer(this);this.penumbraCatcher=this.shadowCatcher.visible;this.shadowCatcher.visible=false;this.penumbraDirty=true;try{this.penumbra.refresh();}catch(e){this.penumbra.dispose();this.penumbra=null;this.shadowCatcher.visible=this.penumbraCatcher;throw e;}}
    if(!on&&this.penumbra){this.penumbra.dispose();this.penumbra=null;this.shadowCatcher.visible=this.penumbraCatcher;}
  }

  setSunPosition(azimuth, elevation) {
    if(!Number.isFinite(azimuth)||!Number.isFinite(elevation)||elevation<=0||elevation>=90)throw new RangeError('sun position');
    const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;
    this.sunDir.set(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));
    this.sunBase=this.sunDir.clone();this.penumbraDirty=true;this.updateCamera();
    if(this.voxOn?.value)this.computeVoxelShadows();
    if(this.giOn?.value){clearTimeout(this.giTimer);this.giTimer=setTimeout(()=>this.bakeGI(),300);}
  }

  /** 绕竖轴转太阳（度）：在当前时段的太阳方向上再转 deg，影子、墨线、逆光一起跟着变 */
  setSunAngle(deg) {
    if(!Number.isFinite(deg))throw new RangeError("sun angle");
    this.penumbraDirty=true;
    if (!this.sunBase) this.sunBase = this.sunDir.clone();
    this.sunDir.copy(this.sunBase).applyAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    this.updateCamera();
  }

  /** 岸线颜色跟着环境走（Bad North：夏季鲑鱼粉、晨雾青） */
  setShoreColor(hex) {
    const c = new THREE.Color(hex ?? '#f7fbfa');
    this.waveMaterial.uniforms.uFoam?.value.copy(c);
    this.skirtMaterial.uniforms.uFoam?.value.copy(c);
  }

  /** 'day' | 'dusk' | 'night' — 1313840428685447170: sun gizmo + lit windows at night. */
  setTimeOfDay(mode) {
    if (mode === 'bn') return;
    this.waterUniforms.uFar.value.set(25, 140);
    this.setShoreColor(null);
    this.timeOfDay = mode;
    const P = {
      day: { sun: [0xfff1dc, 2.7], dir: [-9, 21, 15], amb: 0.5, hemi: 0.95, fill: 0.45, night: 0, exp: 1.08, bg: '#6aa8b0', sea: ['#5f9fa8', '#4f8f99', '#78b1b8'] },
      dusk: { sun: [0xffb37a, 2.2], dir: [22, 7, 6], amb: 0.35, hemi: 0.6, fill: 0.3, night: 0.25, exp: 1.05, bg: '#c58f86', sea: ['#7b8f9e', '#5d7787', '#c79a8f'] },
      night: { sun: [0x9fb4ff, 0.45], dir: [-8, 20, 12], amb: 0.18, hemi: 0.25, fill: 0.12, night: 1, exp: 1.0, bg: '#24414f', sea: ['#2c4c5a', '#223f4c', '#2b4855'] },
    }[mode];
    this.sun.color.setHex(P.sun[0]);
    this.sun.intensity = P.sun[1];
    this.sunDir.set(...P.dir).normalize();
    this.sunBase = this.sunDir.clone();
    this.penumbraDirty=true;
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

  setMountainMode(mode) {
    if(!Number.isInteger(mode)||mode<0||mode>3)throw new RangeError('mountain mode 0..3');
    this.mountainMode.value=mode;
  }

  setNormalContrast({on,scale,threshold,width}={}) {
    const v=this.normalContrast.value,next=[on===undefined?v.x:on?1:0,scale??v.y,threshold??v.z,width??v.w];
    if((on!==undefined&&typeof on!=='boolean')||!next.every(Number.isFinite)||next[1]<.05||next[1]>8||next[2]<0||next[2]>2||next[3]<.5||next[3]>4)throw new RangeError('normal contrast parameters');
    v.set(...next);
  }

  /** Learning-panel switches. */
  setDebug(name, on) {
    (this.debugState ??= {})[name] = on;   // 面板和管线示例都读这个，保持勾选框同步
    switch (name) {
      case 'normalcontrast': this.normalContrast.value.x=on?1:0; break;
      case 'grid': this.gridLines.visible = on; break;
      case 'visibility': this.visibilityOverlay.setVisible(on); break;
      case 'contours': this.contourOverlay.setVisible(on); break;
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
      case 'waterfalls': this.waterfalls.visible = on; break;
      case 'boats': this.boats.visible = on; break;
      case 'lighthouse': this.lighthouses.visible = on; break;
      case 'doodlewall': this.doodleOverlay.setVisible(on); break;
      case 'doodlegray': this.doodleOverlay.setGray(on); break;
      case 'unitsprites': if (this.battle) this.battle.spriteBatch.enabled = on; break;
      case 'passages': this.battle?.setPassagesVisible(on); break;
      case 'watervol': this.waterVol.visible = on; if (on) this.waterVol.refresh(this.town, this.index); break;
      case 'smokecheck': this.smoke.debugChecker = on; break;
      case 'flow': this.flowDebug = on; break;
      case 'strata': this.strataMode.value = on ? 2 : 0; break;
      case 'fields': this.fieldOn.value = on ? 1 : 0; break;
      case 'blotch': this.blotchOn.value = on ? 1 : 0; break;
      case 'gi': this.giOn.value = on ? 1 : 0; if (on) this.bakeGI(); break;
      case 'pointlight': this.giPoint = on; if (this.giOn.value) this.bakeGI(); break;
      case 'voxshadow': this.voxOn.value = on ? 1 : 0; if (on) this.computeVoxelShadows(); break;
      case 'hardnormal': this.normMix.value = on ? 0.8 : 1.0; break;
      case 'thickoutline': this.outline.thickness = on ? 2 : 1; break;
      case 'motionblur': if(this.motionBlur!==on)this._smearReady=false; this.motionBlur = on; break;
      case 'gore': this.goreOff = !on; break;
      case 'modules': this.worldMesh.debugModules = on; this.worldMesh.invalidate(); break;
      case 'stairs': this.navLayer.showStairs = on; break;
      case 'flags': case 'wires': case 'butterflies': this.decor.setLayer(name, on); break;
      case 'shadows': this.sun.castShadow = on; this.shadowCatcher.visible = on && !this.penumbra; if(this.penumbra){this.penumbra.enabled=on;this.penumbra.mesh.visible=on;this.penumbraCatcher=on;} break;
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
    this.span = span / 2;
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

  setStrataStyle({mode=this.strataMode.value,period=this.strataUniform.value.x,amplitude=this.strataUniform.value.y,strength=this.strataUniform.value.z}={}){
    if(!Number.isInteger(mode)||mode<0||mode>2||![period,amplitude,strength].every(Number.isFinite)||period<.05||period>5||amplitude<0||amplitude>2||strength<0||strength>1)throw new RangeError('invalid sediment controls');
    this.strataMode.value=mode;this.strataUniform.value.set(period,amplitude,strength);
  }

  render(dt) {
    this.waterUniforms.uTime.value += dt;
    this.onFrame?.(dt);
    this.penumbra?.refresh();
    this.contourOverlay.refresh();
    this.visibilityOverlay.refresh();
    this.doodleOverlay.refresh();
    this.lighthouses.update();   // 玩法层（badnorth/battle.js）
    if (this.worldMesh.rebuild()) {
      this.mesh.geometry = this.worldMesh.geometry;
      if (this.voxOn.value) this.computeVoxelShadows();
      if (this.giOn.value) { clearTimeout(this.giTimer); this.giTimer = setTimeout(() => this.bakeGI(), 600); }
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
        this.waterfalls.refresh(this.town, this.worldMesh.shape);
        this.lighthouseCount = this.lighthouses.refresh(this.town);
        if (this.waterVol.group.visible) this.waterVol.refresh(this.town, this.index);
        this.boats.refresh((x, z) => { const c = this.index.cellAt(x, z); return !!c && this.town.top(c) > 0; }, this.span || 8);
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
    this.boats.update(dt);
    this.smoke.update(dt, this.atmosphere.uWind.value, this.camera);
    this.decor.update(dt);
    this.outline.update(this.renderer, this.camera, this.sunDir);
    this.groundSurfaceShadow.refresh();
    this.renderer.render(this.scene, this.camera);
    this.#smear(dt);
  }

  /**
   * 运动模糊拖影（1727315611959865407 "I've shipped two whole games with orbital cameras and not once have I previously
   * though about adding motion blur smear"）：相机转得快时，把上一帧（本身已带拖影）按转速半透明叠在这一帧上。
   */
  #smear(dt) {
    const yaw = this.yaw, pitch = this.pitch;
    const speed = cameraAngularSpeed(yaw,pitch,this._lastYaw,this._lastPitch,dt);
    this._lastYaw = yaw; this._lastPitch = pitch;
    if (!this.motionBlur) { this._smearReady=false; return; }
    const r = this.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    if (!this.smearTex || this.smearTex.image.width !== size.x || this.smearTex.image.height !== size.y) {
      this.smearTex?.dispose();
      this.smearQuad?.geometry.dispose();
      this.smearQuad?.material.dispose();
      this.smearTex = new THREE.FramebufferTexture(size.x, size.y);
      this.smearQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        transparent: true, depthTest: false, depthWrite: false,
        uniforms: { uTex: { value: this.smearTex }, uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D uTex; uniform float uA; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb, uA); }',
      }));
      this.smearScene = new THREE.Scene(); this.smearScene.add(this.smearQuad);
      this.smearCam = new THREE.Camera();
      this._smearReady = false;
    }
    const a = smearHistoryWeight(speed,dt);
    this.smearStats={speed,alpha:this._smearReady?a:0};
    if (this._smearReady && a > 0.01) {
      this.smearQuad.material.uniforms.uA.value = a;
      const ac = r.autoClear; r.autoClear = false; r.render(this.smearScene, this.smearCam); r.autoClear = ac;
    }
    r.copyFramebufferToTexture(new THREE.Vector2(0, 0), this.smearTex);   // r160 的参数顺序：(位置, 贴图)
    this._smearReady = true;
  }
}

export { DEFAULT_LEVEL };
