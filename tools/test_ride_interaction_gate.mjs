// =====================================================================
// 载具上不许按 E 与人交互（主人 2026-09-05：「送信人坐在飞艇上也能按下 E 键
// 与其他角色交互」）
//
// 根因：搭乘期间 `player.position` 被载具接管——`airshipRide` 每帧
// `player.position.copy(seat)`——于是所有「离 NPC 多近」的判定量的其实是
// **座位**离 NPC 多近。飞艇停在村口，人坐在船上按 E 就能隔着船舷接信送信。
//
// 这个洞的形状决定了守门方式：它不是某一处写错，而是**新增一个 E 交互时
// 忘了挂闸**。所以这里查的是不变量，不是某次修复：
//   ① 每个注册 KeyE 监听的 messenger 侧模块，都必须收 `isBusyRiding`；
//   ② `main.js` 必须把同一个闸传给这些模块的每一个；
//   ③ 闸必须**排除电车**——阿狸会跟着上电车卧在身旁，车上聊天是原设计；
//   ④ 闸必须覆盖飞艇（本次报障的那台）与其余自驾载具。
//
// 白名单（不该挂闸，各有原因）见 ALLOW。
//
// 运行：node tools/test_ride_interaction_gate.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../TigerMessenger/src/", import.meta.url));
const read = (rel) => fs.readFileSync(path.join(SRC, rel), "utf8");

/** 递归收集 src 下所有 .js */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(path.relative(SRC, p));
  }
  return out;
}

/** 不挂闸的，必须在这里写明理由——白名单是给人看的，不是给测试放水的 */
const ALLOW = new Map([
  ["ui/touchControls.js", "只是把虚拟按钮转发成 KeyE 事件，闸在收事件的那一侧"],
  ["ui/citadelEditorPanel.js", "编辑器换层，与角色交互无关"],
  ["planet/main.js", "planet.html 独立页面，没有送信人也没有载具"],
]);

const files = walk(SRC);

// ---------- ① 注册 KeyE 的模块必须收 isBusyRiding ----------
const keyEFiles = files.filter((rel) => /\bKeyE\b/.test(read(rel)));
assert.ok(keyEFiles.length >= 4, `KeyE 相关文件只找到 ${keyEFiles.length} 个，扫描可能失效`);

const gated = [];
for (const rel of keyEFiles) {
  if (ALLOW.has(rel)) continue;
  const src = read(rel);
  assert.ok(
    /isBusyRiding/.test(src),
    `${rel} 注册了 KeyE 交互却没有 isBusyRiding 闸——载具上会隔着船舷触发。\n` +
    `  要么挂闸，要么把它连同理由加进本测试的 ALLOW 白名单。`
  );
  gated.push(rel);
}
console.log(`  ✓ ① ${gated.length} 个 E 交互模块都挂了闸：${gated.join(" / ")}`);

// ---------- ② main.js 必须逐个注入 ----------
{
  const main = read("main.js");
  assert.ok(
    /function isPlayerPilotingVehicle\(\)/.test(main),
    "main.js 必须有 isPlayerPilotingVehicle()（函数声明，需被更早构造的 quest 闭包捕获）"
  );
  const injections = (main.match(/isBusyRiding:\s*isPlayerPilotingVehicle/g) || []).length;
  assert.ok(
    injections >= gated.length,
    `main.js 注入了 ${injections} 处 isBusyRiding，但有 ${gated.length} 个模块需要——漏了`
  );
  console.log(`  ✓ ② main.js 注入 ${injections} 处`);
}

// ---------- ③ 电车必须在闸外 ----------
{
  const main = read("main.js");
  const body = main.slice(main.indexOf("function isPlayerPilotingVehicle()"));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  assert.ok(
    !/tramRide/.test(fn),
    "电车不得进这道闸：玩家是乘客不是驾驶员，阿狸会跟着上车卧在身旁，车上聊天是原设计"
  );
  console.log("  ✓ ③ 电车在闸外（阿狸随车对话不受影响）");
}

// ---------- ④ 闸必须覆盖飞艇与其余自驾载具 ----------
{
  const main = read("main.js");
  const body = main.slice(main.indexOf("function isPlayerPilotingVehicle()"));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  for (const [name, why] of [
    ["airshipRide", "本次报障的就是飞艇"],
    ["aircraftRide", "飞行器驾驶舱"],
    ["scoutAircraftRide", "侦察机"],
    ["bubblePodRide", "气泡艇"],
    ["boatRide", "小船——停在岸边同样会隔着船舷够到人"],
  ]) {
    assert.ok(fn.includes(name), `闸里缺 ${name}（${why}）`);
  }
  // 飞艇的状态是 idle/climbing/flying 三档，不是布尔 isRiding：
  // 写成 isRiding 会永远 undefined，闸形同虚设
  assert.ok(
    /airshipRide\?\.getState\?\.\(\)/.test(fn),
    "飞艇必须用 getState() 判（idle/climbing/flying 三档），它没有 isRiding()"
  );
  console.log("  ✓ ④ 闸覆盖飞艇 / 飞行器 / 侦察机 / 气泡艇 / 小船");
}

// ---------- ⑤ 闸要放在近身判定里，不能只挡 keydown ----------
{
  // 只挡按键会留下「提示还亮着、气泡还飘着，就是按不动」的假象。
  const quest = read("quest/questSystem.js");
  const qIdx = quest.indexOf("function currentTarget()");
  assert.ok(qIdx > 0, "questSystem 应有 currentTarget()");
  assert.ok(
    quest.slice(qIdx, qIdx + 600).includes("isBusyRiding()"),
    "questSystem 的闸要放在 currentTarget()（提示与气泡一并消失），不能只挡 keydown"
  );

  const fox = read("world/foxNpc.js");
  const fIdx = fox.indexOf("function nearTalk()");
  assert.ok(fIdx > 0 && fox.slice(fIdx, fIdx + 400).includes("isBusyRiding()"),
    "foxNpc 的闸要放在 nearTalk()");

  const elder = read("world/elderMusic.js");
  const eIdx = elder.indexOf("function nearElder()");
  assert.ok(eIdx > 0 && elder.slice(eIdx, eIdx + 400).includes("isBusyRiding()"),
    "elderMusic 的闸要放在 nearElder()");
  console.log("  ✓ ⑤ 闸放在近身判定里（提示/气泡跟着消失，不是只按不动）");
}

console.log("✅ test_ride_interaction_gate（载具上不许按 E 与人交互）");
