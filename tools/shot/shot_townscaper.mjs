// townscaper.html 编辑器页冒烟：无头 Chromium 加载 → 控制台零报错 →
// 未选择对象时编辑界面隐藏 → 选择高山圣城后出现 → 2D 面板点格加/删块 →
// 3D 空地加块 → 撤销 → 导出格式 → 截图目检
// 运行：node tools/shot/shot_townscaper.mjs
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const ROOT = path.resolve(REPO, "TigerMessenger");
const OUT = path.resolve(__dirname, "images");
const PORT = 8807;
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.resolve(ROOT, "." + path.sep + urlPath.replace(/^\/+/, ""));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end("404: " + urlPath);
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

// 本地 playwright 1.47 与浏览器缓存版本错位：直指已缓存的 Chrome for Testing。
const CHROME = path.join(
  os.homedir(),
  "Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
);
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

// 编辑器带 localStorage 存档：先清空，保证从 SPEC 起跑
await page.goto(`http://127.0.0.1:${PORT}/townscaper.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2000);

// ---------- 门控：未选择时编辑界面必须隐藏 ----------
const vis = await page.evaluate(() => ({
  tools: getComputedStyle(document.getElementById("editTools")).display,
  panel: getComputedStyle(document.getElementById("gridPanel")).display,
  stats: getComputedStyle(document.getElementById("stats")).display,
  placeholder: getComputedStyle(document.getElementById("placeholder")).display,
}));
console.log("[未选择]", JSON.stringify(vis));
if (vis.tools !== "none" || vis.panel !== "none" || vis.stats !== "none") {
  throw new Error("未选择对象时编辑界面必须隐藏");
}
if (vis.placeholder !== "flex") throw new Error("未选择对象时必须显示占位提示");

// ---------- 选择高山圣城 → 编辑界面出现 ----------
await page.selectOption("#objectSelect", "citadel");
await page.waitForTimeout(1200);
const vis2 = await page.evaluate(() => ({
  tools: getComputedStyle(document.getElementById("editTools")).display,
  panel: getComputedStyle(document.getElementById("gridPanel")).display,
  placeholder: getComputedStyle(document.getElementById("placeholder")).display,
}));
console.log("[已选择]", JSON.stringify(vis2));
if (vis2.tools === "none" || vis2.panel !== "block" || vis2.placeholder !== "none") {
  throw new Error("选择高山圣城后编辑界面必须出现");
}

const stats0 = await page.textContent("#stats");
console.log("[stats 初始]", stats0);
if (!/格 214 /.test(stats0)) throw new Error("初始统计应为 SPEC 214 格，实际：" + stats0);

// ---------- 2D 平面图面板：左键空格加块（ix=10, iz=10），右键同格删除 ----------
const panel = page.locator("#layerCanvas");
await panel.click({ position: { x: 10 * 26 + 13, y: 10 * 26 + 13 } });
await page.waitForTimeout(400);
const stats1 = await page.textContent("#stats");
console.log("[stats 面板加块后]", stats1);
if (!/格 215 /.test(stats1)) throw new Error("2D 面板加块失败：" + stats1);

await panel.click({ button: "right", position: { x: 10 * 26 + 13, y: 10 * 26 + 13 } });
await page.waitForTimeout(400);
const stats2 = await page.textContent("#stats");
console.log("[stats 面板删块后]", stats2);
if (!/格 214 /.test(stats2)) throw new Error("2D 面板删块失败：" + stats2);

// ---------- 3D：左键点击画布底部空地（当前层平面）→ 在 0 层加一块 ----------
await page.mouse.click(640, 770, { button: "left" });
await page.waitForTimeout(400);
const stats3 = await page.textContent("#stats");
console.log("[stats 3D 加块后]", stats3);
if (!/格 215 /.test(stats3)) throw new Error("3D 左键加块失败：" + stats3);

// Ctrl+Z 撤销回 222
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
const stats4 = await page.textContent("#stats");
console.log("[stats 撤销后]", stats4);
if (!/格 214 /.test(stats4)) throw new Error("撤销失败：" + stats4);

// ---------- 导出面板应能打开且包含 levels 字面量 ----------
await page.click("#exportBtn");
const exported = await page.inputValue("#ioText");
if (!exported.includes("Object.freeze([") || !exported.includes("levels:")) {
  throw new Error("导出格式异常");
}
console.log("[导出] 前 3 行：");
console.log(exported.split("\n").slice(0, 3).join("\n"));
await page.click("#ioClose");

await page.screenshot({ path: path.join(OUT, "townscaperEditor.png") });

if (errors.length) {
  console.error("[console errors]\n" + errors.join("\n"));
  throw new Error("页面存在控制台错误");
}
console.log("截图 → tools/shot/images/townscaperEditor.png");
console.log("全部通过：编辑器冒烟");

await browser.close();
server.close();
