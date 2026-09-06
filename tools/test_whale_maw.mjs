// =====================================================================
// 苔庭之鲸参战（主人 2026-09-06）
//
//   「苔庭之鲸需要也参与战斗
//     1）你来模拟它被渔网束缚后的挣扎」
//   →「不必出现网，有那种被拉扯挣脱的感觉即可」（2026-09-06 修订）
//   （原文接下去是）
//     2）它可以张开大嘴，将重甲兵吸入腹中，再拉粑粑一样拉出去，
//        这个过程需要动画，让重甲兵被吸入时，也要挣扎，
//        拉出去后，军服变成土黄色」
//
// 在此之前鲸是被动的：红盔用绳索把它往下拽、机队用光束把它往上吸，
// 它自己一句话都没有。这条测试盯的就是它新长出来的那两只手。
//
// 鲸本体用一个替身（一个空 Object3D + 尾柄子节点）：whaleMaw 只用到
// 鲸的世界变换和尾柄，把整条 leviathan 拉进来只会让这条测试变慢变脆。
// 重甲兵用**真的** createVanguardSquad —— 军服换色那一条必须验真材质。
//
// 运行：node tools/test_whale_maw.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.location = { search: "", href: "http://localhost/", hash: "" };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createWhaleMaw, WHALE_MAW, applyWhaleCombatShake } = await import(new URL("src/world/whaleMaw.js", BASE).href);
const { createVanguardSquad } = await import(new URL("src/world/vanguardTrooper.js", BASE).href);

const R = 160;
const GROUND = R + 0.5;

/** 鲸的替身：局部 +X 鲸头 / +Y 背上 / +Z 右舷，浮在 hub 上方 24 */
function makeWorld() {
  const scene = new THREE.Scene();
  const hub = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  const up = hub.clone();
  const fwd = new THREE.Vector3(0, 1, 0);
  fwd.addScaledVector(up, -fwd.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();

  const whale = new THREE.Object3D();
  whale.name = "leviathanGroup";
  whale.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, up, right));
  whale.position.copy(up).multiplyScalar(R + 24);
  const tail = new THREE.Object3D();
  tail.name = "leviathan-tail-root";
  whale.add(tail);

  // 躯干替身：一颗按真鲸比例拉伸的球（半长 36 / 半高 10.4 / 半宽 17.6，中心 y=−4.4）。
  // 鲸嘴现在是**把这张壳从眼睛切开**，所以替身必须真的有这张壳。
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(8, 22, 14),
    new THREE.MeshBasicMaterial({ color: 0x6f7f86 })
  );
  body.name = "leviathan-body";
  body.scale.set(4.5, 1.3, 2.2);
  body.position.y = -4.4;
  whale.add(body);
  // 眼睛 = 铰链轴。位置照真鲸的实测值
  const eyeRoots = [-1, 1].map((sd) => {
    const e = new THREE.Object3D();
    e.name = `leviathan-eye-root-${sd < 0 ? "L" : "R"}`;
    e.position.set(27.5, -9.14, sd * 13.63);
    whale.add(e);
    return { eyeRoot: e, side: sd };
  });
  whale.userData.leviathanEyes = eyeRoots;
  // 眼前的零件（吻背结节）：验「鱼眼前部的模型」是不是一起抬起来
  const tubercle = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0x888888 })
  );
  tubercle.name = "leviathan-tubercle-L-2";
  tubercle.position.set(34.2, -2.8, -4.8);
  whale.add(tubercle);
  // 眼后的零件：**不许**跟着抬
  const dorsal = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0x888888 })
  );
  dorsal.name = "leviathan-dorsal";
  dorsal.position.set(-16.5, 5.9, 0);
  whale.add(dorsal);

  scene.add(whale);

  const squad = createVanguardSquad();
  scene.add(squad);
  const troopers = squad.userData.troopers;
  const smoke = [];

  const maw = createWhaleMaw({
    scene,
    getWhale: () => whale,
    getTroopers: () => troopers.filter((tr) => tr.parent && !tr.userData.dead),
    groundHeightAt: () => GROUND,
    spawnSmoke: (p) => smoke.push(p),
  });
  return { scene, whale, tail, body, tubercle, dorsal, squad, troopers, maw, hub, up, fwd, right, smoke };
}

