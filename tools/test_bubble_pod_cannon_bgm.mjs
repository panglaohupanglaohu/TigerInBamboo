// 气泡艇开炮 BGM：第一次开炮起播 黄英华-Opening.mp3，连发不重头，下艇淡出
// 运行：node tools/test_bubble_pod_cannon_bgm.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const musicFile = fileURLToPath(new URL("music/黄英华-Opening.mp3", BASE));

const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  setAttribute() {},
  addEventListener() {},
});
globalThis.document = {
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  createElement: () => stubEl(),
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
function fakeParam() {
  return {
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  };
}
globalThis.window.AudioContext = class {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: fakeParam(),
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: fakeParam(),
      connect() {
        return this;
      },
    };
  }
};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };

const plays = [];
class FakeAudio {
  constructor(url) {
    this.src = url;
    this.loop = false;
    this.volume = 1;
    this.paused = true;
    this.currentTime = 0;
    this.preload = "";
    this.crossOrigin = "";
  }
  play() {
    this.paused = false;
    plays.push({ src: this.src, t: this.currentTime });
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {}
}
globalThis.Audio = FakeAudio;

const {
  BUBBLE_POD_CANNON_BGM_URL,
  setBubblePodCannonBgm,
  isBubblePodCannonBgmPlaying,
} = await import(new URL("src/audio/sfx.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 曲目文件与 URL");
{
  assert.equal(fs.existsSync(musicFile), true, "music/黄英华-Opening.mp3 应存在");
  assert.match(decodeURIComponent(BUBBLE_POD_CANNON_BGM_URL), /黄英华-Opening\.mp3$/);
  ok("Opening 曲目就位");
}

console.log("[2] 第一次开炮起播，连发不重头");
{
  plays.length = 0;
  assert.equal(setBubblePodCannonBgm(true), true);
  assert.equal(isBubblePodCannonBgmPlaying(), true);
  assert.equal(plays.length, 1, "第一次应 play");
  const t0 = plays[0].t;
  assert.equal(setBubblePodCannonBgm(true), true);
  assert.equal(plays.length, 1, "连发不得再次 play / 重头");
  assert.equal(t0, 0);
  ok("起播一次 · 连发不重置");
}

console.log("[3] 下艇停止");
{
  assert.equal(setBubblePodCannonBgm(false, { fade: 0.05 }), true);
  assert.equal(isBubblePodCannonBgmPlaying(), false);
  ok("下艇后不再占用开炮 BGM");
}

console.log(`\n全部通过 ${pass} 项`);
process.exit(0);
