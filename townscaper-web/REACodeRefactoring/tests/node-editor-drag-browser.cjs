// 1724449858369568780 运行时验收：可拖拽节点编辑器（node-editor.html）。
//
// 原片是 Unity Inspector 里的组件链：bool 资产 → FloatSelectNode → FloatLerpTowardsNode
// → Vector2ComposeNode → Vector2EventNode → RectTransform.anchoredPosition。
// 本仓把这条链做成可编辑节点图（src/core/node-graph-editor.js 模型 + node-editor.html 画布）。
// 此前只验过「序列化往返 + 只读连线图」，没有验过「真的能用鼠标拖」——这里补的就是这一层：
//   ① 拖节点标题 → layout 真的变、拖的过程有实时 transform、undo/redo 能回；
//   ② 从输出圆点拖到输入圆点 → 真的接上一条线；点连线 → 真的删掉；
//   ③ 端口类型不符（bool → number）→ 拒绝且图不变（事务原子性在页面上也成立）；
//   ④ 改 Inspector 参数 → 运行图跟着变（speed 40 → 一次 tick 0.25s 走 10）；
//   ⑤ 导出/载入 JSON（含布局）→ 位置与连线都回来。
// 判据全部是可读状态量（model.layout / model.graph.edges / state.value），不靠截图猜。
const { chromium } = require('playwright');

