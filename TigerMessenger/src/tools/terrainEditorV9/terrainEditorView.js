// Small DOM view for the V9 authoring session.  It is intentionally state-only:
// the same commands can be driven by a worker, keyboard or a test DOM.

import { TERRAIN_BRUSHES } from "./terrainEditorCore.js";

const COLORS = Object.freeze({ grassland: "#9abf79", forest: "#47745c", mountain: "#d4c09d", canyon: "#9b654b", lake: "#77aeb2", river: "#91c8cf", empty: "#555b60" });

function svgElement(document, tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function renderTerrainContours(document, svg, field) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const width = Math.max(1, field.width); const height = Math.max(1, field.height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  for (const cell of field.cells || []) {
    const color = COLORS[cell.biome] || COLORS.grassland;
    const rect = svgElement(document, "rect", { x: cell.x, y: height - cell.y - 1, width: 1, height: 1, fill: color, "data-cell-id": cell.id, "data-height": cell.height.toFixed(3), opacity: 0.55 + Math.min(0.45, Math.abs(cell.height) * 0.03) });
    if (cell.hardLock) rect.setAttribute("stroke", "#f6d36b");
    svg.appendChild(rect);
  }
  return svg;
}

export function createTerrainEditorV9View({ document, container, session } = {}) {
  if (!document || !container || !session) throw new Error("terrain editor view requires document, container and session");
  const root = document.createElement("section");
  root.dataset.terrainEditor = "v9";
  root.className = "terrain-editor-v9";
  const toolbar = document.createElement("div");
  toolbar.dataset.role = "brush-toolbar";
  const status = document.createElement("output");
  status.dataset.role = "status";
  const svg = svgElement(document, "svg", { role: "img", "aria-label": "terrain contours" });
  svg.dataset.role = "contours";
  const controls = document.createElement("div");
  controls.dataset.role = "brush-controls";
  const radius = document.createElement("input"); radius.type = "number"; radius.value = "2"; radius.step = "0.5"; radius.dataset.role = "radius";
  const strength = document.createElement("input"); strength.type = "number"; strength.value = "1"; strength.step = "0.1"; strength.dataset.role = "strength";
  controls.append(radius, strength);
  let activeBrush = "raise";
  for (const brush of TERRAIN_BRUSHES) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.brush = brush; button.textContent = brush;
    button.addEventListener("click", () => { activeBrush = brush; status.value = `brush:${brush}`; });
    toolbar.appendChild(button);
  }
  const applyButton = document.createElement("button");
  applyButton.type = "button"; applyButton.dataset.action = "apply"; applyButton.textContent = "apply";
  applyButton.addEventListener("click", () => {
    const result = session.apply({ kind: activeBrush, center: [session.snapshot().field.width / 2, session.snapshot().field.height / 2], radius: Number(radius.value), strength: Number(strength.value) });
    status.value = result.ok ? `applied:${result.transaction.id}` : `blocked:${result.reason}`;
    refresh();
  });
  const undoButton = document.createElement("button"); undoButton.type = "button"; undoButton.dataset.action = "undo"; undoButton.textContent = "undo"; undoButton.addEventListener("click", () => { session.undo(); refresh(); });
  const redoButton = document.createElement("button"); redoButton.type = "button"; redoButton.dataset.action = "redo"; redoButton.textContent = "redo"; redoButton.addEventListener("click", () => { session.redo(); refresh(); });
  controls.append(applyButton, undoButton, redoButton);
  root.append(toolbar, controls, svg, status);
  container.appendChild(root);

  function refresh() { renderTerrainContours(document, svg, session.snapshot().field); return root; }
  root.refresh = refresh;
  root.session = session;
  refresh();
  return root;
}
