import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve("D:/TigerInBamnoo/TigerMessenger");
const PORT = 8801;

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
console.log(`[server] http://127.0.0.1:${PORT}`);

const URL = `http://127.0.0.1:${PORT}/shot-harness.html`;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
page.on("console", (m) => console.log(`[console:${m.type()}]`, m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("requestfailed", (r) => console.log("[requestfailed]", r.url(), r.failure().errorText));

await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));

const status = await page.$eval("#status", (el) => el.textContent).catch(() => "no status");
const ready = await page.evaluate(() => window.__ready);
const ids = await page.evaluate(() => window.__REGISTRY_IDS);
console.log("status text:", status);
console.log("__ready:", ready);
console.log("__REGISTRY_IDS:", ids);

await browser.close();
server.close();
