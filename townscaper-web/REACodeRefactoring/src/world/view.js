import {TerraceEdgeOverlay} from './terrace-edges.js';
import {SpaceVisibilityOverlay} from './space-visibility.js';
import {CloudShadow,CLOUD_SHADOW_GLSL} from '../light/cloud-shadow.js';
/**
 * scene.js — renderer, camera rig, water and picking.
 *
 * The water is a shallow animated shader; picking is an analytic ray march over
 * the column heightfield (raycast-per-cell would be the same result at a much
 * higher cost, since every cube shares one merged mesh).
 */

import * as THREE from 'three';
import {NORMAL_CONTRAST_GLSL} from '../core/normal-contrast.js';
import {cameraAngularSpeed,smearHistoryWeight,whipCapPx,WHIP_SMEAR_GLSL} from '../core/camera-motion.js';
import {makePalettePatch,PALETTE_PATCH_GLSL} from '../core/palette-patch.js';
import {makeColorVolume,makeFeatureColorVolumes,COLOR_VOLUME_FEATURES,COLOR_VOLUME_GLSL} from '../core/color-volume.js';
import {GroundSurfaceShadow, SURFACE_SHADOW_GLSL} from '../light/surface-shadow.js';
import {SEDIMENT_GLSL} from '../core/sediment.js';
import { BLOTCH_GLSL } from '../terrain/blotch-pattern.js';
import { SHRUB_GLSL, SHRUB_DEFAULT_STYLE, SHRUB_TOOTH } from '../terrain/shrub-texture.js';
import { FIELD_GLSL } from '../terrain/field-pattern.js';
import { PenumbraLayer } from './penumbra-layer.js';
import { DoodleOverlay } from './doodle-overlay.js';
import { VisibilityOverlay } from './visibility.js';
import { ContourOverlay, THICK_COLOR_VERT, THICK_COLOR_FRAG } from './contour-overlay.js';
import { latticeForGrid, drapeLattice, latticeTriangles, clipSegmentsToRect, clipPointsToRect, intersectRect, windowForBounds, windowEdgeSegments, boundsForCells, selectionBounds } from '../core/quad-lattice.js';
/** 第 82 轮（1120036868966502401 缺口 ①）：外缘标记的**真回字形**。
 *  原片 frame-0074 逐像素量（460×460 原始帧）：外缘交点上是一个 6×6px 的空心方块 ——
 *  上沿 y=317 / 下沿 y=322 / 左沿 x=285–286 / 右沿 x=291，四边各 1px 深色（lum 0–11），
 *  内部 x287–290 × y319–321 是 lum 244–254 的**白芯**（比地表 200 亮，不是透出地表）。
 *  旧实现是「5px 黑点 + 压一颗 2–3px 白点」，第 81 轮把交点白点层默认关掉后，外缘就只剩一颗实心黑点、
 *  白芯消失，放大一眼能看出与原片不同形。这里改用点精灵在片元里按 Chebyshev 距离画方环：
 *  与 `uSize` 解耦（任意像素尺寸下描边恒 `uStroke` 像素），也不受纹理采样/JPEG 缩放影响。 */
const GRID_RIM_VERT = /* glsl */`
uniform float uSize;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize;
  // 顶点就落在地表上，depthTest 开着时整个点精灵与地表同深度 → 半边被 z-fight 吃掉（第 82 轮实测：
  // 12 个外缘点里只有 2 个能读到完整白芯）。按 clip.w 归一化的极小前移让它稳定压在地表上，
  // 量级远小于一个台阶高度，抬高的平台照样能挡住后面的标记（原片 frame-0470 那条「挡住就断」仍然成立）。
  gl_Position.z -= 0.0009 * gl_Position.w;
}`;
const GRID_RIM_FRAG = /* glsl */`
uniform float uSize;
uniform float uStroke;
uniform vec3 uFill;
uniform vec3 uEdge;
void main(){
  vec2 p = (gl_PointCoord - 0.5) * uSize;
  float m = max(abs(p.x), abs(p.y));          // Chebyshev → 方环
  float e = uSize * 0.5 - m;                  // 距外沿的像素数
  float a = smoothstep(-0.6, 0.6, e);         // 外沿 1px 抗锯齿
  if (a <= 0.002) discard;
  float t = uStroke < 0.01 ? 0.0 : smoothstep(uStroke - 0.6, uStroke + 0.6, e);   // 1=白芯，0=深色描边；stroke=0 → 实心
  gl_FragColor = vec4(mix(uEdge, uFill, t), a);
}`;

/** 线段数组（每 6 个数 = 两端点）→ 每段一个四边形（4 顶点 + 2 三角），带屏幕法向外扩方向 aSide 与逐顶点色。
 *  与 ContourOverlay 的 #buildRegionQuads 同一套顶点格式（配 THICK_COLOR_VERT 用）。 */
/** '#rrggbb' 或 [r,g,b](0..1) → [r,g,b]。三角分组层按组取色用。 */
function toRgb(c) {
  if (Array.isArray(c)) return c.length === 3 ? c : [c[0], c[1], c[2]];
  if (typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c)) {
    const h = c.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  return [0.914, 0.890, 0.235];
}

