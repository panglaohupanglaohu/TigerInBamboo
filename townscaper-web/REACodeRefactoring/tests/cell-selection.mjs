// 1120036868966502401 缺口 ②（第 161 轮）· `src/core/cell-selection.js` 纯逻辑验收。
// 选中态是「编辑器那一层」的账本：点选/多选/剔无效/撤销回位，四条都要能单独断言。
// 口径：非法输入必须抛错（不许把 NaN/字符串 id 记进包围盒）；空选中 → toSelection() 返回 null。
import { CellSelection, isCellId } from '../src/core/cell-selection.js';

const fail = (m) => { throw new Error(m); };
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) fail(`${name}: 期望 ${b}，实得 ${a}`);
  console.log(`  ok  ${name} = ${a}`);
};
const throws = (name, fn, type = Error) => {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  if (!err) fail(`${name}: 应当抛 ${type.name}`);
  if (!(err instanceof type)) fail(`${name}: 抛的是 ${err.constructor.name}（${err.message}），期望 ${type.name}`);
  console.log(`  ok  ${name} → ${err.constructor.name}`);
};

/* ---------- ① 单格 / 多选 / 去重 / 顺序 ---------- */
const sel = new CellSelection();
eq('① 空选中 size', sel.size, 0);
eq('① 空选中 toSelection(null 解析器也没用)', sel.toSelection(() => ({})), null);
eq('① 点选 add', sel.add(7), true);
eq('① 重复 add 不增长', [sel.add(7), sel.size], [false, 1]);
eq('① Shift 加选', [sel.toggle(9), sel.size], [true, 2]);
eq('① Shift 再点同一格 = 取消', [sel.toggle(9), sel.size], [false, 1]);
eq('① 插入序保持', new CellSelection([5, 3, 5, 8]).ids(), [5, 3, 8]);
eq('① remove 已有 / 没有', [sel.remove(7), sel.remove(7)], [true, false]);

/* ---------- ② set / clear / 三种输入形状 ---------- */
const s2 = new CellSelection([1, 2, 3]);
eq('② set 数组整体替换', s2.set([4, 5]), [4, 5]);
eq('② set Set', s2.set(new Set([6, 6, 7])), [6, 7]);
eq('② set 另一个 CellSelection', s2.set(new CellSelection([2, 1])), [2, 1]);
eq('② set {cells:[cell...]} 形状（撤销栈/包围盒同源）', s2.set({ cells: [{ id: 11 }, { id: 12 }] }), [11, 12]);
eq('② clear 返回清掉的数量', [s2.clear(), s2.size], [2, 0]);
eq('② restore(null) = 清空', new CellSelection([1]).restore(null), []);

/* ---------- ③ prune：世界变了以后剔无效 ---------- */
const sp = new CellSelection([1, 2, 3, 4]);
eq('③ prune(fn)', sp.prune((id) => id % 2 === 0), { removed: [1, 3], kept: 2 });
eq('③ prune 后剩下的', sp.ids(), [2, 4]);
const sp2 = new CellSelection([10, 20, 30]);
eq('③ prune(Set)', sp2.prune(new Set([20])), { removed: [10, 30], kept: 1 });
const sp3 = new CellSelection([1, 2]);
eq('③ prune(数组)', sp3.prune([2]), { removed: [1], kept: 1 });
const sp4 = new CellSelection([1, 2]);
eq('③ 解析函数抛错 = 当无效剔掉（不许整批崩）', sp4.prune(() => { throw new Error('boom'); }), { removed: [1, 2], kept: 0 });

/* ---------- ④ 快照 / 回位（撤销栈旁路） ---------- */
const su = new CellSelection([3, 4]);
const snap = su.snapshot();
su.clear();
eq('④ 清空后 snapshot 是空', su.snapshot(), []);
eq('④ restore 回位', su.restore(snap), [3, 4]);
eq('④ snapshot 是拷贝（改它不影响选中）', (() => { const s = su.snapshot(); s.push(99); return su.ids(); })(), [3, 4]);

/* ---------- ⑤ toSelection：解不出格子 → null ---------- */
const st = new CellSelection([1, 2, 3]);
eq('⑤ 全部解析失败 → null', st.toSelection(() => null), null);
const partial = st.toSelection((id) => (id === 2 ? { id } : null));
eq('⑤ 部分解析成功 → 只带解得出的', [partial.cells.length, partial.ids], [1, [1, 2, 3]]);

/* ---------- ⑥ 非法输入 ---------- */
throws('⑥ add 字符串 id', () => new CellSelection().add('7'), RangeError);
throws('⑥ add 负数', () => new CellSelection().add(-1), RangeError);
throws('⑥ add 小数', () => new CellSelection().add(1.5), RangeError);
throws('⑥ set 数字（不是数组）', () => new CellSelection().set(5), TypeError);
throws('⑥ set [null]', () => new CellSelection().set([null]), RangeError);
throws('⑥ toSelection 不给解析函数', () => new CellSelection([1]).toSelection(), TypeError);
eq('⑥ isCellId 口径', [isCellId(0), isCellId(3), isCellId('3'), isCellId(-2)], [true, true, false, false]);

console.log('\ncell-selection: ALL PASS');
