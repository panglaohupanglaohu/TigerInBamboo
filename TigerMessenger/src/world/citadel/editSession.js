// =====================================================================
//  编辑会话：预览 → 提交 → 0.22s 生长动画 → 帧边界切换碰撞（V6-G6）
//  纯数据。动画不改 collisionHash。
// =====================================================================

import { createModuleCatalog } from "./moduleCatalog.js";
import { extractTownCells, resolveTown } from "./moduleResolver.js";
import { appearanceHash } from "./constraintSolver.js";
import { createBlueprintStore } from "./blueprintStore.js";
import { occupancyHash, previewEdit, screenshotHash } from "./editPreview.js";

export const EDIT_GROW_DURATION = 0.22;
export const EDIT_GROW_STAGGER = 0.018;
export const EDIT_FEEDBACK_MS = 150;
export const EDIT_P95_MS = 16;

export function animateModuleTransition(dirtyIds, opts = {}) {
  const duration = opts.duration ?? EDIT_GROW_DURATION;
  const stagger = opts.stagger ?? EDIT_GROW_STAGGER;
  const ids = [...(dirtyIds || [])].sort();
  const collisionHash = opts.collisionHash || "";
  const frames = ids.map((id, i) => ({
    id,
    t0: i * stagger,
    t1: i * stagger + duration,
  }));
  const span = duration + stagger * Math.max(0, ids.length - 1);
  return {
    duration: span,
    frames,
    collisionHash,
    sample(t) {
      const visual = {};
      for (const f of frames) {
        const u = t <= f.t0 ? 0 : t >= f.t1 ? 1 : (t - f.t0) / (f.t1 - f.t0);
        visual[f.id] = u;
      }
      return { visual, collisionHash, t };
    },
  };
}

export function hashesFromTown(town, cells) {
  const occ = occupancyHash(cells);
  const modules = appearanceHash(town.cells || town.solver?.cells || []);
  const props = (town.props?.placed || []).map((p) => `${p.slotId}:${p.kind}`).sort().join("|");
  const surface = `${cells.length}`;
  const nav = `${town.solver?.region?.length || 0}`;
  return {
    occupancy: occ,
    modules,
    props: props || "none",
    surface,
    nav,
    screenshot: screenshotHash({ occupancy: occ, modules, props }),
  };
}

export function createEditSession({ blueprint, catalog = createModuleCatalog(), seed = 7 } = {}) {
  const store = createBlueprintStore(blueprint);
  let pendingPatch = null;
  let previous = null;
  const cells0 = extractTownCells(store.current(), catalog);
  const initial = resolveTown(store.current(), catalog, seed);
  previous = initial.solver;
  let hashes = hashesFromTown(initial, cells0);
  const log = [];
  // 历史解缓存：blueprintHash → { solved, hashes }。
  // dirty 解只重求受影响区域，与 resolveTown 全量重求在区域内 tie-break 顺序不同，
  // undo/redo 若一律全量重求会导致 module hash 漂移；缓存保证回到历史状态时
  // blueprint/module/prop/surface/nav/screenshot 六类 hash 精确复原（V6-G6 undo/redo 项）。
  const solutionCache = new Map();
  solutionCache.set(store.hash(), { solved: initial.solver, hashes });

  function snapshotState() {
    return {
      blueprint: store.hash(),
      version: store.version(),
      ...hashes,
    };
  }

  /** undo/redo 后恢复历史解；未见过的状态（理论上不应出现）才全量重求并落缓存 */
  function restoreSolution() {
    const h = store.hash();
    let entry = solutionCache.get(h);
    if (!entry) {
      const cells = extractTownCells(store.current(), catalog);
      const solved = resolveTown(store.current(), catalog, seed);
      entry = { solved: solved.solver, hashes: hashesFromTown(solved, cells) };
      solutionCache.set(h, entry);
    }
    previous = entry.solved;
    hashes = entry.hashes;
  }

  return {
    store,
    preview(command) {
      return previewEdit(store.current(), command, catalog, seed, previous);
    },
    applyPlayerEdit(command) {
      const preview = previewEdit(store.current(), command, catalog, seed, previous);
      log.push({ type: "preview", ok: preview.ok, ms: preview.ms, dirty: preview.dirtyIds?.length || 0 });
      if (!preview.ok) {
        return { ok: false, preview, committed: false, hashes: snapshotState() };
      }
      const applied = store.apply(command);
      if (!applied.ok) return { ok: false, preview, applied, committed: false };
      previous = preview.solved;
      hashes = {
        occupancy: preview.occupancy,
        modules: preview.modules,
        props: hashes.props,
        surface: hashes.surface,
        nav: hashes.nav,
        screenshot: screenshotHash({ occupancy: preview.occupancy, modules: preview.modules, props: hashes.props }),
      };
      solutionCache.set(store.hash(), { solved: preview.solved, hashes });
      const collisionHash = hashes.screenshot;
      const animation = animateModuleTransition(preview.dirtyIds, { collisionHash });
      const patch = {
        dirtyIds: preview.dirtyIds,
        modules: preview.modules,
        occupancy: preview.occupancy,
        animation,
        collisionHash,
        version: applied.version,
      };
      pendingPatch = patch;
      return {
        ok: true,
        preview,
        committed: true,
        previewMs: preview.ms,
        applyMs: preview.ms,
        patch,
        hashes: snapshotState(),
      };
    },
    flush(apply) {
      if (!pendingPatch) return null;
      const patch = pendingPatch;
      pendingPatch = null;
      apply?.(patch);
      return patch;
    },
    undo() {
      const r = store.undo();
      if (!r.ok) return r;
      restoreSolution();
      pendingPatch = null;
      return { ok: true, hashes: snapshotState() };
    },
    redo() {
      const r = store.redo();
      if (!r.ok) return r;
      restoreSolution();
      pendingPatch = null;
      return { ok: true, hashes: snapshotState() };
    },
    hashes: snapshotState,
    log: () => log.slice(),
  };
}
