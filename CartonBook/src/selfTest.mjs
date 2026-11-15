#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planChapter } from "./planChapter.mjs";
import { layoutEdena } from "./layoutEdena.mjs";
import { exportBook } from "./exportBook.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipe = JSON.parse(fs.readFileSync(path.join(root, "recipes/bookshop-letter.sample.json"), "utf8"));
const work = path.join(root, "artifacts/self-test/bookshop-letter");
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const { plan } = planChapter(recipe, { chapterDir: work });
assert.equal(plan.shots.length, 24, "封面 + 23 个故事镜头");
assert.equal(new Set(plan.shots.map(s => s.id)).size, plan.shots.length, "shot id 不得重复");
assert.equal(plan.layout, "spread");
assert.equal(plan.noFixtures, true);
const referenced = plan.pages.flatMap(p => p.panels.map(panel => panel.shotId));
assert.deepEqual(new Set(referenced), new Set(plan.shots.map(s => s.id)), "每个镜头必须且只应进入页面映射");
assert.equal(referenced.length, plan.shots.length, "不得漏用 s16–s23 或重复占格");

const macro = planChapter({
  id: "camera-defaults",
  storyboard: [{ id: "macro", camera: { mode: "macro" } }, { id: "pilot", camera: { mode: "airshipPilot" } }],
  pages: [{ id: "cover", kind: "cover", panels: [{ shotId: "macro" }] }, { id: "p", kind: "story", panels: [{ shotId: "pilot" }] }],
}, { chapterDir: path.join(root, "artifacts/self-test/camera-defaults") }).plan;
assert.equal(macro.shots[0].camera.dist, 4.5, "macro 不得被 medium 默认 dist 覆盖");
assert.equal(macro.shots[1].camera.fov, 82, "airshipPilot 默认 FOV 82");

const layout = layoutEdena(plan, { chapterDir: work });
assert.equal(layout.written.length, 9, "双页封面 + 序页 + 7 个故事叶");
const cover = fs.readFileSync(path.join(work, "pages/cover.html"), "utf8");
assert.match(cover, /cover-spread/);
assert.match(cover, /四盏灯，<br>一封信/);
assert.doesNotMatch(cover, /门仍/);

const finalShots = path.join(root, "chapters/bookshop-letter/shots");
fs.mkdirSync(path.join(work, "shots"), { recursive: true });
for (const shot of plan.shots) {
  const source = path.join(finalShots, `${shot.id}.png`);
  const fallback = path.join(finalShots, "cover.png");
  fs.copyFileSync(fs.existsSync(source) ? source : fallback, path.join(work, "shots", `${shot.id}.png`));
}
const manifest = {
  id: plan.id,
  mode: "live",
  realCapture: true,
  visualReview: { status: "pending", approvedShotIds: [] },
  shots: plan.shots.map(s => ({ shotId: s.id, ok: true, captureClean: true })),
};
fs.writeFileSync(path.join(work, "manifest.json"), JSON.stringify(manifest));
assert.throws(() => exportBook(plan, { chapterDir: work, layoutResult: layout }), /肉眼验收/, "未肉眼验收不得正式发布");

manifest.visualReview = { status: "approved", approvedShotIds: plan.shots.map(s => s.id) };
fs.writeFileSync(path.join(work, "manifest.json"), JSON.stringify(manifest));
const result = exportBook(plan, { chapterDir: work, layoutResult: layout });
const book = fs.readFileSync(result.bookPath, "utf8");
assert.equal((book.match(/<section class="book-section/g) || []).length, 5, "封面 + 四个内跨页");
assert.equal((book.match(/data-go="prev"/g) || []).length, 1, "不得重复上一页导航");
assert.equal((book.match(/data-go="next"/g) || []).length, 1, "不得重复下一页导航");
assert.equal((book.match(/id="download-pdf"/g) || []).length, 1, "必须提供 PDF 下载入口");
assert.match(book, /href="book.pdf" download=/, "下载入口必须指向真实 book.pdf");
assert.match(book, /@page \{ size: 1380px 920px; margin: 0; \}/, "PDF 必须按完整跨页设置纸张");
assert.ok(!book.includes("../shots/"), "章节根 book.html 必须使用 shots/ 路径");
for (const shot of plan.shots) assert.ok(book.includes(`shots/${shot.id}.png`), `book.html 漏用 ${shot.id}`);

console.log(JSON.stringify({ ok: true, shots: plan.shots.length, leaves: layout.written.length, spreads: 5, checks: ["全镜头入书", "双页封面", "镜头族默认值", "视觉验收门禁", "图片路径", "导航去重"] }, null, 2));
