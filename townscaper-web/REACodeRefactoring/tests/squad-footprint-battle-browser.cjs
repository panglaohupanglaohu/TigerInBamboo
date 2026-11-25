/**
 * squad-footprint-battle-browser.cjs — 883447205176238083 在主战场里的运行验收。
 * 片里的四件事：① 选中队伍脚下的**格边界**线网（轮廓 + 辐条 + 角标，凹口保留）
 * ② 线网贴台面（world.top）③ 旗顶悬空白菱形 ④ 箭矢的细白轨迹线。
 * 只看真画出来的像素与自己读到的网格，不信 exit code。
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], out = {};
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++;
    console.log(`  PASS ${name} — ${detail}`);
  };
  p.on('pageerror', (e) => errors.push(e.message));

  try {
    // 主场景在 swiftshader 下首帧偶尔要 60s+，给两次重试
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad', { waitUntil: 'domcontentloaded' });
      try { await p.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 90000 }); break; } catch (e) {
        if (attempt === 2) throw e;
        console.log('  retry boot ' + (attempt + 1));
      }
    }

    // ── 夹具：找同台面的 2 格（凸）与 3 格 L（凹），把一队人按格中心摆进去 ─────────
    out.fixture = await p.evaluate(async () => {
      const b = rea.battle, w = b.world;
      b.paused = true; b.wave = 1; b.nextWave = 1e9; b.t = 10;
      let pair = null, corner = null;
      for (const c of w.cells) {
        if (w.top(c) < 1) continue;
        const ns = c.edgeNeighbors.map((id) => w.cells[id]).filter((n) => n && w.top(n) === w.top(c));
        if (ns.length >= 1 && !pair) pair = [c, ns[0]];
        for (let i = 0; i < ns.length && !corner; i++) for (let j = i + 1; j < ns.length; j++) {
          if (ns[i].edgeNeighbors.includes(ns[j].id)) continue;   // 两个邻格自己相邻 → 三格是一条直条，不是 L
          corner = [c, ns[i], ns[j]]; break;
        }
        if (pair && corner) break;
      }
      if (!pair || !corner) throw Error('找不到同台面的 2 格 / 3 格 L 夹具');
      const sq = b.squads.find((s) => s.alive && !s.archer) || b.squads[0];
      const alive = sq.members.filter((u) => !u.dead);
      const place = (cells, offset = 0.02) => {
        alive.forEach((u, i) => {
          const c = cells[i % cells.length], ring = Math.floor(i / cells.length);
          const a = ring * 2.4 + i * 0.9;
          u.dead = false; u.onBoat = null; u.fall = false;
          u.x = c.cx + Math.cos(a) * offset; u.z = c.cz + Math.sin(a) * offset;
          u.y = w.top(c) * b.L; u.navFloor = w.top(c); u.cd = 100;
        });
        sq.goal = cells[0]; sq.goalFloor = w.top(cells[0]);
      };
      const stats = () => {
        b.selected = null; b.update(0);
        b.selected = sq; b.update(0);
        return { ...b.footprintStats };
      };
      place(pair);
      const pairStats = stats();
      place(corner);
      const lStats = stats();
      const verts = b.footprintLines.geometry.attributes.position.count;
      rea.view.target.set(corner[0].cx, w.top(corner[0]) * b.L + 0.2, corner[0].cz);
      rea.view.distance = 7; rea.view.pitch = 1.05; rea.view.updateCamera();
      window.__fpFix = { sq, pair, corner, alive };
      return { top: w.top(corner[0]), pairStats, lStats, verts, squad: sq.id, archer: !!sq.archer, L: b.L, cells: b.squads.map((s) => s.id) };
    });

    const { pairStats: ps, lStats: ls } = out.fixture;
    check('2 格占位：面积 == 两格多边形面积和，凹口可忽略', Math.abs(ps.area - ps.cellArea) < 1e-6 && ps.notchArea < 0.03 * ps.area, `area ${ps.area.toFixed(6)} cellArea ${ps.cellArea.toFixed(6)} notch ${ps.notchArea.toFixed(6)}`);
    check('3 格 L：凹口保留（面积 < 凸包，且 == 格面积和）',
      ls.notchArea > 0.05 * ls.area && ls.hullArea > ls.area && Math.abs(ls.area - ls.cellArea) < 1e-6, `area ${ls.area.toFixed(3)} hull ${ls.hullArea?.toFixed(3)} cellArea ${ls.cellArea.toFixed(3)} notch ${ls.notchArea.toFixed(3)}`);
    check('角标与辐条各随一个角（ring == spokes == ticks）', ls.ring === ls.spokes && ls.ring === ls.ticks && ls.ring >= 5, `${ls.ring}/${ls.spokes}/${ls.ticks}`);
    check('线网真的建了几何（轮廓 + 辐条 + 每角 4 边 = 12×角数 段）',
      out.fixture.verts === 12 * ls.ring, `verts ${out.fixture.verts} ring ${ls.ring}`);
    check('线网贴台面（顶点高度 vs world.top 差 < 5e-3 m）', ls.minLift !== null && ls.minLift < 5e-3, `minLift ${ls.minLift}`);

    // ── 像素 A/B：同机位、冻结动画，开/关线网 ──────────────────────────────
    out.pixels = await p.evaluate(async () => {
      const T = await import('three');
      const b = rea.battle, r = rea.view.renderer, scene = rea.view.scene, cam = rea.view.camera;
      const W = 480, H = 340, rt = new T.WebGLRenderTarget(W, H), buf = new Uint8Array(W * H * 4);
      const grab = () => {
        r.setRenderTarget(rt); r.render(scene, cam); r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
        const cp = Uint8Array.from(buf); r.setRenderTarget(null); return cp;
      };
      const on = grab();
      b.setFootprint(false);
      b.selected = null; b.update(0); b.selected = window.__fpFix.sq; b.update(0);
      const off = grab();
      b.setFootprint(true);
      b.selected = null; b.update(0); b.selected = window.__fpFix.sq; b.update(0);
      const back = grab();
      rt.dispose();
      let diff = 0, noise = 0, minX = W, maxX = 0, minY = H, maxY = 0;
      for (let i = 0; i < on.length; i += 4) {
        const d = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]);
        if (d > 24) {
          diff++;
          const px = (i / 4) % W, py = Math.floor((i / 4) / W);
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
        if (Math.abs(on[i] - back[i]) + Math.abs(on[i + 1] - back[i + 1]) + Math.abs(on[i + 2] - back[i + 2]) > 8) noise++;
      }
      const boxArea = diff ? (maxX - minX + 1) * (maxY - minY + 1) : 0;
      return { W, H, diff, noise, box: [minX, minY, maxX, maxY], boxFrac: +(boxArea / (W * H)).toFixed(3), frames: 3 };
    });
    check('开/关整帧差分（线网真的画在场景里）', out.pixels.diff > 300, `diff ${out.pixels.diff} px`);
    check('差分只落在队伍脚下（占地 < 半屏）', out.pixels.boxFrac < 0.5, `box ${JSON.stringify(out.pixels.box)} frac ${out.pixels.boxFrac}`);
    check('开→关→开回位（同状态噪声 0）', out.pixels.noise === 0, `noise ${out.pixels.noise}`);

    await p.screenshot({ path: 'artifacts/coverage/squad-footprint-battle-r157.png' });

    // ── 旗顶悬空白菱形 ──────────────────────────────────────────────────
    out.flags = await p.evaluate(() => {
      const T = window.__threeCache ?? null;
      const b = rea.battle;
      return b.squads.filter((s) => s.alive).map((s) => {
        const m = s.flag.userData.marker;
        if (!m) return { squad: s.id, marker: false };
        const wp = m.getWorldPosition(new (s.flag.position.constructor)());
        const q = s.flag.userData.marker.quaternion;
        const cq = rea.view.camera.quaternion;
        const dot = Math.abs(q.x * cq.x + q.y * cq.y + q.z * cq.z + q.w * cq.w);
        return { squad: s.id, marker: true, visible: m.visible, lift: +(wp.y - s.flag.position.y).toFixed(3), dot: +dot.toFixed(5), color: m.material.color.getHexString(), size: +m.geometry.parameters.width.toFixed(3) };
      });
    });
    check('每面旗顶都有白色菱形', out.flags.length > 0 && out.flags.every((f) => f.marker && f.visible), JSON.stringify(out.flags));
    check('菱形悬在旗杆顶上方 0.74 单位', out.flags.every((f) => Math.abs(f.lift - 0.74) < 0.02), JSON.stringify(out.flags.map((f) => f.lift)));
    check('菱形永远正对相机（billboard）', out.flags.every((f) => f.dot > 0.999), JSON.stringify(out.flags.map((f) => f.dot)));

    // ── 箭矢细白轨迹线 ──────────────────────────────────────────────────
    out.arrow = await p.evaluate(async () => {
      const b = rea.battle, w = b.world;
      const archer = b.squads.find((s) => s.archer && s.alive) || b.squads.find((s) => s.archer);
      if (!archer) throw Error('没有弓手队');
      const shooter = archer.members.find((u) => !u.dead) || archer.members[0];
      if (!shooter) throw Error('弓手队没有成员');
      shooter.dead = false; shooter.onBoat = null; shooter.fall = false; shooter.cd = 0;
      // 第一波维京人可能还在船上：优先取已经下船的，否则从船里拎一个下来
      let foe = b.units.find((u) => u.team !== 0 && !u.dead && !u.onBoat);
      if (!foe) foe = b.boats.flatMap((x) => x.crew ?? []).find((u) => u.team !== 0);
      if (!foe) { b.nextWave = -1; b.update(0.05); b.nextWave = 1e9; foe = b.boats.flatMap((x) => x.crew ?? []).find((u) => u.team !== 0); }
      if (!foe) throw Error('场上没有维京人可当靶子');
      foe.dead = false; foe.onBoat = null; foe.fall = false;
      foe.x = shooter.x + 1.2; foe.z = shooter.z + 0.3; foe.y = shooter.y;
      b.paused = false; b.scale = 1;
      let found = null, steps = 0;
      for (; steps < 400 && !found; steps++) {
        shooter.cd = 0;
        b.update(0.05);
        found = b.arrows.find((a) => a.trail && !a.stuck);   // 要挑一支还在飞的（落定的轨迹线已收掉）
      }
      if (!found) throw Error('弓箭手 20 秒内没有射出还在飞、带轨迹线的箭');
      b.paused = true;
      const pos = found.trail.geometry.attributes.position;
      const headBefore = [pos.getX(1), pos.getY(1), pos.getZ(1)];
      const flying = found.trail.visible && !found.stuck;
      let grown = 0;
      for (let i = 0; i < 4 && !found.stuck; i++) {           // 小步推进，量轨迹线长出去多少
        b.paused = false; b.update(0.02); b.paused = true;
        const h = [pos.getX(1), pos.getY(1), pos.getZ(1)];
        grown = Math.max(grown, Math.hypot(h[0] - headBefore[0], h[1] - headBefore[1], h[2] - headBefore[2]));
      }
      const headAfter = [pos.getX(1), pos.getY(1), pos.getZ(1)];
      const tail = [pos.getX(0), pos.getY(0), pos.getZ(0)];
      for (let i = 0; i < 400 && !found.stuck; i++) b.update(0.05);
      return {
        steps, points: pos.count, tail, headBefore, headAfter, grown,
        from: found.from, flying, trailAfterStuck: found.trail.visible, stuck: found.stuck,
        color: b.arrowTrailMat.color.getHexString(), opacity: b.arrowTrailMat.opacity,
        arrowCount: b.arrows.length,
      };
    });
    check('箭尾有轨迹线（2 个端点，起点=出箭点）',
      out.arrow.points === 2 && Math.hypot(out.arrow.tail[0] - out.arrow.from[0], out.arrow.tail[2] - out.arrow.from[2]) < 1e-6, JSON.stringify(out.arrow.tail));
    check('轨迹线随箭一起长（飞行时可见、端点跟着箭走）',
      out.arrow.flying && out.arrow.grown > 0.01, `flying ${out.arrow.flying} grown ${out.arrow.grown?.toFixed(4)}`);
    check('落定后轨迹线收掉', out.arrow.stuck && out.arrow.trailAfterStuck === false, `stuck ${out.arrow.stuck} trail ${out.arrow.trailAfterStuck}`);
    check('轨迹线是近白细线（0.62 不透明度）', out.arrow.color === 'f7f4ea' && Math.abs(out.arrow.opacity - 0.62) < 1e-6, `${out.arrow.color} @${out.arrow.opacity}`);

    // ── 关档：?footprint=0 时不出线网（对照旧行为） ────────────────────────
    await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad&footprint=0', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 120000 });
    out.offSwitch = await p.evaluate(() => {
      const b = rea.battle;
      b.paused = true; b.wave = 1; b.nextWave = 1e9; b.t = 10;
      b.selected = b.squads[0]; b.update(0);
      return { on: b.footprintOn, stats: b.footprintStats, visible: b.footprintLines.visible, ring: b.ring.visible };
    });
    check('?footprint=0 关档线网不出现（目标圈仍在）',
      out.offSwitch.on === false && out.offSwitch.stats === null && out.offSwitch.visible === false && out.offSwitch.ring === true, JSON.stringify(out.offSwitch));

    check('无页面报错', errors.length === 0, errors.join(' | ') || '0 error');
    fs.writeFileSync('artifacts/coverage/squad-footprint-battle-browser.json', JSON.stringify({ ...out, ok, errors }, null, 2));
    console.log(`PASS squad-footprint-battle-browser：${ok} 项断言全过`);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