/** 把 n 名重甲兵摆到鲸嘴正前方（够得着），其余摆到远处 */
function stageTroopers(w, n = 3, dist = 12) {
  const mouth = w.maw.mouthWorld(new THREE.Vector3());
  const ahead = new THREE.Vector3(1, 0, 0).applyQuaternion(w.whale.quaternion).normalize();
  const side = new THREE.Vector3(0, 0, 1).applyQuaternion(w.whale.quaternion).normalize();
  w.troopers.forEach((tr, i) => {
    tr.visible = true;
    tr.userData.dead = false;
    tr.userData.aboard = false;
    if (i < n) {
      tr.position.copy(mouth).addScaledVector(ahead, dist).addScaledVector(side, (i - 1) * 2.4);
    } else {
      // 远到吸不着：塞到鲸尾后面很远的地方
      tr.position.copy(mouth).addScaledVector(ahead, -220);
    }
  });
}

const step = (w, secs, dt = 0.05, t0 = 0) => {
  const n = Math.round(secs / dt);
  for (let i = 0; i < n; i++) w.maw.update(dt, t0 + i * dt);
};

// ---------------------------------------------------------------- ①
{
  // 被拉扯：拉力从外面喂进来（场上就是绳索小队的拔河，
  // 拉力汇总在 saihojiPhalanx 的 root.userData.ropePull01）。
  //
  // ⚠️ 这里原来验的是一张**渔网**。主人 2026-09-06：「不必出现网，
  // 有那种被拉扯挣脱的感觉即可」——网是我自己加的道具，删了；
  // 拉扯这件事交给场上本来就有的绳索，因果是现成的。
  const w = makeWorld();
  step(w, 0.2);
  assert.equal(w.maw.stats().tug, 0, "一开始没人拉它");
  const q0 = w.whale.quaternion.clone();
  const r0 = w.whale.position.length();
  step(w, 3);
  assert.ok(w.whale.quaternion.angleTo(q0) < 1e-6, "没被拉时鲸不该自己乱抖");

  // 拉住 → 立刻猛挣一下
  w.maw.setTug(1);
  step(w, 0.1, 0.05, 50);
  assert.ok(w.maw.stats().struggle > 0.9,
    "刚被拽住的第一反应就是猛地一挣，不该慢慢升上来");

  // 拉扯期间：姿态在动，而且**整条鲸被拽沉又弹回**（只转不沉读起来像原地扭）
  let minR = Infinity;
  let maxR = -Infinity;
  for (let i = 0; i < 400; i++) {
    w.maw.update(0.05, 100 + i * 0.05);
    const r = w.whale.position.length();
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    // 每帧把位置复位（模拟鲸自己的 update 每帧重算锚点），只看这一帧的偏移
    w.whale.position.setLength(r0);
  }
  assert.ok(r0 - minR > 0.4,
    `被拉扯时整条鲸要被拽沉一截，实测最深只沉了 ${(r0 - minR).toFixed(2)}`);
  assert.ok(maxR - minR > 0.5,
    `拽沉要有起伏（拽下去、挣回来），实测幅度 ${(maxR - minR).toFixed(2)}`);

  // 松手 → 平息
  w.maw.setTug(0);
  step(w, 12, 0.05, 300);
  assert.ok(w.maw.stats().struggle < 0.02, "绳一松就该平静下来");
  assert.equal(w.whale.userData.combatShake, null, "平静后不该还留着甩动量");
  console.log(`  ✓ ① 被拉扯：一拽就猛挣 · 整条鲸被拽沉 ${(r0 - minR).toFixed(2)}（起伏 ${(maxR - minR).toFixed(2)}）· 松手即平息`);
}

