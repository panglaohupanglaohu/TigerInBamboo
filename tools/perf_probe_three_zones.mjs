// 性能复测探针：SwiftShader 无头测量 三区 帧耗时（相对值，不代表真机 GPU）
// 用法：node tools/perf_probe_three_zones.mjs
// 输出：每区 60 帧的平均帧耗时 ms 与网格数
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const target = path.join(root, "TigerMessenger/index.html");

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const p = path.join(path.dirname(target), rel);
  const file = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(path.dirname(target), "index.html");
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".png": "image/png", ".json": "application/json", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(m.text());
});

await page.goto(`http://127.0.0.1:${port}/index.html?local=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
if (await page.locator("#start-btn").count()) {
  await page.click("#start-btn");
  await page.waitForTimeout(1500);
}

// 修正版测量（数据经 window 中转）
async function measure(label, pos, lookDir) {
  await page.evaluate(
    async ({ pos, lookDir }) => {
      const T = window.__tm;
      const cam = T.camera;
      cam.position.set(pos[0], pos[1], pos[2]);
      cam.lookAt(new THREE.Vector3(lookDir[0], lookDir[1], lookDir[2]));
      await new Promise((resolve) => {
        let count = 0;
        const times = [];
        let last = performance.now();
        const step = () => {
          const now = performance.now();
          times.push(now - last);
          last = now;
          count++;
          if (count >= 60) {
            times.shift();
            let meshCount = 0;
            T.scene.traverse((o) => { if (o.isMesh) meshCount++; });
            window.__probeData = {
              avgMs: times.reduce((a, b) => a + b, 0) / times.length,
              meshCount,
            };
            resolve();
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      });
    },
    { pos, lookDir }
  );
  const data = await page.evaluate(() => window.__probeData);
  console.log(`[${label}] 平均帧耗时 ${data.avgMs.toFixed(1)} ms · 场景网格 ${data.meshCount}`);
  return { label, ...data };
}

// 三区：圣城 / 出生岛 / 巨松区（西芳寺主石之庭）
// 圣城：站点 lat 24.1/lon 36.05 → 世界位约 R*dir；用 citadelSiteDir 辅助
const zones = await page.evaluate(() => {
  const T = window.__tm;
  const R = 160;
  const out = {};
  try {
    // 圣城中心
    const citadel = T.scene.getObjectByName("castleContainer") || null;
    if (citadel) out.citadel = citadel.position.toArray();
  } catch { /* noop */ }
  // 出生岛：找 spawn/camp 锚点
  try {
    const camp = T.scene.getObjectByName("starting-camp") || T.scene.getObjectByName("camp-root") || null;
    if (camp) out.spawn = camp.position.toArray();
  } catch { /* noop */ }
  // 西芳寺
  try {
    const saihoji = T.scene.getObjectByName("SaihojiSixScenes") || null;
    if (saihoji) out.saihoji = saihoji.position.toArray();
  } catch { /* noop */ }
  return out;
});
console.log("锚点:", JSON.stringify(zones));

// 兜底：若锚点缺失，用已知站点方位
if (!zones.citadel) zones.citadel = [0, 156, 0];
if (!zones.spawn) zones.spawn = [0, 159, 10];
if (!zones.saihoji) zones.saihoji = [0, 159, -40];

// 圣城视角：站城外看城
await measure("圣城 citadel", zones.citadel, [0, 160, 0]);
// 出生岛
await measure("出生岛 spawn", zones.spawn, [0, 160, 0]);
// 巨松区（西芳寺）：saihoji 中心朝外看
await measure("巨松区 saihoji", zones.saihoji, [0, 160, 0]);

await page.screenshot({ path: path.join(here, "perf-probe-zones.png") });
await browser.close();
server.close();

if (problems.length) {
  console.error("页面异常:", problems.slice(0, 5));
  process.exit(1);
}
console.log("探针完成 ✅");
