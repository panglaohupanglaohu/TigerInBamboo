/**
 * pending-defaults.js — R-A5 管线级默认登记处「待决定」种子（第一批）。
 *
 * docs/PENDING_USER_DECISIONS.md 里每一条「采用哪套 / 设为默认」都要用户点头；在点头之前，
 * 登记处里先放一条 status='pending-*' 的追踪记录，让「当前默认」栏能如实显示「这里有一件事等你决定」，
 * 而不是假装没有记录、也不会被 defaultsHook 当成可应用默认。
 *
 * 规则：
 *   - 只写不存在的 scene:layer key——用户已设的默认 / 已跑完实测选优的记录一律不覆盖。
 *   - pending 记录被「撤回」= 删除登记 = 不再追踪这个待决定（defaults-panel 里就是同一个按钮）。
 *   - 待决定有了结果时，由对应工坊用 setDefault 写正式记录（active）或 pending-measurement 带 winner，
 *     这条种子自然失效（key 已存在，seed 永远跳过）。
 *   - 纯函数 + 可注入 storage，Node / 浏览器共用；pipeline.html 经 defaults-panel mount 调一次。
 */
import { getDefault, setDefault } from './defaults.js?v=defaults-r2';

/**
 * 第一批待决定登记（对应 docs/PENDING_USER_DECISIONS.md；mountain 一条归并 P-R27-01 / P-R28-01 / P-R28-02 三个编号）。
 * capabilityId 是「将来采用时大概归哪条能力管」的占位，不代表已经选定；planId / plan 留空待决定后补。
 */
export const PENDING_DEFAULTS = Object.freeze([
  {
    scene: 'citadel', layer: 'mountain', capabilityId: 'mountain.plan',
    status: 'pending-user', pendingRef: 'P-R27-01,P-R28-01,P-R28-02',
    note: '高山圣城山形：配色二选一（P-R27-01）、新山形是否设为默认（P-R28-01）、峰高范围是否放宽（P-R28-02）待用户决定。',
  },
  {
    scene: 'old-port', layer: 'relief', capabilityId: 'relief.plan',
    status: 'pending-user', pendingRef: 'P-R49-01',
    note: '旧港湾是否换成地形管线做的地形（只换形状 / 全换 / 先不定）待用户决定；玩家地面碰撞需另轮跟上。',
  },
  {
    scene: 'citadel', layer: 'building', capabilityId: 'building.plan',
    status: 'pending-user', pendingRef: 'P-R57-01',
    note: '高山圣城建筑群：采用后要不要像山形一样进游戏自动换上（现状 autoDeploy:false）待用户决定。',
  },
  {
    scene: 'crystal', layer: 'building', capabilityId: 'building.plan',
    status: 'pending-user', pendingRef: 'P-R57-01',
    note: '水晶城建筑群：同 P-R57-01，采用后是否进游戏自动换上待用户决定。',
  },
]);

/**
 * 用户已决定的待决定事项：seed 时把残留的 pending-* 记录改写成正式默认。
 *   pendingRef 匹配才动（只翻它负责的决定）；已是 active 的用户默认一律不碰；
 *   完全没有记录时按决议补一条正式默认。
 */
export const RESOLVED_DEFAULTS = Object.freeze([
  {
    scene: 'apostles', layer: 'apostles-terrain', pendingRef: 'P-R32-01',
    record: {
      capabilityId: 'apostles.look', planId: 'soft',
      plan: { look: 'soft', lookId: 'soft', scores: { approved: 113228, soft: 141652, 'soft,palette': 141652 } },
      adoptedBy: 'user', source: 'decide',
      note: 'P-R32-01（2026-11-25 用户改定 soft 为默认）：soft-tops 破面修复+成面放宽后 e2e 验证可融台阶 163、crack.bad:[]、不写存档；palette 仍为候选。早前 11-24 实测 approved=113228 < soft=141652 的缺陷分属修复前旧状态。',
    },
  },
]);

/**
 * 把缺失的待决定记录补进登记处；已存在的 key（用户默认 / 已实测记录 / 用户删过又补种前的空档）一律不动。
 * 另按 RESOLVED_DEFAULTS 落实已决定事项：pending-* 残留记录转正式默认（返回数不含决议改写）。
 * @returns 写入的种子记录数（0–4，幂等：第二次调用返回 0）
 */
export function seedPendingDefaults(storage, { at } = {}) {
  if (!storage) return 0;
  for (const r of RESOLVED_DEFAULTS) {
    const rec = getDefault(storage, r.scene, r.layer);
    const pendingMatch = rec?.status?.startsWith('pending-') && (rec.pendingRef || '').split(',').includes(r.pendingRef);
    if (!rec) {
      setDefault(storage, r.scene, r.layer, { ...r.record, ...(at ? { at } : {}) });
    } else if (pendingMatch) {
      setDefault(storage, r.scene, r.layer, {
        ...r.record,
        planId: r.record.planId,
        plan: rec.plan ?? r.record.plan,
        note: r.record.note + (rec.note ? `（实测登记：${rec.note}）` : ''),
      });
    }
  }
  let n = 0;
  for (const seed of PENDING_DEFAULTS) {
    if (getDefault(storage, seed.scene, seed.layer)) continue;
    setDefault(storage, seed.scene, seed.layer, {
      capabilityId: seed.capabilityId,
      planId: null,
      plan: null,
      status: seed.status,
      pendingRef: seed.pendingRef,
      source: 'pending-seed',
      note: seed.note,
      ...(at ? { at } : {}),
    });
    n++;
  }
  return n;
}
