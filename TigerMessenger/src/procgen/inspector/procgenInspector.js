// =====================================================================
// Procgen Inspector report（V7-G15）
// 面向开发/QA 的结构化报告，不在生产路径创建 DOM；可直接 JSON 导出。
// =====================================================================

const DEBUG_PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function createProcgenInspector({ jobId = null, profile = null, seed = null, debugEnabled = true, traceLimit = 512 } = {}) {
  const stages = [];
  const events = [];
  const trace = [];
  const wfcCells = new Map();
  const overlays = new Map();
  let fieldSlices = null;
  let workerStats = null;
  const pushTrace = (event) => { if (!debugEnabled) return; trace.push(event); if (trace.length > traceLimit) trace.splice(0, trace.length - traceLimit); };
  return {
    recordStage(name, details = {}, durationMs = null) { stages.push({ name, durationMs, details }); pushTrace({ type: "stage", name, durationMs }); return this; },
    recordEvent(type, data = {}) { events.push({ type, data }); pushTrace({ type, data }); return this; },
    recordWfcCell(cellId, { domainCount = 0, entropy = 0, variant = null, orientation = null, locked = false, decisionLevel = 0, prototype = null, sockets = null, support = null, clearance = null } = {}) {
      const id = String(cellId); wfcCells.set(id, { id, domainCount, entropy, variant, orientation, locked, decisionLevel, prototype, sockets, support, clearance }); return this;
    },
    setFieldSlices(slices = {}) { fieldSlices = { x: slices.x ?? null, y: slices.y ?? null, z: slices.z ?? null, iso: slices.iso ?? 0, semantic: slices.semantic ?? null, flow: slices.flow ?? null, primitiveProvenance: slices.primitiveProvenance ?? null, dirtyChunks: slices.dirtyChunks ?? [] }; return this; },
    setWorkerStats(stats = {}) { workerStats = { queue: stats.queue ?? {}, jobVersion: stats.jobVersion ?? null, cancelled: stats.cancelled ?? 0, cacheHit: stats.cacheHit ?? 0, phaseTime: stats.phaseTime ?? {}, mainApplyMs: stats.mainApplyMs ?? null, gpu: stats.gpu ?? {} }; return this; },
    setOverlay(name, payload = {}) { overlays.set(String(name), { id: String(name), ...payload }); return this; },
    report({ solution = null, field = null, mesh = null, failure = null } = {}) {
      return {
        version: 1,
        jobId, profile, seed,
        stages: stages.slice(),
        events: events.slice(),
        trace: trace.slice(),
        wfc: { cells: [...wfcCells.values()].sort((a, b) => a.id.localeCompare(b.id)), overlays: [...overlays.values()].sort((a, b) => a.id.localeCompare(b.id)) },
        solution: solution ? { ok: solution.ok, reason: solution.reason, hash: solution.solutionHash, stats: solution.stats } : null,
        field: field ? { resolution: field.resolution, bounds: { min: field.min, max: field.max }, minMax: field.minMax?.(), slices: fieldSlices } : { slices: fieldSlices },
        mesh: mesh ? { stats: mesh.stats, hasNormals: Boolean(mesh.normals), hasSemantics: Boolean(mesh.semantics), overlays: [...overlays.values()].filter((item) => item.kind === "mc").sort((a, b) => a.id.localeCompare(b.id)) } : null,
        worker: workerStats,
        failure: failure ? summarizeFailure(failure) : null,
      };
    },
    toJSON(input) { return JSON.stringify(this.report(input)); },
    toSVG(input = {}) {
      const report = this.report(input); const rows = report.wfc.cells.map((cell, index) => `<text x="8" y="${18 + index * 14}">${escapeXml(cell.id)} d=${cell.domainCount} e=${Number(cell.entropy).toFixed(3)} lock=${cell.locked}</text>`).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${Math.max(40, 28 + report.wfc.cells.length * 14)}"><rect width="100%" height="100%" fill="#14181c"/><g fill="#d7e2e8" font-family="monospace" font-size="11">${rows}</g></svg>`;
    },
    toPNG() { return `data:image/png;base64,${DEBUG_PNG_1X1}`; },
    artifacts(input = {}) { return { json: this.toJSON(input), svg: this.toSVG(input), png: this.toPNG() }; },
  };
}

function escapeXml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character])); }

export function summarizeFailure(result) {
  if (result?.ok) return null;
  return { reason: result?.reason || "unknown", cell: result?.cell ?? null, conflict: result?.conflict ?? null, suggestedRelaxations: result?.suggestedRelaxations ?? [] };
}
