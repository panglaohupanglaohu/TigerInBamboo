// 环境：金笺纸天光、雾气、雪原、溪涧（参考雪舟《四季花鸟图》屏风的水口）、太湖石与落雪
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// ---------- 确定性随机 ----------
export function makeRandom(seed = 20260718) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 地形起伏 ----------
function baseHeight(x, z) {
  return (
    0.45 * Math.sin(x * 0.10) * Math.cos(z * 0.085) +
    0.22 * Math.sin(x * 0.27 + 1.7) * Math.sin(z * 0.23 + 0.6) +
    0.08 * Math.sin(x * 0.9 + z * 0.7)
  );
}

// 溪涧走向：自北向南蜿蜒（取景自雪舟屏风的 S 形水口）
// y = 涧床高程：北高南低，地势随水流逐级跌落
export const STREAM_POINTS = [
  new THREE.Vector3(-7, 1.5, -46),
  new THREE.Vector3(4, 1.0, -30),
  new THREE.Vector3(-4, 0.55, -14),
  new THREE.Vector3(5, 0.1, 1),
  new THREE.Vector3(-3, -0.45, 15),
  new THREE.Vector3(4, -1.0, 31),
  new THREE.Vector3(-5, -1.55, 46),
];
// 各控制点的水面半宽：宽窄相间（窄处流急、宽处流缓）
const STREAM_HALF = [0.9, 1.6, 1.0, 2.0, 0.85, 1.7, 2.3];

export const streamCurve = new THREE.CatmullRomCurve3(STREAM_POINTS, false, "catmullrom", 0.5);

// 预采样用于距离/高程/宽度查询
const STREAM_SAMPLES = streamCurve.getPoints(240);

function halfWidthAt(t) {
  const f = THREE.MathUtils.clamp(t, 0, 1) * (STREAM_HALF.length - 1);
  const i = Math.min(Math.floor(f), STREAM_HALF.length - 2);
  return THREE.MathUtils.lerp(STREAM_HALF[i], STREAM_HALF[i + 1], f - i);
}

/** 最近涧心信息：距离 d、高程 elev、该处半宽 halfW、参数 t */
export function streamQuery(x, z) {
  let min = Infinity, best = 0;
  for (let i = 0; i < STREAM_SAMPLES.length; i++) {
    const p = STREAM_SAMPLES[i];
    const dx = p.x - x, dz = p.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < min) { min = d2; best = i; }
  }
  const t = best / (STREAM_SAMPLES.length - 1);
  const s = STREAM_SAMPLES[best];
  return { d: Math.sqrt(min), elev: s.y, halfW: halfWidthAt(t), t, cx: s.x, cz: s.z };
}

export function distToStream(x, z) {
  return streamQuery(x, z).d;
}

export function groundHeight(x, z) {
  let h = baseHeight(x, z);
  const q = streamQuery(x, z);
  // 河谷缓坡：地势随涧床高程起伏（宽范围、弱牵引）
  const vr = q.halfW + 7;
  if (q.d < vr) {
    const t = 1 - q.d / vr;
    h = THREE.MathUtils.lerp(h, q.elev + 0.35, t * t * 0.55);
  }
  // 河床下切：水线内拉向涧底（强牵引，随水宽变化）
  const edge = q.halfW * 0.9;
  const range = edge + 2.2;
  if (q.d < range) {
    const t = THREE.MathUtils.clamp(1 - (q.d - edge) / 2.2, 0, 1);
    const k = t * t * (3 - 2 * t);
    h = h * (1 - k) + (q.elev - 0.55) * k;
  }
  return h;
}

export function waterLevelAt(x, z) {
  return streamQuery(x, z).elev - 0.12;
}

