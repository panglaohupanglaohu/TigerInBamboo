// 第 87 轮 · 天光柱（skyBeam）：837027901853810688 / 912691357440978945
// 片子里的光柱不是 0.9 单位的小竖条（那是 orderPillar），而是「从天而降、上端被画面上缘裁掉、下端停在旗顶 / 地面」的整根光柱。
// 判据数字全部来自帧量测（见 battle-c01.js 里 SKY_BEAM 的注释），这里只锁「口径 + 生命周期 + 跟随 + 可逆」。
import assert from 'node:assert/strict';
import { makeIsland, Battle, THREE } from './fixtures/g5-battle.mjs';
const { C01_FLAGS, SKY_BEAM, beamFade } = await import('../src/badnorth/battle-c01.js');

const log = [];
const ok = (name, detail) => { log.push(`PASS ${name}${detail ? ' — ' + detail : ''}`); };

// ── ① 纯函数：淡出曲线（片子是 1 帧内消失，不是长淡出）
{
  assert.equal(beamFade(0), 1, '刚起 = 满亮');
  assert.equal(beamFade(SKY_BEAM.life * 0.8), 1, '前 80% 一直满亮');
  assert.ok(Math.abs(beamFade(SKY_BEAM.life * 0.9) - 0.5) < 1e-9, '最后 20% 线性');
  assert.equal(beamFade(SKY_BEAM.life), 0, '到期 = 全透明');
  assert.equal(beamFade(SKY_BEAM.life * 3), 0, '超期不出负值');
  assert.equal(beamFade(-1), 1, '负龄夹到满亮');
  ok('beamFade 五档', `life=${SKY_BEAM.life}`);
}

// ── ② 口径常数与帧量测一致
{
  assert.ok(SKY_BEAM.width > 0.2 && SKY_BEAM.width < 0.45, '宽度 0.30 世界单位（837 量 29px/460 画幅）');
  assert.ok(SKY_BEAM.height >= 20, '高度远大于任何镜头可见高度（帧里恒被上缘裁掉，量不出绝对值）');
  assert.ok(SKY_BEAM.life >= 0.18 && SKY_BEAM.life <= 0.40, '寿命落在两片 6–11 帧区间');
  assert.equal(new THREE.Color(SKY_BEAM.color).getHexString(), 'f0fa90', '颜色 = 837 帧线芯中位 #F5FD90 的近邻');
  ok('SKY_BEAM 口径', JSON.stringify(SKY_BEAM));
}

// ── ③ 默认关 + 开关可逆
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01;
  assert.ok(C01_FLAGS.includes('skyBeam'), 'flag 已登记');
  assert.equal(C.on.skyBeam, false, '默认关');
  assert.equal(C.beams.length, 0);
  assert.throws(() => C.set('skyBeamX', true), RangeError, '未知开关抛错');
  C.set('skyBeam', false);
  C.onMove(b.squads[0], {});
  assert.equal(C.beams.length, 0, '关着的时候下令不起柱');
  ok('默认关 / 关着不起柱');
}

// ── ④ 下令 → 一根柱，底在旗顶、顶在 24 单位之上、宽度 0.30
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const sq = b.squads[0];
  C.onMove(sq, {});
  assert.equal(C.beams.length, 1, '一根');
  const rec = C.beams[0];
  const f = sq.flag.position;
  assert.ok(Math.abs(rec.mesh.position.y - (f.y + 0.6)) < 1e-9, '底停在旗顶（旗杆 0.6）');
  assert.equal(rec.bar.scale.x, SKY_BEAM.width);
  assert.equal(rec.bar.scale.y, SKY_BEAM.height);
  assert.ok(rec.mesh.position.y + rec.bar.scale.y > 20, '顶端远出画面上缘');
  b.update(1 / 60);   // afterDraw 里写 stats
  assert.equal(C.stats.beams, 1);
  assert.equal(C.stats.beamWidth, 0.30);
  assert.ok(C.stats.beamTopY - C.stats.beamBaseY === 24, 'stats 顶/底差 = 高度');
  ok('起柱几何', `base=${C.stats.beamBaseY} top=${C.stats.beamTopY}`);
}

// ── ⑤ 0.22s 后自己消失、材质释放、group 里不残留
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  C.onMove(b.squads[0], {});
  const rec = C.beams[0], kids = C.group.children.length;
  b.update(1 / 60);
  const early = rec.bar.material.opacity;
  for (let i = 0; i < 16; i++) b.update(1 / 60);   // 共 ≈0.28s
  assert.equal(C.beams.length, 0, '过期移除');
  assert.equal(C.group.children.length, kids - 1, 'group 里少一个');
  assert.ok(early > 0.9, '刚起时满亮 opacity=' + early.toFixed(2));
  ok('生命周期 0.22s 自动回收');
}

