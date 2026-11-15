#!/usr/bin/env node
/**
 * layoutEdena.mjs — Edena BD 排版（六条硬规则）
 * 绝不调用外部图像生成；图片全部相对路径指向 shots/。
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

function shotById(plan) {
  const m = new Map();
  for (const s of plan.shots) m.set(s.id, s);
  return m;
}

function imgOrMissing(shotId, title) {
  const src = `../shots/${shotId}.png`;
  return `<img src="${esc(src)}" alt="${esc(title || shotId)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'panel-missing',textContent:'缺少截屏：${esc(shotId)}.png'}))" />`;
}

function dialogHtml(shot, show) {
  if (!show || !shot?.dialog?.text) return "";
  const sp = shot.dialog.speaker
    ? `<span class="speaker">${esc(shot.dialog.speaker)}</span>`
    : "";
  return `<div class="dialog-balloon">${sp}${esc(shot.dialog.text)}</div>`;
}

function captionHtml(shot, show) {
  if (!show || !shot?.caption) return "";
  return `<div class="caption-bar">${esc(shot.caption)}</div>`;
}

function stripTitleBar(title, byline) {
  if (!title) return "";
  return `<div class="strip-title-bar"><span class="strip-title">${esc(title)}</span><span class="strip-byline">${esc(byline || "CartonBook")}</span></div>`;
}

function renderPanel(shot, panel, opts = {}) {
  const role = panel.role ? ` role-${esc(panel.role)}` : "";
  const titleBar = opts.stripTitle
    ? stripTitleBar(opts.stripTitle, opts.stripByline)
    : "";
  return `<figure class="panel${role}">
  <div class="panel-frame">
    ${titleBar}
    ${imgOrMissing(panel.shotId, shot?.title)}
    ${dialogHtml(shot, panel.showDialog)}
  </div>
  ${captionHtml(shot, panel.showCaption)}
</figure>`;
}

function cssHrefFromPages() {
  return "../../../layouts/edena.css";
}

function renderCover(plan, page) {
  const id = page.panels[0]?.shotId;
  if (!id) throw new Error("封面必须引用一个 shotId");
  const rawTitle = page.title || plan.title;
  const shortTitle = String(rawTitle).replace(/^.*?·\s*/, "");
  const titleHtml = esc(shortTitle).replace("，", "，<br>");
  const place = String(plan.title).includes("·") ? String(plan.title).split("·")[0].trim() : plan.scene;
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.title)}</title><link rel="stylesheet" href="${cssHrefFromPages()}"></head><body>
<article class="book-page cover cover-spread" aria-label="跨页封面，左右两页">
 <div class="cover-continuous"><img src="../shots/${esc(id)}.png" alt="${esc(plan.title)}跨页全景"></div>
 <div class="cover-leaf left-leaf"><span class="cover-series">${esc(plan.series || "信使纪事")}</span><p class="cover-line">${esc(plan.coverTagline || plan.subtitle)}</p></div>
 <div class="cover-leaf right-leaf"><div class="cover-book-title"><span>${esc(plan.subtitle)}</span><h1>${titleHtml}</h1><p>${esc(place)}</p></div></div>
 <div class="book-fold" aria-hidden="true"></div>
</article></body></html>`;
}
function renderProse(plan, page) {
 return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.title)} · 序</title><link rel="stylesheet" href="${cssHrefFromPages()}"></head><body><article class="book-page prose"><div class="chapter-story"><small>${esc(plan.title.split("·")[0].trim())} / 序</small><h2>${esc(page.title || plan.title)}</h2>${plan.story.split("\n\n").map(p=>`<p>${esc(p)}</p>`).join("")}</div><footer class="page-footer"><span>序 · 完整故事</span><span>${esc(plan.subtitle)}</span></footer></article></body></html>`;
}

function gridClass(page) {
  const tpl = page.template || "edena-stack-3";
  let cls = `panel-grid tpl-${tpl}`;
  if (page.rhythm === "depart") {
    cls += " journey-depart";
  }
  return cls;
}

function renderStoryPage(plan, page, shots, pageIndex, pageCount) {
  const byline = `Edena · ${pageIndex}/${pageCount}`;
  const panels = page.panels.map((p, i) => {
    const stripTitle = i === 0 ? page.title || plan.title : null;
    return renderPanel(shots.get(p.shotId), p, {
      stripTitle,
      stripByline: byline,
    });
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(plan.title)} · ${esc(page.title || page.id)}</title>
<link rel="stylesheet" href="${cssHrefFromPages()}" />
</head>
<body>
<article class="book-page story">
  <div class="${gridClass(page)}">
${panels}
  </div>
  <footer class="page-footer">
    <span>竖条横幅 · 大留白 · 少字</span>
    <span>${esc(page.id)}</span>
  </footer>
</article>
</body>
</html>
`;
}

/**
 * @param {object} plan
 * @param {{ chapterDir: string }} opts
 */
export function layoutEdena(plan, opts) {
  const chapterDir = opts.chapterDir;
  const pagesDir = path.join(chapterDir, "pages");
  fs.mkdirSync(pagesDir, { recursive: true });
  const shots = shotById(plan);
  fs.mkdirSync(path.join(chapterDir, "shots"), { recursive: true });

  const storyPages = plan.pages.filter((p) => p.kind === "story");
  const storyCount = Math.max(storyPages.length, 1);
  const written = [];

  let pageIdx = 0;
  let storyIdx = 0;
  for (const page of plan.pages) {
    let html;
    let filename;
    if (page.kind === "cover" || page.template === "cover") {
      html = renderCover(plan, page);
      filename = "cover.html";
    } else {
      pageIdx += 1;
      filename = `page-${String(pageIdx).padStart(2, "0")}.html`;
      if (page.kind === "prose") {
        html = renderProse(plan, page);
      } else {
        storyIdx += 1;
        html = renderStoryPage(plan, page, shots, storyIdx, storyCount);
      }
    }
    const out = path.join(pagesDir, filename);
    fs.writeFileSync(out, html, "utf8");
    written.push({ id: page.id, file: filename, path: out });
  }

  const indexLinks = written
    .map(
      (w) =>
        `<li><a href="${esc(w.file)}">${esc(w.id)} · ${esc(w.file)}</a></li>`
    )
    .join("\n");
  fs.writeFileSync(
    path.join(pagesDir, "index.html"),
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${esc(plan.title)} 页列表</title>
<link rel="stylesheet" href="${cssHrefFromPages()}"/></head>
<body><div class="book-shell"><h1>${esc(plan.title)}</h1>
<p class="hard-constraint">画面全部来自游戏截屏</p>
<ul>${indexLinks}</ul>
<p><a href="../book.html">打开完整书 book.html</a></p>
</div></body></html>`,
    "utf8"
  );

  return { pagesDir, written };
}

export default layoutEdena;
