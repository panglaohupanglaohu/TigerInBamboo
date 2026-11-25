/**
 * 战役管线 · 导航能力的独立检查（R34–R36）。验证 Worker 里跑：不信改造 Worker 的报告，自己从 site.nav 重建 World 再算一遍。
 *   · 结果被改坏（报告里的数和重算对不上 / 开关没开）→ fail；
 *   · 拱洞：被拱脚封住的门户段里，开了精细门户之后必须放不下身体（直接用 fine-portals.undersideAt 的几何取点，不走报告）；
 *   · 会车 / 穿拱是模拟（启发式的起点与时限）：没全到、擦墙只判 warn，不挡采用；判 fail 的只有确定性的不变量与被改坏的结果；
 *   · 脚高：洞道里脚高必须是洞底；楼梯踏面最大一步必须小于不插值的一步。
 */
import { envFromNavSample, makeNav, finePortalReport, trafficReport, footingReport } from './nav-lab.js?v=nav-r1';
import { undersideAt } from '../../vendor/townscaper-rea-refactoring/src/world/fine-portals.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function verifyNavigation(site, plan, ids, add) {
  const nav = plan?.navigation;
  if (!['battle.navFinePortals', 'battle.navTraffic', 'battle.navFooting'].some((id) => ids.has(id))) return;
  if (!site?.nav) { add('nav-sample', '导航采样', 'fail', '没有导航采样（site.nav），导航能力没有作用对象', [...ids].filter((id) => id.startsWith('battle.nav'))); return; }
  const hollow = !!nav?.arches && Array.isArray(site.nav.hollow);
  let env;
  try { env = envFromNavSample(site.nav, { hollow }); } catch (e) { add('nav-sample', '导航采样', 'fail', e.message, ['battle.stage']); return; }

  if (ids.has('battle.navFinePortals')) {
    const B = ['battle.navFinePortals'];
    add('nav-fine-on', '精细门户开关', nav?.finePortals === true ? 'pass' : 'fail', nav?.finePortals === true ? `已开 · 身高 ${nav.unitHeight}` : '计划里没有打开 finePortals', B);
    const h = nav?.unitHeight;
    add('nav-fine-height', '门户身高', h > 0.05 && h < 1.5 ? 'pass' : 'fail', `身高 ${h}（舞台单位）`, B);
    if (nav?.finePortals === true && h > 0.05 && h < 1.5) {
      // 独立取点：每个拱下节点、每条开口边，在被拱脚封掉的那一段中点放一个身体
      const on = makeNav(env, { finePortals: true, unitHeight: h }), r = on.radius;
      let arch = 0, probes = 0, leaks = 0;
      for (const n of on.graph.nodes) {
        const u = undersideAt(env.world, n.cell, n.floor, { L: env.L, unitHeight: h }); if (!u || u.kind !== 'arch') continue;
        arch++; if (!(u.u0 > 0 && u.u0 < .5)) continue;
        for (const [e] of u.open) {
          const P0 = n.cell.pts[e], P1 = n.cell.pts[(e + 1) % n.cell.n], len = Math.hypot(P1.x - P0.x, P1.z - P0.z), lo = (r + 1e-3) / len;
          if (!(u.u0 > lo)) continue;
          const t = (lo + u.u0) / 2, x = P0.x + (P1.x - P0.x) * t, z = P0.z + (P1.z - P0.z) * t;
          probes++; if (on.discFits(n, x, z, r)) leaks++;
        }
      }
      add('nav-fine-walls', '拱脚不穿墙', leaks ? 'fail' : 'pass', `拱下节点 ${arch} · 拱脚探针 ${probes} 处 · 放得下身体（穿墙）${leaks} 处`, B);
      const re = finePortalReport(env, { unitHeight: h });
      const rep = nav.fine || {};
      add('nav-fine-report', '门户报告复算', same(re.fine, rep.fine) && same(re.probes, rep.probes) && same(re.on, rep.on) ? 'pass' : 'fail',
        same(re.fine, rep.fine) && same(re.on, rep.on) ? `复算一致：收窄 ${re.fine.narrowed} · 穿拱 ${re.on.through}/${re.crossings}` : `报告与复算不一致：报告 ${JSON.stringify(rep.fine || null)} / 复算 ${JSON.stringify(re.fine)}`, B);
      if (re.crossings) add('nav-fine-cross', '穿拱不擦墙', re.on.clips === 0 && re.on.arrived === re.crossings ? 'pass' : 'warn', `穿拱 ${re.crossings} 处：到达 ${re.on.arrived} · 擦墙帧 ${re.on.clips}（关精细门户时 ${re.off.clips}）`, B);
    }
  }
  if (ids.has('battle.navTraffic')) {
    const B = ['battle.navTraffic'], t = nav?.traffic;
    if (!t?.report) add('nav-traffic', '窄道会车', 'fail', '计划里没有会车报告', B);
    else {
      const re = trafficReport(env, { unitHeight: t.unitHeight, heavyRadius: t.heavyRadius, squad: t.squad });
      add('nav-traffic-report', '会车报告复算', same(re, t.report) ? 'pass' : 'fail', same(re, t.report) ? `复算一致：窄道 ${re.corridors} · 弯道 ${re.curves} · 岔口 ${re.forks}` : '报告与复算不一致（结果被改过或输入变了）', B);
      add('nav-traffic-body', '体型参数', t.heavyRadius > 0.055 && t.heavyRadius <= 0.2 && t.heavyShare >= 0 && t.heavyShare <= 0.5 ? 'pass' : 'fail', `大个子半径 ${t.heavyRadius} · 比例 ${t.heavyShare}`, B);
      const m = re.meeting;
      if (!m) add('nav-traffic-meet', '对向会车', 'warn', '这个舞台没有能做会车模拟的窄道', B);
      else { const share = m.arrived / Math.max(1, m.total); add('nav-traffic-meet', '对向会车', share >= 1 ? 'pass' : 'warn', `${m.arrived}/${m.total} 到达 · ${m.frames} 帧 · 最长原地 ${m.stuckMax} 帧 · 最大挤压 ${m.maxPenetration}`, B); }
    }
  }
  if (ids.has('battle.navFooting')) {
    const B = ['battle.navFooting'], f = nav?.footing;
    if (!f?.report) add('nav-footing', '脚高', 'fail', '计划里没有脚高报告', B);
    else {
      const re = footingReport(env, { unitHeight: f.unitHeight, maxRoutes: f.routes });
      add('nav-footing-report', '脚高报告复算', same(re, f.report) ? 'pass' : 'fail', same(re, f.report) ? '复算一致' : '报告与复算不一致（结果被改过或输入变了）', B);
      add('nav-footing-tunnel', '洞里脚贴洞底', re.tunnelErrors ? 'fail' : 'pass', `洞道节点 ${re.covered} · 脚不在洞底 ${re.tunnelErrors}`, B);
      if (re.profiles) add('nav-footing-stairs', '楼梯踏面插值', re.stairMaxStep < re.stairFlatStep - 1e-9 ? 'pass' : 'fail', `踏面最大一步 ${re.stairMaxStep} · 不插值 ${re.stairFlatStep}`, B);
    }
  }
}
