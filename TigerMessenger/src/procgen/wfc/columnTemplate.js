// =====================================================================
//  Column Template — 局部生成的未生成邻域模板（V7-G5）
//  局部生成只覆盖部分 column 时，未生成邻域用 default/boundary 模板
//  填充占位，供支撑/净空校验与导出层消费。模板 cell 一律带
//  template:true 标记，与 solver 坍缩结果严格可区分，禁止冒充。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/**
 * 创建 column 模板。
 * @param {object} opts
 * @param {object} opts.graph voxel-grid-3d 图适配器
 * @param {Array<string|null>} opts.defaultColumn 默认 column：每层的
 *   variant key（或 null = 该层不填模板）
 * @param {Object<string,Array<string|null>>} [opts.columns]
 *   逐 column 覆盖，键为 "x,z"
 */
export function createColumnTemplate({ graph, defaultColumn, columns = {} } = {}) {
  if (!graph || graph.kind !== "voxel-grid-3d") throw new Error("ColumnTemplate requires a voxel-grid-3d graph");
  if (!Array.isArray(defaultColumn) || defaultColumn.length !== graph.height) {
    throw new Error(`ColumnTemplate: defaultColumn must have ${graph.height} layers`);
  }
  for (const [key, layers] of Object.entries(columns)) {
    if (!Array.isArray(layers) || layers.length !== graph.height) {
      throw new Error(`ColumnTemplate: column "${key}" must have ${graph.height} layers`);
    }
  }
  return Object.freeze({
    kind: "column-template",
    height: graph.height,
    defaultColumn: Object.freeze([...defaultColumn]),
    columns: Object.freeze(Object.fromEntries(Object.entries(columns).map(([k, v]) => [k, Object.freeze([...v])]))),
  });
}

/**
 * 实例化模板：为不在 generatedCells 内的 column 生成占位条目。
 * 输出条目一律 { cell, variant, template: true } —— template 标记是
 * 与 solver 坍缩结果（pins/assignment，无此字段）的硬性区分。
 * @param {object} graph voxel-grid-3d 图适配器
 * @param {object} template createColumnTemplate 输出
 * @param {Iterable<string>} [generatedCells] 已生成区域的 cell id 集合
 * @returns {Array<{cell:string, variant:string, template:true}>}（稳定升序 cell 序）
 */
export function instantiateColumnTemplate(graph, template, generatedCells = []) {
  if (!template || template.kind !== "column-template") throw new Error("instantiateColumnTemplate requires a column template");
  const generated = new Set(generatedCells);
  const out = [];
  for (let z = 0; z < graph.depth; z++) {
    for (let x = 0; x < graph.width; x++) {
      const layers = template.columns[`${x},${z}`] ?? template.defaultColumn;
      for (let y = 0; y < graph.height; y++) {
        const id = `v:${x}:${y}:${z}`;
        if (generated.has(id)) continue;
        const variant = layers[y];
        if (variant == null) continue;
        out.push({ cell: id, variant, template: true });
      }
    }
  }
  return out;
}

/**
 * 合并 solver 解与模板占位：solver 结果权威，模板只填未生成邻域。
 * 返回条目带 source 区分（"solver" | "template"），模板 cell 不会被
 * 当成已坍缩结果。
 */
export function mergeSolutionWithTemplate(result, templateEntries) {
  if (!result?.ok) throw new Error("mergeSolutionWithTemplate requires a solved result");
  const out = [];
  for (const [cell, variant] of Object.entries(result.assignmentByCellId)) {
    out.push({ cell, variant, template: false, source: "solver" });
  }
  for (const entry of templateEntries) {
    if (result.assignmentByCellId[entry.cell] !== undefined) {
      throw new Error(`mergeSolutionWithTemplate: template cell ${entry.cell} overlaps solver result`);
    }
    out.push({ ...entry, template: true, source: "template" });
  }
  out.sort((a, b) => (a.cell < b.cell ? -1 : a.cell > b.cell ? 1 : 0));
  return out;
}
