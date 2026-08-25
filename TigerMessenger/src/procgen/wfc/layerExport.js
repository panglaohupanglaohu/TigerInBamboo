// =====================================================================
//  Layer Export — 体素解逐层导出 occupancy / variant / socket /
//  support heatmap（JSON + SVG）（V7-G5）
//  纯数据导出：JSON 结构供分析/缓存，SVG 字符串供 debug 页面直接
//  内嵌。不依赖 Three.js / DOM。
// =====================================================================

/**
 * 逐层导出体素解。
 * @param {object} model voxel-module-3d 模型
 * @param {object} result solveVoxelModel 的解（ok:true）
 * @returns {{kind:string, width:number, depth:number, height:number,
 *   layers:Array<{y:number, occupancy:number[], variants:string[],
 *   sockets:Array<object>, support:number[]}>}}
 *   每层数组均按 cell index 序（y 层内 z-major, x-minor）：
 *   · occupancy：1=实体（variant 无 "void" tag 且 family 非 "empty"），0=空
 *   · variants：variant key
 *   · sockets：{ N,E,S,W,U,D } → connector（未声明的面为 null）
 *   · support：support heatmap = 该 cell U 面 support 值（向上承重能力）
 */
export function exportVoxelLayers(model, result) {
  if (!model || model.kind !== "voxel-module-3d") throw new Error("exportVoxelLayers requires a voxel module model");
  if (!result?.ok) throw new Error("exportVoxelLayers requires a solved result");
  const { graph, compiled } = model;
  const { width, depth, height } = graph;
  const layerSize = width * depth;
  const layers = [];
  for (let y = 0; y < height; y++) {
    const occupancy = new Array(layerSize);
    const variants = new Array(layerSize);
    const sockets = new Array(layerSize);
    const support = new Array(layerSize);
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const index = (y * depth + z) * width + x;
        const slot = z * width + x;
        const variant = compiled.variants[result.assignment[index]];
        const isVoid = variant.tags?.includes("void") || variant.family === "empty";
        occupancy[slot] = isVoid ? 0 : 1;
        variants[slot] = variant.key;
        const faces = variant.faces || {};
        sockets[slot] = {
          N: faces.N?.connector ?? null,
          E: faces.E?.connector ?? null,
          S: faces.S?.connector ?? null,
          W: faces.W?.connector ?? null,
          U: faces.U?.connector ?? null,
          D: faces.D?.connector ?? null,
        };
        support[slot] = faces.U?.support ?? 0;
      }
    }
    layers.push({ y, occupancy, variants, sockets, support });
  }
  return { kind: "voxel-layer-export", width, depth, height, layers };
}

/** 灰度蓝（空）→ 砖红（承重高）的 support 热力色 */
function heatColor(occupied, support, maxSupport) {
  if (!occupied) return "#1b2430"; // 空 cell：暗底
  const t = maxSupport > 0 ? Math.min(1, support / maxSupport) : 0;
  const r = Math.round(0x6b + (0xd9 - 0x6b) * t);
  const g = Math.round(0x75 + (0x45 - 0x75) * t);
  const b = Math.round(0x8c + (0x32 - 0x8c) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * 每层渲染一张 SVG（矩形网格，颜色 = support heatmap，空 cell 暗底，
 * 左上角标注 variant 序号）。返回字符串数组（y 升序），纯字符串拼接。
 * @param {object} exported exportVoxelLayers 输出
 * @param {number} [cellSize=24] 每格像素
 */
export function voxelLayersToSvg(exported, cellSize = 24) {
  if (!exported || exported.kind !== "voxel-layer-export") {
    throw new Error("voxelLayersToSvg requires a voxel-layer-export");
  }
  const { width, depth, layers } = exported;
  let maxSupport = 0;
  for (const layer of layers) for (const s of layer.support) maxSupport = Math.max(maxSupport, s);
  const variantOrder = [];
  const variantColor = new Map();
  for (const layer of layers) {
    for (const key of layer.variants) {
      if (!variantColor.has(key)) {
        variantColor.set(key, variantOrder.length);
        variantOrder.push(key);
      }
    }
  }
  return layers.map((layer) => {
    const w = width * cellSize;
    const h = depth * cellSize;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + 16}" width="${w}" height="${h + 16}">`,
      `<text x="2" y="${h + 12}" font-size="10" fill="#ccc">layer y=${layer.y}</text>`,
    ];
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const slot = z * width + x;
        const fill = heatColor(layer.occupancy[slot], layer.support[slot], maxSupport);
        parts.push(
          `<rect x="${x * cellSize}" y="${z * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}" stroke="#0a0f16" stroke-width="1"/>`
        );
        if (layer.occupancy[slot]) {
          parts.push(
            `<text x="${x * cellSize + 3}" y="${z * cellSize + 12}" font-size="9" fill="#0a0f16">${variantColor.get(layer.variants[slot])}</text>`
          );
        }
      }
    }
    parts.push("</svg>");
    return parts.join("");
  });
}