// 太湖石：瘦、皱、束腰 —— 多频皱褶位移 + 竖向拉伸；顶点色顶深（岩坚）底浅
// opts: stretch 竖向拉伸；flareK/flareFrom 底部外展强度与起点（小石底粗）；
//       waist 束腰内收量；topSoft/flatK 尖峰软封顶（大圆润顶，不刺天）
function taihuGeometry(seed, { stretch = 1.75, flareK = 0.35, flareFrom = 0.6, waist = 0.32, topSoft = 1.25, flatK = 0.35 } = {}) {
  let geo = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(1, 3));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    // 皱：多频正弦叠出窝纹（太湖石的"皱"）
    const w =
      0.30 * Math.sin(n.x * 5.3 + seed) * Math.sin(n.y * 4.1 + seed * 1.7) * Math.sin(n.z * 4.7 + seed * 0.6) +
      0.18 * Math.sin(n.x * 11.1 + n.y * 8.3 + seed * 2.1) +
      0.10 * Math.sin(n.z * 17.3 + n.x * 13.7 + seed * 3.7);
    const r = 1 + w;
    // 瘦：竖向拉伸；束腰内收、顶略削、底部外展
    let y = n.y * r * stretch;
    if (y > topSoft) y = topSoft + (y - topSoft) * flatK; // 尖峰软封顶：锐尖压成圆顶
    const waistF = 1 - waist * Math.exp(-((n.y / 0.45) ** 2));
    const topPinch = n.y > 0.55 ? 1 - (n.y - 0.55) * 0.5 : 1;
    const baseFlare = n.y < -flareFrom ? 1 + (-n.y - flareFrom) * flareK : 1;
    const xz = r * waistF * topPinch * baseFlare;
    pos.setXYZ(i, n.x * xz, y, n.z * xz);
  }
  geo.computeVertexNormals();
  // 顶深底浅顶点色（与贴图相乘）
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x4a3b2a);   // 顶：岩石坚硬处色深
  const light = new THREE.Color(0xe8ddca);  // 近地：色浅
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
    c.copy(light).lerp(dark, Math.pow(t, 1.5));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.translate(0, -bb.min.y, 0); // 底面落到 y=0，摆放同竹子
  geo.userData.height = bb.max.y - bb.min.y;
  return geo;
}

// 顺山石面的积雪壳：取顶部朝上的三角面，沿法线微微抬出；覆盖高度随机
function snowCrust(geo, rand) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
  const H = geo.userData.height;
  const y0 = H * (0.55 + rand() * 0.2); // 自顶往下 55~75% 起覆，每石不同
  const ok = new Uint8Array(pos.count);
  const verts = pos.array.slice();
  const nors = nor.array;
  for (let i = 0; i < pos.count; i++) {
    if (verts[i * 3 + 1] > y0 && nors[i * 3 + 1] > 0.35) {
      ok[i] = 1;
      verts[i * 3] += nors[i * 3] * 0.035;
      verts[i * 3 + 1] += nors[i * 3 + 1] * 0.035;
      verts[i * 3 + 2] += nors[i * 3 + 2] * 0.035;
    }
  }
  const tris = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (ok[a] && ok[b] && ok[c]) tris.push(a, b, c);
  }
  if (!tris.length) return null;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  sg.setIndex(tris);
  sg.computeVertexNormals();
  return sg;
}

// ---------- 场景环境 ----------
export class Environment {
  constructor(scene, config, physics = null) {
    this.scene = scene;
    this.config = config;
    this.physics = physics;
    this.time = 0;
    this._buildSkyAndLight();
    this._buildGround();
    this._buildRocks();   // 先立石：溪涧波纹要绕石衍射
    this._buildStream();
    this._buildSnowfall();
    this._buildRain();
  }

