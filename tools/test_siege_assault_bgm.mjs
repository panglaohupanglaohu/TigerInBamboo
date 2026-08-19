// 蓝盔开始进攻 BGM：The Best Is Yet To Come，突破起播、不重头、清场淡出
// 运行：node tools/test_siege_assault_bgm.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const musicFile = fileURLToPath(
  new URL("music/Aoife Ni Fhearraigh-The Best Is Yet To Come.mp3", BASE)
);

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
  SIEGE_ASSAULT_BGM_URL,
  setSiegeAssaultBgm,
  isSiegeAssaultBgmPlaying,
  isSiegeAssaultBgmHandoff,
  allowSiegeAssaultBgmHandoff,
  setCanyonApproachBgm,
  setSwampBgm,
  setLeviathanStormBgm,
  setBubblePodCannonBgm,
  setInfiltrationBgm,
  updateInfiltrationBgm,
  isInfiltrationBgmPlaying,
} = await import(new URL("src/audio/sfx.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 曲目文件与 URL");
{
  assert.equal(fs.existsSync(musicFile), true, "The Best Is Yet To Come 应存在");
  assert.match(
    decodeURIComponent(SIEGE_ASSAULT_BGM_URL),
    /Aoife Ni Fhearraigh-The Best Is Yet To Come\.mp3$/
  );
  ok("攻城曲目就位");
}

console.log("[2] 开始进攻起播，重复调用不重头");
{
  plays.length = 0;
  assert.equal(setSiegeAssaultBgm(true), true);
  assert.equal(isSiegeAssaultBgmPlaying(), true);
  assert.equal(plays.length, 1, "第一次应 play");
  assert.equal(setSiegeAssaultBgm(true), true);
  assert.equal(plays.length, 1, "已在播不得重头");
  ok("起播一次 · 不重置");
}

console.log("[3] 起播后独占：其它 BGM 不得抢声道；交接前太鼓不起");
{
  plays.length = 0;
  assert.equal(setSiegeAssaultBgm(true), true);
  const n0 = plays.length;
  setCanyonApproachBgm(true);
  setSwampBgm(true);
  setLeviathanStormBgm(true);
  setBubblePodCannonBgm(true);
  assert.equal(isSiegeAssaultBgmPlaying(), true, "攻城曲应继续");
  assert.equal(plays.length, n0, "其它 BGM 不得 play");
  setInfiltrationBgm(true);
  updateInfiltrationBgm({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
  assert.equal(isInfiltrationBgmPlaying(), false, "交接前不得起太鼓");
  assert.equal(isSiegeAssaultBgmPlaying(), true);
  assert.equal(isSiegeAssaultBgmHandoff(), false);
  ok("独占声道 · 太鼓未响前不让出");
}

console.log("[4] 夜晚鼓声响起后才让出");
{
  assert.equal(allowSiegeAssaultBgmHandoff(), true);
  assert.equal(isSiegeAssaultBgmHandoff(), true);
  assert.equal(isSiegeAssaultBgmPlaying(), true, "handoff 后攻城曲仍播");
  setInfiltrationBgm(true);
  updateInfiltrationBgm({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
  assert.equal(isInfiltrationBgmPlaying(), true, "鼓声应响起");
  assert.equal(isSiegeAssaultBgmPlaying(), false, "太鼓起声后攻城曲应让出");
  ok("鼓声响起 · 攻城曲淡出");
}

console.log("[5] 手动停止");
{
  setInfiltrationBgm(false, { fade: 0.05 });
  assert.equal(setSiegeAssaultBgm(true), true);
  assert.equal(setSiegeAssaultBgm(false, { fade: 0.05 }), true);
  assert.equal(isSiegeAssaultBgmPlaying(), false);
  ok("reset 可停");
}

console.log(`\n全部通过 ${pass} 项`);
process.exit(0);
