// 1670064751181791233「mimic Thread.Sleep() in Burst! Just store time in a static unsafe NativeArray!
// Then you can write to it from the main thread and read it from inside a job!」—— 浏览器运行验收（r146）。
//
// 片子只有一件机制：**生成管线跑在 job（Worker 线程）里，主线程往一块共享静态数组写「时间倍率 / 暂停」，
// job 里的 sleep 每片读一次并阻塞**（= Thread.Sleep）。node 测试（tests/pipeline-job-c08.mjs）只证明
// runJob 的节奏与共享控制块的语义，证明不了「这是真线程 + 真共享内存」。本轮要在页面上量出四件事：
//   ① 真 Worker：主线程 rAF 在 job 睡觉期间照常推进（帧计数在涨）→ 睡眠发生在另一个线程；
//   ② 真共享内存：crossOriginIsolated + SharedArrayBuffer + Atomics.wait 路径生效（serve.py 只给本页发 COOP/COEP）；
//   ③ **运行中从主线程改倍率，job 里正在睡的时长当场变短**（片子的原话：write from the main thread, read inside a job）；
//      反向对照：同一倍率不改 → clay 阶段是 2000ms（改完 900ms 以内），两个数一起才说明量具有分辨力；
//   ④ 暂停位：Atomics.wait(PAUSED) 让 job 完全停住（消息数不涨）→ 恢复后继续。
// 另核节奏：片子本身 = **一轮** 22.83 s（片头 0.84 s 是上一轮的尾巴），逐帧量到的阶段边界与 CLIP_RHYTHM 对齐，
//   所以 note 里「四轮节奏」不是片里的东西（多轮是页面的可调参数，默认 4）。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.REA_TEST_URL || 'http://127.0.0.1:8769';
const OUT = path.resolve(__dirname, '../artifacts/coverage');
const STAGES = ['clear', 'triangulate', 'lift', 'clay', 'silhouette', 'color', 'hold'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (n) => console.log('  · ' + n);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1000, height: 680 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const results = {};
  const shot = async (name) => { fs.mkdirSync(OUT, { recursive: true }); await page.locator('#c').screenshot({ path: path.join(OUT, `job-c08-${name}.png`) }); };
  const waitStage = (stage, timeout = 40000) => page.waitForFunction((s) => window.jobC08 && window.jobC08.stage === s, stage, { timeout, polling: 16 });
  const probe = () => page.evaluate(() => ({
    mode: jobC08.mode, coi: jobC08.crossOriginIsolated, sab: typeof SharedArrayBuffer, shared: jobC08.sharedBuffer,
    workerIsReal: jobC08.workerIsReal, msgs: jobC08.msgs, frames: jobC08.frames, stage: jobC08.stage, round: jobC08.round,
    durations: jobC08.durations, rhythm: jobC08.rhythm, timeline: jobC08.timeline.slice(),
  }));

  // ── ① 环境：真 Worker + 真共享内存 ────────────────────────────────────────────
  step('① 环境');
  await page.goto(`${BASE}/job-c08.html?rounds=1&scale=0.25`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.jobC08 && window.jobC08.msgs > 3, null, { timeout: 20000 });
  const env = await probe();
  assert.equal(env.coi, true, 'crossOriginIsolated 必须为 true（serve.py 的 COOP/COEP 没生效）');
  assert.equal(env.sab, 'function', 'SharedArrayBuffer 必须可用');
  assert.equal(env.mode, 'shared-atomics', 'mode=' + env.mode);
  assert.equal(env.shared, true);
  assert.equal(env.workerIsReal, true, 'stage 必须跑在真 Worker 里');

  step('①b 主线程响应');
  // 主线程在 job 睡觉期间照常渲染：隔 400ms 数 rAF 帧数（此时 job 正在 triangulate 的逐点 sleep 里）
  await waitStage('triangulate');
  const f0 = (await probe()).frames; await sleep(400); const f1 = (await probe()).frames;
  const rafDuringSleep = f1 - f0;
  assert.ok(rafDuringSleep >= 8, 'job 睡觉时主线程 rAF 只推进了 ' + rafDuringSleep + ' 帧 → 睡眠疑似发生在主线程');

  step('② 一轮节奏');
  // ── ② 一轮节奏：阶段顺序 + 时长比例 ────────────────────────────────────────────
  await waitStage('clay'); await shot('clay');
  await waitStage('silhouette'); await shot('silhouette');
  await waitStage('color'); await shot('color');
  await page.waitForFunction(() => window.jobC08.stage === 'done', null, { timeout: 40000 });
  const one = await probe();
  const seq = one.timeline.filter((e, i, a) => i === 0 || e.stage !== a[i - 1].stage).map((e) => e.stage);
  assert.deepEqual(seq, [...STAGES, 'done'], '阶段顺序：' + seq.join('>'));
  const scale = 0.25, dur = one.durations;
  for (const s of ['triangulate', 'clay', 'silhouette', 'color', 'hold']) {
    const want = one.rhythm[s] * scale, got = dur[s];
    const rel = got / want;
    assert.ok(rel > 0.55 && rel < 1.75, `${s} 实测 ${got.toFixed(0)}ms vs 期望 ${want.toFixed(0)}ms（×${rel.toFixed(2)}）`);
    results[s] = Math.round(got);
  }
  const total = one.timeline.at(-1).t - one.timeline[0].t;
  // 逐点 sleep 的消息往返（postMessage + rAF + 画布重绘）会额外累加，160 点 × ~1.5ms，
  // 所以整轮只会偏长；判据是「同量级」，精确比例交给 ③④ 的 clay 单阶段做。
  assert.ok(total / (22830 * scale) > 0.7 && total / (22830 * scale) < 1.9, '一轮总时长 ' + total.toFixed(0) + 'ms');
  results.roundMs = Math.round(total);
  results.roundOverhead = +(total / (22830 * scale)).toFixed(2);

  step('③ 恒定倍率 clay');
  // ── ③ 反向对照：不改倍率时 clay = 2000ms（scale .5）────────────────────────────
  const page2 = await browser.newPage({ viewport: { width: 1000, height: 680 } });
  page2.on('pageerror', (e) => errors.push('pageerror2: ' + e.message));
  await page2.goto(`${BASE}/job-c08.html?rounds=1&scale=0.5`, { waitUntil: 'load' });
  await page2.waitForFunction(() => window.jobC08 && window.jobC08.timeline.some((e) => e.stage === 'silhouette'), null, { timeout: 40000, polling: 16 });
  // 用页面自己的时间线算 clay 段长度（silhouette 在 scale .5 下只有 200ms，靠轮询抓 stage 会漏）
  const clayFixedTl = await page2.evaluate(() => { const t = jobC08.timeline, i = t.findIndex((e) => e.stage === 'clay'), j = t.findIndex((e) => e.stage === 'silhouette'); return t[j].t - t[i].t; });
  const clayFixed = Math.round(clayFixedTl);  // 未动倍率：应为 4000×0.5 = 2000ms（Atomics.wait 的 16ms 片有调度余量 → 实测偏长）
  assert.ok(clayFixed > 1800 && clayFixed < 3800, '恒定倍率 clay = ' + clayFixed + 'ms');

  step('④ 运行中改倍率');
  // ── ④ 核心：运行中从主线程写倍率，job 里正在睡的 clay 当场变短 ────────────────────
  const page3 = await browser.newPage({ viewport: { width: 1000, height: 680 } });
  page3.on('pageerror', (e) => errors.push('pageerror3: ' + e.message));
  await page3.goto(`${BASE}/job-c08.html?rounds=1&scale=0.5`, { waitUntil: 'load' });
  await page3.waitForFunction(() => window.jobC08 && window.jobC08.stage === 'clay', null, { timeout: 40000, polling: 16 });
  const tClay2 = Date.now();
  await page3.evaluate(() => window.jobC08.setScale(0.02));   // ← 主线程写 SharedArrayBuffer
  await page3.waitForFunction(() => window.jobC08.timeline.some((e) => e.stage === 'silhouette'), null, { timeout: 20000, polling: 16 });
  const clayLive = Date.now() - tClay2;
  results.clayLiveWall = clayLive;
  results.clayLiveTl = Math.round(await page3.evaluate(() => { const t = jobC08.timeline, i = t.findIndex((e) => e.stage === 'clay'), j = t.findIndex((e) => e.stage === 'silhouette'); return t[j].t - t[i].t; }));
  assert.ok(clayLive < 900, '改倍率后 clay 仍 ' + clayLive + 'ms（≈2000 说明倍率只在启动时读一次，job 没读共享内存）');
  assert.ok(clayFixed - clayLive > 1000, '差值 ' + (clayFixed - clayLive) + 'ms 太小，量具没分辨力');
  const live = await page3.evaluate(() => ({ scale: jobC08.scale, durations: jobC08.durations }));
  assert.ok(Math.abs(live.scale - 0.02) < 1e-9, '主线程写进去的倍率 ' + live.scale);
  results.clayFixed = clayFixed; results.clayLive = clayLive;

  step('⑤ 暂停位');
  // ── ⑤ 暂停位：Atomics.wait(PAUSED) 让 job 停住，恢复后继续 ──────────────────────
  const page4 = await browser.newPage({ viewport: { width: 1000, height: 680 } });
  page4.on('pageerror', (e) => errors.push('pageerror4: ' + e.message));
  await page4.goto(`${BASE}/job-c08.html?rounds=2&scale=0.1`, { waitUntil: 'load' });
  await page4.waitForFunction(() => window.jobC08 && window.jobC08.stage === 'clay', null, { timeout: 40000, polling: 16 });
  await page4.evaluate(() => window.jobC08.pause());
  const p0 = await page4.evaluate(() => ({ msgs: jobC08.msgs, stage: jobC08.stage, frames: jobC08.frames }));
  await sleep(700);
  const p1 = await page4.evaluate(() => ({ msgs: jobC08.msgs, stage: jobC08.stage, frames: jobC08.frames }));
  assert.equal(p1.msgs, p0.msgs, '暂停后 job 还在发消息（' + p0.msgs + '→' + p1.msgs + '）→ 暂停位没被 job 读到');
  assert.equal(p1.stage, 'clay');
  assert.ok(p1.frames > p0.frames + 10, '暂停期间主线程自己也要还在渲染（' + p0.frames + '→' + p1.frames + '）');
  await page4.evaluate(() => window.jobC08.resume());
  await page4.waitForFunction(() => window.jobC08.stage !== 'clay', null, { timeout: 20000, polling: 16 });
  const resumed = await page4.evaluate(() => jobC08.stage);
  // 两轮：轮号必须走到 1（同一 Worker 里循环两遍，不是两条独立 job）
  await page4.waitForFunction(() => window.jobC08.round === 1, null, { timeout: 40000, polling: 16 }).catch(() => {});
  const twoRounds = await page4.evaluate(() => ({ round: jobC08.round, tl: jobC08.timeline.slice(), stages: jobC08.timeline.filter((e, i, a) => i === 0 || e.stage !== a[i - 1].stage).map((e) => e.stage) }));
  const restarts = twoRounds.stages.filter((s) => s === 'clear').length;
  assert.equal(restarts, 2, '两轮应出现 2 次 clear，实际 ' + restarts + '：' + twoRounds.stages.join('>'));
  results.pausedMsgs = p0.msgs; results.pausedFrames = p1.frames - p0.frames; results.resumed = resumed;
  results.twoRoundStages = twoRounds.stages.join('>');

  step('⑥ 三角化逐点');
  // ── ⑥ 三角化是逐点长出来的（片子里线网一点点加密），不是一次性贴上去 ──────────────
  await page.goto(`${BASE}/job-c08.html?rounds=1&scale=0.25`, { waitUntil: 'load' });
  await waitStage('triangulate');
  await page.waitForFunction(() => window.jobC08.i > 4, null, { timeout: 20000, polling: 16 });
  const g0 = await page.evaluate(() => ({ i: jobC08.i, tris: jobC08.tris }));
  await page.waitForFunction((n) => window.jobC08.i > n + 20, g0.i, { timeout: 20000, polling: 16 });
  const g1 = await page.evaluate(() => ({ i: jobC08.i, tris: jobC08.tris }));
  assert.ok(g1.tris > g0.tris, `三角数没有增长 ${g0.tris}→${g1.tris}`);
  results.triangleGrowth = `${g0.tris}→${g1.tris} (i ${g0.i}→${g1.i})`;
  assert.equal(errors.length, 0, 'console errors: ' + errors.join(' | '));

  await browser.close();
  console.log(JSON.stringify({ env: env.mode, rafDuringSleep, ...results, consoleErrors: 0 }, null, 2));
  console.log('PASS pipeline-job-shared-clock-browser');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
