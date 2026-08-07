// 在 TigerMessenger 上启动静态服务器，用无头 Chromium(SwiftShader) 渲染每项并保存 PNG
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const ROOT = path.resolve(REPO, "TigerMessenger");
const OUT = path.resolve(__dirname, "images");
const PORT = 8799;
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.resolve(ROOT, "." + path.sep + urlPath.replace(/^\/+/, ""));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("404: " + urlPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log(`[server] http://127.0.0.1:${PORT}  root=${ROOT}`);

const URL = `http://127.0.0.1:${PORT}/shot-harness.html`;

const withTimeout = (p, ms, tag) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout " + ms + "ms (" + tag + ")")), ms)),
  ]);

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function renderOne(id) {
  // 每项独立启动浏览器，彻底隔离 GPU 状态（避免某项卡死拖垮后续）
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    headless: true,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--disable-gpu-sandbox",
    ],
  });
  let result = { ok: false, error: "unknown" };
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    page.on("pageerror", (e) => console.log("  [pageerror]", id, e.message));
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
    result = await withTimeout(
      page.evaluate(async (i) => {
        if (typeof window.renderItem !== "function") return { ok: false, error: "renderItem 未定义" };
        return await window.renderItem(i);
      }, id),
      25000,
      id
    );
  } catch (e) {
    result = { ok: false, error: (e && e.message) ? e.message : String(e) };
  } finally {
    try { await browser.close(); } catch {}
  }
  return result;
}

const report = [];
// 先开一页读取注册表 id 列表（仅读取，不渲染，快速）
let ids = [];
{
  const b0 = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const p0 = await b0.newPage({ viewport: { width: 512, height: 512 } });
  await p0.goto(URL, { waitUntil: "load", timeout: 30000 });
  await p0.waitForFunction(() => window.__ready === true, { timeout: 30000 }).catch(() => {});
  ids = await p0.evaluate(() => window.__REGISTRY_IDS || []);
  await b0.close();
}
console.log(`[items] ${ids.length} 项待渲染`);

// 支持只渲染指定项：node shot.mjs <id1> <id2> ...
const onlyArg = process.argv.slice(2);
if (onlyArg.length) {
  ids = ids.filter((i) => onlyArg.includes(i));
  console.log(`[filter] 仅渲染 ${ids.length} 项: ${ids.join(", ")}`);
}

for (const id of ids) {
  const r = await renderOne(id);
  if (r.ok && r.dataUrl) {
    const b64 = r.dataUrl.split(",")[1];
    fs.writeFileSync(path.join(OUT, `${id}.png`), Buffer.from(b64, "base64"));
    report.push({ id, ok: true, label: r.label, cat: r.cat });
    console.log(`  ✓ ${id}  (${r.cat} / ${r.label})`);
  } else {
    report.push({ id, ok: false, error: r.error || "unknown" });
    console.log(`  ✗ ${id}  -> ${r.error || "unknown"}`);
  }
}

fs.writeFileSync(path.join(OUT, "_report.json"), JSON.stringify(report, null, 2));
const ok = report.filter((r) => r.ok).length;
console.log(`\n[done] 成功 ${ok}/${report.length}`);

server.close();
