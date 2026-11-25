/**
 * impostor-c09.js — 第 56 批 C09-A：球面星球上的八方位 impostor 树 + 共用 impostor 的蓬松云。
 *
 * 1849427564034498642 "Made some octagonal impostors for these trees … a lot more stable when rotating the camera"
 *   画面：树长在一颗小星球上，地平线附近的树沿径向竖着；线框模式下地面三角网、树冠是卡片。
 *   缺口（第 53/55 批之后）：共享 ImpostorField 只认世界 +Y 为"上"，只能放在平面 World 上。
 * 1852334860137849222 "A fluffy cloud shader. It is using the same impostors as the trees"
 *   画面：星球四周一圈厚厚的蓬松白云（菜花状鼓包、底部灰蓝），前景大云遮住半个画面，树梢上有小云团。
 *   缺口：原蓬松云形、前景/背景云层次。
 *
 * 做法（不改共享 impostor.js 的默认行为）：
 *   localUpImpostorField()：先用共享 ImpostorField 建材质，再把顶点着色器里"世界 Y 轴"的三处替换成实例自己的
 *   局部坐标系（instanceMatrix 的 Y 列 = 径向上方）：水平视线 = 视线去掉径向分量；方位角在实例 X/Z 列里量；
 *   俯仰 = 视线与局部上方的夹角。烘焙、图集、八方位 × 多俯仰四帧混合、球面叶隙全部沿用共享代码。
 *   fluffyCloudGeometry()：程序化菜花云（大鼓包 + 表面小鼓包），光照和底部灰蓝烘进顶点色，再用共享
 *   ImpostorBaker.bake(...,{vertexColors:true}) 烘成 impostor —— 和树走同一个 Baker、同一张图集、同一个 Field 类。
 * 没有原美术：树冠、云形、星球配色都是程序化替代。
 */
import * as THREE from 'three';
import { ImpostorField } from './impostor.js';

// 共享着色器里要替换的三段（原样文本）。共享代码一改，这里会抛错，tests/c09-life.mjs 也会失败。
const FRAME_SRC = `vec2 hd = toCam.xz;
          if (length(hd) < 1e-6) hd = back.xz;
          if (length(hd) < 1e-6) hd = vec2(0.0, 1.0);
          vec3 hdir = vec3(hd.x, 0.0, hd.y) / length(hd);
          vec3 right = vec3(hdir.z, 0.0, -hdir.x);
          vec3 up = vec3(0.0, 1.0, 0.0);`;
const FRAME_DST = `// C09 local up：实例 Y 列 = 这棵树/这朵云所在处的径向上方
          vec3 up = normalize(im[1].xyz);
          vec3 axX = normalize(im[0].xyz), axZ = normalize(im[2].xyz);
          vec3 hv = toCam - up * dot(toCam, up);
          if (length(hv) < 1e-6) hv = back - up * dot(back, up);
          if (length(hv) < 1e-6) hv = axZ;
          vec3 hdir = normalize(hv);
          vec3 right = cross(up, hdir);`;
const AZ_SRC = `float parentYaw = atan(modelMatrix[2].x, modelMatrix[2].z);
          float az = atan(hdir.x, hdir.z) - aYaw - parentYaw;`;
const AZ_DST = `float az = atan(dot(hdir, axX), dot(hdir, axZ));   // 实例矩阵已含绕径向的朝向`;
const EL_SRC = `float el = atan(toCam.y, max(1e-5, length(toCam.xz)));`;
const EL_DST = `float el = atan(dot(toCam, up), max(1e-5, length(toCam - up * dot(toCam, up))));`;
const DRIFT_SRC = `center.x += cloudDrift(uTime,aYaw) / cd;   // 沿风向慢慢飘，飘出去从另一边回来
            // REACode engine/impostor.js 的云风材质（uWindAmt：树 0 / 云 0.6）：相位取实例位置，
            // 三轴异频起伏，整圈云不一块板一起滑。
            center += cloudWindBob(uTime, im[3].xyz, uWindAmt) / cd;`;
const DRIFT_DST = `/* C09：球面云不沿世界轴漂/起伏；整层云随父组绕球心转（近云视差 cd 行保留，未用） */`;

export function patchLocalUp(src) {
  let out = src;
  for (const [a, b] of [[FRAME_SRC, FRAME_DST], [AZ_SRC, AZ_DST], [EL_SRC, EL_DST]]) {
    if (!out.includes(a)) throw new Error('impostor-c09: shared ImpostorField shader changed, anchor missing: ' + a.slice(0, 40));
    out = out.replace(a, b);
  }
  if (out.includes(DRIFT_SRC)) out = out.replace(DRIFT_SRC, DRIFT_DST);
  return out;
}

