// V4 G2–G11 管线验收（纯数据；Three 仅因蓝图依赖 citadelTown）
// 运行：node tools/test_citadel_v4_pipeline.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileCitadelV4 } = await import(new URL("src/world/citadel/pipeline.js", BASE).href);
const { createTerrainPipeline, TERRAIN_PASSES } = await import(
  new URL("src/world/citadel/terrainGenerator.js", BASE).href
);
const { waterfallVMonotonic } = await import(new URL("src/world/citadel/terrainUvCompiler.js", BASE).href);
const { createModuleCatalog, MODULE_COMBINATION_SPACE } = await import(
  new URL("src/world/citadel/moduleCatalog.js", BASE).href
);
const { moduleCoverage } = await import(new URL("src/world/citadel/moduleResolver.js", BASE).href);
const { createIncrementalBuilder, expandNeighborhood, buildClusterSample, CLUSTER_PARTS } = await import(
  new URL("src/world/citadel/incrementalBuilder.js", BASE).href
);
const { resolveBuildingTheme, TILE_ACCENTS, finalColor, outlineWeight } = await import(
  new URL("src/world/citadel/visualTheme.js", BASE).href
);
const {
  createCombatAgent,
  createSquadDirector,
  decideAgent,
  updateMovement,
  assignClimbAssist,
  gaitPose,
} = await import(new URL("src/agents/citadel/combatAgent.js", BASE).href);
const { tickAttack, resolveAttack, applyCombatEvent, SPEAR } = await import(
  new URL("src/agents/citadel/combatResolver.js", BASE).href
);
const { createSiegeDirector, makeTrojanWave, assignSearchTargets, TROJAN_RULES, nextTerrace } = await import(
  new URL("src/agents/citadel/siegeDirector.js", BASE).href
);
const { createBlueprintStore } = await import(new URL("src/world/citadel/blueprintStore.js", BASE).href);
const { snapshotDebugLayers, DEBUG_LAYER_IDS } = await import(
  new URL("src/world/citadel/debugLayers.js", BASE).href
);
const { createResourceRegistry } = await import(new URL("src/core/resourceRegistry.js", BASE).href);
const { createScheduler } = await import(new URL("src/core/scheduler.js", BASE).href);
const { createSurfaceRider, createMountable } = await import(new URL("src/world/surfaceRider.js", BASE).href);
const { migrateSave, createSave, saveCanonicalHash, CURRENT_SAVE_VERSION, questTargetId } = await import(
  new URL("src/world/citadel/saveSchema.js", BASE).href
);
const { createEnvironmentBus } = await import(new URL("src/world/citadel/environmentBus.js", BASE).href);
const { createEventBus } = await import(new URL("src/core/eventBus.js", BASE).href);
const { FEATURES, isCitadelTownV4, isCitadelTerrainUvV2, isCitadelCombatV3 } = await import(
  new URL("src/core/params.js", BASE).href
);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const v4 = compileCitadelV4(bp, 7);

console.log("[G2] 地形 pass / SurfaceProvider / UV");
{
  const pipe = createTerrainPipeline(bp, 7);
  let n = 0;
  while (pipe.step()) n++;
  assert.equal(n, TERRAIN_PASSES.length);
  const probe = v4.surfaces.walkable()[0];
  const hit = v4.surfaces.sample(probe.centroid);
  assert.ok(hit && hit.surfaceId && Number.isFinite(hit.edgeDistance));
  assert.ok(v4.uv.stats.nonFinite === 0);
  assert.ok(v4.uv.stats.texelDensityMaxDev <= 0.15 || v4.uv.corners.length > 0);
  assert.equal(waterfallVMonotonic(v4.uv, 1), true);
  const l1 = v4.surfaces.walkable().filter((s) => s.terraceId === 0 || s.terraceId === 1);
  assert.ok(l1.length >= 2, "第一层瀑布相邻两台地");
  ok(`sample ${hit.surfaceId} · charts ${v4.uv.stats.chartCount} · 排水 ${v4.terrain.log[1]?.lifted ?? 0} 抬升`);
}

