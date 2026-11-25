// 1010979395719319552 角色接口（本轮补的可做部分；原兜帽/锁甲素材与全装备层级仍是素材卡点）：
//   · part-random.js sampleSlots 加 {pin:{槽:变体}}——钉槽值必须在该槽 variants 内，钉槽照样消耗同一随机流；
//   · game-portrait-c01.js squadPortraitIdentity(sq)：矛兵→锁甲 mail、弓手→兜帽 hood、步兵不钉、队序→底色；
//   · battle-c01.js 头像卡按小队真数据钉槽（种子仍按 sq.id 稳定，卡面身份 = 小队身份）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleSlots } from '../src/core/part-random.js';
import { GAME_SLOTS, drawGamePortrait, squadPortraitIdentity } from '../src/ui/game-portrait-c01.js';

// recording Canvas2D stand-in（同 slot-portrait-ui.mjs）
const rec = () => { const log = []; return new Proxy({ log }, { get: (t, k) => k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : (...a) => { log.push([k, ...a]); }, set: (t, k, v) => { t[k] = v; return true; } }); };

/* ① sampleSlots pin：钉住的槽变体生效、记进 spec.pinned；同种子下没钉的槽位一个不变（同一随机流） */
{
  const free = sampleSlots(7, GAME_SLOTS), pinned = sampleSlots(7, GAME_SLOTS, { pin: { gear: 'mail', bg: 'teal' } });
  assert.equal(pinned.parts.gear, 'mail'); assert.equal(pinned.parts.bg, 'teal');
  assert.deepEqual(pinned.pinned.sort(), ['bg', 'gear']);
  for (const s of GAME_SLOTS) if (!['gear', 'bg'].includes(s.key)) assert.equal(pinned.parts[s.key], free.parts[s.key], `未钉槽 ${s.key} 不变`);
  assert.deepEqual(pinned.params, free.params, '随机流消耗一致');
  assert.equal(sampleSlots(7, GAME_SLOTS, { pin: { gear: free.parts.gear } }).pinned.length, 0, '钉到原采样值不算钉');
  assert.throws(() => sampleSlots(7, GAME_SLOTS, { pin: { gear: 'plate' } }), /Pinned variant gear:plate/, '钉表外变体被拒');
  assert.throws(() => sampleSlots(7, GAME_SLOTS, { pin: { weapon: 'axe' } }), /Pinned variant/, '钉表外槽位被拒');
}

/* ② squadPortraitIdentity：兵种→装备、队序→底色；非法小队抛错 */
{
  assert.deepEqual(squadPortraitIdentity({ id: 0, pike: false, archer: false }), { gear: null, bg: 'pink' });
  assert.deepEqual(squadPortraitIdentity({ id: 1, pike: true, archer: false }), { gear: 'mail', bg: 'teal' });
  assert.deepEqual(squadPortraitIdentity({ id: 2, pike: false, archer: true }), { gear: 'hood', bg: 'amber' });
  assert.equal(squadPortraitIdentity({ id: 4, pike: true }).bg, 'pink', '底色按队序取模循环');
  assert.throws(() => squadPortraitIdentity({}), TypeError);
  assert.throws(() => squadPortraitIdentity({ id: -1 }), TypeError);
}

/* ③ drawGamePortrait 接 identity：小队真数据钉进卡面；同队同种子确定性 */
{
  const pike = { id: 1, pike: true, archer: false };
  const a = drawGamePortrait(rec(), 138, { x: 0, y: 0, w: 88, h: 88 }, { identity: squadPortraitIdentity(pike) });
  assert.equal(a.spec.parts.gear, 'mail', '矛兵卡 = 锁甲');
  assert.equal(a.spec.parts.bg, 'teal', '队序 1 = teal 底');
  assert.deepEqual(a.drawn.map(([k]) => k), GAME_SLOTS.map((s) => s.key), '走表顺序不变');
  const b = drawGamePortrait(rec(), 138, { x: 0, y: 0, w: 88, h: 88 }, { identity: squadPortraitIdentity(pike) });
  assert.deepEqual(a.spec, b.spec, '同队同种子 → 同卡面');
  const archer = drawGamePortrait(rec(), 138, { x: 0, y: 0, w: 88, h: 88 }, { identity: squadPortraitIdentity({ id: 2, archer: true }) });
  assert.equal(archer.spec.parts.gear, 'hood', '弓兵卡 = 布兜帽');
  assert.notEqual(archer.spec.parts.bg, a.spec.parts.bg, '不同队不同底色');
  const infantry = drawGamePortrait(rec(), 138, { x: 0, y: 0, w: 88, h: 88 }, { identity: squadPortraitIdentity({ id: 3 }) });
  assert.ok(!infantry.spec.pinned.includes('gear'), '步兵装备不钉（随种子）');
  // 显式 pin 与 identity 合并；显式 pin 优先级更低（identity 覆盖同名槽——接口语义：角色数据覆盖调用方默认值）
  const both = drawGamePortrait(rec(), 138, { x: 0, y: 0, w: 88, h: 88 }, { pin: { gear: 'helmet', beard: 'full' }, identity: squadPortraitIdentity(pike) });
  assert.equal(both.spec.parts.gear, 'mail'); assert.equal(both.spec.parts.beard, 'full');
}

/* ④ battle-c01 接线：头像卡按小队钉槽 */
{
  const src = readFileSync(new URL('../src/badnorth/battle-c01.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ drawGamePortrait, squadPortraitIdentity \} from '..\/ui\/game-portrait-c01\.js'/);
  assert.match(src, /identity: squadPortraitIdentity\(sq\)/, '卡片按小队身份钉槽');
}
console.log('PASS game-portrait-c01：pin 钉槽 / 小队身份映射 / 卡片接线');