// ---------------------------------------------------------------- ②
{
  // 挣扎：要**一阵一阵**的。匀速抖动读起来像机器，不像被网住的活物。
  const w = makeWorld();
  const q0 = w.whale.quaternion.clone();
  step(w, 3);
  assert.ok(w.whale.quaternion.angleTo(q0) < 1e-6, "没被网住时鲸不该自己乱抖");

  w.maw.setTug(1);
  // 采样一段时间里的挣扎强度，看它有没有起伏
  const samples = [];
  for (let i = 0; i < 400; i++) {
    w.maw.update(0.05, 100 + i * 0.05);
    samples.push(w.maw.stats().struggle);
  }
  const hi = Math.max(...samples);
  const lo = Math.min(...samples);
  assert.ok(hi > 0.5, `网住后要挣得动，实测峰值 ${hi.toFixed(2)}`);
  assert.ok(lo < 0.4, `挣扎要有间歇，实测谷值 ${lo.toFixed(2)}——一直满格就是机器不是活物`);
  // 峰值不止一次：确实是「一阵一阵」，不是挣一次就完了
  let bursts = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] > 0.9 && samples[i - 1] <= 0.9) bursts++;
  }
  assert.ok(bursts >= 3, `20 秒里应当挣好几阵，实测 ${bursts} 阵`);
  // 姿态真的在动
  const q1 = w.whale.quaternion.clone();
  w.maw.update(0.05, 200);
  assert.ok(w.whale.quaternion.angleTo(q1) > 1e-5, "挣扎期间鲸的姿态必须逐帧在变");

  // 松手 → 平息
  w.maw.setTug(0);
  step(w, 12, 0.05, 300);
  assert.ok(w.maw.stats().struggle < 0.02, "松了手就该平静下来");
  console.log(`  ✓ ② 挣扎：峰 ${hi.toFixed(2)} / 谷 ${lo.toFixed(2)} · ${bursts} 阵 · 松手即平息`);
}