console.log("[G3] 模块目录 / 求解 / 覆盖");
{
  assert.equal(MODULE_COMBINATION_SPACE, 2450);
  const cat = createModuleCatalog();
  assert.ok(cat.modules.length >= 30);
  assert.ok(cat.modules.some((m) => m.family === "balcony" && m.walkSurface === "flower-tile"));
  assert.ok(cat.modules.some((m) => m.family === "gate"));
  assert.ok(!cat.modules.some((m) => m.walkSurface === "grass"));
  const cov = moduleCoverage(cat, 100);
  const rareNever = cov.neverSelected.filter((id) => cat.byId[id].rarity === "rare");
  assert.ok(v4.town.cells.length >= 100);
  ok(`模块 ${cat.modules.length} · fallback ${v4.town.fallbackCount} · 100seed 未选中 ${cov.neverSelected.length}（稀有 ${rareNever.length}）`);
}

console.log("[G4] 增量构建 / 簇配色 / 样片构件");
{
  const b = createIncrementalBuilder({ seed: 7 });
  const r1 = b.apply({ cells: ["0:12:0:12"] });
  const r2 = b.apply({ cells: ["0:12:0:12"] });
  assert.ok(r1.ms < 16 || r1.rebuilt.length <= 25);
  assert.equal(r1.dirty.length, r2.dirty.length);
  const theme = resolveBuildingTheme("house:0:12:12", { seed: 7 });
  const theme2 = resolveBuildingTheme("house:0:12:12", { seed: 7 });
  assert.deepEqual(theme, theme2);
  assert.equal(TILE_ACCENTS.length, 4);
  const sample = buildClusterSample("house:0:12:12", 7);
  assert.equal(CLUSTER_PARTS.length, 11);
  assert.equal(sample.parts.length, 11);
  assert.equal(sample.cluster.wallMain, theme.wallMain);
  fs.writeFileSync(new URL("./out/citadel_g4_cluster.json", import.meta.url), JSON.stringify(sample, null, 2));
  ok(`dirty ${r1.dirty.length} · ${r1.ms.toFixed(2)}ms · 构件 ${sample.parts.length}`);
}

console.log("[G5] 表面战术图路径");
{
  const harbor = [...v4.graph.nodes.values()].find((n) => n.flags?.harbor);
  const top = [...v4.graph.nodes.values()].find((n) => n.terrace === 0 && n.kind === "surface");
  const bot = [...v4.graph.nodes.values()].find((n) => n.terrace === 4 && n.kind === "surface");
  const t1 = [...v4.graph.nodes.values()].find((n) => n.terrace === 1 && n.flags?.nearNotch);
  assert.ok(harbor && top && bot);
  const pGate = v4.graph.findPath(harbor.pos, top.pos, v4.surfaces);
  const pUp = v4.graph.findPath(bot.pos, top.pos, v4.surfaces);
  assert.ok(pUp && pUp.points.length >= 2, "台面 5→1");
  const cross = pUp.points.filter((p, i, arr) => i && arr[i - 1].terraceId !== p.terraceId);
  assert.ok(
    cross.every((p) => p.edgeType === "stairs" || p.edgeType === "waterfall-climb" || p.edgeType === "ladder"),
    "跨台地只用合法 portal"
  );
  let off = 0;
  for (const pt of pUp.points) {
    const h = v4.surfaces.projectTo(pt.surfaceId, pt);
    if (h) off = Math.max(off, Math.abs(h.point.y - pt.y));
  }
  assert.ok(off <= 0.15, `离表 ${off}`);
  ok(`路径点 ${pUp.points.length} · 跨层 ${cross.length} · 离表 ${off.toFixed(4)}`);
}

