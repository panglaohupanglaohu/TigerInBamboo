#!/usr/bin/env node
/**
 * planChapter.mjs — 故事板/场景描述 → 镜头计划
 * 纯规则 + 模板，不调用文生图。
 */
import fs from "node:fs";
import path from "node:path";

const PRESET_DEFAULTS = {
  cover: { dist: 28, orbit: 0.3, pitch: 0.2 },
  wide: { dist: 22, orbit: 0.4, pitch: 0.15 },
  medium: { dist: 12, orbit: 0.1, pitch: 0.05 },
  close: { dist: 7, orbit: 0, pitch: 0.1 },
  high: { dist: 20, orbit: 0.2, pitch: 0.55 },
};

/**
 * @param {object} recipe
 * @param {{ chapterDir: string }} opts
 */
export function planChapter(recipe, opts) {
  if (!recipe?.id) throw new Error("recipe.id 必填");
  if (!Array.isArray(recipe.storyboard) || !recipe.storyboard.length) {
    throw new Error("recipe.storyboard 不能为空");
  }
  if (!Array.isArray(recipe.pages) || recipe.pages.length < 2) {
    throw new Error("recipe.pages 至少含封面 + 1 页分镜");
  }

  const shotMap = new Map();
  const shots = recipe.storyboard.map((raw, i) => {
    const id = raw.id || `shot-${i + 1}`;
    const preset = raw.camera?.preset || (i === 0 ? "cover" : "medium");
    const defaults = PRESET_DEFAULTS[preset] || PRESET_DEFAULTS.medium;
    const camera = {
      preset,
      landmark: raw.camera?.landmark ?? null,
      dist: raw.camera?.dist ?? defaults.dist,
      orbit: raw.camera?.orbit ?? defaults.orbit,
      pitch: raw.camera?.pitch ?? defaults.pitch,
      waitMs: raw.camera?.waitMs ?? 800,
    };
    // 保留科学镜头族字段（captureShots 读 mode/family/fov）
    if (raw.camera?.mode) camera.mode = raw.camera.mode;
    if (raw.camera?.family) camera.family = raw.camera.family;
    if (raw.camera?.fov != null) camera.fov = raw.camera.fov;
    const shot = {
      id,
      title: raw.title || id,
      note: raw.note || "",
      camera,
      caption: raw.caption || "",
      dialog: normalizeDialog(raw.dialog),
      outFile: `shots/${id}.png`,
    };
    shotMap.set(id, shot);
    return shot;
  });

  const pages = recipe.pages.map((p, pi) => {
    const panels = (p.panels || []).map((panel, j) => {
      if (!shotMap.has(panel.shotId)) {
        throw new Error(`页面 ${p.id || pi} 引用未知 shotId: ${panel.shotId}`);
      }
      return {
        shotId: panel.shotId,
        role: panel.role || null,
        showCaption: panel.showCaption !== false,
        showDialog: panel.showDialog !== false,
      };
    });
    return {
      id: p.id || `page-${String(pi).padStart(2, "0")}`,
      kind: p.kind || (pi === 0 ? "cover" : "story"),
      template: p.template || (pi === 0 ? "cover" : "edena-stack-3"),
      title: p.title || "",
      rhythm: p.rhythm || null,
      panels,
    };
  });

  const plan = {
    id: recipe.id,
    title: recipe.title || recipe.id,
    subtitle: recipe.subtitle || "",
    scene: recipe.scene || "messenger",
    gameUrl: recipe.gameUrl || null,
    timeOfDay: recipe.timeOfDay ?? null,
    viewport: recipe.viewport || { width: 1280, height: 800 },
    notes: recipe.notes || "",
    hardConstraint: "all-images-from-game-screenshots",
    createdAt: new Date().toISOString(),
    shots,
    pages,
  };

  const chapterDir = opts.chapterDir;
  fs.mkdirSync(chapterDir, { recursive: true });
  const planPath = path.join(chapterDir, "plan.json");
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");
  return { plan, planPath };
}

function normalizeDialog(dialog) {
  if (!dialog) return null;
  if (typeof dialog === "string") return { speaker: "", text: dialog };
  return {
    speaker: dialog.speaker || "",
    text: dialog.text || "",
  };
}

export default planChapter;
