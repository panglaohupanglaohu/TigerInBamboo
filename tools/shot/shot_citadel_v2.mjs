import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger";
const OUT = "/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/images";
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".css":"text/css", ".json":"application/json", ".png":"image/png" };
const server = http.createServer((req, res) => {
  const p = path.resolve(ROOT, "." + decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(8809, "127.0.0.1", r));
const CHROME = path.join(os.homedir(), "Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=angle","--use-angle=swiftshader","--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
await page.goto("http://127.0.0.1:8809/townscaper.html");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1800);
await page.selectOption("#objectSelect", "citadel");
await page.waitForTimeout(1200);

// 中键拖拽旋转 ~180° 看背面（附屋+水巷）
async function drag(dx, dy) {
  await page.mouse.move(480, 400);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(480 + dx, 400 + dy, { steps: 20 });
  await page.mouse.up({ button: "middle" });
  await page.waitForTimeout(300);
}
await drag(550, 0);           // 转 ~190°
await page.screenshot({ path: path.join(OUT, "citadel-v2-back.png") });
await drag(0, -130);          // 抬高视角看屋顶/露台围栏
await page.screenshot({ path: path.join(OUT, "citadel-v2-back-top.png") });
await browser.close(); server.close();
console.log("done");