// ---------------------------------------------------------------- ③④
{
  // 张嘴 + 吸入：够得着的人被吸向嘴心，**一路挣扎**，到嘴边消失。
  const w = makeWorld();
  stageTroopers(w, 3, 12);
  const { maw } = w.maw.parts();

  // ---- 嘴 = 沿**口裂线**把下颌切出来，绕眼轴往下沉，喉囊鼓成一个大兜 ----
  // 主人 2026-09-06 给了蓝鲸吞噬式摄食（lunge feeding）的参考图。图里：
  // 上颚（吻背）基本不动、下颌整个往下沉、喉囊鼓成布满纵向条纹的大口袋。
  // 我上一版拿**竖直平面**在眼睛处切，把吻背连同下颌一起往上掀了——那是错的。
  assert.ok(maw.hinge, "应当有一个铰链（= 颌关节）");
  assert.ok(Math.abs(maw.hinge.position.x - 27.5) < 1e-6
    && Math.abs(maw.hinge.position.y + 9.14) < 1e-6 && maw.hinge.position.z === 0,
    "铰链必须架在**两眼连线**上——须鲸的眼睛就长在嘴角，那正是颌关节");
  assert.equal(w.body.visible, false, "原来那张整壳要退场，由切开的两块接手");

  // 切得对不对：下颌的顶点必须**全部在口裂线以下**（而不只是「在眼前」）
  {
    const slope = 0.10; // WHALE_MAW.mouthSlope
    const p = maw.front.geometry.attributes.position;
    let worst = -Infinity;
    let minX = Infinity;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);            // 铰链系：x=0 就是眼睛
      const y = p.getY(i);
      worst = Math.max(worst, y - slope * x);
      minX = Math.min(minX, x);
    }
    // 按三角形质心切，跨切面的三角形整块归一边，允许一个环距的富余
    assert.ok(worst < 6,
      `下颌的顶点应当整体压在口裂线以下，实测最高越线 ${worst.toFixed(1)}——` +
      "越得多就说明吻背被切进了下颌（上一版就是这么错的）");
    assert.ok(minX > -6, `下颌不该长到嘴角后面去，实测最靠后 ${minX.toFixed(1)}`);
  }

  // 吻背上的零件（结节）在口裂线**以上**，张嘴时必须留在原地
  assert.equal(w.tubercle.parent, w.whale,
    "吻背结节长在**上颚**上——参考图里张嘴时吻背纹丝不动，它不该跟着下巴走");
  assert.equal(w.dorsal.parent, w.whale, "背鳍更不许动");

  assert.ok(Math.abs(maw.hinge.rotation.z) < 1e-6, "没开吞时下颌是合着的");
  assert.ok(Math.abs(maw.hinge.scale.y - 1) < 1e-6, "没开吞时喉囊不该鼓着");

  assert.equal(w.maw.swallow(), true, "开吞应成功");
  step(w, WHALE_MAW.gapeTime * 0.9, 0.05, 500);

  // ① 下颌**往下**沉（负角），不是往上掀
  assert.ok(maw.hinge.rotation.z < -WHALE_MAW.gape * 0.3,
    `下颌要往**下**沉，实测铰链 ${maw.hinge.rotation.z.toFixed(3)} 弧度——` +
    "正角是把下巴往上翻，那不是张嘴");
  // 下颌前端确实掉到了嘴角下方
  {
    // ⚠️ 先刷世界矩阵：update() 只写 rotation/scale，不会替你算 matrixWorld，
    // 直接拿 matrixWorld 量出来的是上一帧（甚至单位阵）的位置。
    w.whale.updateMatrixWorld(true);
    const tip = new THREE.Vector3(maw.jawTipX - 27.5, 0, 0).applyMatrix4(maw.hinge.matrixWorld);
    const pivot = new THREE.Vector3(0, 0, 0).applyMatrix4(maw.hinge.matrixWorld);
    // 判据按**下颌自身的长度**来量，不写死一个绝对值：
    // 这里的鲸是个替身椭球，腹线比真鲸抬得早，下颌只有 3 个单位长；
    // 真鲸的壳一直伸到 x=43，下颌会长得多。绝对值会把替身误判成失败。
    const jawLen = maw.jawTipX - 27.5;
    const drop = tip.clone().sub(pivot).dot(w.up);
    assert.ok(drop < -0.6 * jawLen,
      `下颌前端要明显低于嘴角（张开的嘴是往下豁开的）：` +
      `颌长 ${jawLen.toFixed(1)}，实测下沉 ${drop.toFixed(1)}`);
  }
  // ② 喉囊鼓起来
  assert.ok(maw.hinge.scale.y > 1 + WHALE_MAW.pouchY * 0.3
    && maw.hinge.scale.z > 1 + WHALE_MAW.pouchZ * 0.3,
    `喉囊要鼓（纵 ${maw.hinge.scale.y.toFixed(2)} / 横 ${maw.hinge.scale.z.toFixed(2)}）——` +
    "参考图里那个占半张画面的大兜就是这么来的");
  // ③ 口内该看得见的东西
  assert.equal(maw.throat.visible, true, "张开要露出上腭，不然能一眼望穿整条鲸");
  assert.ok(maw.baleen.material.opacity > 0.2, "上腭内侧要挂出鲸须");
  assert.ok(maw.pleats.material.opacity > 0.2, "喉囊表面要显出纵向喉腹褶");
  assert.ok(maw.baleen.isLineSegments && maw.pleats.isLineSegments,
    "鲸须和喉腹褶都用 LineSegments，各一个 draw call");

  // 进入吸入段：记录距离与「挣扎痕迹」
  // ⚠️ 别在这里就统计被吞的人：此刻还在张嘴（gape），beginSuck 还没跑。
  let seenAny = false;
  let prevD = Infinity;
  let closing = 0;
  let rotChanges = 0;
  const mouth = w.maw.mouthWorld(new THREE.Vector3());
  let lastRot = null;
  for (let i = 0; i < 90; i++) {
    w.maw.update(0.05, 600 + i * 0.05);
    const live = w.troopers.filter((tr) => tr.userData.swallowed && tr.visible);
    // 头几帧还在张嘴（beginSuck 还没跑），此时没人被吞是正常的——
    // 不能一看见空就 break，那会在吸入还没开始时就退出。
    if (!live.length) { if (seenAny) break; continue; }
    seenAny = true;
    const d = Math.min(...live.map((tr) => tr.getWorldPosition(new THREE.Vector3()).distanceTo(mouth)));
    if (d < prevD - 1e-4) closing++;
    prevD = d;
    const r = live[0].rotation.x;
    if (lastRot !== null && Math.abs(r - lastRot) > 1e-4) rotChanges++;
    lastRot = r;
  }
  const eatenN = w.maw.stats().swallowed;
  assert.ok(eatenN > 0 && eatenN <= WHALE_MAW.capacity,
    `一口应当吞 1~${WHALE_MAW.capacity} 个，实测 ${eatenN}`);
  assert.ok(closing > 20, `被吸的人要**持续**靠近嘴心，实测只有 ${closing} 帧在靠近`);
  assert.ok(rotChanges > 20,
    `被吸入时必须挣扎（姿态逐帧在变），实测只有 ${rotChanges} 帧有变化——` +
    "直挺挺飞进嘴里那是根木头，不是人");
  console.log(`  ✓ ③④ 下颌下沉 ${maw.hinge.rotation.z.toFixed(2)} 弧度 · 喉囊鼓 ${maw.hinge.scale.y.toFixed(2)}× · 鲸须/喉腹褶就位 · 吸入 ${eatenN} 人一路挣扎（${rotChanges} 帧姿态在变）`);
}