  _buildSkyAndLight() {
    const { mist, goldBackground } = this.config.scene;
    // 金笺纸底色（屏风贴金箔的暖调）
    const paper = goldBackground ? new THREE.Color(0xe7d9b4) : new THREE.Color(0xdfe4e6);
    this.scene.background = paper;
    this.scene.fog = new THREE.FogExp2(paper, 0.008 + mist * 0.02);

    // 暖色主光（如晨光透过纸背）+ 冷色天光补
    const sun = new THREE.DirectionalLight(0xffe8c4, 1.9);
    sun.position.set(-24, 30, -14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    const skyFill = new THREE.HemisphereLight(0xdde6ea, 0xb9a98a, 0.85);
    this.scene.add(skyFill);

    const rim = new THREE.DirectionalLight(0xcfe0e8, 0.5); // 冷轮廓光，拉开雪竹层次
    rim.position.set(20, 12, 24);
    this.scene.add(rim);
  }

  _buildGround() {
    const RADIUS = 58, SEG = 150;
    const geo = new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const snow = new THREE.Color(0xf4f6f4);      // 雪面
    const snowShade = new THREE.Color(0xdfe6e8); // 雪阴处微蓝
    const wet = new THREE.Color(0x8d8878);       // 涧边湿土
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      const q = streamQuery(x, z);
      if (q.d < q.halfW + 0.4) {
        c.copy(wet);
      } else {
        const shade = THREE.MathUtils.clamp(0.5 + h * 0.4, 0, 1);
        c.copy(snowShade).lerp(snow, shade);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildStream() {
    // 沿曲线铺设水面 ribbon：宽度、高程、流速逐段而变
    const N = 200;
    const positions = new Float32Array((N + 1) * 2 * 3);
    const uvs = new Float32Array((N + 1) * 2 * 2);
    const speeds = new Float32Array((N + 1) * 2);
    const indices = [];
    const pt = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const Q = 2.6; // 流量常数：连续方程 v = Q / 宽（窄处快、宽处慢）
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      streamCurve.getPointAt(t, pt);
      streamCurve.getTangentAt(t, tan);
      side.crossVectors(up, tan).normalize();
      const hw = halfWidthAt(t);
      const y = pt.y - 0.12; // 水面随涧床高程跌落
      const v = THREE.MathUtils.clamp(Q / (hw * 1.6), 0.5, 2.6);
      const li = i * 2, ri = i * 2 + 1;
      positions[li * 3] = pt.x + side.x * hw; positions[li * 3 + 1] = y; positions[li * 3 + 2] = pt.z + side.z * hw;
      positions[ri * 3] = pt.x - side.x * hw; positions[ri * 3 + 1] = y; positions[ri * 3 + 2] = pt.z - side.z * hw;
      uvs[li * 2] = 0; uvs[li * 2 + 1] = t * 40;
      uvs[ri * 2] = 1; uvs[ri * 2 + 1] = t * 40;
      speeds[li] = speeds[ri] = v;
      if (i < N) {
        const a = i * 2, b = i * 2 + 1, c2 = i * 2 + 2, d = i * 2 + 3;
        indices.push(a, b, c2, b, d, c2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geo.setIndex(indices);

    // 涧水：半透明玻璃质 + 菲涅尔反射（随光照/视角）+ 绕石碎波与衍射环
    const rockVecs = (this.streamRocks || []).map((r) => new THREE.Vector4(r.x, r.z, r.r, 0));
    while (rockVecs.length < 16) rockVecs.push(new THREE.Vector4(0, 0, -99, 0));
    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-24, 30, -14).normalize() }, // 同主光
      uRocks: { value: rockVecs },
      uWader: { value: new THREE.Vector4(0, 0, 0.55, 0) }, // 涉水者：x,z 位置 / z 半径 / w 强度
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute float aSpeed;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying float vSpeed;
        void main() {
          vUv = uv;
          vSpeed = aSpeed;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec4 uRocks[16];
        uniform vec4 uWader;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying float vSpeed;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float rip(vec2 p) { // 两层噪声合成波高（细波，非条带）
          return vnoise(p * 5.0) * 0.62 + vnoise(p * 11.0 + 31.7) * 0.38;
        }

        void main() {
          // —— 绕石：衍射环、近石泛白、石后流速加成 ——
          float ring = 0.0, foam = 0.0, boost = 0.0;
          vec2 ringGrad = vec2(0.0);
          for (int i = 0; i < 16; i++) {
            vec4 rk = uRocks[i];
            if (rk.z < 0.0) continue;
            vec2 dv = vWorld.xz - rk.xy;
            float d = max(length(dv), 1e-3);
            float rr = rk.z;
            float phase = d * 13.0 - uTime * (2.5 + vSpeed * 2.0);
            float att = exp(-max(d - rr, 0.0) * 1.1) * smoothstep(rr * 0.7, rr + 0.25, d);
            ring += sin(phase) * att;
            ringGrad += (dv / d) * (13.0 * cos(phase) - 1.1 * sin(phase) * step(rr, d)) * att;
            foam += smoothstep(rr + 0.7, rr * 0.9, d) * 0.5;
            boost += exp(-max(d - rr, 0.0) * 0.9) * 0.8;
          }

          // —— 涉水者：足下药环外扩 + 近身泛白（虎行于涧，步步生涟） ——
          if (uWader.w > 0.001) {
            vec2 dv = vWorld.xz - uWader.xy;
            float d = max(length(dv), 1e-3);
            float phase = d * 16.0 - uTime * 5.0;
            float att = exp(-d * 0.85) * uWader.w;
            ring += sin(phase) * att;
            ringGrad += (dv / d) * (16.0 * cos(phase)) * att;
            foam += smoothstep(0.9, 0.2, d) * 0.35 * uWader.w;
            boost += exp(-d * 0.7) * 0.5 * uWader.w;
          }

          // —— 波纹场：随流速推移（v=Q/宽；遇石再加速），噪声细波取代旧条带 ——
          float spd = vSpeed * (1.0 + boost);
          vec2 fuv = vec2(vUv.x * 2.2, vUv.y * 1.2 - uTime * spd * 0.9);
          float h0 = rip(fuv) + ring * 0.5;
          float e = 0.05;
          float hx = rip(fuv + vec2(e, 0.0)) - rip(fuv - vec2(e, 0.0));
          float hz = rip(fuv + vec2(0.0, e)) - rip(fuv - vec2(0.0, e));
          vec3 N = normalize(vec3(-hx * 1.6 - ringGrad.x * 0.22, 1.0, -hz * 1.6 - ringGrad.y * 0.22));

          // —— 玻璃质半透：菲涅尔 + 日光镜面（随光照与视角改变反射）——
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 L = normalize(uSunDir);
          float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
          vec3 deep = vec3(0.10, 0.20, 0.22);
          vec3 shallow = vec3(0.36, 0.50, 0.50);
          float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
          vec3 base = mix(shallow, deep, edge) * (0.85 + h0 * 0.3);
          vec3 skyRef = vec3(0.91, 0.86, 0.72); // 金笺天光反射
          vec3 col = mix(base, skyRef, 0.12 + fres * 0.6);
          float spec = pow(max(dot(reflect(-L, N), V), 0.0), 140.0) * (1.2 + boost);
          col += spec * vec3(1.0, 0.96, 0.82);
          col += foam * vec3(0.85);
          float alpha = 0.5 + fres * 0.3 + foam * 0.25;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
        }`,
    });
    const water = new THREE.Mesh(geo, mat);
    water.renderOrder = 2;
    this.scene.add(water);
  }

  _buildRocks() {
    const rand = makeRandom(99);
    // 斧劈皴拼版贴图（rocks_taihu.png：原生分辨率笔触 ×4，不放大所以不糊）
    const rockTex = new THREE.TextureLoader().load("/assets/textures/rocks_taihu.png");
    rockTex.colorSpace = THREE.SRGBColorSpace;
    rockTex.anisotropy = 4;
    // 贴图 × 顶点色渐变（顶深底浅，见 taihuGeometry）
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, vertexColors: true, roughness: 0.95 });
    const facetMat = new THREE.MeshStandardMaterial({ map: rockTex, vertexColors: true, roughness: 0.95, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf6f8f6, roughness: 1 });

    // 立一块石：s = 底宽，targetH = 总高；一律下沉 1/3 入土（立石生根）
    // pose: "lay" = 横卧于地；{x,z} = 斜倚倾角；null = 端庄直立
    const placeStone = (x, z, s, targetH, geo, mat, pose = null) => {
      const y = groundHeight(x, z);
      const sy = targetH / geo.userData.height;
      const rock = new THREE.Mesh(geo, mat);
      rock.scale.set(s, sy, s);
      rock.rotation.y = rand() * Math.PI * 2;
      if (pose === "lay") {
        // 横卧：放倒长轴贴地而卧，略下沉（先卧后转，卧向随机）
        rock.rotation.z = Math.PI / 2 + (rand() - 0.5) * 0.15;
        rock.position.set(x, y - 0.06 - s * 0.3, z);
      } else {
        rock.position.set(x, y - 0.06 - targetH / 3, z); // 下沉 1/3
        if (pose) { rock.rotation.x = pose.x; rock.rotation.z = pose.z; }
      }
      rock.castShadow = rock.receiveShadow = true;
      this.scene.add(rock);
      // 顺石面的积雪壳：随机约 3/4 的石有雪，卧石不覆（壳为子节点，随石缩放倾侧）
      if (pose !== "lay" && rand() < 0.75) {
        const sg = snowCrust(geo, rand);
        if (sg) {
          const snow = new THREE.Mesh(sg, snowMat);
          snow.receiveShadow = true;
          rock.add(snow);
        }
      }
    };

    // 小山石：涧边点景 —— 底部粗、多棱面（flatShading）、轮廓不规则，杜绝方棱锥
    const nearWater = [];
    for (let i = 0; i < 26; i++) {
      const t = rand();
      const p = streamCurve.getPointAt(t);
      const sideSign = rand() > 0.5 ? 1 : -1;
      const off = 1.8 + rand() * 2.2;
      const x = p.x + sideSign * off;
      const z = p.z + (rand() - 0.5) * 3;
      const s = 0.35 + rand() * 0.75;
      placeStone(x, z, s, s * (1.6 + rand() * 0.8),
        taihuGeometry(rand() * 100, { stretch: 1.3, flareK: 1.0, flareFrom: 0.35, waist: 0.2 }),
        facetMat);
      const q = streamQuery(x, z);
      if (q.d < q.halfW + 1.2) nearWater.push({ x, z, r: s * 1.15 }); // 会碰水的石
    }
    this.streamRocks = nearWater.slice(0, 16); // 供水 shader 绕石波纹用

    // 大山石：龙安寺式组石 —— 两组（3 块 / 2 块），粗者端庄为主、细者斜倚为配；
    // 每组随机挑一块横卧于地，布局错落、不作对称
    const groups = [
      [-21, -27, 3.1, 3], [17, 21, 2.3, 2],
    ];
    for (const [gx, gz, gs, n] of groups) {
      const layIdx = Math.floor(rand() * n); // 本组横卧的那一块
      for (let k = 0; k < n; k++) {
        const main = k === 0;
        const a = main ? 0 : rand() * Math.PI * 2;
        const d = main ? 0 : gs * (0.8 + rand() * 0.5);
        const s = main ? gs : gs * (0.5 + rand() * 0.15);
        const h = main ? gs * (1.2 + rand() * 0.3) : gs * (1.3 + rand() * 0.4); // 高度压低，峰不刺天
        const geo = main
          ? taihuGeometry(rand() * 100, { stretch: 1.3, flareK: 0.5, waist: 0.28 })
          : taihuGeometry(rand() * 100, { stretch: 1.5, flareK: 0.3, waist: 0.34 });
        const lean = 0.14 + rand() * 0.18;
        const pose = k === layIdx ? "lay"
          : main ? null
          : { x: (rand() - 0.5) * lean, z: (rand() - 0.5) * lean };
        placeStone(gx + Math.cos(a) * d, gz + Math.sin(a) * d, s, h, geo, rockMat, pose);
      }
    }
  }

  _buildSnowfall() {
    const COUNT = 1600;
    this.snowCount = COUNT;
    const positions = new Float32Array(COUNT * 3);
    const rand = makeRandom(7);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (rand() - 0.5) * 110;
      positions[i * 3 + 1] = rand() * 40;
      positions[i * 3 + 2] = (rand() - 0.5) * 110;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85,
      sizeAttenuation: true, depthWrite: false,
    });
    this.snow = new THREE.Points(geo, mat);
    this.scene.add(this.snow);
  }

  /** 雨丝：线段而非点 —— 每滴雨是一截短竖线，按风向倾斜 */
  _buildRain() {
    const COUNT = 900;
    this.rainCount = COUNT;
    const positions = new Float32Array(COUNT * 2 * 3); // 每滴两点
    const rand = makeRandom(23);
    this._rainSeeds = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      this._rainSeeds[i * 3] = (rand() - 0.5) * 110;
      this._rainSeeds[i * 3 + 1] = rand() * 40;
      this._rainSeeds[i * 3 + 2] = (rand() - 0.5) * 110;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x8fa5b2, transparent: true, opacity: 0.5, depthWrite: false,
    });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  /** 涉水波纹：生物位置 + 移动强度 → 水 shader 的 uWader（入水才生效，强度平滑） */
  updateWader(pos, moving = 1) {
    const u = this.waterUniforms?.uWader;
    if (!u) return;
    const q = streamQuery(pos.x, pos.z);
    const inWater = q.d < q.halfW * 0.95;
    const target = inWater ? Math.min(moving, 1) : 0;
    u.value.w += (target - u.value.w) * 0.08; // 渐入渐出
    if (inWater) {
      u.value.x = pos.x;
      u.value.y = pos.z;
    }
  }

  update(dt) {
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;
    // 降水：温度 > 0℃ 下雨，≤ 0℃ 下雪；风向决定水平飘移方向
    const { temperature, snowfall, wind, windDirection } = this.config.weather;
    const isRain = temperature > 0;
    const dirRad = (windDirection * Math.PI) / 180;
    const dirX = Math.sin(dirRad), dirZ = Math.cos(dirRad); // 0°=北(+Z)，90°=东(+X)

    this.snow.visible = !isRain && snowfall > 0.02;
    this.rain.visible = isRain && snowfall > 0.02;

    if (isRain) {
      // 雨：快、斜向风向；强度决定雨滴密度
      const speed = 11 * (0.6 + snowfall * 0.4);
      const drift = wind * 4.5;
      const active = Math.max(1, Math.floor(this.rainCount * Math.min(snowfall / 2, 1)));
      this.rain.geometry.setDrawRange(0, active * 2); // LineSegments 按顶点计
      const pos = this.rain.geometry.attributes.position;
      const seeds = this._rainSeeds;
      const len = 0.55 + wind * 0.35; // 雨丝长度
      for (let i = 0; i < this.rainCount; i++) {
        let y = seeds[i * 3 + 1] - dt * speed * (0.8 + (i % 5) * 0.1);
        let x = seeds[i * 3] + dt * drift * dirX;
        let z = seeds[i * 3 + 2] + dt * drift * dirZ;
        // 与地面碰撞（物理地形高度）：触地重生
        if (y < this._groundY(x, z)) {
          y = 36 + Math.random() * 6;
          x = (Math.random() - 0.5) * 110;
          z = (Math.random() - 0.5) * 110;
        }
        seeds[i * 3] = x; seeds[i * 3 + 1] = y; seeds[i * 3 + 2] = z;
        // 线段两端：尾端沿落体方向（下落 + 风飘）偏移
        const vx = drift * dirX * 0.09, vz = drift * dirZ * 0.09;
        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, x - vx, y + len, z - vz);
      }
      pos.needsUpdate = true;
      return;
    }

    // 雪：缓、随风向飘，带摇摆；强度决定雪粒密度
    const active = Math.max(1, Math.floor(this.snowCount * Math.min(snowfall / 2, 1)));
    this.snow.geometry.setDrawRange(0, active);
    const pos = this.snow.geometry.attributes.position;
    const speed = 1.6 * (0.7 + snowfall * 0.3);
    const drift = wind * 1.4;
    for (let i = 0; i < this.snowCount; i++) {
      let y = pos.getY(i) - dt * speed * (0.7 + (i % 7) * 0.08);
      let x = pos.getX(i) + dt * drift * dirX + dt * wind * 0.5 * Math.sin(this.time * 0.6 + i);
      let z = pos.getZ(i) + dt * drift * dirZ;
      // 与地面碰撞（物理地形高度）：触地重生
      if (y < this._groundY(x, z)) {
        y = 38 + Math.random() * 4;
        x = (Math.random() - 0.5) * 110;
        z = (Math.random() - 0.5) * 110;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  /** 落点地形高度：优先物理世界 Heightfield，退化为解析地形 */
  _groundY(x, z) {
    return this.physics ? this.physics.heightAt(x, z) : groundHeight(x, z);
  }
}