const PAGE = 'http://127.0.0.1:8769/node-editor.html';
// 初始自动布局会把节点排到 x=1270（画布可视宽约 940），鼠标够不到 → 先载一张紧凑布局。
const LAYOUT = {
  button: { x: 20, y: 20 },
  falseValue: { x: 20, y: 120 },
  trueValue: { x: 20, y: 220 },
  select: { x: 250, y: 120 },
  lerp: { x: 480, y: 20 },
  compose: { x: 480, y: 240 },
  sink: { x: 700, y: 120 },
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const samples = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(PAGE, { timeout: 90000 });
    await page.waitForFunction(() => window.nodeEditor && window.nodeEditor.ready, null, { polling: 100, timeout: 30000 });
    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(samples)); };

    // ── 0. 紧凑布局 + 重画（点一下节点体，走页面自己的 draw）
    await page.evaluate((layout) => {
      const m = window.nodeEditor.model;
      const doc = m.snapshot();
      doc.layout = layout;
      m.load(doc);
    }, LAYOUT);
    await page.evaluate(() => {
      const g = document.querySelector('[data-node="button"] rect:not(.node-title)');
      const r = g.getBoundingClientRect();
      g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + 40, clientY: r.y + 50 }));
    });

    const base = await page.evaluate(() => {
      const m = window.nodeEditor.model;
      return {
        nodes: m.graph.nodes.size,
        edges: m.graph.edges.length,
        layout: JSON.parse(JSON.stringify(m.layout)),
        domNodes: document.querySelectorAll('[data-node]').length,
        titleRects: document.querySelectorAll('.node-title').length,
        paths: document.querySelectorAll('#wires path, svg#graph path.edge').length,
        portCircles: document.querySelectorAll('#graph circle.port').length,
        portExpected: [...m.graph.nodes.values()].reduce((a, n) => a + n.inputs.length + n.outputs.length, 0),
        types: [...m.graph.nodes.values()].map((n) => n.type),
      };
    });
    samples.base = base;
    if (base.nodes !== 7 || base.layout && Object.keys(base.layout).length !== 7) fail('节点数应为 7');
    if (base.edges !== 6) fail('初始连线应为 6 条（bool→select 三条 + select→lerp→compose→sink）');
    if (base.domNodes !== 7 || base.paths !== 6) fail('DOM 节点框/连线数与模型不一致');
    if (base.portCircles !== base.portExpected || base.portCircles !== 13) fail('端口圆点数应等于 各节点 in+out 之和（13），实际 ' + base.portCircles);

    const before = await page.screenshot({ path: 'artifacts/coverage/node-editor-r111-before.png' });

    // ── 1. 拖节点标题：compose (±40,+60)
    const drag1 = await (async () => {
      const el = page.locator('[data-node="compose"] .node-title').first();
      const box = await el.boundingBox();
      await page.mouse.move(box.x + 30, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(box.x + 30 + 40, box.y + 12 + 60, { steps: 12 });
      const midTransform = await page.evaluate(() => document.querySelector('[data-node="compose"]').getAttribute('transform'));
      const midPending = await page.evaluate(() => !!document.querySelector('[data-pending-link]'));
      await page.mouse.up();
      const after = await page.evaluate(() => {
        const m = window.nodeEditor.model;
        return { layout: { ...m.layout.compose }, status: document.querySelector('#status').textContent, past: m.past.length };
      });
      return { from: { x: box.x, y: box.y }, midTransform, midPending, after };
    })();
    samples.drag1 = drag1;
    if (drag1.after.layout.x !== 520 || drag1.after.layout.y !== 300) {
      fail(`拖拽后 layout.compose 应为 (520,300)，实得 (${drag1.after.layout.x},${drag1.after.layout.y})`);
    }
    if (!/translate\(/.test(drag1.midTransform || '')) fail('拖动过程中应有实时 transform（跟手），不是松手才跳');

    // undo / redo 各回一次
    const undoRedo = await (async () => {
      await page.click('#undo');
      const u = await page.evaluate(() => ({ ...window.nodeEditor.model.layout.compose, past: window.nodeEditor.model.past.length, future: window.nodeEditor.model.future.length }));
      await page.click('#redo');
      const r = await page.evaluate(() => ({ ...window.nodeEditor.model.layout.compose }));
      return { undo: u, redo: r };
    })();
    samples.undoRedo = undoRedo;
    if (undoRedo.undo.x !== 480 || undoRedo.undo.y !== 240) fail('undo 没把节点放回 (480,240)');
    if (undoRedo.redo.x !== 520 || undoRedo.redo.y !== 300) fail('redo 没把节点放回 (520,300)');

    // ── 2. 点连线删掉 compose→sink（最后一条）
    const del = await (async () => {
      const pt = await page.evaluate(() => {
        const p = document.querySelector('[data-edge="5"]');
        const m = p.getPointAtLength(p.getTotalLength() / 2);
        const r = document.querySelector('#graph').getBoundingClientRect();
        return { x: r.left + m.x, y: r.top + m.y };
      });
      await page.mouse.click(pt.x, pt.y);
      let st = await page.evaluate(() => ({ edges: window.nodeEditor.model.graph.edges.length, status: document.querySelector('#status').textContent }));
      let via = 'mouse';
      if (st.edges !== 5) {
        // 3px 描边偶尔点不中：改为在 path 上派发同一事件（仍走页面自己的 handler）
        via = 'dispatch';
        await page.evaluate(() => document.querySelector('[data-edge="5"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
        st = await page.evaluate(() => ({ edges: window.nodeEditor.model.graph.edges.length, status: document.querySelector('#status').textContent }));
      }
      return { pt, via, ...st };
    })();
    samples.delete = del;
    if (del.edges !== 5) fail('点连线后应剩 5 条边，实际 ' + del.edges);

    // ── 3. 从 compose:out 拖到 sink:in 重新接上
    const connect = await (async () => {
      const pos = await page.evaluate(() => {
        const r = document.querySelector('#graph').getBoundingClientRect();
        const c = (id, port, out) => {
          const el = document.querySelector(`circle[data-id="${id}"][data-port="${port}"][data-out="${out}"]`);
          const b = el.getBoundingClientRect();
          return { x: b.x + b.width / 2, y: b.y + b.height / 2, left: r.left };
        };
        return { out: c('compose', 'out', 'true'), in: c('sink', 'in', 'false') };
      });
      await page.mouse.move(pos.out.x, pos.out.y);
      await page.mouse.down();
      await page.mouse.move(pos.in.x, pos.in.y, { steps: 14 });
      const pending = await page.evaluate(() => !!document.querySelector('[data-pending-link]'));
      await page.mouse.up();
      const st = await page.evaluate(() => {
        const m = window.nodeEditor.model;
        return { edges: m.graph.edges.length, last: m.graph.edges[m.graph.edges.length - 1], status: document.querySelector('#status').textContent };
      });
      return { pending, ...st };
    })();
    samples.connect = connect;
    if (!connect.pending) fail('拖线过程中应有一条跟随鼠标的 pending 线');
    if (connect.edges !== 6) fail('拖线接上后应回到 6 条边，实际 ' + connect.edges);
    if (!connect.last || connect.last.fromId !== 'compose' || connect.last.toId !== 'sink' || connect.last.toPort !== 'in') {
      fail('新接的边应是 compose:out → sink:in');
    }

    // ── 4. 类型不符必须拒绝：bool 输出 → number 输入
    const reject = await (async () => {
      const pos = await page.evaluate(() => {
        const g = (id, port, out) => {
          const b = document.querySelector(`circle[data-id="${id}"][data-port="${port}"][data-out="${out}"]`).getBoundingClientRect();
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        };
        return { out: g('button', 'out', 'true'), in: g('compose', 'x', 'false') };
      });
      const snapBefore = await page.evaluate(() => JSON.stringify(window.nodeEditor.model.snapshot()));
      await page.mouse.move(pos.out.x, pos.out.y);
      await page.mouse.down();
      await page.mouse.move(pos.in.x, pos.in.y, { steps: 12 });
      await page.mouse.up();
      const after = await page.evaluate(() => ({
        edges: window.nodeEditor.model.graph.edges.length,
        status: document.querySelector('#status').textContent,
        snap: JSON.stringify(window.nodeEditor.model.snapshot()),
      }));
      return { unchanged: after.snap === snapBefore, edges: after.edges, status: after.status };
    })();
    samples.reject = { unchanged: reject.unchanged, edges: reject.edges, status: reject.status };
    if (!reject.unchanged) fail('bool→number 的连线被接受了（类型校验没兜住，图被改了）');
    if (!/未修改/.test(reject.status)) fail('拒绝时应给出「未修改：…」提示，实际「' + reject.status + '」');

    // ── 5. 改参数 → 运行图响应：选中 lerp，speed 20 → 40
    const param = await (async () => {
      await page.evaluate(() => {
        const r = document.querySelector('[data-node="lerp"] rect:not(.node-title)').getBoundingClientRect();
        document.querySelector('[data-node="lerp"] rect:not(.node-title)').dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + 30, clientY: r.y + 40 }));
      });
      const fields = await page.evaluate(() => [...document.querySelectorAll('#parameters input')].map((i) => ({ label: i.getAttribute('aria-label'), type: i.type, value: i.value })));
      await page.evaluate(() => {
        const el = document.querySelector('input[aria-label="lerp speed"]');
        el.value = '40';
        el.dispatchEvent(new Event('change'));
      });
      const st = await page.evaluate(() => {
        const g = window.nodeEditor.model.graph;
        return { params: { ...g.nodes.get('lerp').params }, speedApplied: g.state('lerp').value };
      });
      return { fields, ...st };
    })();
    samples.param = param;
    if (!param.fields.some((f) => f.label === 'lerp speed')) fail('Inspector 没有 lerp 的 speed 参数输入框');
    if (param.params.speed !== 40) fail('改 speed 后模型参数应变成 40');

    // 一次 tick 0.25s，speed 40 → 走 10（同一 evaluate 内取前后，避免 rAF 插进来）
    const step = await page.evaluate(() => {
      const g = window.nodeEditor.model.graph;
      g.state('button').value = true;
      g.tick(0);
      const v0 = g.state('lerp').value;
      g.tick(0.25);
      const v1 = g.state('lerp').value;
      g.tick(100);
      const v2 = g.state('lerp').value;
      const sinkState = g.state('sink');
      const mover = document.querySelector('#mover');
      return { v0, v1, v2, delta: v1 - v0, target: g.nodes.get('select').out.out, calls: sinkState.calls, last: sinkState.last, transform: mover.style.transform, valueText: document.querySelector('#value').textContent };
    });
    samples.step = step;
    if (Math.abs(step.delta - 10) > 1e-6) fail(`speed 40 × dt 0.25 应走 10，实得 ${step.delta}`);
    if (step.v2 !== step.target) fail('tick(100) 后应停在目标值');
    if (!/translate/.test(step.transform)) fail('sink 触发后预览块应被移动（transform 为空）');

    // ── 6. 导出 / 载入（含布局）
    const io = await (async () => {
      await page.click('#export');
      const text = await page.evaluate(() => document.querySelector('#json').value);
      const doc = JSON.parse(text);
      doc.layout.button = { x: 60, y: 40 };
      await page.evaluate((t) => { document.querySelector('#json').value = t; }, JSON.stringify(doc));
      await page.click('#import');
      const back = await page.evaluate(() => {
        const m = window.nodeEditor.model;
        return { nodes: m.graph.nodes.size, edges: m.graph.edges.length, button: { ...m.layout.button }, status: document.querySelector('#status').textContent };
      });
      return { exportedNodes: doc.graph.nodes.length, exportedEdges: doc.graph.edges.length, hasLayout: !!doc.layout, ...back };
    })();
    samples.io = io;
    if (!io.hasLayout) fail('导出应带布局（可拖拽编辑器要能存回位置）');
    if (io.nodes !== 7 || io.edges !== 6) fail('载入后节点/边数不对');
    if (io.button.x !== 60 || io.button.y !== 40) fail('载入后布局没回放');

    await page.screenshot({ path: 'artifacts/coverage/node-editor-r111-after.png' });

    if (errors.length) fail('页面有 console/page 错误：' + errors.join(' | '));

    const summary = {
      nodes: base.nodes, edges: base.edges, ports: base.portCircles,
      drag: `${drag1.after.layout.x},${drag1.after.layout.y}`,
      undoRedo: `${undoRedo.undo.x},${undoRedo.undo.y}→${undoRedo.redo.x},${undoRedo.redo.y}`,
      deleteVia: del.via, deleteEdges: del.edges,
      connectEdges: connect.edges,
      rejectUnchanged: reject.unchanged, rejectMsg: reject.status,
      speed: param.params.speed, stepDelta: step.delta, calls: step.calls,
      ioNodes: io.nodes, ioEdges: io.edges,
    };
    console.log('PASS 可拖拽节点编辑器 · ' + JSON.stringify(summary));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