function gridQuads(seg, col, perVertex = null) {
  const segs = seg.length / 6, pos = [], side = [], pa = [], pb = [], colors = [];
  for (let i = 0; i < segs; i++) {
    const o = i * 6, ax = seg[o], ay = seg[o + 1], az = seg[o + 2], bx = seg[o + 3], by = seg[o + 4], bz = seg[o + 5];
    const c0 = perVertex ? [perVertex[o], perVertex[o + 1], perVertex[o + 2]] : col;
    for (const [px, py, pz, sgn] of [[ax, ay, az, -1], [ax, ay, az, 1], [bx, by, bz, 1], [bx, by, bz, -1]]) {
      pos.push(px, py, pz); side.push(sgn); pa.push(ax, ay, az); pb.push(bx, by, bz); colors.push(c0[0], c0[1], c0[2]);
    }
  }
  const idx = new Uint32Array(segs * 6);
  for (let q = 0, i = 0; q < segs * 4; q += 4, i += 6) { idx[i] = q; idx[i + 1] = q + 1; idx[i + 2] = q + 2; idx[i + 3] = q; idx[i + 4] = q + 2; idx[i + 5] = q + 3; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aPosA', new THREE.Float32BufferAttribute(pa, 3));
  g.setAttribute('aPosB', new THREE.Float32BufferAttribute(pb, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.userData = { quads: segs };
  return g;
}

import { WorldMesh } from './worldmesh.js';
import { buildBakeShellGeometry } from './ao-mesh-debug.js';
import { makeReflectionMaterial, setReflectionStyle } from '../water/reflection.js';
import { makePlanarReflection } from '../water/planar-reflection.js';
import { buildShore, makeSkirtMaterial, makeWaveMaterial, skirtStats } from '../water/shore.js';
import { OutlineLayers } from './outline.js';
import { Birds } from '../life/birds.js';
import { Vegetation } from '../life/vegetation.js';
import { Atmosphere } from '../life/atmosphere.js';
import { Effects, popShaderChunk } from '../life/effects.js';
import { EditFxQueue } from '../core/edit-fx-schedule.js';
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
import { ShadingExtras, shadingKeysFromURL } from './view-shading.js';   // 第 55 批 G1：十二个着色模块接 View 主材质（默认关）
import { installPostExtras } from './view-post-extras.js';   // 第 55 批 G2：描边/拖影/云体/半影/软法线/风旗/植被开关（默认关）

const DEFAULT_LEVEL = 0.5;

/**
 * 地面笔触（1480635131614355459 "these big paint blotches. They hide the polys well"；1703750394164199473 "the swirly blobbyness"；
 * 1696864977171189980 "draw with much bigger blotches without the blotches bleeding across"）：
 * 世界坐标的域扭曲噪声成大片柔和色斑（mode 2，默认；本片实测边带宽 20–30px、色阶连续），
 * 另保留量化三档（mode 0，早期观感）与旋涡/可变密度（mode 1）两档对照；只画在明确标记的地形顶面草色上，
 * 排除屋顶/河床/岩壁；每层高度按实际levelHeight换偏移。
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
    // 1305948413872267265：投影要"quite subtle and soft"。PCFSoftShadowMap 的 shader 忽略 shadow.radius
    // （只有 1 texel 的 3×3 抖动），换到 PCFShadowMap 才能让 shadow.radius 真的把核撑开。
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // 同一句话的后半段："fast enough for mobile too if I only update them on command after a regeneration"
    // → 阴影图不每帧重画，只在盖完房子/改太阳/平移镜头时置 needsUpdate。
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

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
    // 1313841094069817344："texture-only and light-only render modes" —— 两个正交的调试视图。
    // texture-only：outgoingLight 直接等于 albedo（贴图 + 顶点色），不参与光照/投影；
    // light-only：不看顶点色（= 白模），只留光照与投影（case 'lightonly' 换材质颜色）。
    this.textureOnlyOn = { value: 0 };
    this.lightOnlyOn = false;
    this.giOn = { value: 0 };             // 光体积 GI（1580835075629133825 等）
    this.fieldOn = { value: 0 };
    this.mountainMode = {value:0}; // 0 existing, 1 base colour, 2 local vertex bake, 3 runtime normal
    this.normalContrast = {value:new THREE.Vector4(0,1.25,.35,1)};
    this.strataMode = {value:0};
    this.strataUniform = {value:new THREE.Vector3(levelHeight,.12,1)};
    // 裁判同款 sWarp uniforms（SEDIMENT_GLSL 逐式移植需要同名 uniform）：uSedAmp = uStrata.y*2，setStrataStyle 同步
    this.sedAmpUniform = {value:.24};
    this.sedFreqUniform = {value:.52};
    this.palettePatchUniforms=Array.from({length:4},()=>({value:new THREE.Vector3(.5,.5,.5)}));
    this.colorVolumeOn={value:0};
    this.colorVolumeMin={value:new THREE.Vector3(.18,.2,.35)};
    this.colorVolumeMax={value:new THREE.Vector3(.35,.5,.65)};
    this.colorVolumeSteps={value:0};   // 0=连续；>=2 吸附到 i/(steps-1) 离散格（原作 ~12 格色带粒度）
    // 其他特征（1710031224838771027 残差）：roof/cliff 等表面特征各自的 HSL 范围，按 COLOR_VOLUME_FEATURES 序排
    this.featVolOn={value:new THREE.Vector3(0,0,0)};
    this.featVolMin={value:Array.from({length:COLOR_VOLUME_FEATURES.length},()=>new THREE.Vector3(0,0,0))};
    this.featVolMax={value:Array.from({length:COLOR_VOLUME_FEATURES.length},()=>new THREE.Vector3(0,0,0))};
    this.groundSurfaceShadow = new GroundSurfaceShadow(this);
    this.cloudShadow = new CloudShadow(this);
    // 1243228419162341379：水与植被也接同一份云影 uniform（ShaderMaterial 的 uniforms 是同一对象，后加键即可）
    Object.assign(this.waterUniforms, this.cloudShadow.uniforms);
    this.blotchLevel = { value: levelHeight };
    this.blotchStyleMode = { value: 0 };
    this.blotchStyle = { value: new THREE.Vector4(2.3,.55,.9,1) };
    this.blotchOn = { value: 0 };
    // 纯纹理灌木（1707490932017279035 / 1707497006640365880）：顶面着色，不加几何
    this.shrubOn = { value: 0 };
    this.shrubStyle = { value: new THREE.Vector4(SHRUB_DEFAULT_STYLE.width, SHRUB_DEFAULT_STYLE.ragged, SHRUB_DEFAULT_STYLE.shadow, SHRUB_DEFAULT_STYLE.coverage) };
    // 第 72 轮：外缘齿距独立参数（每单位齿数，默认 46 = 第 67 轮标定值）
    this.shrubTooth = { value: SHRUB_DEFAULT_STYLE.tooth ?? 46 };
    this.shrubColor = { value: new THREE.Color(SHRUB_DEFAULT_STYLE.color) };         // 地面笔触（1480635131614355459 / 1703750394164199473 / 1696864977171189980）
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = this.nightUniform;
      shader.uniforms.uTime = this.waterUniforms.uTime;
      shader.uniforms.uSnow = this.snowUniform;
      shader.uniforms.uNormMix = this.normMix;
      shader.uniforms.uVoxOn = this.voxOn;
      shader.uniforms.uTextureOnly = this.textureOnlyOn;
      for(const [i,key]of ['uPaletteA','uPaletteB','uPaletteC','uPaletteD'].entries())shader.uniforms[key]=this.palettePatchUniforms[i];
      shader.uniforms.uColorVolumeOn=this.colorVolumeOn;
      shader.uniforms.uColorVolumeMin=this.colorVolumeMin;
      shader.uniforms.uColorVolumeMax=this.colorVolumeMax;
      shader.uniforms.uColorVolumeSteps=this.colorVolumeSteps;
      shader.uniforms.uFeatVolOn=this.featVolOn;
      shader.uniforms.uFeatVolMin=this.featVolMin;
      shader.uniforms.uFeatVolMax=this.featVolMax;
      shader.uniforms.uSurfaceShadowMap=this.groundSurfaceShadow.map;
      shader.uniforms.uSurfaceShadowXform=this.groundSurfaceShadow.xform;
      shader.uniforms.uSurfaceShadowStrength=this.groundSurfaceShadow.strength;
      shader.uniforms.uBlotch = this.blotchOn;
      shader.uniforms.uShrub = this.shrubOn;
      shader.uniforms.uShrubStyle = this.shrubStyle;
      shader.uniforms.uShrubTooth = this.shrubTooth;
      shader.uniforms.uShrubColor = this.shrubColor;
      shader.uniforms.uBlotchLevel = this.blotchLevel;
      shader.uniforms.uBlotchStyleMode = this.blotchStyleMode;
      shader.uniforms.uBlotchStyle = this.blotchStyle;
      shader.uniforms.uFields = this.fieldOn;
      shader.uniforms.uNormalContrast = this.normalContrast;
      shader.uniforms.uMountainMode = this.mountainMode;
      shader.uniforms.uStrataMode = this.strataMode;
      shader.uniforms.uStrata = this.strataUniform;
      shader.uniforms.uSedAmp = this.sedAmpUniform;
      shader.uniforms.uSedFreq = this.sedFreqUniform;
      shader.uniforms.uGI = this.giOn;
      Object.assign(shader.uniforms, this.pop.uniforms, this.cloudShadow.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aMountainTone;\nvarying float vMountainTone;\nattribute vec3 aField;\nvarying vec3 vField;\nattribute float aEdge;\nvarying float vEdge;\nattribute float aBand;\nvarying float vBand;\nattribute float aGlow;\nattribute float aVox;\nattribute vec3 aGI;\nvarying vec3 vGI;\nvarying float vGlow;\nvarying float vVox;\nvarying float vUp;\nvarying vec3 vWPos;\nuniform float uTime;\n' + this.pop.pars)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMountainTone=aMountainTone;\nvField = aField;\nvEdge = aEdge;\nvBand = aBand;\nvGlow = aGlow;\nvVox = aVox;\nvGI = aGI;\nvUp = normalize(objectNormal).y;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n' + this.pop.body);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uMountainMode;\nvarying float vMountainTone;\nuniform float uFields;\nvarying vec3 vField;\nuniform float uNight;\nuniform float uSnow;\nuniform float uNormMix;\nuniform float uVoxOn;\nuniform float uTextureOnly;\nuniform float uBlotch;\nuniform float uGI;\nvarying vec3 vGI;\nvarying float vGlow;\nvarying float vVox;\nvarying float vUp;\nvarying vec3 vWPos;\n' + BLOTCH_GLSL + SHRUB_GLSL + FIELD_GLSL + SEDIMENT_GLSL + SURFACE_SHADOW_GLSL + COLOR_VOLUME_GLSL + PALETTE_PATCH_GLSL + NORMAL_CONTRAST_GLSL + CLOUD_SHADOW_GLSL)
        // 平滑法线和硬法线在最终光照里混合：硬法线由屏幕空间导数算（每个面一个），和插值来的平滑法线按 uNormMix 混
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nvec3 hardN = normalize(cross(dFdx(-vViewPosition), dFdy(-vViewPosition)));\nif (dot(hardN, normal) < 0.0) hardN = -hardN;\nnormal = normalize(mix(hardN, normal, uNormMix));')
        // 逐顶点体素阴影：顶点朝太阳在体素里走，被挡住就暗
        .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>\n')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.directDiffuse *= 1.0 - uVoxOn * vVox * 0.75;\nreflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vGI * diffuseColor.rgb * 0.9, uGI * 0.7);')
        .replace('#include <color_fragment>', '#include <color_fragment>\nif(uColorVolumeOn>2.5){int cvf=vField.z>.5&&vField.z<1.5?0:abs(vField.z)<.5?1:vField.z<-.5?2:-1;if(cvf>=0&&uFeatVolOn[cvf]>.5)diffuseColor.rgb=featVolumeSample(cvf,vec3(bn(vWPos.xz*.3),.5,clamp(vWPos.y/6.,0.,1.)));}\nelse if(uColorVolumeOn>.5 && vField.z>.5 && vField.z<1.5) diffuseColor.rgb=uColorVolumeOn>1.5?palettePatch(vec2(bn(vWPos.xz*.3),clamp(vWPos.y/6.,0.,1.))):colorVolumeSample(vec3(bn(vWPos.xz*.3),.5,clamp(vWPos.y/6.,0.,1.)));\nif(uStrataMode>.5 && vField.z< -1.5) discard;\nif(uStrataMode>.5 && vField.z< -.5) diffuseColor.rgb=sedimentColor(diffuseColor.rgb,vWPos);\nif(uSurfaceShadowStrength>0. && vField.z>.5 && vField.z<1.5 && vUp>.8) diffuseColor.rgb*=surfaceShadowTone(vWPos);\nif (uFields > 0.5) diffuseColor.rgb *= fieldTone(vField);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * smoothstep(0.55, 0.85, vUp));\nif (uBlotch > 0.5 && vField.z > 0.5 && vField.z < 1.5 && vUp > 0.8 && diffuseColor.g > diffuseColor.r * 0.82 && diffuseColor.g > diffuseColor.b * 1.05) diffuseColor.rgb *= blotchTone(vWPos);\nif (uShrub > 0.5 && vField.z > 0.5 && vField.z < 1.5 && vUp > 0.8 && vEdge < 0.999) diffuseColor.rgb = shrubApply(diffuseColor.rgb, vEdge, vWPos);')
        .replace('#include <opaque_fragment>', 'if(uTextureOnly>.5) outgoingLight=diffuseColor.rgb;\nif(uMountainMode>.5 && vField.z<-.5){float tone=1.;if(uMountainMode>1.5)tone=uMountainMode<2.5?vMountainTone:.66+.42*max(0.,dot(normal,normalize((viewMatrix*vec4(-.62,.62,-.48,0.)).xyz)));outgoingLight=diffuseColor.rgb*tone;}\nif(uNormalContrast.x>.5 && abs(vField.z)>.5) outgoingLight=mix(outgoingLight,vec3(.025,.045,.05),normalContrastInk(vWPos)*.85);\noutgoingLight*=cloudShadowTone(vWPos);\n#include <opaque_fragment>')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * vGlow * uNight * 1.6;');
    };
    // 第 55 批 G1（src/world/view-shading.js）：链在上面的 onBeforeCompile 之后，追加色体 / 对比纹理 / 笔触法线 / patch 混合 /
    // 图集笔触 / 划痕 / 表面层 / 扩展纹理阴影 / 山体图集 / 表面反弹 / 体素场 / 体素软法线，全部默认关（setDebug 或 ?shade=）
    this.shading = new ShadingExtras(this);
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
    this.vegetation = new Vegetation({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime, cloud: this.cloudShadow.uniforms });
    this.vegetation.initImpostors(this.renderer);   // 八方位 impostor + 云（启动时烘一次）
    // 环境（风场、雪、雾）、建造反馈（水花、出现动画、火）、小镇装饰（旗子、彩旗绳、蝴蝶）
    this.atmosphere = new Atmosphere({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime });
    this.effects = new Effects({ scene: this.scene, uTime: this.waterUniforms.uTime, popUniforms: this.pop.uniforms });
    // 1260586697538113537：一帧差分出多个 edit 时按「变心径向波」错拍喂给 effects/sound
    // （快照只有整笔颗粒度，笔内顺序不可恢复 → 确定序近似原片的依次生长）；setDebug('editfx')/?editfx=0 整层可关
    this.editFx = new EditFxQueue();
    this.navLayer = new NavLayer({ scene: this.scene, levelHeight });
    this.waterfalls = new Waterfalls({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime });   // 1007587812462530561
    this.waterVol = new WaterVolume({ scene: this.scene, uTime: this.waterUniforms.uTime });   // 1758251637280268481 SDF 叠层浅水
    this.lighthouses = new Lighthouses({ scene: this.scene, levelHeight, uTime: this.waterUniforms.uTime, uNight: this.nightUniform });   // 1331905048801144836
    // 901469409579061248：原片尾迹是**平行走廊**（两条恒定间距边线 + 成排断续泡沫），默认 corridor 档；
    // `?wake=v` 回到旧 Kelvin V，供 A/B 对照。r184 起 boats.js 真的走 corridor（r183 只有模块档、页面没切）。
    this.boats = new Boats({
      scene: this.scene, uTime: this.waterUniforms.uTime,
      mode: new URLSearchParams(globalThis.location?.search ?? '').get('wake') === 'v' ? 'v' : 'corridor',
    });
    this.smoke = new Smoke({ scene: this.scene, uTime: this.waterUniforms.uTime });   // 1015140880666300416 等四段                            // 901469409579061248   // 简化导航图 + 楼梯
    this.sound = new Sound();   // 建造音效（WebAudio 合成：咕咚入水 / 磕石头 / 啵）
    this.decor = new Decor({ scene: this.scene, uTime: this.waterUniforms.uTime, uWind: this.atmosphere.uWind, levelHeight });

    // Reflection: the town mirrored under the water line, flattened toward a
    // colour halfway between itself and the sea (1215644531221311488: "the
    // bright colors wouldn't let me get away with a monochrome reflection, so
    // I had to figure out this somewhat abstract flat colored mid point").
    this.reflectMaterial = makeReflectionMaterial({time:this.waterUniforms.uTime,water:this.waterUniforms.uShallow,night:this.nightUniform,cloud:this.cloudShadow.uniforms});
    this.reflection = new THREE.Mesh(this.worldMesh.geometry, this.reflectMaterial);
    this.reflection.scale.y = -1;
    this.reflection.renderOrder = 1;
    this.reflection.visible = false;   // r182：主场景改用 RTT 平面反射（见下），旧双网格只在 reflection.html 实验室里开
    this.scene.add(this.reflection);

    // 1758250248483278925 / 1215644531221311488：真平面反射（镜像相机 + 斜近平面 + 水面屏幕空间 UV）。
    // `?refl=0` 关档；`view.setDebug('reflection', false)` 同效（给 A/B 差分用）。
    this.planarReflection = makePlanarReflection({ renderer: this.renderer, scene: this.scene, size: 512 });
    this.planarReflection.enabled = !/refl=0/.test(globalThis.location?.search || '');
    this.waterUniforms.uRefl.value = this.planarReflection.texture;
    this.waterUniforms.uReflStrength.value = this.planarReflection.enabled ? 0.72 : 0;

    // Shore: static skirt (foam rim + pale halo) and the looping wave ribbons.
    this.skirtMaterial = makeSkirtMaterial(new THREE.Color('#9fd0d3'));
    // 1991099314714902634：裙带的白段/缝隙跟着同一个水时钟走（与浪带同一 uTime）
    this.skirtMaterial.uniforms.uTime = this.waterUniforms.uTime;
    // 实验页读数用：岸线白带的亮段 / 缝隙（与顶点着色器同一条曲线）
    this.skirtStats = (t = 0) => skirtStats(this.skirt.geometry, t, 0.5,
      this.skirtMaterial.uniforms.uSkirtDrift.value, this.skirtMaterial.uniforms.uSkirtBreak.value);
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
    this.contourOverlay = new ContourOverlay(this.town, { levelHeight });
    this.scene.add(this.contourOverlay.mesh);
    this.visibilityOverlay = new VisibilityOverlay(this.town, { levelHeight });
    this.scene.add(this.visibilityOverlay.group);
    this.spaceVisibility=new SpaceVisibilityOverlay(this.town,this.index,{levelHeight});
    this.scene.add(this.spaceVisibility.group);
    this.terraceEdges=new TerraceEdgeOverlay(this);this.scene.add(this.terraceEdges.lines);
    this.doodleOverlay = new DoodleOverlay(this.town, { levelHeight });
    this.scene.add(this.doodleOverlay.mesh);
    this.resize();
    this.updateCamera();
    this.setTimeOfDay('day');
    installPostExtras(this);
    for (const k of shadingKeysFromURL(globalThis.location?.search)) this.setDebug(k, true);
    { const mp = new URLSearchParams(globalThis.location?.search ?? '').get('mixedPersp'); if (mp !== null) this.mixedPerspReady = import('./view-mixed-persp.js').then((m) => (this.mixedPersp = m.attachMixedPerspective(this, { k: mp === '' ? 1 : +mp }))); } // 1310503825510367232 混合透视（C05 r56，默认不加载）
    // 1215644531221311488 "(Also, the wave skirt stretches further this time)"：裙带宽度（1 = 旧窄带，原片宽档 1.6）
    { const sw = new URLSearchParams(globalThis.location?.search ?? '').get('skirtWidth'); this.skirtWidth = sw === null ? 1 : Math.max(0.5, Math.min(3, +sw || 1)); }
    // 1664566546683899905：裙带外圈按距离场真距离落点（?skirtField=0 退回等比外推，做 A/B）
    this.haloField = new URLSearchParams(globalThis.location?.search ?? '').get('skirtField') !== '0';
    this.shoreRings = null;
    if (new URLSearchParams(globalThis.location?.search ?? '').get('c04') !== null) this.c04Ready = import('./view-c04.js').then((m) => m.installC04(this)); // 第 56 批 C04：?c04=dualcells,rayvis,ssao,dustao,hexslots（默认不加载）
    if (new URLSearchParams(globalThis.location?.search ?? '').get('c07') !== null) this.c07Ready = import('./view-c07.js').then((m) => m.installC07(this)); // 第 56 批 C07：?c07=townskin,decalboil,splash,gardenplots,aolayers,sungizmo（默认不加载）
    if (new URLSearchParams(globalThis.location?.search ?? '').get('c11') !== null) this.c11Ready = import('./view-c11.js').then((m) => m.installC11(this)); // 第 56 批 C11：?c11=grassline,shrubband,megagi,...（默认不加载）
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
    // 5 texels @2048/44u ≈ 0.11 世界单位 ≈ 片子里被花台投在石板上那团 8–10px 的软边
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
      // 1758250248483278925 / 1215644531221311488：真平面反射（RTT 镜像相机 → 水面按屏幕空间 UV 取样）。
      // strength=0 就是关档；旧"镜像双网格"只留给 reflection.html 实验室，主场景不再画。
      uRefl: { value: null },
      uReflMatrix: { value: new THREE.Matrix4() },
      uReflStrength: { value: 0 },
      uReflDistort: { value: 0.0032 },
      // 1215：片内的倒影不是高清镜面，而是"对象色与水色的中间色"（原话 flat colored mid point）
      uReflTint: { value: 0.45 },
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
        uniform sampler2D uRefl;
        uniform mat4 uReflMatrix;
        uniform float uReflStrength;
        uniform float uReflDistort;
        uniform float uReflTint;
        varying vec3 vWorld;
        ${CLOUD_SHADOW_GLSL}
        void main() {
          // Local background color treatment. Clip 1991103578011029507 shows
          // restrained coastal motion; it does not establish this drift formula.
          vec2 p = vWorld.xz;
          float n = sin(p.x * 0.35 + uTime * 0.21) * sin(p.y * 0.29 - uTime * 0.17)
                  + 0.5 * sin((p.x - p.y) * 0.8 + uTime * 0.37);
          vec3 col = mix(uDeep, uShallow, 0.55 + 0.08 * n);
          float far = smoothstep(uFar.x, uFar.y, length(vWorld.xz - cameraPosition.xz));
          col = mix(col, uSky, far);
          // 1243228419162341379：水面也接同一份云影（原来只有合并地形/建筑主材质接收）
          col *= cloudShadowTone(vWorld);
          // 平面反射：世界坐标 → 镜像相机的屏幕空间 UV（bias·P·V 已在 JS 里乘好）。
          // 没有几何的地方反射图 alpha=0，按 alpha 混色 → 不会把天空色二次铺到水色上。
          if (uReflStrength > 0.0) {
            vec4 rc = uReflMatrix * vec4(vWorld, 1.0);
            vec2 ruv = rc.xy / max(rc.w, 1e-6);
            ruv += vec2(sin(vWorld.z * 1.7 + uTime * 1.3), cos(vWorld.x * 1.5 - uTime * 1.1)) * uReflDistort;
            if (ruv.x > 0.0 && ruv.y > 0.0 && ruv.x < 1.0 && ruv.y < 1.0) {
              vec4 refl = texture2D(uRefl, ruv);
              // 中间色：倒影色朝水体色拉 45%，既压掉二次 tonemap 的偏亮，也是 1215 说的 flat mid point
              vec3 reflMid = mix(refl.rgb, (uDeep + uShallow) * 0.5, uReflTint);
              // 反射图边界羽化：不羽化会在 uv 越界处留一条硬直的横线（水面上一眼假）
              float edge = smoothstep(0.0, 0.05, ruv.x) * smoothstep(0.0, 0.05, 1.0 - ruv.x)
                         * smoothstep(0.0, 0.05, ruv.y) * smoothstep(0.0, 0.05, 1.0 - ruv.y);
              col = mix(col, reflMid, clamp(refl.a, 0.0, 1.0) * uReflStrength * edge);
            }
          }
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
    const{steps=0,...ranges}=options??{};
    if(!Number.isInteger(steps)||steps===1||steps<0||steps>256)throw new RangeError('color volume steps');
    const vol=makeColorVolume(ranges);
    this.colorVolumeMin.value.set(vol.h[0],vol.s[0],vol.l[0]);
    this.colorVolumeMax.value.set(vol.h[1],vol.s[1],vol.l[1]);
    this.colorVolumeSteps.value=steps;
    this.colorVolumeOn.value=1;
  }

  /**
   * 1710031224838771027 残差「其他特征」：每个表面特征一段独立 HSL 范围。
   * map: { ground:{h,s,l}, roof:{h,s,l}, cliff:{h,s,l} }（可只给部分特征；
   * 未给的特征保持顶点基色）。vField.z 分桶：ground .5–1.5 / roof |z|<.5 / cliff z<-.5。
   * steps: 0=连续采样；>=2 吸附到 i/(steps-1) 离散格（原作 Inspector ~12 格色带）。
   */
  setFeatureColorVolumes(map=null, {steps=0}={}) {
    if(map===null){this.colorVolumeOn.value=0;return;}
    if(!Number.isInteger(steps)||steps===1||steps<0||steps>256)throw new RangeError('color volume steps');
    const vols=makeFeatureColorVolumes(map);
    COLOR_VOLUME_FEATURES.forEach((k,i)=>{
      const v=vols[k];
      this.featVolOn.value.setComponent(i,v?1:0);
      if(v){this.featVolMin.value[i].set(v.h[0],v.s[0],v.l[0]);this.featVolMax.value[i].set(v.h[1],v.s[1],v.l[1]);}
    });
    this.colorVolumeSteps.value=steps;
    this.colorVolumeOn.value=3;
  }

  /** 纯纹理灌木参数（1707490932017279035）：width 0–0.6、ragged 0–0.3、shadow 0–1、coverage 0–1、color 十六进制 */
  setShrubStyle({width=this.shrubStyle.value.x,ragged=this.shrubStyle.value.y,shadow=this.shrubStyle.value.z,coverage=this.shrubStyle.value.w,color=null}={}){
    // 第 68 轮：上限 0.6 → 1.2。原片 1707497006640365880 frame-0560+ 台面几乎被橙粉铺满（整面覆盖），
    // 而 0–0.6 配着色器里的 (.55+.9*bfbm)*mix(.5,1,cover) 最多只到 d≈0.87，永远盖不到格心。
    if(![width,ragged,shadow,coverage].every(Number.isFinite)||width<0||width>1.2||ragged<0||ragged>.3||shadow<0||shadow>1||coverage<0||coverage>1)throw new RangeError('Invalid shrub style');
    this.shrubStyle.value.set(width,ragged,shadow,coverage);if(color)this.shrubColor.value.set(color);
    return {width,ragged,shadow,coverage,color:'#'+this.shrubColor.value.getHexString()};
  }

  /** 第 72 轮：外缘齿距（每单位齿数）。46 = 第 67 轮标定值；范围 6–90。返回实际写入值。 */
  setShrubTooth(perUnit){
    if(!Number.isFinite(perUnit)||perUnit<SHRUB_TOOTH.min||perUnit>SHRUB_TOOTH.max)throw new RangeError('Invalid shrub tooth');
    this.shrubTooth.value=perUnit;return perUnit;
  }

  /** 白色格线框半宽（px）；总宽 = 2×px。原片 460 宽实测 2px（第 68 轮）。 */
  setGridWidth(halfPx){
    if(!(halfPx>=0.5&&halfPx<=4))throw new RangeError('Invalid grid width');
    this.gridWidth=halfPx;this.gridPx.base.line=halfPx*2;this.applyGridPx();
    return halfPx*2;
  }

  /**
   * 第 81 轮：交点「亮点」层尺寸（px，屏幕定宽）。默认 0 = 关。
   * 断面量测（frame-0340/0480/0510）证明原片交点没有比线更粗的独立亮斑：
   * 白线掩膜半宽 P50=1.00 / P99=2.20 / max=3.00，全帧只有一个 3×3 夹角块。
   * 传 0 关掉、传 2–6 才补一层实心点（对照旧观感用）。
   */
  setGridDotSize(px){
    if(!(px>=0&&px<=8))throw new RangeError('Invalid grid dot size');
    this.gridPx.base.dot=px;this.applyGridPx();
    if(this.gridDots){
      const n=this.gridDots.geometry.getAttribute('position')?.count||0;
      this.gridDots.visible=n>0&&this.gridLines.visible&&px>0;
    }
    return px;
  }

  /**
   * 第 82 轮：外缘回字环的尺寸/描边（均为原片 460 宽口径的 px，进 applyGridPx 后按视口折算）。
   * 量测依据见 GRID_RIM_FRAG 上方注释：外径 6px、描边 1px、白芯 4×4（frame-0074）。
   * 传 stroke=0 得到实心方块（旧观感对照用）。
   */
  setGridRimSize(px, stroke = 1){
    if(!(px >= 2 && px <= 12) || !(stroke >= 0 && stroke < px / 2))throw new RangeError('Invalid grid rim size');
    this.gridPx.base.rim = px; this.gridPx.base.rimStroke = stroke;
    this.applyGridPx();
    return { px, stroke };
  }

  /**
   * 第 79 轮（1120036868966502401 缺口 ① ②）：格线宽 / 交点亮斑 / 外缘方块按视口高折算。
   *
   * 原片是 460×460 录的：格距中位 22px、白线 2px、交点亮点 2–3px、外缘黑方块 ≈5px —— 这四条是**同一把尺**，
   * 比值线宽/格距 = 0.091、点径/线宽 ≈ 1.25–1.5。本仓截图是 1000×760 起（高是原片的 1.65 倍），
   * 若线宽恒 2px、点恒 3px，同一机位下格距变大而线不变 → 格线明显偏细、交点几乎看不见。
   * 所以按 `k = 视口高 / 460` 折：线 2k、点 3k、外缘方块 5k（k 限 0.5–3，避免极小/极大窗口跑飞）。
   * 不传 height 时用上一次记住的值（交给 onBeforeRender 每帧刷新）。
   */
  applyGridPx(height){
    if(Number.isFinite(height)&&height>0)this.gridPx.viewport=height;
    const h=this.gridPx.viewport;
    if(!(h>0))return null;
    const k=Math.min(3,Math.max(.5,h/this.gridPx.ref));
    this.gridPx.scale=+k.toFixed(4);
    const line=this.gridPx.base.line*k, dot=this.gridPx.base.dot*k, rim=this.gridPx.base.rim*k;
    this.gridWidth=line/2;
    if(this.gridThickMat)this.gridThickMat.uniforms.uWidth.value=line/2;
    if(this.gridDots?.material)this.gridDots.material.size=+dot.toFixed(2);
    if(this.gridRim?.material){
      const m=this.gridRim.material;
      // 第 82 轮：外缘回字环 —— 尺寸随视口折，描边恒为 base.rimStroke（px），不跟着放大成粗框；
      // rimStroke=0 是「实心方块」对照档，不能被最小描边夹回可见环（否则对照档失效）。
      if(m.uniforms){
        const sb=m.uniforms.uStroke, sbBase=this.gridPx.base.rimStroke??1;
        m.uniforms.uSize.value=+rim.toFixed(2);
        sb.value=sbBase<=0?0:+Math.max(.6,sbBase*Math.min(k,1.4)).toFixed(2);
      }
      m.size=+rim.toFixed(2);   // 兼容旧读取
    }
    this.gridPx.line=+line.toFixed(2);this.gridPx.dot=+dot.toFixed(2);this.gridPx.rim=+rim.toFixed(2);
    return this.gridPx;
  }
  setBlotchStyle({mode=this.blotchStyleMode.value,swirl=this.blotchStyle.value.x,density=this.blotchStyle.value.y,scale=this.blotchStyle.value.z,strength=this.blotchStyle.value.w}={}) {
    if(!Number.isInteger(mode)||mode<0||mode>2 || ![swirl,density,scale,strength].every(Number.isFinite) || swirl<0||swirl>6||density<0||density>1||scale<.05||scale>4||strength<0||strength>1)throw new RangeError('blotch style bounds');
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

    // 第 68 轮（1120036868966502401）：白色格线框定宽。WebGL 的 lineWidth 恒为 1px，而原片 460 宽实测**中位 2px**
    // （frame-0060 / 0065 逐扫描行量 run 长度，n=94/108，median=2 mode=2）。和区域边界一样改成
    // 「每段一个四边形 + 屏幕空间法向外扩」：1px 硬芯线保留，外面套一层定宽四边形（默认半宽 1px → 总宽 2px）。
    this.gridWidth = 1;   // 半宽（px）
    this.gridThickMat = new THREE.ShaderMaterial({
      uniforms: { uWidth: { value: this.gridWidth }, uHalfPx: { value: .0016 }, uAspect: { value: 1.6 }, uOpacity: { value: .55 } },
      vertexShader: THICK_COLOR_VERT, fragmentShader: THICK_COLOR_FRAG,
      // 第 86 轮（缺口：外缘回字环与线共面时谁压谁未定）：**半透明覆盖层不写深度**。
      // 原片 frame-0074 8× 裁切里，外缘回字环压在白格线上——白线走到环的深色描边就终止，描边四边
      // 完整不断（edge-a / edge-d 两处）。本仓此前 quad 材质 depthWrite 默认 true，线四边形的深度
      // 会跟同高度的环点精灵打架，谁在上面取决于 GPU 的深度比较顺序（z-fight，不是设计）。
      // 关掉线层的深度写：线仍然吃地形遮挡（depthTest 照旧），但不再遮挡同层的环/三角层。
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    this.gridThick = new THREE.Mesh(gridQuads(arr, [1, 1, 1]), this.gridThickMat);
    this.gridThick.renderOrder = 5; this.gridThick.frustumCulled = false; this.gridThick.visible = false;
    // 视口比例在 onBeforeRender 里现取，省得再挂一套 resize 钩子；第 79 轮顺带按视口折算线宽/点径
    this.gridThick.onBeforeRender = (r) => {
      const e = r.domElement; if (!e?.height) return;
      this.gridThickMat.uniforms.uAspect.value = e.width / e.height;
      this.applyGridPx(e.height);
    };
    this.scene.add(this.gridThick);
    this.gridFlatArr = arr;      // 平铺档（旧观感 / town 还没生成时的兜底）
    this.gridSurface = true;     // 第 71 轮：默认贴面
    this.gridRegular = false;    // 第 77 轮：quad-regular 档（等距方格 + 交点亮斑），默认关
    this.gridDrape = true;       // 第 78 轮：等距格逐交点贴到地表并按岛体轮廓裁（原片 frame-0280 的锯齿外缘）
    this.gridBreakMode = 'none'; // 第 79 轮：跨层不画竖线（原片台沿处格线终止）
    this.gridDrapeStats = null;
    this.gridWindow = null;      // 第 94 轮：窗口补丁（原片白格网只画一块矩形补丁，边界硬切，见 setGridWindow）
    // 第 96 轮曾加过「窗口边缘高亮」并默认开：当时读 frame-0300 认为补丁四边有一圈更亮的框（约 3px vs 格线 2px）。
    // 第 97 轮逐像素复核**推翻**：460 宽原片里白线的 distanceTransform 半宽 P50=1.00 / P90=1.00（=2px 线），
    //   边界带与内部**完全一致**；把白掩膜做一次 3×3 腐蚀后，0300/0440/0620 三帧里没有一条 >40px 的长条，
    //   只剩交点/端点的小块（最大 20px）→ 原片**没有**加粗外框，补丁边就是最外那圈普通格线（端点成白点）。
    // 所以这一层降级为**实验档、默认关**：setGridWindowEdge(true) 仍可用于对照，但不再假装是原片观感。
    this.gridWindowEdge = false;
    this.gridWinEdgeMat = new THREE.ShaderMaterial({
      uniforms: { uWidth: { value: this.gridWidth * 1.6 }, uHalfPx: { value: .0016 }, uAspect: { value: 1.6 }, uOpacity: { value: .92 } },
      vertexShader: THICK_COLOR_VERT, fragmentShader: THICK_COLOR_FRAG,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    this.gridWinEdge = new THREE.Mesh(new THREE.BufferGeometry(), this.gridWinEdgeMat);
    this.gridWinEdge.renderOrder = 7; this.gridWinEdge.frustumCulled = false; this.gridWinEdge.visible = false;
    this.scene.add(this.gridWinEdge);
    this.gridLatticeStep = 0;    // 等距档的实际格距（窗口自动对齐用，refreshGridGeometry 里刷新）
    this.gridLatticeOrigin = { x: 0, z: 0 };
    this.gridWindowAuto = null;  // 最近一次「按包围盒自动定」的结果（供断言/回读）
    this.gridWindowSel = null;   // 第 98 轮：最近一次「按选中态自动定」的包围盒（窗口是选中态的纯函数）
    // 交点亮斑：原片每个格子交点上是一个比线更亮的圆斑（2–3px，屏幕恒定）。只在 regular 档有内容。
    // 第 79 轮：外缘顶点另有**黑色空心小方块**（≈5px）—— 先画 5px 黑点、再在白点层压一个 2–3px 白点，
    // 就得到「黑框浅心」的观感（原片 frame-0072 / frame-0470 / frame-0076 外缘裁切）。
    // 原片 460 宽：线 2px。第 81 轮断面量测（frame-0340/0480/0510，白线掩膜 val>225 & sat<28 的
    // distanceTransform）：半宽 P50=1.00 / P90=1.40 / P99=2.20 / max=3.00，全帧只有 1 个 3×3 的
    // "比线更粗"的连通块（面积 6px）—— 那就是两条 2px 线交叉的夹角，**不是独立亮点**。
    // 所以 dot 默认 0（关），不再是 3：旧值「点 2–3px」把交叉夹角读成了点，会在每个交点补一颗
    // 比线还紧的实心方块，放大后是一眼能看出的假点层。要对照旧观感用 setGridDotSize(3)。
    // 第 82 轮：外缘标记改**真回字形**（见 GRID_RIM_FRAG）。原片 frame-0074 逐像素量：外径 6px、描边 1px、
    // 白芯 4×4。原来的「5px 黑点 + 白点压心」在 dot 默认关掉后只剩实心黑点，白芯没了 —— 所以不再靠两层叠加，
    // 环本身在片元里画（描边恒 1px 与尺寸解耦）。`base.rim` 按量测改 6（旧 5 是目测）。
    this.gridPx = { ref: 460, base: { line: 2, dot: 0, rim: 6, rimStroke: 1 }, scale: 1 };
    this.gridDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: .95, depthWrite: false }));
    this.gridDots.renderOrder = 6; this.gridDots.frustumCulled = false; this.gridDots.visible = false;
    this.scene.add(this.gridDots);
    this.gridRimMat = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: 6 }, uStroke: { value: 1 },
        uFill: { value: new THREE.Color(0xf4f7f8) }, uEdge: { value: new THREE.Color(0x14181c) },
      },
      vertexShader: GRID_RIM_VERT, fragmentShader: GRID_RIM_FRAG,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.gridRimMat.size = 6;   // 兼容旧读取（测试/调试面板按 material.size 取点径）
    this.gridRim = new THREE.Points(new THREE.BufferGeometry(), this.gridRimMat);
    // 第 86 轮：外缘环的**严格层序** —— 白格线 5 → 外缘环 5.5 → 三角层 6。
    // 与线层共面时靠「线层不写深度（depthWrite:false）+ 环后画」定死谁在上面，而不是靠 z-fight 的运气；
    // 环自身对地形仍要 depthTest（抬高的平台照样挡住它，原片 frame-0470），所以保留顶点里的极小前移。
    this.gridRim.renderOrder = 5.5; this.gridRim.frustumCulled = false; this.gridRim.visible = false;
    this.scene.add(this.gridRim);
    this.gridStats = null;
    // 第 80 轮（1120036868966502401 缺口 ②）：**黄色三角化轮廓**。原片 frame-0301 浅色地面上散着 6 个黄色三角，
    // 每个的直角边沿格线、斜边是格对角线 —— 即「四边格被对角线切成两三角」里的其中一个，且对角线方向逐格交替
    // （frame-0105 / frame-0520 同批）。只有描边无填充。这一层默认关、只画 region 里的格子（原片是局部调试层），
    // 顶点高度复用贴面档的 `drapeLattice(...).heights`，所以黄三角贴着地表走而不是浮在 y=0.02。
    this.gridTriOn = false;
    this.gridTriRegion = null;
    this.gridTriSplit = 'auto';
    this.gridTriGroups = null;   // 第 84 轮：多组不同色的三角层（原片 frame-0300 蓝组 + 黄组）
    this.gridTriStats = null;
    this.gridTri = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe9e33c, transparent: true, opacity: .95, depthWrite: false }));
    this.gridTri.renderOrder = 6; this.gridTri.frustumCulled = false; this.gridTri.visible = false;
    this.scene.add(this.gridTri);
    // 原片黄三角线宽与白格线同量级（460 宽下 2px），WebGL 的 lineWidth 恒 1px → 和白格线一样走「四边形 + 屏幕空间外扩」。
    this.gridTriThickMat = new THREE.ShaderMaterial({
      uniforms: { uWidth: { value: this.gridWidth }, uHalfPx: { value: .0016 }, uAspect: { value: 1.6 }, uOpacity: { value: 1 } },
      vertexShader: THICK_COLOR_VERT, fragmentShader: THICK_COLOR_FRAG,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    this.gridTriThick = new THREE.Mesh(new THREE.BufferGeometry(), this.gridTriThickMat);
    this.gridTriThick.renderOrder = 6; this.gridTriThick.frustumCulled = false; this.gridTriThick.visible = false;
    this.scene.add(this.gridTriThick);
    this.refreshGridGeometry();

    // shoreline (yellow) and the pushed-out smoothed line (blue), 1849732997945110651
    const lineMat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
    this.shoreLine = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(0xffd23a));
    this.seaLine = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(0x3a6dff));
    for (const l of [this.shoreLine, this.seaLine]) { l.renderOrder = 6; l.visible = false; l.frustumCulled = false; this.scene.add(l); }
  }

  /** 白色格线**贴面**（第 71 轮，1120036868966502401 缺口 ①）。
   *  原片 3× 放大复核（frame-0080 / frame-0088）：白线不是平铺在地平面上的一层，而是**贴着实体表面**走的 ——
   *  坡屋面上线随坡倾斜、竖直墙面上是一段竖直短线。旧实现把整张格线钉在 y=0.015，岛体一挡就整片被遮掉。
   *  这里按每格的 `world.top` 画它自己的顶面边（同一条格边在两侧高度不同时会各画一次），
   *  并在「邻格更低」的边上从本层顶面往下跌一根**角柱**（跨层竖边）—— 这一步是旧实现完全没有的。
   *  水面以下（top=0）不画：原片格线只出现在地表与墙面上。
   *
   *  第 77 轮加 **quad-regular 档**（`setGridRegular(true)`）：本仓地形是不规则三角/四边混合网格，
   *  「每格每条边」画出来永远不是原片那种等距方格（每格边 2.724 段、还有三角格的对角边）。
   *  开这一档时改从 `core/quad-lattice.js` 铺一张等距方格（格距 = 本网格边中位长，外接框对齐），
   *  每格边只一条线、交点补亮斑 —— 与原片 22px 格距 / 2px 线 / 无对角线 / 交点亮斑 四条对齐。
   *  dots 数组只在 regular 档有内容；贴面档不画交点（原片的亮斑也只出现在平面格网上）。 */
  refreshGridGeometry() {
    const town = this.town, L = this.levelHeight || 1;
    this.gridDrapeStats = null;   // 每次重建先清，免得关掉 regular 后还带着上一轮的贴面统计
    this.gridTriStats = null;
    let seg = this.gridFlatArr || [], vertical = 0, cells = 0, surface = false, maxY = 0.015, dots = null, rims = null, lattice = null, draped = null;
    if (this.gridRegular && this.grid?.cells?.length) {
      lattice = latticeForGrid(this.grid, { y: 0.02 });
      seg = lattice.positions; dots = lattice.cornerPositions; maxY = 0.02;
      // 第 96 轮：把实际格距/原点记下来 —— 自动定窗口必须对齐这张格子的格点（否则补丁边界落在线中间）。
      this.gridLatticeStep = lattice.stats?.size || lattice.stats?.gridSpacing?.median || 0;
      this.gridLatticeOrigin = { ...(lattice.stats?.origin || { x: 0, z: 0 }) };
      // 第 78 轮（缺口 ①）：等距格不再钉在 y=0.02 一张平板上 —— 逐交点取地表高抬上去，
      // 取不到地面的交点丢掉，格网外缘因此变成原片 frame-0280 那种按格退让的锯齿；
      // 抬高的平台挡住的格子由 depthTest 处理（同 frame-0470：侧面没有白格线）。
      if (this.gridDrape && this.index?.cellAt && typeof town?.top === 'function') {
        const sample = (x, z) => {
          const c = this.index.cellAt(x, z);
          if (!c) return null;
          const t = town.top(c);
          return t > 0 ? t * L + 0.02 : null;
        };
        const draped0 = drapeLattice(lattice, sample, { breakMode: this.gridBreakMode || 'none' });
        if (draped0.stats.drawn > 0) { draped = draped0; seg = draped.positions; dots = draped.cornerPositions; rims = draped.rimPositions; maxY = draped.stats.maxY; this.gridDrapeStats = draped.stats; }
      }
    } else if (this.gridSurface && town?.cells?.length && typeof town.top === 'function') {
      const out = [], seen = new Set(), seenV = new Set();
      for (const c of town.cells) {
        const pts = c.pts; if (!pts || c.n < 3) continue;
        const t = town.top(c); if (!(t > 0)) continue;
        const y = t * L + 0.015, yk = y.toFixed(3);
        cells++;
        if (y > maxY) maxY = y;
        for (let i = 0; i < c.n; i++) {
          const a = pts[i], b = pts[(i + 1) % c.n];
          const k = (a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id) + '@' + yk;
          if (!seen.has(k)) { seen.add(k); out.push(a.x, y, a.z, b.x, y, b.z); }
          const nb = town.neighbor(c, i);
          if (!nb) continue;
          const nt = town.top(nb);
          if (nt >= t) continue;                        // 只在这条边真要往下掉时才落竖边
          const ny = nt * L + 0.015, nk = ny.toFixed(3);
          for (const p of [a, b]) {
            const vk = p.id + '@' + yk + '>' + nk;
            if (seenV.has(vk)) continue; seenV.add(vk);
            out.push(p.x, y, p.z, p.x, ny, p.z); vertical++;
          }
        }
      }
      if (out.length) { seg = out; surface = true; }
    }
    // 第 94 轮 · 窗口补丁（1120036868966502401 缺口 ③）：原片的白格网是**一块有界矩形补丁** ——
    // 边界是硬切的一刀（不是按地形退让的锯齿），补丁外一格都不画，位置逐段跟着编辑对象跑
    // （frame-0300 右上 / 0445 中上 / 0620 高台）。本仓 regular 档一直铺满 latticeForGrid 的整个外接框，
    // 没有「窗口」这一档，所以这里按窗口裁：**两个端点都在窗口内**才留（原片没有半截悬在补丁外的线），
    // 交点亮斑与外缘回字同样按点裁；三角层走区域交集（见下面 tri 段）。
    let windowStats = null;
    if (this.gridWindow) {
      const cs = clipSegmentsToRect(seg, this.gridWindow);
      windowStats = { rect: { ...this.gridWindow }, kept: cs.kept, total: cs.total, points: 0, pointsTotal: 0 };
      seg = cs.positions;
      if (dots?.length) { const cp = clipPointsToRect(dots, this.gridWindow); dots = cp.positions; windowStats.points = cp.kept; windowStats.pointsTotal = cp.total; }
      else if (dots) dots = [];
      rims = rims?.length ? clipPointsToRect(rims, this.gridWindow).positions : (rims ? [] : rims);
    }
    this.gridLines.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    this.gridLines.geometry = g;
    this.gridThick.geometry.dispose();
    this.gridThick.geometry = gridQuads(seg, [1, 1, 1]);
    this.gridDots.geometry.dispose();
    this.gridDots.geometry = new THREE.BufferGeometry();
    if (dots?.length) this.gridDots.geometry.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    this.gridDots.visible = !!dots && this.gridLines.visible && this.gridPx.base.dot > 0;
    this.gridRim.geometry.dispose();
    this.gridRim.geometry = new THREE.BufferGeometry();
    if (rims?.length) this.gridRim.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rims, 3));
    this.gridRim.visible = !!rims?.length && this.gridLines.visible;
    // 第 96 轮 · 补丁边缘高亮：窗口的四条边各画一条比白格线更粗更实的框（原片 frame-0300 关掉格线后框仍在）。
    this.gridWinEdge.geometry.dispose();
    this.gridWinEdge.geometry = new THREE.BufferGeometry();
    if (windowStats && this.gridWindowEdge) {
      const edgeSeg = windowEdgeSegments(this.gridWindow, maxY + .004);
      windowStats.edge = { segments: edgeSeg.length / 6, color: [1, 1, 1], widthMul: 1.6 };
      this.gridWinEdge.geometry = gridQuads(edgeSeg, [1, 1, 1]);
    } else if (windowStats) {
      windowStats.edge = null;
    }
    this.gridWinEdge.visible = !!windowStats?.edge && this.gridWindowEdge;
    // 第 80 轮：黄色三角化层。只有真建筑了格网（lattice）且开了 region 才有内容；顶点高度取贴面档的 heights，
    // 没跑贴面（gridDrape 关）就退回格网自身的 y —— 黄三角要么贴地、要么平铺，不会混着来。
    let tri = null;
    if (this.gridTri && this.gridTriOn && lattice) {
      // 第 84 轮：多组不同色（原片 frame-0300 同帧一组深蓝 + 一组黄绿）。给了 groups 就逐组拼一条几何，
      // 每组用各自的 bbox 挖格子、各自的色写进 aColor；没给就退回原来的单色固定档。
      const groups = Array.isArray(this.gridTriGroups) ? this.gridTriGroups.filter(g => g && g.region) : null;
      let built = null;
      if (groups?.length) {
        const P = [], C = [];
        const agg = { split: this.gridTriSplit || 'auto', quads: 0, skipped: 0, dropped: 0, triangles: 0, edges: 0, splits: { a: 0, b: 0 }, groups: 0, colored: true, yMin: 0, yMax: 0, per: [] };
        let minY = Infinity, maxY = -Infinity;
        for (const g of groups) {
          const c = toRgb(g.color);
          // 第 94 轮：三角层也要被窗口裁 —— 分组区域与窗口求交，没交集就整组跳过（不画补丁外的三角）。
          const reg = intersectRect(g.region, this.gridWindow);
          if (!reg) continue;
          agg.groups++;
          const b = latticeTriangles(lattice, { region: reg, heights: draped?.heights || null, split: g.split || this.gridTriSplit || 'auto', colors: () => c });
          for (let i = 0; i < b.positions.length; i++) P.push(b.positions[i]);
          for (let i = 0; i < b.colors.length; i++) C.push(b.colors[i]);
          agg.quads += b.stats.quads; agg.skipped += b.stats.skipped; agg.dropped += b.stats.dropped;
          agg.triangles += b.stats.triangles; agg.edges += b.stats.edges;
          agg.splits.a += b.stats.splits.a; agg.splits.b += b.stats.splits.b;
          if (b.stats.quads) { minY = Math.min(minY, b.stats.yMin); maxY = Math.max(maxY, b.stats.yMax); }
          agg.per.push({ region: b.stats.region, color: g.color ?? null, quads: b.stats.quads });
        }
        agg.yMin = Number.isFinite(minY) ? minY : 0; agg.yMax = Number.isFinite(maxY) ? maxY : 0;
        built = { positions: P, colors: C, stats: agg };
      } else {
        built = latticeTriangles(lattice, { region: intersectRect(this.gridTriRegion, this.gridWindow), heights: draped?.heights || null, split: this.gridTriSplit || 'auto' });
      }
      tri = built.stats;
      this.gridTri.geometry.dispose();
      this.gridTri.geometry = new THREE.BufferGeometry();
      if (built.positions.length) {
        this.gridTri.geometry.setAttribute('position', new THREE.Float32BufferAttribute(built.positions, 3));
        if (built.colors) this.gridTri.geometry.setAttribute('color', new THREE.Float32BufferAttribute(built.colors, 3));
      }
      this.gridTri.material.vertexColors = !!built.colors;
      this.gridTriThick.geometry.dispose();
      this.gridTriThick.geometry = built.positions.length ? gridQuads(built.positions, [0.914, 0.890, 0.235], built.colors) : new THREE.BufferGeometry();
      this.gridTriThickMat.uniforms.uWidth.value = this.gridWidth;
    } else if (this.gridTri) {
      this.gridTri.geometry.dispose();
      this.gridTri.geometry = new THREE.BufferGeometry();
      this.gridTriThick.geometry.dispose();
      this.gridTriThick.geometry = new THREE.BufferGeometry();
    }
    if (this.gridTri) this.gridTri.visible = !!tri?.triangles && this.gridLines.visible;
    this.gridTriThick.visible = this.gridTri.visible;
    this.gridTriStats = tri;
    // 贴面档必须开深度测试：原片 frame-0080 里岛体背面的格线是被实体挡住的，
    // 而 y=0.015 平铺档当初为了「平地也看得见」关掉了 depthTest —— 那会把格线画成一张透穿全场的网。
    // 第 77 轮：quad-regular 档同理——原片的等距方格只铺在地面上，岛体一抬起来就把格子挡掉，
    // 所以这一档也必须 depthTest（否则整张纸会浮在岛上面，和片里完全不像）。
    const depthTest = surface || !!lattice;
    this.gridThickMat.depthTest = depthTest;
    this.gridThickMat.needsUpdate = true;
    this.gridLines.material.depthTest = depthTest;
    this.gridLines.material.needsUpdate = true;
    this.gridRim.material.depthTest = depthTest;
    this.gridRim.material.needsUpdate = true;
    this.gridTri.material.depthTest = depthTest;
    this.gridTri.material.needsUpdate = true;
    this.gridTriThickMat.depthTest = depthTest;
    this.gridTriThickMat.needsUpdate = true;
    this.gridStats = { segments: seg.length / 6, vertical, cells, surface, maxY: +maxY.toFixed(3), flat: !surface,
      regular: !!lattice, lattice: lattice?.stats || null, drape: this.gridDrapeStats || null,
      dots: dots ? dots.length / 3 : 0, rims: rims ? rims.length / 3 : 0, breakMode: this.gridBreakMode || 'none',
      // 第 86 轮：把「谁压谁」这件事做成可断言的状态（原片是环压线，见 gridThickMat 构造处注释）
      order: { lines: this.gridLines.renderOrder, rim: this.gridRim.renderOrder, tri: this.gridTri.renderOrder },
      lineDepthWrite: !!this.gridThickMat.depthWrite, lineDepthTest: !!this.gridThickMat.depthTest,
      window: windowStats, tri: tri || null, px: { ...this.gridPx } };
    return this.gridStats;
  }
  /** 贴面格线开关（关掉回到 y=0.015 平铺档，用于和原片对照）。 */
  setGridSurface(on) { this.gridSurface = !!on; return this.refreshGridGeometry(); }
  /** quad-regular 档开关（第 77 轮）：等距方格 + 每边一次 + 交点亮斑，用于和原片格网对齐比对。 */
  setGridRegular(on) { this.gridRegular = !!on; return this.refreshGridGeometry(); }
  /** 等距格的贴面裁剪开关（第 78 轮）：关掉回到「y=0.02 一张平板铺满外接框」的旧观感，用于和原片对照。 */
  setGridDrape(on) { this.gridDrape = !!on; return this.refreshGridGeometry(); }
  /**
   * 第 94 轮 · 窗口补丁（1120036868966502401）：原片的白格网**只画一块矩形补丁**，边界硬切、随编辑对象移动，
   * 补丁外一格都不画；本仓 regular 档默认铺满整个外接框。
   * rect = {minX,maxX,minZ,maxZ}（世界 XZ，闭区间）| null（关掉，回到铺满）。
   * 只影响画出来的几何：`gridStats.window` 给出 { kept, total, points } 供断言（kept/total 是段数）。
   */
  setGridWindow(rect) {
    if (rect == null) { this.gridWindow = null; return this.refreshGridGeometry(); }
    for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) if (!Number.isFinite(rect[k])) throw new RangeError(`window.${k} 必须是有限数`);
    if (rect.minX > rect.maxX || rect.minZ > rect.maxZ) throw new RangeError('window 的 min 不能大于 max');
    this.gridWindow = { minX: rect.minX, maxX: rect.maxX, minZ: rect.minZ, maxZ: rect.maxZ };
    return this.refreshGridGeometry();
  }
  /**
   * 第 96 轮 · 窗口随「选中对象包围盒」自动定（1120036868966502401 缺口 ①）。
   * 原片补丁位置逐段跟着正在编辑的对象跑（0300 右上房子 / 0445 中上 / 0620 高台），每边比对象多约 1 格、
   * 边长 7–8 格 —— 第 94/95 轮只能手拖，这里做成一步：给包围盒就出窗口（对齐格点，见 windowForBounds）。
   * 传 null = 清掉自动窗口（回到铺满）；等距档没开（gridLatticeStep=0）会报错，不开档就没有格距可对齐。
   */
  setGridWindowForBounds(bounds, { pad = 1, maxCells = 8 } = {}) {
    if (!bounds) { this.gridWindowAuto = null; return this.setGridWindow(null); }
    if (!(this.gridLatticeStep > 0)) throw new RangeError('先 setGridRegular(true) 并 refresh 一次：没有格距无法对齐窗口');
    const rect = windowForBounds(bounds, { step: this.gridLatticeStep, origin: this.gridLatticeOrigin, pad, maxCells });
    this.gridWindowAuto = rect;
    return this.setGridWindow(rect);
  }
  /**
   * 第 98 轮 · 窗口接**选中态**（1120036868966502401 缺口 ① 收口）。
   * r96 的 `setGridWindowForBounds` 要手动灌包围盒；原片的补丁是跟着「正在编辑的对象」跑的，
   * 所以这里补上「选中态 → 包围盒 → 窗口」这一步：
   *   sel = null（清空）| { bounds } | { cells:[cell|id...] } | { objects:[{bounds}|{cells}] }
   * `this.gridWindowSel` 回读最近一次的选中包围盒（供断言：窗口是不是真的由选中态算出来的）。
   */
  setGridWindowForSelection(sel, opts = {}) {
    const bounds = selectionBounds(sel);
    this.gridWindowSel = bounds;
    if (!bounds) return this.setGridWindowForBounds(null, opts);
    return this.setGridWindowForBounds(bounds, opts);
  }
  /**
   * 第 98 轮 · 拾取 + 「编辑对象」成组：点到一个格子后，把它所在的那片实心建筑整块当成编辑对象
   * （原片 0300 的补丁包住的是一整栋房子，不是单格）。BFS 走 `edgeNeighbors`，只收 `top>0` 的格，
   * 层高差 ≤ `levelTol` 算同层（台地上下不连成一块），`max` 是格数上限（防止选中整岛把补丁撑爆）。
   * 返回 { cells:[id...], bounds, top }。
   */
  builtClusterAt(x, z, { max = 64, levelTol = 0 } = {}) {
    const start = this.index?.cellAt ? this.index.cellAt(x, z) : null;
    if (!start) return null;
    return this.builtCluster(start, { max, levelTol });
  }
  builtCluster(startCell, { max = 64, levelTol = 0 } = {}) {
    const top = (c) => (this.town?.top ? this.town.top(c) : 0);
    if (!startCell || top(startCell) <= 0) return null;
    const h0 = top(startCell);
    const seen = new Set([startCell.id]);
    const queue = [startCell];
    const cells = [];
    while (queue.length && cells.length < max) {
      const c = queue.shift();
      cells.push(c);
      for (const nb of (c.edgeNeighbors || [])) {
        if (nb == null || nb < 0 || seen.has(nb)) continue;
        const n = this.grid.cells[nb];
        if (!n || top(n) <= 0) continue;
        if (Math.abs(top(n) - h0) > levelTol) continue;
        seen.add(nb); queue.push(n);
      }
    }
    return { cells: cells.map((c) => c.id), bounds: boundsForCells(cells), top: h0 };
  }
  /** 补丁边缘高亮开关（第 96 轮）：原片那一圈更亮的框。关掉只少画框，窗口裁剪本身不变。 */
  setGridWindowEdge(on) { this.gridWindowEdge = !!on; return this.refreshGridGeometry(); }
  /** 跨层处理档（第 79 轮）：none=原片（台沿处格线终止，默认）/ single=边中一根 / pair=两端各一根（第 71 轮旧观感）。 */
  setGridBreakMode(mode) {
    if (!['none', 'single', 'pair'].includes(mode)) throw new RangeError("grid break mode must be 'none'|'single'|'pair'");
    this.gridBreakMode = mode; return this.refreshGridGeometry();
  }
  /**
   * 黄色三角化调试层（第 80 轮）：给 region 里的每个四边格画它被对角线切出来的那个三角形。
   * 原片 frame-0301 的黄三角是**局部**出现的（相邻格不描边），所以 region 必填 —— 传 null 会直接报错，
   * 免得整张格网都长出对角线（那就成了「格内画斜线」，与原片相反）。
   * `split`：'auto' 按 (col+row) 奇偶交替（原片对角线方向逐格交替）/ 'a' 对角线 v00–v11 / 'b' 对角线 v10–v01。
   */
  setGridTriangles({ on = true, region = this.gridTriRegion, split = this.gridTriSplit } = {}) {
    if (on && !region) throw new RangeError('setGridTriangles 需要 region（原片是局部调试层，不给区域会把整张格网画满对角线）');
    if (!['auto', 'a', 'b'].includes(split)) throw new RangeError("grid triangle split must be 'auto'|'a'|'b'");
    this.gridTriOn = !!on; this.gridTriRegion = region || null; this.gridTriSplit = split;
    if (!on) this.gridTriGroups = null;
    return this.refreshGridGeometry();
  }

  /** 第 84 轮（缺口 ①）：三角层**多组不同色**。原片 frame-0300 同帧两组：右侧深蓝、左下黄绿，
   *  两组各自覆盖连续若干格且互不接壤 → 颜色是逐 patch 的，不是整层固定黄。
   *  groups = [{ region:{minX,maxX,minZ,maxZ}, color:'#rrggbb', split? }]
   *  传 [] 或 null 退回单色档（`setGridTriangles` 的 region 一条）。 */
  setGridTriangleGroups(groups) {
    if (groups != null && !Array.isArray(groups)) throw new TypeError('setGridTriangleGroups 需要数组（或 null/[]）');
    const list = (groups || []).map((g) => {
      if (!g || !g.region) throw new RangeError('每个三角分组都要带 region');
      const r = g.region;
      for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) if (!Number.isFinite(r[k])) throw new RangeError(`region.${k} 必须是有限数`);
      if (r.minX > r.maxX || r.minZ > r.maxZ) throw new RangeError('region 的 min 不能大于 max');
      const split = g.split ?? this.gridTriSplit ?? 'auto';
      if (!['auto', 'a', 'b'].includes(split)) throw new RangeError("group split must be 'auto'|'a'|'b'");
      return { region: { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ }, color: g.color ?? null, split };
    });
    this.gridTriGroups = list.length ? list : null;
    if (list.length && !this.gridTriOn) this.gridTriOn = true;
    return this.refreshGridGeometry();
  }

  setMountainMode(mode) {    if(!Number.isInteger(mode)||mode<0||mode>3)throw new RangeError('mountain mode 0..3');
    this.mountainMode.value=mode;
  }

  /**
   * 阴影图按需重画（1305948413872267265 "only update them on command after a regeneration"）。
   * autoUpdate=false 之后，盖完房子 / 换太阳 / 平移镜头必须显式叫一次，否则影子会停在旧几何上。
   */
  requestShadowUpdate() {
    this.renderer.shadowMap.needsUpdate = true;
    return this.renderer.shadowMap.needsUpdate;
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
      case 'grid': if (on) this.refreshGridGeometry(); this.gridLines.visible = on; this.gridThick.visible = on; this.gridDots.visible = on && !!this.gridStats?.regular && this.gridPx.base.dot > 0; this.gridRim.visible = on && !!this.gridStats?.rims; this.gridTri.visible = on && !!this.gridStats?.tri?.triangles; this.gridTriThick.visible = this.gridTri.visible; break;
      case 'gridregular': this.setGridRegular(on); this.gridLines.visible = on || this.gridLines.visible; this.gridThick.visible = on || this.gridThick.visible; break;
      case 'woodladders': this.navLayer.woodLadders=on;this.navLayer.refresh(this.town,this.worldMesh.shape);break;
      case 'terraceedges': this.terraceEdges.setMode(on?'steps':'off'); break;
      case 'rayvis': this.spaceVisibility.setVisible(on); break;
      case 'visibility': this.visibilityOverlay.setVisible(on); break;
      case 'contours': this.contourOverlay.setVisible(on); break;
      case 'shorelines': this.shoreLine.visible = on; this.seaLine.visible = on; break;
      case 'wavewire': this.waveMaterial.wireframe = on; this.skirt.visible = !on; break;
      case 'waves': this.waves.visible = on; this.skirt.visible = on; break;
      case 'reflection':
        // r182：开关改成"反射强度"（RTT 平面反射），旧镜像双网格只留实验室页面。
        this.planarReflection.enabled = on;
        this.reflectStrength = on ? 0.72 : 0;
        this.waterUniforms.uReflStrength.value = this.reflectStrength;
        this.birds.reflections = on;
        break;
      case 'birds': this.birds.visible = on; break;
      case 'vegetation': this.vegetation.visible = on; break;
      case 'grass': case 'shrubs': case 'trees': case 'flowers': this.vegetation.setLayer(name, on); break;
      case 'leafy': this.vegetation.leafyOn = on; break;
      case 'impostor': this.vegetation.impostor = on; break;
      // 1205420678859632640 残差：距离阈值 LOD——远处树冠换共享图集交叉面片（life/leaf-impostor.js）
      case 'treelod': this.vegetation.updateCrownLOD(this.camera, on ? 8 : 0); break;
      case 'cloudshadow': this.cloudShadow.setEnabled(on); break;
      case 'clouds': this.vegetation.clouds = on; break;
      case 'moody': this.vegetation.moody = on; break;
      case 'wind': this.atmosphere.showArrows = on; break;
      case 'snow': this.atmosphere.showSnow = on; this.snowUniform.value = on ? 1 : 0; break;
      case 'fog': this.atmosphere.showFog = on; break;
      case 'fire': this.effects.showFire = on; break;
      case 'sound': this.sound.enabled = on; break;
      // 1260586697538113537：编辑特效层（弹出/水花/灰尘+音效）总开关——关掉时连已排程的一起丢
      case 'editfx': this.editFx.enabled = on; if (!on) this.editFx.clear(); break;
      case 'nav':
        if (on) { if (this.navLayer.walkGraph) this.navLayer.walk = false; this.navLayer.showGraph = true; }
        else if (!this.navLayer.walkGraph) this.navLayer.showGraph = false;
        break;
      // 917405214638006273：可走图（每格一点 + 到邻格的黄线），和上面的最短路树互斥画法
      case 'navwalk':
        this.navLayer.walk = on;
        if (on) this.navLayer.showGraph = true;
        else if (!this.debugState?.nav) this.navLayer.showGraph = false;
        break;
      case 'waterfalls': this.waterfalls.visible = on; break;
      case 'boats': this.boats.visible = on; break;
      case 'lighthouse': this.lighthouses.visible = on; break;
      case 'doodlewall': this.doodleOverlay.setVisible(on); break;
      case 'doodlegray': this.doodleOverlay.setGray(on); break;
      case 'unitsprites': if (this.battle) this.battle.spriteBatch.enabled = on; break;
      case 'passages': this.battle?.setPassagesVisible(on); break;
      case 'watervol': this.waterVol.visible = on; if (on) this.waterVol.refresh(this.town, this.index); break;
      case 'smokecheck': this.smoke.debugChecker = on; break;
      case 'flow':
        this.flowDebug = on;
        if (!on && this.battle) {
          this.battle.flowLines.visible = false;
          this.battle.flowGrid.visible = false;   // 902069261304287232 格网
          this.battle.flowFaces.visible = false;  // 901842167508992000 格面着色
          if (this.battle.flowDim) this.battle.flowDim.visible = false;   // 第 68 轮压暗层
          if (this.battle.flowLegend) this.battle.flowLegend.style.display = 'none';
        }
        break;
      // 流场调试的配色键：off（默认）= 一支守军一个颜色（902069261304287232 继承树）；on = 按兵种上色（901842167508992000）
      case 'flowunit': this.flowColorBy = on ? 'type' : 'unit'; break;
      case 'strata': this.strataMode.value = on ? 2 : 0; break;
      case 'fields': this.fieldOn.value = on ? 1 : 0; break;
      case 'blotch': this.blotchOn.value = on ? 1 : 0; break;
      case 'shrubtex': this.shrubOn.value = on ? 1 : 0; break;   // 1707490932017279035 纯纹理灌木
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
      case 'shadows': this.sun.castShadow = on; this.shadowCatcher.visible = on && !this.penumbra; if(this.penumbra){this.penumbra.enabled=on;this.penumbra.mesh.visible=on;this.penumbraCatcher=on;} this.requestShadowUpdate(); break;
      case 'textureonly':
        // 1313841094069817344：只看贴图 —— 关掉光照与投影，直接把 albedo 当结果
        this.textureOnlyOn.value = on ? 1 : 0;
        if (on && this.lightOnlyOn) this.setDebug('lightonly', false);
        break;
      case 'ao': this.worldMesh.bake = on; this.worldMesh.invalidate(); break;
      // 1298689301488775169 第四个视图「my AO baking mesh」：把烘焙用的分层体素壳画出来
      case 'aomesh': {
        if (on && !this.aoShell) {
          const g = buildBakeShellGeometry(this.town, { L: this.levelHeight, shape: this.worldMesh.shape });
          this.aoShell = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
          this.aoShell.renderOrder = 4;
          this.aoShell.userData.faces = g.userData.voxels;
          this.scene.add(this.aoShell);
        }
        if (this.aoShell) this.aoShell.visible = on;
        // 壳视图下不叠正常网格，否则看不出烘焙面在哪
        this.mesh.visible = !on;
        this.outline.group.visible = !on;
        this.reflection.visible = false;   // r182：主场景走 RTT，旧双网格常隐
        break;
      }
      case 'smooth': this.worldMesh.smooth = on; this.worldMesh.invalidate(); break;
      case 'outline': this.outline.inkVisible = on; this.vegetation.ink = on; break;
      case 'backlit': this.outline.rimVisible = on; break;
      case 'lightonly':
        // 1313841094069817344：只看光照 —— 丢掉顶点色（白模），光照/投影/AO 原样保留
        this.lightOnlyOn = on;
        if (on && this.textureOnlyOn.value) this.setDebug('textureonly', false);
        this.material.vertexColors = !on;
        this.material.color.set(on ? 0xf2efe8 : 0xffffff);
        this.material.needsUpdate = true;
        break;
      // 793557992931266561：原片五级阶梯是**只看烘焙**的对照（flat / up normal / voxel AO / directional AO），
      // 每级只差顶点色，画面里没有任何实时光照/投影/阴影。lightonly 是"白模 + 光照"（正相反），
      // textureonly 只把 albedo 当结果、仍走标准材质 —— 缺的是"把烘焙结果直接铺满"的无光照档，本 case 补这一档。
      case 'bakedonly':
        this.bakedOnlyOn = on;
        this.bakedMat ??= new THREE.MeshBasicMaterial({ vertexColors: true });
        if (on) {
          if (this.lightOnlyOn) this.setDebug('lightonly', false);
          this.mesh.material = this.bakedMat;
        } else if (this.mesh.material === this.bakedMat) {
          this.mesh.material = this.material;
        }
        break;
      case 'wire': this.material.wireframe = on; break;
      default: this.shading?.set(name, on); break;
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
    this.mixedPersp?.fixRay(ray, ndcX, ndcY); // 混合透视下射线不过眼点（view-mixed-persp.js）
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
    // 1120036868966502401（第 49 轮）：等值线 / 区域边界开着时，鼠标下的格整格黄色高亮（三角格按三角）
    if (this.contourOverlay?.mesh.visible) this.contourOverlay.selectCell(hit?.cell ?? null);
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

  /**
   * 1215644531221311488 "(Also, the wave skirt stretches further this time)"：
   * 裙带宽度的**尺度**参数（不是贴图）。重建一次岸浪几何并返回裙带读数，默认 1 = 旧窄带。
   */
  setSkirtWidth(w) {
    if (!Number.isFinite(w) || w < 0.5 || w > 3) throw new RangeError('skirt width');
    this.skirtWidth = w;
    const shore = buildShore(this.town, this.grid, this.index, {
      posts: this.worldMesh.posts, shape: this.worldMesh.shape, skirtWidth: w, haloField: this.haloField !== false,
    });
    this.shoreRings = shore.rings || null;
    this.skirt.geometry.dispose();
    this.waves.geometry.dispose();
    this.shoreLine.geometry.dispose();
    this.seaLine.geometry.dispose();
    this.skirt.geometry = shore.skirt;
    this.waves.geometry = shore.waves;
    this.shoreLine.geometry = shore.shoreLine;
    this.seaLine.geometry = shore.seaLine;
    return this.skirtStats(0);
  }

  setStrataStyle({mode=this.strataMode.value,period=this.strataUniform.value.x,amplitude=this.strataUniform.value.y,strength=this.strataUniform.value.z}={}){    if(!Number.isInteger(mode)||mode<0||mode>4||![period,amplitude,strength].every(Number.isFinite)||period<.05||period>5||amplitude<0||amplitude>2||strength<0||strength>1)throw new RangeError('invalid sediment controls');
    this.strataMode.value=mode;this.strataUniform.value.set(period,amplitude,strength);
    this.sedAmpUniform.value=amplitude*2; // 裁判 uSedAmp 口径 = 本地峰值 ×2，sWarp 与 sedimentOffset 同源
  }

  render(dt) {
    this.waterUniforms.uTime.value += dt;
    this.onFrame?.(dt);
    this.penumbra?.refresh();
    this.contourOverlay.refresh();
    // 第 53 轮：选中格的金黄定宽折线与 gizmo 要按当前相机 / 视口高度换算，必须每帧喂一次
    if (this.contourOverlay.mesh.visible) this.contourOverlay.update(this.camera, this.renderer.domElement.height);
    this.visibilityOverlay.refresh();
    this.spaceVisibility.refresh();
    this.terraceEdges.refresh();
    this.doodleOverlay.refresh();
    this.lighthouses.update();   // 玩法层（badnorth/battle.js）
    if (this.worldMesh.rebuild()) {
      this.mesh.geometry = this.worldMesh.geometry;
      this.requestShadowUpdate();   // 几何变了：这是"regeneration"那一刀，影子必须跟着重画一次
      if (this.voxOn.value) this.computeVoxelShadows();
      if (this.giOn.value) { clearTimeout(this.giTimer); this.giTimer = setTimeout(() => this.bakeGI(), 600); }
      this.reflection.geometry = this.worldMesh.geometry;
      this.outline.setGeometry(this.worldMesh.geometry);
      // 1260586697538113537：edits 先排程错拍（径向波），到期在下方统一 drain —— 撤销/重做/回放同路
      if (this.worldMesh.edits?.length) this.editFx.push(this.worldMesh.edits, this.waterUniforms.uTime.value);
      // 屋顶变了：等编辑停下来再重新找屋脊（拖动时不每帧重算）
      clearTimeout(this.birdTimer);
      this.birdTimer = setTimeout(() => {
        this.birds.refresh(this.worldMesh.geometry);
        this.vegetation.refresh(this.town, this.worldMesh.shape, this.worldMesh.garden);
        this.atmosphere.rebuild(this.town, this.index);
        // 蝴蝶落点 = 小花 + 后院格心（1273520600221433857 "a potential landing spot"）：
        // 只给小花时城镇场景常常只剩 1 个落点，蝴蝶永远换不了地方；后院补上才有"飘走"。
        const yardSpots = [...(this.worldMesh.garden?.yards || [])]
          .map((id) => this.town.cells[id])
          .filter((c) => c && this.town.topIsBuilt(c))
          .map((c) => ({ x: c.cx, y: this.town.top(c) * this.levelHeight, z: c.cz }));
        this.decor.refresh(this.town, this.index, this.birds.perches, [...(this.vegetation.flowerSpots || []), ...yardSpots]);
        this.effects.setFireSources(this.worldMesh.chimneys || []);
        this.navLayer.refresh(this.town, this.worldMesh.shape);
        this.waterfalls.refresh(this.town, this.worldMesh.shape);
        this.lighthouseCount = this.lighthouses.refresh(this.town);
        if (this.waterVol.group.visible) this.waterVol.refresh(this.town, this.index);
        this.boats.refresh((x, z) => { const c = this.index.cellAt(x, z); return !!c && this.town.top(c) > 0; }, this.span || 8);
        this.requestShadowUpdate();   // 植被 / 装饰 / 灯塔也是投影体，刷新完要再画一次阴影图
      }, this.birdsReady ? 450 : 0);
      this.birdsReady = true;
      const t0 = performance.now();
      // 岸浪只在陆地 / 钢柱 / 海岸形状变了时重建（盖高楼、刷颜色不用）
      if (this.worldMesh.shoreDirty) {
      const shore = buildShore(this.town, this.grid, this.index, { posts: this.worldMesh.posts, shape: this.worldMesh.shape, skirtWidth: this.skirtWidth ?? 1, haloField: this.haloField !== false });
      this.shoreRings = shore.rings || null;
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
    // 到期的编辑特效这帧才发（灰尘/水花按 spawn 时刻生成，不能提前）；uTime 已在本帧开头 += dt
    this.editFx.drain(this.waterUniforms.uTime.value, (e) => { this.effects.onEdit(e.cell, e.before, e.after, this.levelHeight); this.sound.onEdit(e.cell, e.before, e.after); });
    this.boats.update(dt);
    this.smoke.update(dt, this.atmosphere.uWind.value, this.camera);
    this.decor.update(dt);
    this.outline.update(this.renderer, this.camera, this.sunDir);
    this.groundSurfaceShadow.refresh();
    this.shading.update();
    this.cloudShadow.update();
    // 距离 LOD 只在阈值开着且镜头移动时重划（updateCrownLOD 内部有缓存）
    if (this.vegetation.crownLodDistance > 0) this.vegetation.updateCrownLOD(this.camera);
    // autoUpdate=false：只有太阳方向或镜头目标变了才重画阴影图（轨道旋转不会移动 target，所以转视角不重画）
    if (!this._shadowSunDir) { this._shadowSunDir = new THREE.Vector3(1e9, 0, 0); this._shadowTarget = new THREE.Vector3(1e9, 0, 0); }
    if (!this._shadowSunDir.equals(this.sunDir) || !this._shadowTarget.equals(this.target)) {
      this._shadowSunDir.copy(this.sunDir);
      this._shadowTarget.copy(this.target);
      this.renderer.shadowMap.needsUpdate = true;
    }
    // 1758/1215：反射图必须在主渲染之前画（水面材质在同一帧里取样），
    // 反射通道里隐藏水面/影接收面/裙带/浪带/旧倒影层 —— 反射不该把自己拍进去。
    if (this.planarReflection.enabled) {
      this.planarReflection.update(this.camera, {
        hide: [this.water, this.shadowCatcher, this.skirt, this.waves, this.reflection],
        planeY: 0,
      });
      this.waterUniforms.uRefl.value = this.planarReflection.texture;
      this.waterUniforms.uReflMatrix.value.copy(this.planarReflection.textureMatrix);
      this.waterUniforms.uReflStrength.value = this.reflectStrength ?? 0.72;
    }
    this.renderer.render(this.scene, this.camera);
    this.#smear(dt);
  }

  /**
   * 运动模糊拖影（1727315611959865407 "I've shipped two whole games with orbital cameras and not once have I previously
   * though about adding motion blur smear"；1727324352264474664 快速转镜拖抹续作）：
   * 相机转得快时，把上一显示帧（本身已带拖影）按转速叠在这一帧上。
   * r220：叠法从「同位置半透明重影」升级为**轮廓加权方向性拖尾**（whipSmear，CPU 孪生在 core/camera-motion.js）——
   * 上一帧沿本帧内容速度（切向 + 俯仰竖移）往回 streak，透明度再乘 .45+.55·轮廓强度：
   * 硬轮廓被整段拉长（片内可判行为），平区少受历史污染；停转/无效 dt 依旧零历史。
   */
  #smear(dt) {
    const yaw = this.yaw, pitch = this.pitch;
    const speed = cameraAngularSpeed(yaw,pitch,this._lastYaw,this._lastPitch,dt);
    // 带符号分量：屏旋量 = yaw 差 × sin(俯角)，俯仰竖移 = dpitch × 焦距(px)。±π 接缝用 atan2(sin,cos) 包裹。
    const dyaw = Number.isFinite(yaw) && Number.isFinite(this._lastYaw)
      ? Math.atan2(Math.sin(yaw - this._lastYaw), Math.cos(yaw - this._lastYaw)) : 0;
    const dpitch = Number.isFinite(pitch) && Number.isFinite(this._lastPitch) ? pitch - this._lastPitch : 0;
    this._lastYaw = yaw; this._lastPitch = pitch;
    if (!this.motionBlur) { this._smearReady=false; return; }
    const r = this.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    if (!this.smearTex || this.smearTex.image.width !== size.x || this.smearTex.image.height !== size.y) {
      this.smearTex?.dispose();
      this.smearQuad?.geometry.dispose();
      this.smearQuad?.material.dispose();
      this.smearTex = new THREE.FramebufferTexture(size.x, size.y);
      // r220：拖尾沿速度方向双线性采样（REACode smear.js「必须双线性」同款口径；默认 Nearest 会让亚像素位移丢失）
      this.smearTex.magFilter = THREE.LinearFilter; this.smearTex.minFilter = THREE.LinearFilter;
      this.smearQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        transparent: true, depthTest: false, depthWrite: false,
        uniforms: {
          uTex: { value: this.smearTex }, uA: { value: 0 },
          uRes: { value: new THREE.Vector2(size.x, size.y) }, uCenter: { value: new THREE.Vector2(size.x / 2, size.y / 2) },
          uShift: { value: 0 }, uPan: { value: 0 }, uEdge: { value: 48 / 255 }, uCap: { value: 32 },
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D uTex; uniform float uA; uniform vec2 uRes; uniform vec2 uCenter; uniform float uShift; uniform float uPan; uniform float uEdge; uniform float uCap; varying vec2 vUv;\n' + WHIP_SMEAR_GLSL +
          '\nvoid main() { gl_FragColor = whipSmear(uTex, vUv, uRes, uCenter, uShift, uPan, uA, uEdge, uCap); }',
      }));
      this.smearScene = new THREE.Scene(); this.smearScene.add(this.smearQuad);
      this.smearCam = new THREE.Camera();
      this._smearReady = false;
    }
    const a = smearHistoryWeight(speed,dt);
    // 内容速度场参数：切向（轨道旋转绕 target 投影点）+ 俯仰竖移（dpitch × 半高/tan(半fov)）
    const c = this.target.clone().project(this.camera), u = this.smearQuad.material.uniforms;
    const focalPx = (size.y / 2) / Math.tan((this.camera.fov ?? 40) * Math.PI / 360);
    const shift = dyaw * Math.sin(pitch), pan = -dpitch * focalPx;
    // r228：拖尾上限。默认仍是 32（旧口径逐像素等价，既有 r220 验收与各页 A/B 不受影响）；
    // `smearCap = 0`（页面 `?whiplen=auto`）改按本帧外圈位移自适应 —— 片内快速转镜的拖影长到画面宽 1/3，
    // 慢转时又几乎为零，常数 32 会把长拖尾截成短影。给正数则钉死该像素值。
    const cap = this.smearCap === 0 ? whipCapPx(shift, pan, size.x, size.y, { k: this.smearCapK ?? 1.6 })
      : (this.smearCap > 0 ? this.smearCap : 32);
    u.uCap.value = cap;
    u.uRes.value.set(size.x, size.y);
    u.uCenter.value.set((c.x * .5 + .5) * size.x, (c.y * .5 + .5) * size.y);
    u.uShift.value = shift; u.uPan.value = pan;
    this.smearStats={speed,alpha:this._smearReady?a:0,shift,pan,center:[Math.round(u.uCenter.value.x),Math.round(u.uCenter.value.y)],taps:4,maxPx:+cap.toFixed(3),edge:48/255};
    if (this._smearReady && a > 0.01) {
      this.smearQuad.material.uniforms.uA.value = a;
      const ac = r.autoClear; r.autoClear = false; r.render(this.smearScene, this.smearCam); r.autoClear = ac;
    }
    r.copyFramebufferToTexture(new THREE.Vector2(0, 0), this.smearTex);   // r160 的参数顺序：(位置, 贴图)
    this._smearReady = true;
  }
}

export { DEFAULT_LEVEL };
