import * as THREE from 'three';
// 湖沼目标图：大白鲸身旁水下跟着两只小白鲸，身影透过清水可见，始终不出水。
// Greg 团队·异星生态：幼崽贴着母亲外侧、稍深处、错开相位跟游——生态里"成群"的信号。
// 做法：现有幼鲸（whales[1]）在母鲸每帧更新之后被改为水下跟游（holdPup，默认开）；
// 再克隆一只更小的幼鲸（去掉嘴线，其余与原幼鲸共用几何与材质）。新幼鲸不进 inner.userData.whales，
// 所以湖沼自身游动循环与水面笔触不会把它拉出水面。?swampWhaleCalves=0 关闭。
// 必须在 swamp 的 userData.update(...) 之后调用本模块 update(t)，t 与湖沼动画同一时间轴。
const flag = k => new URLSearchParams(globalThis.location?.search || '').get(k) !== '0';

function cloneWhale(src) {
  const ud = src.userData; src.userData = {};          // userData 内含网格引用，避免 JSON 深拷贝
  let c; try { c = src.clone(true); } finally { src.userData = ud; }
  c.traverse(o => { if (o !== c) o.userData = {}; });
  c.getObjectByName('swamp-beluga-mouth')?.removeFromParent();
  return c;
}

export function installSwampWhaleCalves({swamp, enabled = flag('swampWhaleCalves'), holdPup = true,
  lanes = [{lag: .6, extra: 3.6, y: 22.3, scale: null}, {lag: 1.05, extra: 5.0, y: 21.7, scale: .42}]} = {}) {
  const report = {enabled, version: 1, calves: 0, added: 0, heldPup: false, drawCalls: 0, triangles: 0, maxTopY: -Infinity, minY: Infinity};
  const inner = swamp?.userData?.inner || swamp;
  const adult = inner?.userData?.whale;
  if (!enabled || !adult) return {report, update() {}};
  const waterY = inner.userData.waterY ?? 25;
  const pup = (inner.userData.whales || []).find(w => w !== adult && w.scale.x < .9);
  const calves = [];
  if (holdPup && pup) { calves.push(pup); report.heldPup = true; }
  const template = pup || adult;
  while (calves.length < 2) {
    const c = cloneWhale(template);
    const lane = lanes[calves.length];
    c.scale.setScalar(lane.scale ?? (calves.length ? .42 : .55));
    c.name = 'swamp-beluga-calf-' + calves.length;
    c.rotation.order = 'YXZ'; c.userData.swampCalf = true; c.userData.surfacing = 0;
    adult.parent.add(c); calves.push(c); report.added++;
    c.traverse(o => { if (o.isMesh || o.isLine) { report.drawCalls++; const g = o.geometry; report.triangles += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  }
  report.triangles = Math.round(report.triangles);
  report.calves = calves.length;
  // 身体竖向半高（本地 Y 包围），用于保证"不出水"
  const halfH = calves.map(c => { const b = new THREE.Box3(); c.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox); } }); return Math.max(.5, (b.max.y - b.min.y) * .5 + .15); });
  function update(t) {
    const sw = adult.userData.swim;
    calves.forEach((c, i) => {
      const L = lanes[i], k = c.scale.x;
      if (sw) {
        const ang = sw.phase + t * sw.speed - L.lag + Math.sin(t * .23 + i * 2.1) * .05;
        const rx = sw.rx + L.extra, rz = sw.rz + L.extra;
        c.position.x = sw.cx + Math.cos(ang) * rx;
        c.position.z = sw.cz + Math.sin(ang) * rz;
        c.rotation.y = Math.atan2(-Math.sin(ang) * rx, Math.cos(ang) * rz);
      } else {
        c.position.x = adult.position.x + (i ? -3 : 3); c.position.z = adult.position.z - 3 - i * 2; c.rotation.y = adult.rotation.y;
      }
      const bob = Math.sin(t * .55 + i * 2.3);
      let y = L.y + bob * .45;
      y = Math.min(y, waterY - .6 - halfH[i] * k);          // 背始终在水面下
      c.position.y = y;
      c.rotation.x = -Math.cos(t * .55 + i * 2.3) * .09;
      c.rotation.z = Math.sin(t * .4 + i) * .05;
      c.userData.surfacing = 0;
      report.maxTopY = Math.max(report.maxTopY, y + halfH[i] * k); report.minY = Math.min(report.minY, y);
    });
  }
  update(0);
  return {report, calves, update};
}
