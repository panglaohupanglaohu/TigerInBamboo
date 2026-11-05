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
  if (!fs.existsSync(pagesDir)) {
    throw new Error("pages/ 不存在，请先运行 layout");
  }

  const pageFiles = fs
    .readdirSync(pagesDir)
    .filter((f) => f === "cover.html" || /^page-\d+\.html$/.test(f))
    .sort((a, b) => {
      if (a === "cover.html") return -1;
      if (b === "cover.html") return 1;
      return a.localeCompare(b);
    });

  if (pageFiles.length < 2) {
    throw new Error("需要封面 + 至少一页分镜 HTML");
  }

  // 内联：用同文档多 section + 打印分页；导航切换显示
  const sections = pageFiles
    .map((f, i) => {
      const raw = fs.readFileSync(path.join(pagesDir, f), "utf8");
      const m = raw.match(/<article[\s\S]*?<\/article>/i);
      let article = m ? m[0] : `<article class="book-page"><p>${esc(f)}</p></article>`;
      // pages/ uses ../shots/; book.html sits beside shots/ so rewrite for the book document
      // also normalize any accidental ../../shots/ or ./../shots/
      article = article.replace(/(?:\.\.\/)+shots\//g, "shots/");
      if (article.includes("../shots/")) {
        throw new Error(`exportBook: failed to rewrite ../shots/ in ${f}`);
      }
      return `<section class="book-section" data-page="${i}" ${i === 0 ? "" : "hidden"}>\n${article}\n</section>`;
    })
    .join("\n");

  const nav = pageFiles
    .map((f, i) => {
      const label = f === "cover.html" ? "封面" : f.replace(".html", "");
      return `<button type="button" data-go="${i}" class="${i === 0 ? "is-active" : ""}">${esc(label)}</button>`;
    })
    .join("\n");

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
    .book-section[hidden] { display: block !important; }
    .book-section { page-break-after: always; }
  }
</style>
</head>
<body>
<div class="book-shell">
  <p class="hard-constraint">CartonBook · 所有画面来自 TigerMessenger 游戏截屏 · 禁止文生图</p>
  <nav class="book-nav" id="nav">
${nav}
    <button type="button" data-go="prev">上一页</button>
    <button type="button" data-go="next">下一页</button>
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
      } catch {}
      const badge = realCapture
        ? `<span class="badge ok">真截屏</span>`
        : `<span class="badge warn">样章/fixtures（仅排版）</span>`;
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