// ---------------------------------------------------------------- ⑤⑥
{
  // 腹中 → 排出：鼓包从头走到尾；出来落地，军服变土黄。
  const w = makeWorld();
  stageTroopers(w, 3, 12);
  w.maw.swallow();

  // 记录鼓包的行程
  const xs = [];
  let t = 1000;
  for (let i = 0; i < 400; i++) {
    w.maw.update(0.05, t);
    t += 0.05;
    const b = w.maw.parts().bulge;
    if (b?.visible) xs.push(b.position.x);
    if (w.maw.stats().expelled > 0 && w.maw.phase() === "idle") break;
  }
  assert.ok(xs.length > 10, "肚子里要看得见一坨东西在走");
  assert.ok(xs[0] > xs[xs.length - 1] + 20,
    `鼓包要从鲸头一路走到尾根，实测 ${xs[0].toFixed(1)} → ${xs[xs.length - 1].toFixed(1)}`);

  const stats = w.maw.stats();
  assert.equal(stats.swallowed, stats.expelled, "吞进去几个就要排出来几个，不许有人留在肚子里");
  assert.ok(stats.expelled > 0, "必须真的排出来");

  const out = w.troopers.filter((tr) => tr.userData.uniformSoiled);
  assert.equal(out.length, stats.expelled, "排出来的人军服都要染上");
  for (const tr of out) {
    assert.equal(tr.visible, true, "排出来的人要重新出现在画面上");
    assert.equal(tr.userData.swallowed, false, "排出来就不再是「被吞」状态，得还给战斗逻辑");
    assert.ok(tr.userData.dazed > 0, "刚出来该有一小段呆滞，抖一抖再归队");
    // 落到地面（排出口在尾根底下，人要掉到地上，不是飘在半空）
    const r = tr.getWorldPosition(new THREE.Vector3()).length();
    assert.ok(Math.abs(r - GROUND) < 1.5,
      `排出来的人要落到地面，实测半径 ${r.toFixed(2)}（地表 ${GROUND}）`);
    assert.ok(Math.abs(tr.rotation.x) < 1e-6 && Math.abs(tr.rotation.z) < 1e-6,
      "落地后姿态要摆正，不能一直躺着转");
  }

  // ---- 军服真的变了：比对材质颜色，不是只翻了个标志位 ----
  const soiled = out[0];
  const colors = new Set();
  soiled.traverse((o) => { if (o.isMesh && o.material?.color) colors.add(o.material.color.getHex()); });
  assert.ok(colors.has(0x8a7434), "装甲主色要换成土黄 0x8a7434");
  assert.ok(!colors.has(0x4a4f55), "原来的深灰装甲色不该还在");
  // 没被吞的人不许被连累（材质是全场共享的，这一条防的就是「一染染一片」）
  const clean = w.troopers.find((tr) => !tr.userData.uniformSoiled);
  const cleanColors = new Set();
  clean.traverse((o) => { if (o.isMesh && o.material?.color) cleanColors.add(o.material.color.getHex()); });
  assert.ok(cleanColors.has(0x4a4f55),
    "没被吞的人军服必须还是原色——toonMat 是全场共享缓存，" +
    "直接改 material.color 会把所有人一起染了");
  assert.ok(!cleanColors.has(0x8a7434), "没被吞的人不该染上土黄");
  console.log(`  ✓ ⑤⑥ 腹中鼓包 ${xs[0].toFixed(0)}→${xs[xs.length - 1].toFixed(0)} · 排出 ${stats.expelled} 人落地 · 军服变土黄（旁人不受连累）`);
}

