// 场切片导出（V7-G7 / TODO 1185）：沿轴切一片标量场，导出 JSON/SVG/PNG，
// 显示 iso 边界、语义色板与 primitive provenance。PNG 编码复用 colorblindSim。
import { encodePng } from "./colorblindSim.mjs";
import { SEMANTIC_NAMES, SEMANTIC_COLORS } from "../../TigerMessenger/src/procgen/field/semantics.js";

// provenance 无语义通道时的调色板（按 primitive index 轮转）
const PROVENANCE_COLORS = Object.freeze([
  [128, 96, 170], [200, 120, 60], [60, 150, 150], [180, 80, 110], [110, 140, 60], [90, 110, 200],
]);

// 沿 axis 在网格 index 处切片；u/v 为切片内两个面内轴。
// provenanceAt(x, y, z) → primitive index（可选）。
export function sliceField(field, { axis = 1, index = 0, provenanceAt = null } = {}) {
  if (!Number.isInteger(axis) || axis < 0 || axis > 2) throw new Error("slice axis must be 0/1/2");
  const res = [field.resolution.x, field.resolution.y, field.resolution.z];
  if (!Number.isInteger(index) || index < 0 || index >= res[axis]) throw new Error(`slice index out of range for axis ${axis}`);
  const u = (axis + 1) % 3; const v = (axis + 2) % 3;
  const width = res[u]; const height = res[v];
  const values = new Float32Array(width * height);
  const semantics = field.semantics ? new Uint8Array(width * height) : null;
  const provenance = typeof provenanceAt === "function" ? new Int32Array(width * height) : null;
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const c = [0, 0, 0]; c[axis] = index; c[u] = i; c[v] = j;
    const k = j * width + i;
    values[k] = field.valueAt(c[0], c[1], c[2]);
    if (semantics) semantics[k] = field.semantics[field.index(c[0], c[1], c[2])];
    if (provenance) provenance[k] = provenanceAt(c[0], c[1], c[2]);
  }
  return { axis, index, width, height, values, semantics, provenance };
}

// iso 边界：实体内部（value < iso）且四邻有外部的格
function isBoundary(slice, i, j, iso) {
  const { width, height, values } = slice;
  if (values[j * width + i] >= iso) return false;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = i + di; const y = j + dj;
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    if (values[y * width + x] >= iso) return true;
  }
  return false;
}

function cellColor(slice, k, iso) {
  const inside = slice.values[k] < iso;
  if (slice.semantics) {
    const c = SEMANTIC_COLORS[slice.semantics[k] % SEMANTIC_COLORS.length];
    return inside ? c : c.map((x) => Math.round(x * 0.25 + 190));
  }
  if (slice.provenance) {
    const c = PROVENANCE_COLORS[((slice.provenance[k] % PROVENANCE_COLORS.length) + PROVENANCE_COLORS.length) % PROVENANCE_COLORS.length];
    return inside ? c : [235, 235, 235];
  }
  return inside ? [90, 90, 90] : [235, 235, 235];
}

export function sliceToJson(slice, { iso = 0, provenanceNames = null } = {}) {
  return {
    axis: slice.axis, index: slice.index, width: slice.width, height: slice.height, iso,
    semanticNames: SEMANTIC_NAMES.slice(),
    provenanceNames: provenanceNames ? provenanceNames.slice() : null,
    values: Array.from(slice.values),
    semantics: slice.semantics ? Array.from(slice.semantics) : null,
    provenance: slice.provenance ? Array.from(slice.provenance) : null,
  };
}

export function sliceToSvg(slice, { iso = 0, cell = 10 } = {}) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${slice.width * cell}" height="${slice.height * cell}" viewBox="0 0 ${slice.width * cell} ${slice.height * cell}">`];
  parts.push(`<title>field slice axis=${slice.axis} index=${slice.index} iso=${iso}</title>`);
  for (let j = 0; j < slice.height; j++) for (let i = 0; i < slice.width; i++) {
    const k = j * slice.width + i;
    const [r, g, b] = cellColor(slice, k, iso);
    const boundary = isBoundary(slice, i, j, iso);
    parts.push(`<rect x="${i * cell}" y="${j * cell}" width="${cell}" height="${cell}" fill="rgb(${r},${g},${b})"${boundary ? ' stroke="#000" stroke-width="1"' : ""}/>`);
  }
  parts.push("</svg>");
  return parts.join("\n");
}

export function sliceToPng(slice, { iso = 0 } = {}) {
  const rgba = new Uint8Array(slice.width * slice.height * 4);
  for (let j = 0; j < slice.height; j++) for (let i = 0; i < slice.width; i++) {
    const k = j * slice.width + i;
    const [r, g, b] = isBoundary(slice, i, j, iso) ? [0, 0, 0] : cellColor(slice, k, iso);
    rgba[k * 4] = r; rgba[k * 4 + 1] = g; rgba[k * 4 + 2] = b; rgba[k * 4 + 3] = 255;
  }
  return encodePng(slice.width, slice.height, rgba);
}
