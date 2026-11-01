/**
 * bncanopy.js — 把第 12 轮的 `buildBlobCanopy`（球堆 → surface nets → 橡皮筋/气球松弛）
 * 接成 Bad North 用的"树冠"，输出一份可以直接丢给 impostor 烘焙的 BufferGeometry。
 *
 * 为什么不用 `impostor.js` 自带的 `makeBlobTree`：那个是三个二十面体硬拼的，
 * 轮廓是三个球。参考帧（c_grass 里的灌木、summer1 里右下角那棵树）是**一坨
 * 圆钝但凹凸不平**的东西，接缝处还有浅窝 —— 那正是 surface nets + 双刚度松弛的产物。
 * 所以这里直接复用那次的结果，只把 [x,y,z] 顶点表和索引表转成 BufferGeometry。
 *
 * 顶点色沿用同一套"底部深、顶部亮"的规则（和 makeBlobTree 的 bakeLitColors 一致）：
 * impostor 烘焙时没有真实光照，颜色必须**烘进顶点**，否则树冠会是一块平色。
 */
import * as THREE from 'three';
import { buildBlobCanopy } from '../src/blobrelax.js';

function shade(hex, k) {
  const c = new THREE.Color(hex);
  return [c.r * k, c.g * k, c.b * k];
}

export function makeCanopyGeometry(seed = 1, {
  res = 15,
  tint = '#7c8d60',
  height = 1.0,
} = {}) {
  // 自己给球堆，不用 buildBlobCanopy 的默认布局。
  // 默认那套是"7 个球绕一圈 + 1 个中心"（为整片树冠设计的），等值面出来是个**环**，
  // 烤成 impostor 之后像一只绿色的蝙蝠。岛上的树要的是**实心团块**：
  // 一个中心大球 + 5 个贴在外围的小球，间距小于半径，等值面就糊成一坨。
  let rs = (seed * 22695477 + 1) | 0;
  const rnd = () => ((rs = (Math.imul(rs, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  const blobs = [{ x: 0, y: 0.62, z: 0, r: 0.72 }];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.5;
    const rad = 0.34 + rnd() * 0.16;
    blobs.push({
      x: Math.cos(a) * rad,
      y: 0.46 + rnd() * 0.40,
      z: Math.sin(a) * rad,
      r: 0.44 + rnd() * 0.16,
    });
  }

  const { mesh } = buildBlobCanopy({
    seed,
    blobs,
    res,
    // 立方体必须**完整包住**球堆：球顶在 y≈1.46，第一版 size 2.6 / min -1.3 只到 1.3，
    // 顶部被裁掉 → 等值面在边界上收成两个尖角，看着像绿色的蝙蝠。
    size: 3.4,
    min: [-1.7, -1.7, -1.7],
    relax: true,
  });

  const verts = mesh.verts;
  const tris = mesh.tris;

  // 量包围盒：水平居中、底部落在 y=0、高度归一化到 height
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of verts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const sy = height / Math.max(0.001, maxY - minY);
  const sxz = sy * 0.92;      // 稍微压扁一点，别太"球"

  const pos = new Float32Array(verts.length * 3);
  const col = new Float32Array(verts.length * 3);
  const base = new THREE.Color(tint);

  verts.forEach((v, i) => {
    pos[i * 3] = (v[0] - cx) * sxz;
    pos[i * 3 + 1] = (v[1] - minY) * sy;
    pos[i * 3 + 2] = (v[2] - cz) * sxz;
    // 底部压暗、顶部提亮：impostor 烘焙时没有光，明暗只能烘进顶点色
    const t = Math.min(1, Math.max(0, (v[1] - minY) / Math.max(0.001, maxY - minY)));
    // 顶部 1.0、底部 0.55：只靠明暗表达体积，不做光照（和整页的平光风格一致）
    const k = 0.55 + 0.45 * t;
    const c = shade(base, k);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  });

  const idx = new Uint32Array(tris.length * 3);
  tris.forEach((t, i) => { idx[i * 3] = t[0]; idx[i * 3 + 1] = t[1]; idx[i * 3 + 2] = t[2]; });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  return { geometry: geo, height, verts: verts.length, tris: tris.length };
}