// ---------------------------------------------------------------- ⑦
{
  // 吸不着的人不许被吸走：太远的、以及绕到鲸尾后头的。
  const w = makeWorld();
  const mouth = w.maw.mouthWorld(new THREE.Vector3());
  const ahead = new THREE.Vector3(1, 0, 0).applyQuaternion(w.whale.quaternion).normalize();
  w.troopers.forEach((tr, i) => {
    tr.visible = true;
    // 一半在嘴前方但**远**（射程之外），一半在**鲸尾后头**（够得着距离但在背面）
    tr.position.copy(mouth).addScaledVector(ahead, i % 2 === 0 ? 90 : -10);
  });
  w.maw.swallow();
  step(w, 6, 0.05, 2000);
  assert.equal(w.maw.stats().swallowed, 0,
    "射程之外、以及绕到鲸尾后头的人，一个都不许被吸走——" +
    "不然鲸就成了全场吸尘器");
  assert.equal(w.maw.phase(), "idle", "一个都够不着就该合上嘴进冷却，不是空张着");
  console.log("  ✓ ⑦ 够不着的不吸：射程之外 / 绕到鲸尾后头，一个都没动");
}

// ---------------------------------------------------------------- ⑧
{
  // 冷却：不许变成绞肉机。
  const w = makeWorld();
  stageTroopers(w, 3, 12);
  w.maw.swallow();
  let t = 3000;
  // 跑到整轮**收尾**（回 idle）为止：expelled 是在开始排出那一刻就记的，
  // 那时还在 expel 段，冷却要等这一段走完才会挂上。
  for (let i = 0; i < 600; i++) {
    w.maw.update(0.05, t);
    t += 0.05;
    if (w.maw.stats().expelled > 0 && w.maw.phase() === "idle") break;
  }
  assert.ok(w.maw.stats().expelled > 0, "第一轮应当走完");
  assert.equal(w.maw.phase(), "idle", "一轮结束应当回到 idle");
  assert.equal(w.maw.swallow(), false, "刚吞完一轮，冷却期内不许马上再吞");
  assert.ok(w.maw.stats().cooldown > 0, "冷却计时要在走");
  step(w, WHALE_MAW.cooldown + 1, 0.05, t);
  // 冷却过了、场上还有没被吞过的人 → 可以再来一轮
  stageTroopers(w, 3, 12);
  assert.equal(w.maw.swallow(), true, "冷却结束后可以再开一轮");
  console.log(`  ✓ ⑧ 冷却 ${WHALE_MAW.cooldown}s：一轮之内不重复开吞`);
}