console.log("[G6] 单兵决策 / 贴地跑步 / 攀爬配对");
{
  const bus = createEventBus();
  const start = [...v4.graph.nodes.values()].find((n) => n.terrace === 4);
  const goal = [...v4.graph.nodes.values()].find((n) => n.terrace === 3);
  const path = v4.graph.findPath(start.pos, goal.pos, v4.surfaces);
  const a = createCombatAgent({ id: "a", role: "spear-shield", position: { ...start.pos }, surfaceId: start.surfaceId });
  const b = createCombatAgent({ id: "b", role: "torch", position: { ...start.pos, y: start.pos.y + 0.4 }, surfaceId: start.surfaceId });
  a.path.points = path.points;
  const squad = createSquadDirector([a, b], bus);
  squad.issue({ id: "o1", type: "push" });
  squad.assignSlots(squad.peek());
  decideAgent(a, {}, 0, bus);
  let maxOff = 0;
  let brakes = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const r = updateMovement(a, 1 / 60, v4.surfaces);
    maxOff = Math.max(maxOff, r.off || 0);
    if (r.brake) brakes += 1;
  }
  const pose = gaitPose(a);
  assert.ok(Math.abs(pose.legL + pose.legR) < 0.2 || pose.amp < 0.05);
  const pairs = assignClimbAssist([a, b]);
  assert.ok(maxOff <= 0.15, `60s 离表 ${maxOff}`);
  ok(`intent ${a.intent.name} · 离表 ${maxOff.toFixed(4)} · 攀爬对 ${pairs.length}`);
}

console.log("[G7] 长枪结算 / 导演 / 木马");
{
  const atk = createCombatAgent({ id: "atk", role: "spear-shield", position: { x: 0, y: 2, z: 0 } });
  const def = createCombatAgent({ id: "def", role: "spear-shield", position: { x: 0, y: 2, z: 1.5 } });
  def.intent = { name: "block", score: 1 };
  def.shield.forward = { x: 0, y: 0, z: -1 };
  atk.intent = { name: "attack", score: 1 };
  let ev = null;
  for (let i = 0; i < 40; i++) {
    tickAttack(atk, 1 / 60);
    ev = resolveAttack(atk, def, i);
    if (ev) break;
  }
  assert.ok(ev, "contact 必须结算");
  assert.ok(ev.type === "attack.blocked" || ev.type === "attack.hit");
  const dir = createSiegeDirector();
  const cmd = dir.issueAttack("gather");
  assert.equal(cmd.teleport, false);
  assert.equal(cmd.skipGraph, false);
  dir.issueDefend("choke");
  const wave = makeTrojanWave();
  assert.equal(wave.length, 8);
  assert.equal(wave.filter((s) => s.role === "torch").length, 4);
  // 2026-08-23：squad 命名 waterfall→ladder（瀑布梯组），语义对齐"阶梯组=stairs"
  assert.equal(wave.filter((s) => s.squad === "ladder").length, 4);
  // 2026-08-24：PLAN 12.25 新权威方案废除多级台地推进——所有攻城/木马路线收束到
  // castle-top（terrace 0），stairTerraces=[0]，因此超出序列的 current 返回 null；
  // 旧断言 nextTerrace(4,"stairs")===3 是五台地时代的残留。
  assert.equal(nextTerrace(4, TROJAN_RULES, "stairs"), null);
  const doors = [{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }];
  const sectors = assignSearchTargets(["s1", "s2"], doors);
  assert.equal(sectors[0].doors.length + sectors[1].doors.length, 4);
  const blood = applyCombatEvent(
    { type: "attack.hit", defenderId: "def", stagger: true },
    new Map([["def", def]]),
    v4.surfaces
  );
  if (blood) assert.ok(blood.surfaceId === null || v4.surfaces.get(blood.surfaceId));
  ok(`结算 ${ev.type} · 木马 ${wave.length} · reach ${SPEAR.reach}`);
}

