// 1201179450668441600 / 1024679338292256769（第 50 轮，迁自 REACode src/uidecor.js）：纯描边图标等墨量 + 徽记折数闭合；接进共享工具栏。
import assert from 'node:assert/strict';
import { DEFAULT_ICONS, inkBalance, iconSvg, foldClosure } from '../src/ui/icon-ink.js';
const W = inkBalance(DEFAULT_ICONS);
assert.ok(W.cvEq < W.cvFit && W.cvFit < W.cvRaw, `墨量离散度 raw ${W.cvRaw.toFixed(3)} → 光学框 ${W.cvFit.toFixed(3)} → 等墨量 ${W.cvEq.toFixed(3)}`);
assert.ok(W.rows.every((r) => r.width >= 1.55 && r.width <= 2.45), '线宽夹在上下限内');
const svg = iconSvg(DEFAULT_ICONS.close, { scale: 1, width: 2 }); assert.ok(/^<svg[^>]*><path d="M[^"]+" fill="none" stroke="currentColor"/.test(svg), 'SVG');
const E = foldClosure([{ name: '皇冠', rep: 1, r: 1.3 }, { name: '六边', rep: 6, r: 1 }, { name: '放射', rep: 24, r: .86 }, { name: '月桂', rep: 18, r: .74 }, { name: '环', rep: 0, r: .47 }, { name: '内芯', rep: 4, r: .37 }], 4);
assert.deepEqual(E.closed, ['放射', '内芯']); assert.deepEqual(E.open, ['皇冠', '六边', '月桂']); assert.ok(E.mono && E.minGap > 0);
// 工具栏：DOM 桩，item.paths → 内联 SVG + data-ink-width
const els = []; const mk = () => { const e = { dataset: {}, style: {}, classList: { toggle() {} }, setAttribute() {}, addEventListener() {}, remove() {}, html: '', insertAdjacentHTML(_, h) { this.html += h; }, append(...c) { els.push(...c); } }; return e; };
globalThis.document = { createElement: mk }; globalThis.matchMedia = () => ({ matches: true });
const { mountIconToolbar } = await import('../src/ui/icon-toolbar.js');
const host = mk(); const items = Object.entries(DEFAULT_ICONS).map(([key, paths]) => ({ key, label: key, paths }));
const tb = mountIconToolbar(host, items);
const btns = els.filter((e) => e.dataset.key);
assert.equal(btns.length, items.length); assert.ok(btns.every((b) => b.html.startsWith('<svg') && Number(b.dataset.inkWidth) >= 1.55), '按钮带等墨量 SVG');
tb.dispose();
console.log('PASS 图标等墨量（接进共享工具栏）+ 徽记折数闭合', JSON.stringify({ cvRaw: +W.cvRaw.toFixed(3), cvFit: +W.cvFit.toFixed(3), cvEq: +W.cvEq.toFixed(3), widths: W.rows.map((r) => +r.width.toFixed(2)) }));