// 1852334860137849222 蓬松云着色：直接用烘进图里的顶点色（底部灰蓝、顶部暖白），不再只按 r 通道压成一条灰白渐变。
const CLOUD_COL_SRC = `vec3 col = mix(vec3(0.8, 0.84, 0.9), vec3(1.0), lum) * vCol * uLight;`;
const CLOUD_COL_DST = `vec3 col = clamp(c.rgb / max(c.a, 0.05), 0.0, 1.0) * vCol * uLight; col = mix(col, vec3(1.0), smoothstep(.8, 1., lum) * .2);`;
export function patchBakedCloudColor(src) {
  if (!src.includes(CLOUD_COL_SRC)) throw new Error('impostor-c09: shared cloud fragment changed');
  return src.replace(CLOUD_COL_SRC, CLOUD_COL_DST);
}
/** 让 Baker 用无光照顶点色材质烘 vertexColors 网格（光照已烘在顶点色里，Lambert 会把它照成全白）。只影响这个 baker 实例。 */
export function useUnlitVertexColors(baker) { baker.matVC = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }); return baker; }

/** 共享 ImpostorField，"上方"改为每个实例自己的 Y 轴（球面星球）。opts 同 ImpostorField，另加 bakedColor（云用顶点色）。 */
export function localUpImpostorField(texture, baked, max, opts = {}) {
  const f = new ImpostorField(texture, baked, max, opts);
  f.material.vertexShader = patchLocalUp(f.material.vertexShader);
  if (opts.cloud && opts.bakedColor) f.material.fragmentShader = patchBakedCloudColor(f.material.fragmentShader);
  f.material.needsUpdate = true;
  f.localUp = true;
  return f;
}

/** 球面上某点的实例矩阵：Y 列 = 径向，绕径向转 yaw，均匀缩放 s，放在半径 r 处。 */
export function radialMatrix(dir, r, yaw, s, out = new THREE.Matrix4()) {
  const up = new THREE.Vector3(...dir).normalize();
  const ref = Math.abs(up.y) < .95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const x0 = new THREE.Vector3().crossVectors(ref, up).normalize(), z0 = new THREE.Vector3().crossVectors(x0, up).normalize();
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const x = x0.clone().multiplyScalar(c).addScaledVector(z0, -sn), z = x0.clone().multiplyScalar(sn).addScaledVector(z0, c);
  out.makeBasis(x.multiplyScalar(s), up.clone().multiplyScalar(s), z.multiplyScalar(s));
  out.setPosition(up.multiplyScalar(r));
  return out;
}

