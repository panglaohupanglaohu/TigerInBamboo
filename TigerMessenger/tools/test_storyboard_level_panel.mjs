import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../tools/shot/node_modules/playwright/index.mjs";

// Isolated UI harness: real workbench/module/CSS and real configured level,
// no running world, no model generation, no access to the user's browser storage.
const root = new URL("../", import.meta.url);
const levelPath = "godot/data/levels/swamp-rescue-v1.json";
const level = JSON.parse(await readFile(new URL(levelPath, root), "utf8"));
const html = await readFile(new URL("index.html", root), "utf8");
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join("\n");
const runId = `panel-${Date.now()}`;
const out = new URL(`artifacts/swamp-rescue-level/${runId}/`, root);
await mkdir(out, { recursive: true });
// Narrow UI capture contract: retry + expanded real configuration at each size.
const captures = ["desktop", "mobile"].flatMap(mode => ["load-failed", "configured", "armor-stage"].map(state => ({ mode, state, screenshot: `${mode}-${state}.png` })));
await writeFile(new URL("capture-contract.json", out), JSON.stringify({ runId, captures }, null, 2));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
const draft = { title: "保留我的旧故事", story: "原有正文不能被替换。", shots: [{ id: "user-shot", title: "旧分镜", note: "用户原有动作", assets: [] }] };
try {
  for (const mode of ["desktop", "mobile"]) {
    const viewport = mode === "desktop" ? { width: 1280, height: 900 } : { width: 390, height: 844 };
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    let levelRequests = 0;
    const unexpected = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(saved => {
      localStorage.setItem("tm.storyboard.workspace.v1", JSON.stringify(saved));
      window.__writes = [];
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { window.__writes.push(key); return setItem.call(this, key, value); };
      window.__executions = 0;
      window.__clears = 0;
    }, draft);
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/TigerMessenger/panel-test") {
        return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style><body><script type="module">import {createStoryboardPanel} from './src/story/storyboardPanel.js';window.panel=createStoryboardPanel({onExecute:()=>{window.__executions++;},onClear:()=>{window.__clears++;}});window.panel.setOpen(true);</script></body></html>` });
      }
      if (url.pathname.endsWith("/storyCatalog.js")) return route.fulfill({ contentType: "text/javascript", body: "export function getStoryCatalog(){return [{id:'fox',label:'红狐',category:'动物'}]}" });
      if (url.pathname.endsWith(`/${levelPath}`)) {
        levelRequests++;
        return route.fulfill({ status: levelRequests === 1 ? 503 : 200, contentType: "application/json", body: levelRequests === 1 ? "{}" : JSON.stringify(level) });
      }
      if (url.pathname.startsWith("/TigerMessenger/src/") && url.pathname.endsWith(".js")) {
        return route.fulfill({ contentType: "text/javascript", body: await readFile(new URL(url.pathname.slice("/TigerMessenger/".length), root), "utf8") });
      }
      unexpected.push(url.pathname);
      return route.abort();
    });
    await page.goto("http://127.0.0.1:8767/TigerMessenger/panel-test");
    await page.locator("#sb-title").waitFor();
    assert.equal(levelRequests, 0, "Level is lazy-loaded only on expansion");
    assert.equal(await page.locator("#sb-title").inputValue(), draft.title);
    await page.locator("#sb-level-config > summary").click();
    await page.getByRole("button", { name: "重新读取" }).waitFor();
    await page.screenshot({ path: new URL(`${mode}-load-failed.png`, out).pathname });
    await page.getByRole("button", { name: "重新读取" }).click();
    await page.getByText("已配置 · 尚未部署到游戏（只读查看）", { exact: true }).waitFor();
    assert.equal(await page.locator(".sb-level-stage").count(), level.stages.length);
    const targetIndex = Math.max(0, level.stages.findIndex(stage => /改装|盔甲/.test(stage.title)));
    const target = page.locator(".sb-level-stage").nth(targetIndex);
    await target.locator("summary").click();
    assert((await target.innerText()).includes(level.stages[targetIndex].objective));
    assert((await target.innerText()).includes("完成条件："));
    await page.locator("#sb-level-config > div").evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: new URL(`${mode}-configured.png`, out).pathname });
    await target.evaluate(node => node.scrollIntoView({ block: "nearest" }));
    await page.screenshot({ path: new URL(`${mode}-armor-stage.png`, out).pathname });
    const state = await page.evaluate(() => {
      const section = document.querySelector("#sb-level-config");
      const box = section.getBoundingClientRect();
      const inner = section.querySelector("div");
      return {
        saved: JSON.parse(localStorage.getItem("tm.storyboard.workspace.v1")),
        writes: window.__writes, executions: window.__executions, clears: window.__clears,
        hasHorizontalOverflow: inner.scrollWidth > inner.clientWidth + 1,
        inViewport: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
        download: section.querySelector("a").getAttribute("download"),
        text: section.textContent,
      };
    });
    assert.deepEqual(state.saved, draft);
    assert.deepEqual(state.writes, []);
    assert.equal(state.executions, 0);
    assert.equal(state.clears, 0);
    assert.equal(state.hasHorizontalOverflow, false);
    assert.equal(state.inViewport, true);
    assert.equal(state.download, "swamp-rescue-v1.json");
    assert(!state.text.includes("configured_not_deployed"));
    assert(!state.text.includes("待补充条件说明"));
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    // Collapsing/reopening uses the already loaded result and still leaves draft alone.
    await page.locator("#sb-level-config > summary").click();
    await page.locator("#sb-level-config > summary").click();
    assert.equal(levelRequests, 2);
    reports.push({ mode, viewport, stages: level.stages.length, levelRequests, oldDraftPreserved: true, noStorageWrites: true, noExecution: true, noHorizontalOverflow: true, errors });
    await context.close();
  }
  // textContent must keep configuration-authored markup inert.
  const page = await browser.newPage();
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(".json")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...level, title: '<img src=x onerror="window.__unsafe=1">' }) });
    if (url.pathname.endsWith("storyboardLevelPanel.js")) return route.fulfill({ contentType: "text/javascript", body: await readFile(new URL("src/story/storyboardLevelPanel.js", root), "utf8") });
    return route.fulfill({ contentType: "text/html", body: '<script type="module">import {createStoryboardLevelPanel} from "./src/story/storyboardLevelPanel.js";document.body.append(createStoryboardLevelPanel());document.querySelector("details").open=true;</script>' });
  });
  await page.goto("http://127.0.0.1:8767/TigerMessenger/security-test");
  await page.locator("#sb-level-config strong").waitFor();
  assert.equal(await page.locator("#sb-level-config img").count(), 0);
  assert.equal(await page.evaluate(() => !!window.__unsafe), false);
  await writeFile(new URL("report.json", out), JSON.stringify({ runId, passed: true, reports, inertText: true, scope: "Isolated real workbench UI; not gameplay deployment or full-world playtest." }, null, 2));
  console.log(JSON.stringify({ passed: true, out: out.pathname, reports }, null, 2));
} finally {
  await browser.close();
}