// ---------------------------------------------------------------- ⑨
{
  // 确定性 + 预算。
  const snap = () => {
    const w = makeWorld();
    stageTroopers(w, 3, 12);
    w.maw.setTug(1);
    w.maw.swallow();
    let t = 0;
    for (let i = 0; i < 300; i++) { w.maw.update(0.05, t); t += 0.05; }
    return w.troopers.slice(0, 6)
      .map((tr) => tr.position.toArray().map((v) => v.toFixed(6)).join(","))
      .join("|") + "#" + JSON.stringify(w.maw.stats());
  };
  assert.equal(snap(), snap(), "重跑两次必须逐位一致（禁 Math.random）");

  const w = makeWorld();
  w.maw.setTug(1);
  step(w, 0.2);
  let tris = 0;
  let lines = 0;
  // 「新部件」= 上腭 / 鲸须 / 喉腹褶 + 肚子里的鼓包。
  // 切开的两半不算新增：那是**鲸原来的模型**换了个挂法，三角总数没变。
  const p = w.maw.parts();
  for (const part of [p.hinge, p.bulge].filter(Boolean)) {
    part.traverse((n) => {
      const g = n.geometry;
      if (!g) return;
      const c = g.index ? g.index.count : (g.attributes.position?.count || 0);
      if (n.isLineSegments) lines += c / 2; else tris += c / 3;
    });
  }
  assert.ok(tris < 12000, `鲸的新部件三角数 ${tris}，超预算`);
  console.log(`  ✓ ⑨ 确定性逐位一致 · 预算：${tris} 三角 + ${lines} 段网线`);
}

// ---------------------------------------------------------------- ⑩
{
  // 顺序陷阱：挣扎会不会被鲸自己的 update 抹掉。
  //
  // 场景是按 sceneHandles 顺序逐个 update 的，默认 ["messenger", "saihoji"]：
  //   messenger → saihojiPhalanx → whaleMaw（写甩动）
  //   saihoji   → leviathan.update → `group.quaternion.copy(poseQ)`（复位）
  // 后者在后面。第一版直接在 whaleMaw 里 rotateZ，画面上一动不动——
  // node --check 查不出来，只跑 whaleMaw 一家的测试也查不出来。
  // 这一块把**真实顺序**摆出来：写 → 复位 → applyWhaleCombatShake。
  const w = makeWorld();
  const poseQ = w.whale.quaternion.clone();
  w.maw.setTug(1);

  let moved = 0;
  for (let i = 0; i < 200; i++) {
    w.maw.update(0.05, 5000 + i * 0.05);          // ① messenger 侧：写甩动
    w.whale.quaternion.copy(poseQ);                // ② saihoji 侧：鲸自己复位
    applyWhaleCombatShake(w.whale);                // ③ 复位之后补上
    if (w.whale.quaternion.angleTo(poseQ) > 1e-4) moved++;
  }
  assert.ok(moved > 120,
    `复位之后必须还看得见挣扎，实测 200 帧里只有 ${moved} 帧姿态偏离——` +
    "这正是「写了却被下一个场景抹掉」的样子");

  // 幂等的边界：不挣扎时不该留下残余
  w.maw.setTug(0);
  for (let i = 0; i < 400; i++) {
    w.maw.update(0.05, 6000 + i * 0.05);
    w.whale.quaternion.copy(poseQ);
    applyWhaleCombatShake(w.whale);
  }
  assert.ok(w.whale.quaternion.angleTo(poseQ) < 1e-6,
    "平静下来后应当完全回到原姿态，不留残余");
  assert.equal(applyWhaleCombatShake(null), false, "没有鲸时安全返回 false");
  console.log(`  ✓ ⑩ 顺序：鲸复位之后挣扎仍在（${moved}/200 帧）· 平静后不留残余`);
}

console.log("✅ test_whale_maw（被绳索拉扯挣脱 · 下颌下沉喉囊鼓起 · 吸入时挣扎 · 腹中走一趟 · 排出落地 · 军服变土黄 · 不被场景顺序抹掉）");