/** CPU 镜像：给定实例矩阵和视线（指向镜头），算方位帧号 f∈[0,8) 与俯仰（与着色器同式）。 */
export function localUpView(matrix, toCam) {
  const e = matrix.elements, n = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const ax = n([e[0], e[1], e[2]]), up = n([e[4], e[5], e[6]]), az = n([e[8], e[9], e[10]]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const u = dot(toCam, up), hv = toCam.map((v, i) => v - up[i] * u), hl = Math.hypot(...hv);
  const hd = hl > 1e-6 ? hv.map((v) => v / hl) : az;
  const ang = Math.atan2(dot(hd, ax), dot(hd, az));
  const f = (((ang / (2 * Math.PI)) * 8) % 8 + 8) % 8;
  return { frame: f, elevation: Math.atan2(u, Math.max(1e-5, hl)) };
}

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** 合并若干球（[x,y,z,r]）成一个非索引几何；shade(p,n)→[r,g,b] 时烘顶点色。 */
function mergePuffs(puffs, { detail = 2, squashY = 1, shade = null } = {}) {
  const pos = [], nor = [], col = [];
  for (const [x, y, z, r] of puffs) {
    const g = new THREE.IcosahedronGeometry(r, detail);   // 已是非索引
    g.scale(1, squashY, 1); g.translate(x, y, z); g.computeVertexNormals();
    const p = g.getAttribute('position'), nn = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      const P = [p.getX(i), p.getY(i), p.getZ(i)], N = [nn.getX(i), nn.getY(i), nn.getZ(i)];
      pos.push(...P); nor.push(...N); if (shade) col.push(...shade(P, N));
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (shade) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/**
 * 1852334860137849222 蓬松云：底面压平的一大团，顶上一圈圈鼓包，鼓包表面再长小鼓包（菜花边）。
 * 顶点色 = 固定光 Lambert × 高度渐变（底部灰蓝 → 顶部暖白）× 鼓包间缝隙压暗（越靠团心越暗一点）。
 * 返回几何（宽约 2.4，底面 y≈0）；puffs 数量写在 userData.puffs。
 */
export function fluffyCloudGeometry(seed = 1, { lumps = 9, subLumps = 3 } = {}) {
  const rnd = rng(seed), puffs = [];
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + rnd() * .5, rad = i === 0 ? 0 : .35 + rnd() * .55;
    const x = Math.cos(a) * rad * 1.1, z = Math.sin(a) * rad * .7, r = .55 - rad * .3 + rnd() * .12;
    const y = r * .55 + (1 - rad) * .35;
    puffs.push([x, y, z, r]);
    for (let k = 0; k < subLumps; k++) {     // 鼓包上的小鼓包：轮廓上出菜花状的小弧
      const t = rnd() * Math.PI * 2, el = .25 + rnd() * .9, rr = r * (.38 + rnd() * .2);
      puffs.push([x + Math.cos(t) * Math.cos(el) * r * .85, y + Math.sin(el) * r * .85, z + Math.sin(t) * Math.cos(el) * r * .85, rr]);
    }
  }
  const L = new THREE.Vector3(.35, .85, .4).normalize(), top = [1, .99, .97], bottom = [.52, .60, .72];
  let maxY = 0; for (const p of puffs) maxY = Math.max(maxY, p[1] + p[3]);
  const g = mergePuffs(puffs, {
    detail: 2, squashY: .85,
    shade: (P, N) => {
      const lam = Math.max(0, N[0] * L.x + N[1] * L.y + N[2] * L.z), h = Math.min(1, Math.max(0, P[1] / maxY));
      const k = (.62 + .38 * lam) * (.9 + .1 * Math.min(1, Math.hypot(P[0], P[2]) / .9));
      return top.map((t, i) => (bottom[i] + (t - bottom[i]) * Math.pow(h, .7)) * k);
    },
  });
  // 底面压平：低于 0 的顶点抬到 0（云底是平的，从侧面看是一条灰蓝的底边）
  const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * .15);
  g.userData.puffs = puffs.length;
  return g;
}

/** 程序化树冠（几个球的团），白色——颜色在实例上乘。 */
export function treeCrownGeometry(seed = 1) {
  const rnd = rng(seed + 11), puffs = [[0, .55, 0, .34]];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + rnd(); puffs.push([Math.cos(a) * .22, .45 + rnd() * .3, Math.sin(a) * .22, .2 + rnd() * .06]); }
  puffs.push([0, .1, 0, .07]);   // 树干位置的小团，烘出来是底部一点深色
  return mergePuffs(puffs, { detail: 2 });
}

/**
 * 程序化小星球的落点：森林（树）和云层（大云/小云）。elevation(dir)→[0,1]，海平面 sea。
 * 返回 { trees:[{dir,yaw,s,variant}], clouds:[{dir,yaw,s,layer}] }，确定性。
 */
export function planetImpostorSites(elevation, { seed = 5, sea = .52, trees = 1400, clouds = 90, forest = null } = {}) {
  const rnd = rng(seed), out = { trees: [], clouds: [] }, dir = () => {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [s * Math.cos(t), u, s * Math.sin(t)];
  };
  let guard = 0;
  while (out.trees.length < trees && guard++ < trees * 40) {
    const d = dir(), e = elevation(d);
    if (e < sea + .015 || e > sea + .2) continue;                 // 沙岸和山顶不长树
    if (forest && forest(d) < .5) continue;                       // 成片森林
    out.trees.push({ dir: d, yaw: rnd() * Math.PI * 2, s: .7 + rnd() * .5, variant: Math.floor(rnd() * 3) });
  }
  guard = 0;
  while (out.clouds.length < clouds && guard++ < clouds * 60) {
    const d = dir(), band = Math.abs(d[1]);
    // 云带：赤道两侧一圈 + 少量散在树梢上的小云
    const big = rnd() < .55;
    if (big && (band > .55 || rnd() < .3)) continue;
    out.clouds.push({ dir: d, yaw: rnd() * Math.PI * 2, s: big ? 1.6 + rnd() * 1.6 : .35 + rnd() * .35, layer: big ? 'big' : 'small' });
  }
  return out;
}
