#!/usr/bin/env node
/**
 * exportBook.mjs — 汇总可翻页 HTML 书 + 更新 viewer
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARTON = path.resolve(__dirname, "..");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} plan
 * @param {{ chapterDir: string, layoutResult?: object }} opts
 */
export function exportBook(plan, opts) {
  const chapterDir = opts.chapterDir;
  const pagesDir = path.join(chapterDir, "pages");
  const requiresLive = plan.noFixtures === true || ["bookshop-letter", "messenger-tide-letter"].includes(plan.id);
  if (requiresLive) {
    const manifestPath = path.join(chapterDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error("正式导出需要 manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.realCapture || manifest.mode !== "live" || manifest.shots?.some(e => !e.ok || !e.captureClean)) {
      throw new Error("正式导出需要全部真实、无 HUD 截图；fixtures / incomplete / placeholder 均禁止发布");
    }
    if (plan.id === "bookshop-letter" && plan.story) {
      const reviewed = new Set(manifest.visualReview?.approvedShotIds || []);
      const missingReview = plan.shots.map(s => s.id).filter(id => !reviewed.has(id));
      if (manifest.visualReview?.status !== "approved" || missingReview.length) {
        throw new Error(`正式导出前必须逐张肉眼验收；未通过镜头: ${missingReview.join(", ") || "尚未签署视觉验收"}`);
      }
    }
  }
  if (!fs.existsSync(pagesDir)) {
    throw new Error("pages/ 不存在，请先运行 layout");
  }

  let leafIndex = 0;
  const pageFiles = plan.pages.map((page) => {
    if (page.kind === "cover" || page.template === "cover") return "cover.html";
    leafIndex += 1;
    return `page-${String(leafIndex).padStart(2, "0")}.html`;
  });
  const missingPages = pageFiles.filter(f => !fs.existsSync(path.join(pagesDir, f)));
  if (missingPages.length) throw new Error(`缺少本次计划页面，请先重新 layout: ${missingPages.join(", ")}`);

  if (pageFiles.length < 2) {
    throw new Error("需要封面 + 至少一页分镜 HTML");
  }

  // 内联：用同文档多 section + 打印分页；显式 spread/single 决定翻页单位。
  const useSpread = plan.layout !== "single";
  const spreads = useSpread
    ? [pageFiles.slice(0, 1), ...Array.from({ length: Math.ceil((pageFiles.length - 1) / 2) }, (_, i) => pageFiles.slice(1 + i * 2, 3 + i * 2))]
    : pageFiles.map(f => [f]);
  const sections = spreads.map((files, i) => {
    const articles = files.map(f => {
      const raw = fs.readFileSync(path.join(pagesDir, f), "utf8");
      const match = raw.match(/<article[\s\S]*?<\/article>/i);
      if (!match) throw new Error(`Missing article: ${f}`);
      return match[0].replace(/(?:\.\.\/)+shots\//g, "shots/");
    }).join("\n");
    return `<section class="book-section ${files.length === 2 ? "spread-inner" : "spread-cover"}" data-page="${i}" ${i === 0 ? "" : "hidden"}>${articles}</section>`;
  }).join("\n");
  const pageButtons = spreads.map((files, i) => {
    const label = i === 0 ? (useSpread ? "跨页封面" : "封面") : useSpread ? `${i * 2 - 1}${files.length === 2 ? `—${i * 2}` : ""}` : String(i);
    return `<button type="button" data-go="${i}" class="${i === 0 ? "is-active" : ""}">${label}</button>`;
  }).join("\n");
  const turnLabel = useSpread ? "跨页" : "页";
  const pdfName = `${String(plan.title || plan.id).replace(/[\\/:*?"<>|]/g, "-")}.pdf`;
  const nav = `${pageButtons}\n<button type="button" data-go="prev">上一${turnLabel}</button><button type="button" data-go="next">下一${turnLabel}</button>\n<a class="download-pdf" id="download-pdf" href="book.pdf" download="${esc(pdfName)}">下载 PDF</a>`;

  const bookHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(plan.title)} · CartonBook</title>
<link rel="stylesheet" href="../../layouts/edena.css" />
<style>
  .book-section[hidden] { display: none !important; }
  @media print {
    @page { size: 1380px 920px; margin: 0; }
    html, body { width: 1380px; margin: 0 !important; padding: 0 !important; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .book-shell, .book-shell:has(.cover-spread), #book { width: 1380px; max-width: none; margin: 0; padding: 0; }
    .book-section[hidden] { display: block !important; }
    .book-section, .book-section.spread-cover, .book-section.spread-inner {
      width: 1380px; height: 920px; min-height: 920px; max-width: none;
      margin: 0; overflow: hidden; box-shadow: none;
      break-after: page; page-break-after: always;
    }
    .book-section.spread-inner { display: grid !important; grid-template-columns: 1fr 1fr; gap: 0; }
    .book-section.spread-cover { display: block !important; }
    .book-section:last-child { break-after: auto; page-break-after: auto; }
    .spread-inner .book-page { width: 690px; height: 920px; min-height: 920px; margin: 0; break-after: auto; page-break-after: auto; }
    .book-page.cover-spread { width: 1380px; height: 920px; min-height: 0; aspect-ratio: auto; break-after: auto; page-break-after: auto; }
    .book-nav, .hard-constraint { display: none !important; }
  }
</style>
</head>
<body>
<div class="book-shell">
  <p class="hard-constraint">${esc(plan.title)}</p>
  <nav class="book-nav" id="nav">
${nav}
  </nav>
  <div id="book">
${sections}
  </div>
</div>
<script>
(function () {
  const sections = [...document.querySelectorAll(".book-section")];
  const buttons = [...document.querySelectorAll("#nav [data-go]")];
  let i = 0;
  function show(n) {
    i = Math.max(0, Math.min(sections.length - 1, n));
    sections.forEach((s, k) => { s.hidden = k !== i; });
    buttons.forEach((b) => {
      const g = b.getAttribute("data-go");
      if (g === "prev" || g === "next") return;
      b.classList.toggle("is-active", Number(g) === i);
    });
  }
  document.getElementById("nav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    const g = b.getAttribute("data-go");
    if (g === "prev") show(i - 1);
    else if (g === "next") show(i + 1);
    else show(Number(g));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") show(i + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") show(i - 1);
  });
  show(0);
})();
</script>
</body>
</html>
`;

  const bookPath = path.join(chapterDir, "book.html");
  if (bookHtml.includes("../shots/")) {
    throw new Error("exportBook: book.html still contains ../shots/ after rewrite — abort");
  }
  const imgSrcs = [...bookHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const src of imgSrcs) {
    if (src.includes("../shots/") || src.startsWith("../")) {
      throw new Error(`exportBook: bad img src for chapter-root book.html: ${src}`);
    }
    if (!src.startsWith("shots/")) {
      console.warn("[exportBook] unexpected img src (expected shots/...):", src);
    } else if (!fs.existsSync(path.join(chapterDir, src))) {
      throw new Error(`exportBook: 缺少图片 ${src}`);
    }
  }
  fs.writeFileSync(bookPath, bookHtml, "utf8");

  // 更新 viewer
  updateViewer(plan, bookPath);

  return { bookPath, pageFiles };
}

function updateViewer(plan, bookPath) {
  const viewerDir = path.join(CARTON, "viewer");
  fs.mkdirSync(viewerDir, { recursive: true });
  const chaptersRoot = path.join(CARTON, "chapters");
  const chapters = fs
    .readdirSync(chaptersRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter((id) => fs.existsSync(path.join(chaptersRoot, id, "book.html")))
    .sort();

  const cards = chapters
    .map((id) => {
      let title = id;
      let subtitle = "";
      let realCapture = null;
      let mode = "";
      let visualStatus = "unknown";
      try {
        const p = JSON.parse(
          fs.readFileSync(path.join(chaptersRoot, id, "plan.json"), "utf8")
        );
        title = p.title || id;
        subtitle = p.subtitle || "";
      } catch {}
      try {
        const m = JSON.parse(
          fs.readFileSync(path.join(chaptersRoot, id, "manifest.json"), "utf8")
        );
        realCapture = !!m.realCapture;
        mode = m.mode || (realCapture ? "live" : "fixtures");
        visualStatus = m.visualReview?.status || (realCapture ? "pending" : "not-required");
      } catch {}
      const badge = realCapture && visualStatus === "approved"
        ? `<span class="badge ok">真截 · 已视觉验收</span>`
        : realCapture
          ? `<span class="badge warn">真截 · 待视觉验收</span>`
          : `<span class="badge warn">${esc(mode || "unknown")}（仅排版 / 未验收）</span>`;
      return `<li class="chapter-card">
  <a class="chapter-link" href="../chapters/${esc(id)}/book.html">
    <strong>${esc(title)}</strong>
    ${subtitle ? `<span class="sub">${esc(subtitle)}</span>` : ""}
  </a>
  <div class="meta"><code>${esc(id)}</code> ${badge}${mode ? ` · <code>${esc(mode)}</code>` : ""}</div>
</li>`;
    })
    .join("\n");

  const homeBody = (title, homeNote) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<link rel="stylesheet" href="../layouts/edena.css" />
<style>
  .home-hero { margin-bottom: 1.25rem; }
  .home-hero h1 { margin: 0 0 0.35rem; font-size: 1.75rem; }
  .home-hero .lede { color: var(--ink-soft); margin: 0.4rem 0 0; line-height: 1.55; }
  .chapter-card { list-style: none; margin: 0 0 0.85rem; padding: 0.9rem 1rem; border: 1.5px solid var(--ink); background: #fffdf8; }
  .chapter-card .chapter-link { text-decoration: none; color: var(--ink); display: flex; flex-direction: column; gap: 0.25rem; }
  .chapter-card .sub { font-size: 0.92rem; color: var(--ink-soft); }
  .chapter-card .meta { margin-top: 0.55rem; font-family: var(--font-ui); font-size: 12px; color: var(--ink-soft); }
  .badge { display: inline-block; padding: 0.1rem 0.45rem; border: 1px solid var(--ink); border-radius: 999px; font-size: 11px; }
  .badge.ok { background: #e8f5e6; }
  .badge.warn { background: #f7ecd6; }
  .home-links { margin-top: 1.5rem; font-family: var(--font-ui); font-size: 13px; }
  .home-links a { margin-right: 0.85rem; }
  ul.chapter-list { padding: 0; margin: 0; }
</style>
</head>
<body>
<div class="book-shell">
  <header class="home-hero">
    <h1>${esc(title)}</h1>
    <p class="hard-constraint">所有画面来自 TigerMessenger 游戏截屏 · 禁止文生图 / 图生动画</p>
    <p class="lede">${homeNote}</p>
  </header>
  <ul class="chapter-list">
${cards || "<li class=\"chapter-card\">（尚无章节，先运行 <code>node src/cli.mjs layout-only --recipe …</code>）</li>"}
  </ul>
  <p class="home-links">
    <a href="../chapters/bookshop-letter/book.html">打开样章 book.html</a>
    <a href="../docs/DESIGN.md">设计文档</a>
    <a href="../docs/QA-CHECKLIST.md">QA 清单</a>
    <a href="../README.md">README</a>
  </p>
</div>
</body>
</html>
`;

  const html = homeBody(
    "CartonBook Viewer",
    "本地 HTTP 目录页。请用 <code>npm run serve</code>（端口 8787）打开，不要依赖 file://。"
  );
  fs.writeFileSync(path.join(viewerDir, "index.html"), html, "utf8");

  // web/ — same chapter list (paths relative to web/)
  const webDir = path.join(CARTON, "web");
  fs.mkdirSync(webDir, { recursive: true });
  const webHtml = homeBody(
    "CartonBook",
    "Web 首页。样章与目录均可浏览器打开；后续正式控制台将覆盖选题 → 跑管线 → 翻书。"
  );
  fs.writeFileSync(path.join(webDir, "index.html"), webHtml, "utf8");
}

export default exportBook;
