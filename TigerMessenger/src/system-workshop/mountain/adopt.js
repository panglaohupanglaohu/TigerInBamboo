/**
 * R28 采用后进游戏自动换上新山形：只认用户在工坊里亲手点过「采用」写下的 v2 记录（纯数据，游戏与 Node 测试共用）。
 *   记录：localStorage tm.mountain.adopted.v1:<场景>  =  { v: 2, plan, at, autoDeploy: true, sig }
 *   sig = 采用时实景采样的指纹（网格尺寸 / 陆地 / 建筑 / 轨道格数）；进游戏时实景重新采样，指纹对得上才换（场景改过就不换，免得山压到新建筑上）。
 *   旧的 v1 记录（R25 之前的「采用」只是存档，没有 autoDeploy）不自动部署——那时的采用说明里写的是「带网址参数才部署」，不能事后改变它的意思。
 *   网址 ?mountainAdopted=0 本次进游戏不换（一键看原山形）；工坊「回到原山形」= 删掉记录 + 撤下预览。
 * 「设为默认」（不需要采用、所有人进游戏都是新山形）不在这里：要用户点头，见 docs/PENDING_USER_DECISIONS.md。
 */
export const ADOPT_VERSION = 2;
export const adoptKey = (id) => `tm.mountain.adopted.v1:${id}`;
export function fieldSignature(field) {
  const N = field.n * field.n; let land = 0, structure = 0, rail = 0;
  for (let q = 0; q < N; q++) { const v = field.h[q]; if (v != null && Number.isFinite(v) && v > 0.3) land++; if (field.cls[q] === 1) structure++; else if (field.cls[q] === 2) rail++; }
  return { n: field.n, step: field.step, land, structure, rail };
}
/** 两次采样的指纹是否算同一个场景：网格一致，陆地 / 建筑 / 轨道格数各差 ≤ 1%（采样里浮点边界会有个别格出入） */
export function sameSite(a, b) {
  if (!a || !b || a.n !== b.n || a.step !== b.step) return false;
  return ['land', 'structure', 'rail'].every((k) => Math.abs((a[k] || 0) - (b[k] || 0)) <= Math.max(2, Math.ceil(Math.max(a[k] || 0, b[k] || 0) * 0.01)));
}
export function adoptRecord(plan, field, at = Date.now()) {
  if (!plan || !Array.isArray(plan.h) || plan.h.length !== field.n * field.n) throw new TypeError('山形计划与采样网格不一致');
  return { v: ADOPT_VERSION, plan, at, autoDeploy: true, sig: fieldSignature(field) };
}
/** 进游戏时要不要自动换：返回 { deploy, reason }。sig = 这次实景采样的指纹（还没采样时传 null，只做前置判断） */
export function shouldAutoDeploy(record, { search = '', sig = null } = {}) {
  const q = new URLSearchParams(search);
  if (q.get('mountainAdopted') === '0') return { deploy: false, reason: '网址带 ?mountainAdopted=0：本次不换，看原山形' };
  if (!record) return { deploy: false, reason: '没有采用记录：游戏里是原山形' };
  if (record.v !== ADOPT_VERSION || record.autoDeploy !== true) return { deploy: false, reason: '旧版采用记录（R25 之前）只存档、不自动部署；在工坊里重新点一次「采用山形」即可' };
  if (!record.plan || !Array.isArray(record.plan.h)) return { deploy: false, reason: '采用记录里没有山形计划' };
  if (sig && !sameSite(record.sig, sig)) return { deploy: false, reason: `场景和采用时不一样（采用时 陆地 ${record.sig?.land} / 建筑 ${record.sig?.structure} / 轨道 ${record.sig?.rail} 格，现在 ${sig.land} / ${sig.structure} / ${sig.rail}）：不换，请在工坊重新执行并采用` };
  return { deploy: true, reason: sig ? '采用记录与实景对得上：自动换上新山形' : '有采用记录：等实景就绪后核对' };
}
