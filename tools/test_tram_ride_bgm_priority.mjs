// 电车搭乘 BGM 优先级：上车后电车曲主导，峡谷/湖沼区域曲不得抢声道。
import assert from "node:assert/strict";

const BASE = new URL("../TigerMessenger/", import.meta.url);
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.AudioContext = class {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }
  resume() { return Promise.resolve(); }
  createGain() {
    return { gain: { value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } };
  }
};
globalThis.document = {
  getElementById: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  querySelector: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  body: { appendChild() {} },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);

const plays = [];
const audios = [];
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.paused = true;
    this.currentTime = 0;
    this.readyState = 1;
    this.duration = 180;
    this.preload = "";
    this.crossOrigin = "";
    audios.push(this);
  }
  play() {
    this.paused = false;
    plays.push(this.src);
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  addEventListener() {}
}
globalThis.Audio = FakeAudio;

const {
  setTramRideBgm,
  isTramRideBgmPlaying,
  setCanyonApproachBgm,
  isCanyonBgmPlaying,
  setSwampBgm,
  isSwampBgmPlaying,
  setSiegeAssaultBgm,
  isSiegeAssaultBgmPlaying,
} = await import(new URL("src/audio/sfx.js", BASE).href);

// 区域曲先启动，模拟电车进入峡谷/湖沼前已经有环境 BGM。
setCanyonApproachBgm(true, { fade: 0.01 });
assert.equal(isCanyonBgmPlaying(), true);
const canyonAudio = audios.find((audio) => decodeURIComponent(audio.src).includes("風之傳說"));
assert.ok(canyonAudio, "峡谷区域曲应创建测试音频");

const beforeBoard = plays.length;
setTramRideBgm(true, { fade: 0.01 });
assert.equal(isTramRideBgmPlaying(), true, "上车后电车 BGM 必须播放");
assert.ok(plays.slice(beforeBoard).some((src) => decodeURIComponent(src).includes("Various Artists-Tram.mp3")), "应播放电车主曲");
assert.equal(isCanyonBgmPlaying(), false, "电车上峡谷曲不得占用主声道");
assert.equal(canyonAudio.paused, true, "已有峡谷曲必须暂停");

const beforeRegion = plays.length;
setCanyonApproachBgm(true, { fade: 0.01 });
setSwampBgm(true, { fade: 0.01 });
assert.equal(isTramRideBgmPlaying(), true, "区域更新不得打断电车 BGM");
assert.equal(isCanyonBgmPlaying(), false, "峡谷更新不得抢电车声道");
assert.equal(isSwampBgmPlaying(), false, "湖沼更新不得抢电车声道");
assert.equal(plays.length, beforeRegion, "区域 BGM 在乘车期间不得重新 play");

setTramRideBgm(false, { fade: 0.01 });
await new Promise((resolve) => setTimeout(resolve, 70));

// 红车使用指定曲目；蓝车的旧播放链路保持不变（上面的断言已覆盖）。
const beforeRedBoard = plays.length;
setTramRideBgm(true, { fade: 0.01, variant: "red" });
assert.equal(isTramRideBgmPlaying(), true, "红车上车后必须有搭乘 BGM");
assert.ok(
  plays.slice(beforeRedBoard).some((src) => decodeURIComponent(src).includes("FKJ Tom Bailey - Drops.mp3")),
  "红色有轨电车必须播放 FKJ Tom Bailey - Drops.mp3"
);
assert.equal(
  plays.slice(beforeRedBoard).some((src) => decodeURIComponent(src).includes("Various Artists-Tram.mp3")),
  false,
  "红车不能误播蓝车原有 Tram.mp3"
);
setTramRideBgm(false, { fade: 0.01 });

plays.length = 0;
setSiegeAssaultBgm(true, { fade: 0.01 });
assert.equal(isSiegeAssaultBgmPlaying(), true, "攻城曲先起播");
const beforeBlueDuringSiege = plays.length;
setTramRideBgm(true, { fade: 0.01, variant: "blue" });
assert.equal(isTramRideBgmPlaying(), true, "蓝车上车必须播放电车 BGM，不能被攻城曲挡住");
assert.ok(
  plays.slice(beforeBlueDuringSiege).some((src) => decodeURIComponent(src).includes("Various Artists-Tram.mp3")),
  "蓝车必须播放 Various Artists-Tram.mp3"
);
assert.equal(isSiegeAssaultBgmPlaying(), false, "乘车期间攻城曲让出声道");
setTramRideBgm(false, { fade: 0.01 });
console.log("✅ Tram ride BGM priority + red/blue vehicle mapping verified");
