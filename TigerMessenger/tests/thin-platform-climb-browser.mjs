// 补学验收（learn-queue terrain 线，clip 781957658597269506「109帧黄色薄平台」残差：原薄台/攀爬）：
//   合成场地（nav-lab 条带世界，vendor 副本同一套模块）——单位从 1 层地面出发，经一片沿墙薄檐
//   （第 3 层、底下悬空，placeThinLedge 生成、thinLedges 标记、ladderContact 判 thinPlatform）
//   爬到 4 层台地，逐帧留下坐标轨迹；对照：avoidThinLadders 开档（原作语义：薄台上的梯子不可靠）
//   同一对起终点无路线。分析轨迹由 vendor climb-route.js（ladderProfile/ladderClimb 采样）给出。
// 运行：cd TigerMessenger && $NODE tests/thin-platform-climb-browser.mjs   （需要 8931 服务）
import { launch, expect, pageErrors, BASE } from './nav-e2e-lib.mjs';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const TM = join(here, '..'), LIB = join(TM, '../townscaper-web/REACodeRefactoring');

const { report, page, shot, finish } = await launch('thin-platform-climb');
try {
  // 换进 vendor 的本次新件与最新库逐字一致（否则下面跑的不是同一套代码）
  report.steps.vendorSync = {};
  for (const f of ['terrain/thin-platform.js', 'world/climb-route.js', 'world/navlayer.js']) {
    const a = fs.readFileSync(join(TM, 'src/vendor/townscaper-rea-refactoring/src', f), 'utf8');
    const b = fs.readFileSync(join(LIB, 'src', f), 'utf8');
    report.steps.vendorSync[f] = a === b;
    expect(a === b, 'vendor 副本与最新库不一致：' + f);
  }

  // 借演示页拿到 /TigerMessenger/ 域下的运行页（模块走浏览器真实加载链路）
  await page.goto(BASE + 'nav-arch-demo.html?static=1');
  await page.waitForFunction(() => globalThis.__navDemo?.done === true, {}, { timeout: 60000 });

  report.steps.synthetic = await page.evaluate(async () => {
    const lab = await import('/TigerMessenger/src/system-workshop/battle/nav-lab.js');
    const tp = await import('/TigerMessenger/src/vendor/townscaper-rea-refactoring/src/terrain/thin-platform.js');
    const cr = await import('/TigerMessenger/src/vendor/townscaper-rea-refactoring/src/world/climb-route.js');
    const { buildNav } = await import('/TigerMessenger/src/vendor/townscaper-rea-refactoring/src/world/navgraph.js');
    const { asciiWorld, COLUMN, makeNav, simulateWalk, BODY_RADIUS } = lab;

    /* 场地：东侧 4 层台地，台地西壁贴两片「只第 3 层、底下空」的悬空檐；
       地面 '.' 与台地 '4' 高差 3 层 —— 唯一能上去的路是 '.'→檐(2)→'4'(1)。 */
    const ROWS = ['########', '#....44#', '#....44#', '#......#', '########'];
    const env = asciiWorld(ROWS, { ...COLUMN, '4': [1, 2, 3, 4] });
    const ledgeCells = [env.at(4, 1).id, env.at(4, 2).id];
    const placed = tp.placeThinLedge(env.world, ledgeCells, 3);
    const ledges = tp.thinLedges(env.world);
    const surface = buildNav(env.world);
    const route = cr.climbRoute(env.world, surface, env.at(1, 3), env.at(6, 1), { L: env.L });

    /* 实际消费者走法（vendor BattleNavigation + nav-lab simulateWalk），梯子模式开、允许薄台梯 */
    const nav = makeNav(env, {});
    nav.ladderMode = true; nav.avoidThinLadders = false; nav.refresh();
    const start = env.at(1, 3), goal = env.at(6, 1);
    const u = { x: start.cx, z: start.cz, navFloor: 1, radius: BODY_RADIUS, goal, goalFloor: 4 };
    const track = [];
    const sim = simulateWalk(env, nav, [u], { frames: 1500, lanes: false, separation: false, onFrame: (v, f) => {
      const node = nav.unitNode(v), st = node && nav.stairAt(v.x, v.z, node);
      if (f % 3 === 0 || st?.ladder) track.push({ f, x: +v.x.toFixed(3), z: +v.z.toFixed(3), foot: +nav.footHeight(v).toFixed(3), floor: v.navFloor, ladder: st?.ladder ? { p: +st.ladder.progress.toFixed(3), rung: st.ladder.rung } : null });
    } });
    /* 对照：原作语义的 avoidThinLadders —— 同一世界同一对起终点，开档无路线 */
    const navAvoid = makeNav(env, {});
    navAvoid.ladderMode = true; navAvoid.avoidThinLadders = true; navAvoid.refresh();
    const planAvoid = navAvoid.plan({ x: start.cx, z: start.cz, navFloor: 1, radius: BODY_RADIUS }, goal, 4);

    return { placed, ledges, route: { ok: route.ok, climbs: route.climbs, points: route.points.length, y0: route.points[0]?.y, y1: route.points.at(-1)?.y },
      walkLedge: ledgeCells.map((id) => ({ id, walk: !!surface.walk[id], hgt: surface.hgt[id] })),
      sim: { frames: sim.frames, arrived: u.arrived, arrivedAt: u.arrivedAt, cells: [...u.cells], track },
      avoid: { thinLadders: navAvoid.thinLadders.size, plan: !!planAvoid } };
  });

  const s = report.steps.synthetic;
  /* 生成与标记 */
  expect(s.placed.placed.length === 2, '两片檐没都放下 ' + JSON.stringify(s.placed));
  expect(s.ledges.length === 1 && s.ledges[0].cells.length === 2 && s.ledges[0].walls.length >= 1, '薄檐没标记成片/没挂壁 ' + JSON.stringify(s.ledges));
  expect(s.walkLedge.every((x) => x.walk && x.hgt === 3), '薄檐格没进可走图 ' + JSON.stringify(s.walkLedge));
  /* 分析轨迹（climbRoute：ladderAnchors/ladderProfile/ladderContact/ladderClimb 同一口径） */
  expect(s.route.ok && s.route.climbs.length === 2, '分析攀爬路线不通 ' + JSON.stringify(s.route));
  expect(s.route.climbs[0].rise === 2 && s.route.climbs[0].thin === true, '第一把梯应 rise=2 且搭薄台 ' + JSON.stringify(s.route.climbs));
  expect(s.route.climbs[1].rise === 1 && s.route.climbs[1].thin === false, '第二把梯应 rise=1 在实壁');
  expect(Math.abs(s.route.y0 - 0.5) < 1e-9 && Math.abs(s.route.y1 - 2.0) < 1e-9, '轨迹端点高度不对');
  /* 实际行走：单位真从地面经薄檐爬到台地顶 */
  expect(s.sim.arrived === true, '单位没走到台地顶 ' + JSON.stringify({ arrived: s.sim.arrived, stuck: s.sim.frames }));
  const feet = s.sim.track.map((p) => p.foot);
  expect(Math.min(...feet) <= 0.5 + 1e-3 && Math.max(...feet) >= 2.0 - 1e-3, '脚高没从 0.5 爬到 2.0：' + Math.min(...feet) + '→' + Math.max(...feet));
  const ladderFrames = s.sim.track.filter((p) => p.ladder);
  expect(ladderFrames.length >= 6, '轨迹里几乎没有攀爬帧 ' + ladderFrames.length);
  expect(ladderFrames.some((p) => p.ladder.p > 0.9), '梯子没爬到顶');
  const onLedge = s.sim.track.filter((p) => Math.abs(p.foot - 1.5) < 0.02);
  expect(onLedge.length >= 3, '轨迹没站在薄檐面上（脚高 1.5）' + onLedge.length);
  /* 对照与失败恢复 */
  expect(s.avoid.thinLadders >= 1 && s.avoid.plan === false, 'avoidThinLadders 对照：薄台梯应被踢出图、无路线 ' + JSON.stringify(s.avoid));
  expect(pageErrors(report).length === 0, 'page errors: ' + pageErrors(report).join(' | '));
  report.pass = true;
} catch (e) { report.pass = false; report.failure = e.message; }
await finish();