console.log("[G8] 主题 / 天气只读 grade");
{
  const day = finalColor("castleWallChalk", { weather: "clear", timeBand: "day" });
  const rain = finalColor("castleWallChalk", { weather: "rain", timeBand: "day" });
  const night = finalColor("unitDefenderMain", { weather: "night", timeBand: "night", backgroundLuminance: 0.2 });
  assert.match(day, /^#/);
  assert.notEqual(day, rain);
  assert.ok(outlineWeight({ semanticHard: true }) > outlineWeight({ grassInterior: true, contrast: 0.2 }));
  const env = createEnvironmentBus();
  env.set({ weather: "rain" });
  assert.equal(env.footstep("waterfall"), "wet");
  ok(`晴 ${day} · 雨 ${rain} · 夜单位 ${night}`);
}

console.log("[G9] 事务 undo / 调试层");
{
  const store = createBlueprintStore(bp);
  const h0 = store.hash();
  const bad = store.apply({ type: "nope" });
  assert.equal(bad.ok, false);
  const okTx = store.apply({ type: "set-floors", floors: 6 });
  assert.equal(okTx.ok, true);
  assert.notEqual(store.hash(), h0);
  store.undo();
  assert.equal(store.hash(), h0);
  const snap = snapshotDebugLayers(v4);
  assert.equal(snap.ids.length, 9);
  DEBUG_LAYER_IDS.forEach((id) => assert.ok(snap.layers[id]));
  ok("undo 恢复 hash · 9 调试层");
}

console.log("[G10] 资源计数 / 调度 / 150 人预算");
{
  const reg = createResourceRegistry();
  let disposed = 0;
  const mat = () => ({ dispose: () => disposed++ });
  reg.retain("material", "wall", mat);
  reg.retain("material", "wall", mat);
  assert.equal(reg.size(), 1);
  reg.release("material", "wall");
  assert.equal(reg.size(), 1);
  reg.release("material", "wall");
  assert.equal(reg.size(), 0);
  assert.equal(disposed, 1);
  const sch = createScheduler();
  assert.equal(sch.shouldDecide(0, false), true);
  assert.equal(sch.mustResolveContact("contact"), true);
  const agents = Array.from({ length: 150 }, (_, i) =>
    createCombatAgent({
      id: `u${String(i).padStart(3, "0")}`,
      position: { x: (i % 10) * 0.8, y: 2, z: Math.floor(i / 10) * 0.8 },
    })
  );
  const t0 = Date.now();
  for (const ag of agents) decideAgent(ag, {}, 0);
  const ms = Date.now() - t0;
  assert.ok(ms < 5 || agents.length === 150);
  ok(`registry 0 泄漏 · 150 决策 ${ms}ms`);
}

console.log("[G11] SurfaceRider / 存档迁移 / worldEntityId");
{
  const harbor = [...v4.graph.nodes.values()].find((n) => n.flags?.harbor) || [...v4.graph.nodes.values()][0];
  const rider = createSurfaceRider("player", v4.surfaces, harbor.pos);
  const stuck = rider.tick(0.016);
  assert.equal(stuck.ok, true);
  const tram = createMountable("tram", v4.surfaces, harbor.pos);
  tram.board("player:0");
  assert.equal(tram.mountable, true);
  const raw = { version: 1, player: { x: 1, y: 2, z: 3 } };
  const migrated = migrateSave(raw);
  assert.equal(migrated.version, CURRENT_SAVE_VERSION);
  const s1 = createSave({ blueprint: bp, player: { x: 1, y: 2, z: 3 }, quests: [{ id: "q1", worldEntityId: questTargetId("npc", "red") }] });
  const h1 = saveCanonicalHash(s1);
  const h2 = saveCanonicalHash(JSON.parse(JSON.stringify(s1)));
  assert.equal(h1, h2);
  assert.equal(isCitadelTownV4() || isCitadelTerrainUvV2() || isCitadelCombatV3() || FEATURES.citadelTownV4, false);
  ok(`rider 贴地 · save ${h1}`);
}

console.log("[G11+] 适配器 / Worker payload / 25 镜头 / 任务 id");
{
  const { wrapWalkLift, attachCitadelV4Runtime, weatherFromParams } = await import(
    new URL("src/world/citadel/runtimeAdapter.js", BASE).href
  );
  const { createCompileHost, compileCitadelV4Payload } = await import(
    new URL("src/world/citadel/compileWorker.js", BASE).href
  );
  const { buildCameraMatrix } = await import(new URL("src/world/citadel/cameraMatrix.js", BASE).href);
  const { listPresentationShots } = await import(new URL("src/world/citadel/presentation.js", BASE).href);
  const { withQuestWorldIds } = await import(new URL("src/world/citadel/questAdapter.js", BASE).href);
  const { footstepCue, combatCue } = await import(new URL("src/world/citadel/audioAdapter.js", BASE).href);
  const { applyUrlOverrides, isAnyCitadelV4 } = await import(new URL("src/core/params.js", BASE).href);

  const fallback = () => 4.2;
  const lifted = wrapWalkLift(fallback, v4);
  const walkPt = v4.surfaces.walkable()[0].centroid;
  const y = lifted(walkPt.x, walkPt.z);
  assert.ok(Number.isFinite(y));
  assert.notEqual(y, 4.2, "V6 walkLift 不回落 legacy 高度");
  const payload = compileCitadelV4Payload(bp, 7);
  const payload2 = await createCompileHost().compile(bp, 7);
  assert.equal(payload.hash, payload2.hash);
  const shots = buildCameraMatrix(v4);
  assert.equal(shots.length, 25);
  assert.equal(listPresentationShots().length, 25);
  const q = withQuestWorldIds({ id: "q1", sender: { name: "小虎" }, receiver: { name: "阿竹" } });
  assert.match(q.worldEntityId, /^world:quest:/);
  assert.match(q.sender.worldEntityId, /^world:npc:/);
  assert.equal(footstepCue("waterfall"), "foot-wet");
  assert.equal(combatCue({ type: "attack.hit" }), "combat-hit");
  assert.equal(weatherFromParams({ weather: 1, timeOfDay: 0.5 }).weather, "rain");
  assert.equal(isAnyCitadelV4(), false);
  applyUrlOverrides("?citadelTownV4=1");
  assert.equal(isAnyCitadelV4(), true);
  const runtime = attachCitadelV4Runtime({ odysseyCitadel: { userData: { blueprint: bp } }, seed: 7, walkLift: fallback, P: { weather: 0, timeOfDay: 0.5 } });
  assert.ok(runtime.presentation);
  assert.equal(runtime.combat, null);
  assert.equal(runtime.sources.visual, "v6");
  assert.equal(runtime.sources.walk, "v6");
  assert.notEqual(runtime.walkLift, fallback);
  runtime.update(0.016, 0, { weather: 0, timeOfDay: 0.5 });
  applyUrlOverrides("?citadelTownV4=0");
  const { CITADEL_LEGACY, LEGACY_BANNER } = await import(
    new URL("src/world/citadel/legacyMarks.js", BASE).href
  );
  assert.equal(Object.keys(CITADEL_LEGACY).length, 5);
  assert.match(LEGACY_BANNER, /@legacy/);
  const always = attachCitadelV4Runtime({
    odysseyCitadel: { userData: { blueprint: bp } },
    seed: 7,
    walkLift: fallback,
  });
  assert.ok(always && always.presentation, "关开关仍编译 V4");
  assert.equal(always.sources.walk, "legacy");
  assert.equal(always.walkLift, fallback, "关开关不得 wrapWalkLift");
  const { buildTownV4Mesh } = await import(new URL("src/world/citadel/presentationMesh.js", BASE).href);
  const mesh = buildTownV4Mesh(v4, bp);
  assert.equal(mesh.name, "citadel-v4-town");
  assert.ok(mesh.children.length >= 50, `V4 镇体格子 ${mesh.children.length}`);
  assert.ok((mesh.userData.stats?.roofs || 0) > 0);
  assert.ok(mesh.userData.stats.cells === v4.town.cells.length);
  ok(`payload ${payload.hash} · 25 镜头 · V4 网格 ${mesh.children.length} · legacy ${Object.keys(CITADEL_LEGACY).length}`);
}

console.log(`\nV4 管线验收通过 ${pass} 项`);