// ── ⑥ 跟着目标走（912 的 x 从 305 移到 276 = 追着移动中的单位）
// 注意：battle.update 每帧会用小队成员位置重算旗顶，所以「手动挪旗」会被覆盖 —— 只看不变量：
// 光柱底恒等于当前旗顶，且小队真的走动了（否则这个不变量是空的）。
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const sq = b.squads[0];
  C.beamAt(null, { follow: sq, life: 3 });   // 跟随要跨 30 帧才看得出，寿命临时放宽；口径仍是同一条代码路径
  const x0 = C.beams[0].mesh.position.x, z0 = C.beams[0].mesh.position.z;
  b.nextWave = 1e9;
  let drift = 0, worst = 0;
  for (let k = 0; k < 30; k++) {
    b.update(1 / 30);
    const f = sq.flag.position, p = C.beams[0].mesh.position;
    worst = Math.max(worst, Math.hypot(p.x - f.x, p.z - f.z), Math.abs(p.y - (f.y + 0.6)));
    drift = Math.max(drift, Math.hypot(p.x - x0, p.z - z0));
  }
  assert.ok(worst < 1e-9, '每帧底点 = 当前旗顶（误差 ' + worst.toExponential(1) + '）');
  assert.ok(drift > 1e-6, '旗子确实动过（不然跟随无从验证）drift=' + drift.toFixed(3));
  ok('跟随目标', `drift=${drift.toFixed(3)} 误差=${worst.toExponential(1)}`);
}

// ── ⑦ 小队全灭 → 立刻收柱（片子里没有对着空地下柱）
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const sq = b.squads[0];
  C.onMove(sq, {});
  sq.alive = false;
  b.update(1 / 60);
  assert.equal(C.beams.length, 0, '旗没了柱就没了');
  ok('灭队即收柱');
}

// ── ⑧ start/stop 清理干净
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  C.onMove(b.squads[0], {});
  b.stop();
  assert.equal(C.beams.length, 0, 'stop 清空');
  b.start(world);
  assert.equal(C.beams.length, 0, 'start 也不残留');
  ok('start/stop 无残留');
}

// ── ⑨ 第 95 轮：柱底「帽」按帧标定（r94 缺口 ①）
// 837 柱窗 0358–0364 逐行量（掩膜 G>215 & R>195 & B<205 & G−B>35，x∈[262,304]）：
//   柱身从 y=0 到 y≈137 恒为 **28px 宽**（没有一处变宽），R 244→236 单调略降，
//   唯一的变化在 y≈130–137 这 6–8px：B 从 145 抬到 165（+20）、R 再降 8 → 帽是**偏白的去黄**，不是更亮的宽喇叭。
//   96.7 px/世界单位（29px = 0.30）→ 6–8px ≈ 0.06–0.08 单位，取 0.07；帽宽 == 柱宽（1.0×，旧值 1.35× 无依据）。
{
  assert.ok(SKY_BEAM.capHeight >= 0.06 && SKY_BEAM.capHeight <= 0.08, `帽高 ${SKY_BEAM.capHeight} 落在 6–8px 量测区间`);
  assert.equal(SKY_BEAM.capWidth, 1, '帽宽与柱宽一致（帧里 28px 宽一路到底，没有变宽）');
  const body = new THREE.Color(SKY_BEAM.color), cap = new THREE.Color(SKY_BEAM.cap);
  assert.ok(cap.b > body.b + 0.05, `帽比柱身「更白」：B ${cap.b.toFixed(2)} > ${body.b.toFixed(2)}`);
  assert.ok(cap.r < body.r + 1e-6, '帽的 R 不高于柱身（帧里 R 244→236）');
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const rec = C.beamAt(new THREE.Vector3(0, 0, 0));
  assert.ok(Math.abs(rec.cap.scale.x - rec.width) < 1e-9, `帽宽 == 柱宽（cap ${rec.cap.scale.x} vs bar ${rec.width}）`);
  assert.ok(Math.abs(rec.cap.scale.y - SKY_BEAM.capHeight) < 1e-9, '帽高直接取口径常数');
  ok('柱底帽按帧标定', `capHeight=${SKY_BEAM.capHeight} capWidth=${SKY_BEAM.capWidth} cap=${SKY_BEAM.cap}`);
  b.stop();
}

console.log(log.join('\n'));
console.log(`\n${log.length} 项全过`);
