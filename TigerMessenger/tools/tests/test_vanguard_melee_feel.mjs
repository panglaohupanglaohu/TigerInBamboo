// 先锋重甲兵近战手感（vanguardMeleeFeel + updateVanguardCombat + 优化骨架 meleeRigPose）：node 直接跑真模型。
//   ① 三段时间线：出手那帧不扣血，刀落到人（k≥0.5）那一帧才结算；结算后卡帧 0.06 s；
//   ② 三种刀路轮换：overhead → slashLR → slashRL；
//   ③ 命中：目标沿刀向被顶开 ≈0.35 m（贴球面、半径不变）；喷溅粒子出现后落地消失；刀光弧只在劈出段亮；
//   ④ 优化骨架姿态：蓄力手高过肩、劈出手到身前、前跨步 > 0。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const threeUrl = pathToFileURL(join(root, 'vendor/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeUrl)},shortCircuit:true};if(s.startsWith('three/'))return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor')).href)}+'/'+s.slice(6),shortCircuit:true};return n(s,c);}`));
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {}, classList: { add() {}, remove() {}, toggle() {} } });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, documentElement: el() }, { get: (t, k) => k in t ? t[k] : () => el() });
globalThis.addEventListener ??= () => {}; globalThis.window ??= globalThis; globalThis.location ??= { search: '' };

const THREE = await import('three');
const VT = await import(pathToFileURL(join(root, 'src/world/vanguardTrooper.js')).href);
const MF = await import(pathToFileURL(join(root, 'src/world/vanguardMeleeFeel.js')).href);

// 场景：一名重甲兵站在 r=160 球面上，面前 2 m 一名无盾红盔
const scene = new THREE.Scene();
const squad = new THREE.Group(); squad.name = 'vanguard-squad'; scene.add(squad);
const tr = VT.createVanguardTrooper({ optimized: false });
tr.position.set(0, 160, 0); squad.add(tr);
squad.userData.state = 'deployed'; squad.userData.troopers = [tr];
tr.userData.onGround = true;
const foe = new THREE.Object3D(); foe.position.set(0, 160, 2).setLength(160); scene.add(foe);
foe.userData = { equipment: {} };
scene.updateMatrixWorld(true);
let wounds = 0;
const opts = { soldiers: [foe], onWound: () => { wounds++; }, bladeRange: 3, swingPeriod: 0.7 };
const dt = 1 / 60;
let t = 0, swings = 0, firstWoundFrame = -1, startFrame = -1, maxTrail = 0, sprayMax = 0, stopFrames = 0;
const styles = [];
const r0 = foe.position.length(), p0 = foe.position.clone();
for (let f = 0; f < 60 * 4; f++) {
  const prevAnim = tr.userData._swingAnim;
  const st = VT.updateVanguardCombat(squad, dt, (t += dt), opts);
  scene.updateMatrixWorld(true);
  if (st.blade) { swings++; styles.push(tr.userData._swingStyle); if (startFrame < 0) startFrame = f; assert.equal(wounds, firstWoundFrame < 0 ? 0 : wounds, '出手那帧不结算'); }
  if (wounds && firstWoundFrame < 0) { firstWoundFrame = f; assert.ok(tr.userData._swingAnim >= MF.VANGUARD_MELEE.impact - 1e-9, '刀落到人才结算'); }
  if (prevAnim !== undefined && prevAnim < 1 && tr.userData._swingAnim === prevAnim) stopFrames++;
  for (const m of Object.values(tr.userData._trails || {})) if (m.visible) maxTrail = Math.max(maxTrail, m.material.opacity);
  const sp = squad.userData._meleeSpray; if (sp) sprayMax = Math.max(sprayMax, sp.pts.geometry.drawRange.count);
  foe.userData.dead = false; // 让它一直站着挨刀
}
const delay = (firstWoundFrame - startFrame) * dt;
assert.ok(firstWoundFrame > startFrame && delay > 0.15 && delay < 0.3, `出手→砍中有延迟（${delay.toFixed(3)} s）`);
assert.ok(stopFrames >= 3, `命中卡帧（${stopFrames} 帧）`);
assert.ok(swings >= 3, '连砍');
assert.deepEqual(styles.slice(0, 3), ['overhead', 'slashLR', 'slashRL'], '三种刀路轮换');
assert.ok(maxTrail > 0.5, '刀光弧亮');
assert.ok(sprayMax >= 8, `命中喷溅（${sprayMax} 点）`);
const moved = foe.position.distanceTo(p0);
assert.ok(moved > 0.3, `目标被顶开（${moved.toFixed(2)} m）`);
assert.ok(Math.abs(foe.position.length() - r0) < 1e-6, '贴球面');
assert.ok(foe.position.z > p0.z, '朝背离攻击者方向');
// 优化骨架关键姿态
const up = MF.meleeRigPose('overhead', MF.VANGUARD_MELEE.windup), hit = MF.meleeRigPose('overhead', MF.VANGUARD_MELEE.impact), rest = MF.meleeRigPose('overhead', 1);
assert.ok(up.hand.y > 1.4 && hit.hand.z > 0.4 && hit.lunge > 0.15 && Math.abs(rest.lunge) < 1e-9, '优化骨架：蓄力过肩 / 劈出到身前并前跨 / 回架');
const lr = MF.meleeRigPose('slashLR', MF.VANGUARD_MELEE.windup), lr2 = MF.meleeRigPose('slashLR', 0.7);
assert.ok(lr.hand.x < -0.4 && lr2.hand.x > 0.2, '横斩从右侧拉到左侧');
console.log('PASS 重甲兵近战：蓄力→劈出→收势、刀落才结算 + 卡帧、三刀路轮换、刀光、喷溅、顶开', JSON.stringify({ delay: +delay.toFixed(3), stopFrames, swings, maxTrail: +maxTrail.toFixed(2), sprayMax, moved: +moved.toFixed(2), wounds }));
