#!/usr/bin/env node
/** 将 book.html 按完整跨页导出为真实 PDF；不经过截图或文生图。 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const CARTON = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadChromium() {
  const candidates = [
    "playwright",
    path.join(CARTON, "../tools/shot/node_modules/playwright"),
    "playwright-core",
  ];
  for (const candidate of candidates) {
    try {
      const pw = require(candidate);
      if (pw.chromium) return pw.chromium;
    } catch {}
  }
  throw new Error("未找到 Playwright；请安装 playwright，或保留 ../tools/shot/node_modules/playwright");
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

export async function exportPdf(plan, opts) {
  const chapterDir = opts.chapterDir;
  const bookPath = path.join(chapterDir, "book.html");
  const pdfPath = path.join(chapterDir, "book.pdf");
  if (!fs.existsSync(bookPath)) throw new Error("book.html 不存在，请先运行 export");

  const chromium = loadChromium();
  const executablePath = chromePath();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(pathToFileURL(bookPath).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.querySelectorAll(".book-section").forEach(section => { section.hidden = false; });
      const images = [...document.images];
      images.forEach(img => { img.loading = "eager"; });
      await Promise.all(images.map(img => img.complete ? img.decode().catch(() => {}) : new Promise(resolve => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      })));
      await document.fonts.ready;
    });
    const broken = await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.getAttribute("src")));
    if (broken.length) throw new Error(`PDF 导出前图片加载失败: ${broken.join(", ")}`);
    if (errors.length) throw new Error(`PDF 导出前页面脚本错误: ${errors.join("; ")}`);
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }

  const data = fs.readFileSync(pdfPath);
  if (data.length < 10000 || data.subarray(0, 5).toString() !== "%PDF-" || !data.includes("%%EOF")) {
    throw new Error("PDF 文件校验失败");
  }
  return { pdfPath, bytes: data.length };
}

export default exportPdf;
