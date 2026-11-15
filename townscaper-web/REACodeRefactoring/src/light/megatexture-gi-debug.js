/**
 * megatexture-gi-debug.js — 把 megatexture-gi 的三张贴图画成 RGBA（对应 1580845127207387137 上方三张调试图）：
 *   ① SDF 体积：y 切片平铺；空格 R,G = 最近纹素 UV，B = 距离/最大距离；实心格暗红（-距离）。
 *   ② 六向光体积：+X −X / +Y −Y / +Z −Z 六块，每块再把 y 切片平铺；x/(1+x) 色调映射 + sRGB。
 *   ③ mega texture：图集本身（被照亮的出射光 / 反照率 / 直射 / 间接）。
 * 纯函数，node 与浏览器共用（不碰 DOM）。
 */
const enc = (a) => { a = a / (1 + a); return Math.round(255 * (a <= .0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - .055)); };

export function sdfImage(r) {
  const { nx, ny, nz } = r.vox, cols = Math.ceil(Math.sqrt(ny)), rows = Math.ceil(ny / cols), W = cols * nx, H = rows * nz, data = new Uint8ClampedArray(W * H * 4), rgba = r.sdfuv.rgba, maxD = r.sdfuv.sdf.maxDistance;
  for (let y = 0; y < ny; y++) {
    const ox = (y % cols) * nx, oy = Math.floor(y / cols) * nz;
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const k = (z * ny + y) * nx + x, o = ((oy + z) * W + ox + x) * 4, d = rgba[k * 4 + 3];
      if (d < 0 || rgba[k * 4] < 0) { data[o] = 60 + 120 * Math.min(1, -d / maxD * 4); data[o + 1] = 20; data[o + 2] = 30; }
      else { data[o] = 255 * rgba[k * 4]; data[o + 1] = 255 * rgba[k * 4 + 1]; data[o + 2] = 255 * Math.min(1, .35 + d / maxD); }
      data[o + 3] = 255;
    }
  }
  return { w: W, h: H, data, cols, rows };
}

export function lightVolumeImage(r, lv = r.lv) {
  const { lnx, lny, lnz, lsolid } = r, cols = Math.ceil(Math.sqrt(lny)), rows = Math.ceil(lny / cols), PW = cols * lnx + 2, PH = rows * lnz + 2, W = PW * 3, H = PH * 2, data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = 32; data[i * 4 + 1] = 52; data[i * 4 + 2] = 60; data[i * 4 + 3] = 255; }
  for (let d = 0; d < 6; d++) {
    const px = (d >> 1) * PW, py = (d & 1) * PH;
    for (let y = 0; y < lny; y++) {
      const ox = px + 1 + (y % cols) * lnx, oy = py + 1 + Math.floor(y / cols) * lnz;
      for (let z = 0; z < lnz; z++) for (let x = 0; x < lnx; x++) {
        const k = (z * lny + y) * lnx + x, o = ((oy + z) * W + ox + x) * 4;
        if (lsolid[k]) { data[o] = data[o + 1] = data[o + 2] = 0; continue; }
        for (let c = 0; c < 3; c++) data[o + c] = enc(lv[(k * 6 + d) * 3 + c]);
      }
    }
  }
  return { w: W, h: H, data };
}

export function megaTextureImage(r, field = 'exitance', values = null) {
  const m = r.mega, W = m.W, H = m.H, data = new Uint8ClampedArray(W * H * 4), src = values ?? (field === 'albedo' ? m.albedo : r[field]);
  for (let i = 0; i < W * H; i++) {
    const t = m.atlas[i], o = i * 4; data[o + 3] = 255;
    if (t < 0) continue;
    for (let c = 0; c < 3; c++) data[o + c] = field === 'albedo' ? Math.round(255 * src[t * 3 + c]) : enc(src[t * 3 + c] * 1.6);
  }
  return { w: W, h: H, data };
}
