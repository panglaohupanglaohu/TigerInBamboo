import fs from "node:fs";
import { resolvePlaywright } from "./src/captureShots.mjs";

const pw = await resolvePlaywright();
if (!pw?.chromium) {
  console.error("no playwright");
  process.exit(1);
}
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOpts = {
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
};
if (fs.existsSync(CHROME)) launchOpts.executablePath = CHROME;
else launchOpts.channel = "chrome";

const browser = await pw.chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const url =
  "http://127.0.0.1:8931/TigerMessenger/?scene=messenger&autostart=1&cartonCapture=1&timeOfDay=0.75&dev=1";
console.log("goto", url);
page.on("pageerror", (e) => console.warn("pageerror", String(e.message).slice(0, 140)));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

let ready = false;
for (let i = 0; i < 70; i++) {
  const st = await page
    .evaluate(() => {
      const btn =
        document.getElementById("start-btn") ||
        document.querySelector("button#start, .start-btn");
      if (btn) btn.click();
      document.getElementById("intro")?.classList.add("hidden");
      const tm = window.__tm;
      return {
        hasCam: !!tm?.camera,
        captureQs: location.search.includes("cartonCapture=1"),
        bookshop: !!tm?.messenger?.landmarks?.bookshop,
        landmarkKeys: tm?.messenger?.landmarks
          ? Object.keys(tm.messenger.landmarks).slice(0, 12)
          : [],
      };
    })
    .catch((e) => ({ err: String(e) }));
  console.log("t", i, JSON.stringify(st));
  if (st.hasCam) {
    ready = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 3000));
}
if (!ready) {
  console.error("FAIL no __tm.camera");
  await browser.close();
  process.exit(2);
}

await page.evaluate(() => {
  window.__tm?.setCaptureMode?.(true);
});
const clean = await page.evaluate(() => {
  const ids = [
    "minimap-panel",
    "quest-panel",
    "hud",
    "hint-panel",
    "controls-dock",
    "touch-toggle",
    "touch-toggle-slot",
    "tm-perf-probe",
    "bubble",
    "bubble-crosshair",
    "npc-hint",
    "toast",
    "rescue-campaign",
  ];
  const vis = [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const hidden =
      st.visibility === "hidden" ||
      st.display === "none" ||
      st.opacity === "0" ||
      r.width < 1 ||
      r.height < 1;
    if (!hidden) vis.push(id);
  }
  return {
    captureMode: !!window.__tm?.isCaptureMode?.(),
    classClean: document.documentElement.classList.contains("tm-capture-clean"),
    vis,
  };
});
console.log("CLEAN", JSON.stringify(clean));

await page.evaluate(() => {
  const tm = window.__tm;
  const T = tm.THREE;
  const lm = tm.messenger?.landmarks?.bookshop;
  const obj = lm?.isObject3D ? lm : lm?.group || lm?.root || lm?.mesh || lm;
  tm.scene?.updateMatrixWorld?.(true);
  let target = null;
  if (obj?.getWorldPosition) target = obj.getWorldPosition(new T.Vector3());
  else if (obj?.position?.clone) target = obj.position.clone();
  const player = tm.player;
  if (target && player) {
    const up = target.clone().normalize();
    const side = new T.Vector3()
      .crossVectors(up, new T.Vector3(1, 0, 0.3))
      .normalize();
    player.position
      .copy(target)
      .addScaledVector(side, 14)
      .addScaledVector(up, 0.6);
    if (player.velocity) player.velocity.set(0, 0, 0);
  }
  tm.cameraRig?.setFirstPerson?.(false);
  tm.cameraRig?.setDist?.(34);
  tm.cameraRig?.setFov?.(72);
  tm.cameraRig?.snapToPlayer?.();
  if (tm.camera && target) {
    const up2 = player.position.clone().normalize();
    tm.camera.position
      .copy(player.position)
      .addScaledVector(up2, 34 * 0.85)
      .addScaledVector(player.forward || new T.Vector3(0, 0, 1), -34 * 0.45);
    tm.camera.up.copy(up2);
    tm.camera.lookAt(target);
    tm.renderer?.render(tm.scene, tm.camera);
  }
});
await page.waitForTimeout(1000);

const out =
  "/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/chapters/messenger-tide-letter/_smoke-c0.png";
const dataUrl = await page.evaluate(() => {
  const tm = window.__tm;
  const c = tm?.renderer?.domElement;
  if (!c) return null;
  tm.renderer.render(tm.scene, tm.camera);
  return c.toDataURL("image/png");
});
if (!dataUrl) {
  console.error("no canvas data");
  await browser.close();
  process.exit(3);
}
fs.writeFileSync(
  out,
  Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64")
);
console.log("SMOKE_OK", out, fs.statSync(out).size);
await browser.close();
