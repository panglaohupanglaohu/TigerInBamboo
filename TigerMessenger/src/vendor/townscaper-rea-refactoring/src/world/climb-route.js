/**
 * climb-route.js — 攀爬可达性：单位从地面经薄平台爬到更高层的坐标轨迹（781957658597269506 残差「攀爬」）。
 *
 * 竖向通道 = navgraph 的落差边 + ladder-profile 的实际三维锚点（ladderAnchors）+ 端点体素接触
 * （ladderContact）：通道可用 = 梯脚站在低层顶面、梯身不穿岩、梯顶搭在上层顶边且顶面暴露可踏下；
 * 上层支撑深度 < 落差 → 这条通道是搭在薄平台上的（contact.thinPlatform，原片「下台到上台的梯跨越空隙」）。
 *
 *   ladderChannel   一条楼梯的完整通道（NavLayer.ladderDiagnostics 现在消费同一份，见 navlayer.js）
 *   ladderChannels  当前可走图里所有通道
 *   channelBetween  任意相邻两格之间的通道（含 nav.stairs 未保留的候选边 —— 寻路经过的落差边必有梯位）
 *   climbRoute      findNavPath 的格序列 → 逐点 3D 轨迹：同层走格心，跨层沿 ladderClimb 中轴采样；
 *                   通道不可用 / 无路 → ok:false 记 reason，不静默跳过。
 *
 * 纯数据，不依赖 three；nav = buildNav(world) 的返回值。
 */
import { findNavPath } from './navgraph.js';
import { ladderProfile, ladderAnchors, ladderContact, ladderClimb } from '../core/ladder-profile.js';

/** 一条楼梯的完整竖向通道：{ stair, h, rise, anchors, profile, contact, usable, reason }。 */
export function ladderChannel(world, nav, stair, { at = (p) => [p.x, p.z], L = 1 } = {}) {
  const h = nav.hgt[stair.low.id];
  const anchors = ladderAnchors(stair, h, { at, L });
  if (!anchors) return { stair, h, rise: stair.rise || 1, anchors: null, profile: null, contact: null, usable: false, reason: 'no-anchors' };
  const profile = ladderProfile(anchors.foot, anchors.lip, { side: anchors.side, width: anchors.width });
  const contact = ladderContact(world, stair, anchors, profile, { at, L });
  const usable = !!(contact.footOnTop && contact.footInside && contact.columnClear && contact.lipOnTop);
  return { stair, h, rise: stair.rise || 1, anchors, profile, contact, usable, reason: usable ? null : 'contact' };
}

/** 可走图里所有楼梯的通道（顺序与 nav.stairs 一致）。 */
export function ladderChannels(world, nav, { at, L } = {}) {
  return nav.stairs.map((s) => ladderChannel(world, nav, s, { at, L }));
}

/**
 * 相邻两格 a↔b 之间的通道。nav.stairs 只保留最短路树用到的那批，但任何被 nav.cost 放行的
 * 非河落差边在生成时都有梯位（navgraph 的 stairSet 覆盖全部候选）——这里按落差方向重建 {low,high,edge,rise}
 * 再走 ladderChannel 同一口径，不依赖树的选择。
 */
export function channelBetween(world, nav, a, b, opts = {}) {
  const low = nav.hgt[a.id] <= nav.hgt[b.id] ? a : b, high = low === a ? b : a;
  const edge = low.edgeNeighbors.indexOf(high.id);
  if (edge < 0) return null;
  return ladderChannel(world, nav, { low, high, edge, rise: Math.abs(nav.hgt[b.id] - nav.hgt[a.id]) }, opts);
}

/**
 * 单位从 from 格爬到 to 格的轨迹。返回 { ok, reason, path, cost, points, climbs }：
 *   points  [{x,y,z,mode:'walk'|'climb',cell,t?}] —— 行走段贴各格站立高度，攀爬段沿梯梁中轴；
 *   climbs  [{from,to,rise,thin,supportDepth,length}] —— thin = 这把梯子搭在薄平台上。
 * requireContact（默认开）：经过的每条落差边都要过端点接触检查，否则 ok:false（reason = 首个失败通道）。
 */
export function climbRoute(world, nav, from, to, { at = (p) => [p.x, p.z], L = 1, climbSamples = 8, requireContact = true } = {}) {
  if (!from || !to) return { ok: false, reason: 'missing-endpoint', path: [], cost: Infinity, points: [], climbs: [] };
  const { path, cost } = findNavPath(world, nav, from, to);
  if (!path.length) return { ok: false, reason: 'no-route', path: [], cost, points: [], climbs: [] };
  const cells = world.cells;
  const points = [{ x: from.cx, y: nav.hgt[from.id] * L, z: from.cz, mode: 'walk', cell: from.id }];
  const climbs = [];
  for (let i = 1; i < path.length; i++) {
    const a = cells[path[i - 1]], b = cells[path[i]];
    const dh = nav.hgt[b.id] - nav.hgt[a.id];
    if (!dh || (world.river[a.id] && world.river[b.id])) {          // 同层 / 河道顺落差：走，不爬
      points.push({ x: b.cx, y: nav.hgt[b.id] * L, z: b.cz, mode: 'walk', cell: b.id });
      continue;
    }
    const ch = channelBetween(world, nav, a, b, { at, L });
    if (!ch || !ch.usable) {
      if (requireContact) return { ok: false, reason: ch?.reason === 'no-anchors' ? 'no-anchors' : 'contact', at: [a.id, b.id], path, cost, points, climbs };
      points.push({ x: b.cx, y: nav.hgt[b.id] * L, z: b.cz, mode: 'walk', cell: b.id });
      continue;
    }
    const up = dh > 0;
    for (let k = 0; k <= climbSamples; k++) {
      const tt = up ? k / climbSamples : 1 - k / climbSamples;      // 下爬沿梁反向：lip → foot
      const s = ladderClimb(ch.profile, tt);
      points.push({ x: s.position.x, y: s.position.y, z: s.position.z, mode: 'climb', cell: up ? b.id : a.id, t: tt });
    }
    climbs.push({ from: a.id, to: b.id, rise: dh, thin: !!ch.contact.thinPlatform, supportDepth: ch.contact.supportDepth, length: ch.profile.length });
    points.push({ x: b.cx, y: nav.hgt[b.id] * L, z: b.cz, mode: 'walk', cell: b.id });
  }
  return { ok: true, path, cost, points, climbs };
}
