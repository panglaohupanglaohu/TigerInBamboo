// 系统工坊「游玩检验」跟随当前场景（2026-11-11 用户报告：十二门徒编辑器点游玩检验跳到莫西斯湖）。
// 静态检查：工坊 → 桥 → 游戏三处都带上场景 id；纯函数：标题、id 回落、落点选择。
// 用法：node tools/tests/test_workshop_playtest_scene.mjs [项目根]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root = process.argv[2] || new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const read = (p) => readFileSync(root + '/' + p, 'utf8');
const { playtestSceneId, sceneShortName, viewerTitle, choosePlaytestLanding } = await import(pathToFileURL(root + '/src/scene-authoring/playtest-target.js').href);
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

// 1. 场景 id：apostles / citadel / crystal / 通用场景原样传，缺省 / 非法回落莫西斯湖
for (const id of ['apostles', 'citadel', 'crystal', 'moss', 'old-port', 'moon-lake', 'gate', 'bookshop', 'swamp', 'morris-lake']) check(playtestSceneId(id) === id, `playtestSceneId(${id}) 原样传`);
for (const bad of [undefined, null, '', 'a b', '<x>', 'x'.repeat(65)]) check(playtestSceneId(bad) === 'morris-lake', `playtestSceneId(${JSON.stringify(bad)?.slice(0, 12)}) 回落莫西斯湖`);

// 2. 实景标题跟当前场景
check(viewerTitle('object', '十二门徒') === ' 实景 / 十二门徒 · 点选物件', '物件管线标题 = 十二门徒');
check(viewerTitle('scene', '高山圣城') === ' 实景 / 高山圣城', '场景管线标题 = 高山圣城');
check(viewerTitle('scene', '莫西斯湖 · 湖上建筑群') === ' 实景 / 莫西斯湖', '莫西斯湖标题不变');
check(viewerTitle('scene') === ' 实景 / 莫西斯湖', '无场景名时仍为莫西斯湖');
check(viewerTitle('planet', '十二门徒') === ' 实景 / 整颗星球', '球系统标题不变');
check(sceneShortName('水晶城') === '水晶城', '短名');

// 3. 落点：场景中心是海（十二门徒岩柱立在海里），中心有一根高岩柱；东侧 0.1 rad 以外是低岸
const R = 160, dir = { x: 0, y: 0, z: 1 };
const angleOf = (p) => Math.acos(p.z / Math.hypot(p.x, p.y, p.z));
const groundAt = (p) => { const a = angleOf(p); if (a < 0.012) return R + 30; /* 岩柱顶 */ if (p.x > 0 && a > 0.08) return R + 2.5; return R - 4; };
const waterAt = () => R;
const land = choosePlaytestLanding({ dir, radius: R, groundAt, waterAt });
check(!!land, '找到落点');
if (land) {
  const a = angleOf(land.position), r = Math.hypot(land.position.x, land.position.y, land.position.z);
  check(a > 0.08 && a < 0.12 && land.position.x > 0, `落在最近的岸上（角距 ${a.toFixed(3)} rad，约 ${Math.round(a * R)} m）`);
  check(Math.abs(r - (R + 2.5 + 0.15)) < 1e-6, '贴地（地面 + 0.15）');
  const toward = { x: -land.position.x, y: -land.position.y, z: R - land.position.z };
  check(land.forward.x * toward.x + land.forward.y * toward.y + land.forward.z * toward.z > 0, '面朝场景中心');
  const up = land.up; check(Math.abs(up.x * land.forward.x + up.y * land.forward.y + up.z * land.forward.z) < 1e-9, 'forward 在切平面内');
}
check(choosePlaytestLanding({ dir, radius: R, groundAt: () => R - 5, waterAt }) === null, '全是水时不乱放玩家（返回 null）');
const flat = choosePlaytestLanding({ dir, radius: R, groundAt: () => R + 1, waterAt });
check(flat && angleOf(flat.position) < 1e-9, '中心是陆地时直接落在中心');

// 4. 调用链：工坊 play 带 id → 桥转给 plugin.play(id) → 游戏按 id 放玩家
const studio = read('src/scene-authoring/studio.js'), bridge = read('src/scene-authoring/pipeline-bridge.js'), town = read('src/world/morrisTownscaper.js'), main = read('src/main.js');
check(/request\('play',\{id\}\)/.test(studio) && /playtestSceneId\(window\.__tmCurrentScene\)/.test(studio), 'studio.js：游玩检验带当前场景 id');
check(!/run\('play'\)/.test(studio), "studio.js：不再发不带场景的 run('play')");
check(/case 'play':\{[\s\S]{0,200}playtestSceneId\(payload\?\.id\)[\s\S]{0,200}plugin\.play\?\.\(id\)/.test(bridge), 'pipeline-bridge.js：play 把 id 交给 plugin.play');
check(/play:id=>\{[\s\S]{0,300}__tmPlaytestAt\?\.\(id\)/.test(town), 'morrisTownscaper.js：非莫西斯湖场景先放玩家');
check(/globalThis\.__tmPlaytestAt=id=>/.test(main) && /choosePlaytestLanding\(/.test(main), 'main.js：__tmPlaytestAt 用同一套地面 / 水面采样');
check(/apostles/.test(main.match(/const batianTargets=\[[^\n]*/)?.[0] || ''), 'main.js：十二门徒在场景目标表里（__tmSceneTargets 可找到）');
const tabs = read('src/system-workshop/system-tabs.js');
check(!/实景 \/ 莫西斯湖/.test(tabs) && /viewerTitle\(tier, window\.__tmCurrentSceneLabel\)/.test(tabs), 'system-tabs.js：标题不再写死莫西斯湖');

if (fails) { console.log(`FAIL ${fails} 项`); process.exit(1); }
console.log('PASS 游玩检验跟随当前场景');
