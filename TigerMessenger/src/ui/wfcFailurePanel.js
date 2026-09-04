// =====================================================================
//  WFC 失败只读列表（门 G）。纯 DOM，无重试/重启按钮。
// =====================================================================

function row(text) {
  const el = document.createElement("div");
  el.textContent = text;
  return el;
}

/**
 * @param {HTMLElement} container
 * @param {object|null} failure  solveTownSelection().failure
 */
export function renderWfcFailure(container, failure) {
  if (!container) return;
  if (!failure) {
    container.textContent = "WFC: ok";
    return;
  }
  const involved = failure.conflict?.involvedCells ?? [];
  const relax = failure.suggestedRelaxations ?? [];
  const lines = [
    `reason: ${failure.reason ?? "?"}`,
    `empty cell: ${failure.conflict?.emptyCell ?? failure.cell ?? "?"}`,
    `involved: ${involved.join(" ")}`,
    ...relax.map((s) => `relax: ${typeof s === "string" ? s : JSON.stringify(s)}`),
  ];
  container.replaceChildren(...lines.map(row));
}

/** 在开发者面板里挂一个只读 WFC 区块。 */
export function mountWfcFailureSection(panel) {
  if (!panel) return null;
  const group = document.createElement("div");
  group.className = "dev-group";
  group.textContent = "WFC";
  const box = document.createElement("div");
  box.id = "dev-wfc-failure";
  box.textContent = "WFC: ok";
  panel.appendChild(group);
  panel.appendChild(box);
  return box;
}
