/**
 * learnui.js — 「我学到了什么」面板：可拖拽的浮动窗口 + 能钉到视频旁边。
 *
 * 形态（三种）：
 *   closed  收起
 *   float   浮动窗口：在视口里随便拖，位置记在 localStorage；拖不出屏幕（clamp）
 *   docked  钉住：把面板整个**移进**视频对话框右侧那一列（#dockHost），
 *           于是视频和台账并排，谁也不遮谁。之所以搬 DOM 而不是再复制一份，
 *           是因为里面的目录/滚动位置/问答历史都是同一份状态。
 *
 * 数据在 `LEARNED`（learn/learned.js），这里只负责渲染 + 检索 + 摆放。
 * 提问是**本地检索**：中文切二元组 → 覆盖率打分 → 手写 qa 加权，没有后端。
 */
(() => {
  const L = window.LEARNED;
  const floatEl = document.getElementById('learnFloat');
  const panelEl = document.getElementById('learnPanel');
  const dragBar = document.getElementById('learnDrag');
  const dockHost = document.getElementById('dockHost');
  const videoDlg = document.getElementById('dlg');
  const openBtn = document.getElementById('learnOpen');
  const closeBtn = document.getElementById('learnClose');
  const popBtn = document.getElementById('learnPop');
  const tocEl = document.getElementById('learnToc');
  const bodyEl = document.getElementById('learnBody');
  const metaEl = document.getElementById('learnMeta');
  const logEl = document.getElementById('lqLog');
  const formEl = document.getElementById('lqForm');
  const inputEl = document.getElementById('lqInput');
  const chipsEl = document.getElementById('lqChips');
  if (!L || !floatEl || !panelEl) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const code = (s) => esc(s).replace(/((?:src|engine|learn)\/[\w./\-]+)/g, '<code>$1</code>');
  metaEl.textContent = `台账 ${L.meta.rounds} 轮 ${L.meta.ledger ?? L.meta.total} 条 · 全库已学 ${L.meta.total} / ${L.meta.corpus} · 更新 ${L.meta.updated}`;

  const sections = [
    { key: 'method', name: '怎么学的（方法）', sub: '抽帧 / 量参数 / 验证 / 并发' },
    ...L.rounds.map((r) => ({ key: 'r' + r.n, name: `第 ${r.n} 轮 · ${r.title}`, sub: `${r.date} · ${r.items.length} 条` })),
  ];

  // ---------------- 渲染 ----------------
  function renderToc(active) {
    tocEl.innerHTML = '<h4>目录</h4>' + sections.map((s) => `
      <button data-sec="${s.key}" class="${s.key === active ? 'on' : ''}">
        ${esc(s.name)}<small>${esc(s.sub)}</small>
      </button>`).join('');
  }

  function itemHTML(it, hi) {
    return `<div class="li${hi ? ' hi' : ''}" data-id="${esc(it.id)}">
      <h3>${esc(it.title)}<span class="tag">${esc(String(it.id).slice(-6))}</span></h3>
      <dl>
        ${it.quote ? `<dt>原文</dt><dd class="q">${md(it.quote)}</dd>` : ''}
        ${it.scene ? `<dt>画面</dt><dd>${md(it.scene)}</dd>` : ''}
        ${it.how ? `<dt>做法</dt><dd>${md(it.how)}</dd>` : ''}
        ${it.nums ? `<dt>数字</dt><dd class="n">${md(it.nums)}</dd>` : ''}
        ${it.where ? `<dt>落点</dt><dd>${code(it.where)}${it.page ? ` · <a href="${it.page}" target="_blank">打开 ${esc(it.page)} →</a>` : ''}</dd>` : ''}
        ${it.pit ? `<dt>坑</dt><dd class="p">${md(it.pit)}</dd>` : ''}
      </dl>
    </div>`;
  }

  function renderSection(key) {
    renderToc(key);
    if (key === 'method') {
      bodyEl.innerHTML = `<h2>怎么学的（方法）</h2><p class="mut">${esc(L.meta.note)}</p>
        ${L.method.map((m) => `<div class="li"><h3>${esc(m.t)}<span class="tag">${esc(m.k)}</span></h3>
          <dl><dt>做法</dt><dd>${md(m.d)}</dd></dl></div>`).join('')}`;
    } else {
      const r = L.rounds.find((x) => 'r' + x.n === key);
      if (!r) return;
      bodyEl.innerHTML = `<h2>第 ${r.n} 轮 · ${esc(r.title)}</h2><p class="mut">${esc(r.date)} · ${r.items.length} 条</p>
        ${r.items.map((it) => itemHTML(it)).join('')}`;
    }
    bodyEl.scrollTop = 0;
  }

  /** 一条片子在这三份数据里分别长什么样：笔记 / 管线位置 / 逐条台账。 */
  function clipInfo(clipId) {
    const id = String(clipId);
    const item = (window.LEARN?.items ?? []).find((x) => String(x.id) === id) || null;
    let place = null;
    const P = window.PIPELINE;
    if (P) {
      for (const lane of P.lanes) {
        for (const [group, arr] of lane.groups) {
          const hit = arr.find((x) => String(x.id) === id);
          if (hit) place = { lane: lane.name, group, name: hit.name, where: hit.where, page: hit.page, status: P.statusName?.[hit.status] || hit.status };
        }
      }
      if (!place) {
        const step = P.roadmap.find((r) => r.study.some((x) => String(x) === id));
        if (step) place = { lane: (P.lanes.find((l) => l.key === step.lane) || {}).name || step.lane, group: '学习路线', name: step.name, where: '', page: step.page, status: P.statusName?.[step.status] || step.status };
      }
    }
    const round = L.rounds.find((r) => r.items.some((x) => String(x.id) === id)) || null;
    return { id, item, place, round };
  }

  /**
   * 钉到视频旁边时显示的内容。
   *
   * 为什么不是"直接跳到那一轮"：台账只覆盖我逐帧学过的 12 轮（一百多条），
   * 而页面上有 237 个视频，大部分点开是没有逐条台账的。所以这里按三层降级：
   *   有台账 → 原文 + 管线位置 + 逐条详情（并高亮）
   *   无台账但有笔记 → 原文 + 管线位置 + "学到/没学到什么"
   *   都没有 → 说明这一条还没进台账，给个可以问的方向
   */
  function renderClip(clipId) {
    const { id, item, place, round } = clipInfo(clipId);
    const body = [];
    body.push(`<h2>这条片子</h2>`);
    body.push(`<p class="mut">${esc(item?.date || '')} · ${esc(id)}${place ? ` · ${esc(place.lane)} / ${esc(place.group)}` : ''}</p>`);
    if (item?.text) body.push(`<div class="clipquote">${md(item.text)}</div>`);
    if (place) {
      body.push(`<div class="clipmeta"><dl>
        ${place.name ? `<dt>管线步骤</dt><dd>${esc(place.name)}</dd>` : ''}
        ${place.status ? `<dt>状态</dt><dd>${esc(place.status)}</dd>` : ''}
        ${place.where ? `<dt>代码</dt><dd>${code(place.where)}</dd>` : ''}
        ${place.page ? `<dt>能看</dt><dd><a href="${place.page}" target="_blank">${esc(place.page)} →</a></dd>` : ''}
      </dl></div>`);
    }
    if (item?.note) body.push(`<div class="clipnote"><b>学到：</b>${md(item.note)}</div>`);

    if (round) {
      body.push(`<div class="mut" style="margin:16px 0 8px">逐条台账（第 ${round.n} 轮 · ${esc(round.title)}）</div>`);
      body.push(round.items.map((it) => itemHTML(it, String(it.id) === id)).join(''));
    } else {
      body.push(`<div class="mut" style="margin:16px 0 8px">逐条台账</div>
        <div class="ans"><h3>这一条还没有逐条台账</h3>
        <div class="body">它属于"看过/仅展示"或还没学到。可以在下面直接问，或者点标题栏的「浮起」打开目录翻。</div></div>`);
    }
    bodyEl.innerHTML = body.join('');
    bodyEl.scrollTop = 0;
    renderToc(round ? 'r' + round.n : null);
    // 滚到高亮那一条。用 rAF + 瞬时滚动：钉住的列有 0.2s 宽度动画，
    // smooth 滚动会被这次布局变化打断，停在半路（第一版就是这样，
    // 高亮在视口外面，看起来像"没定位"）。
    const hi = bodyEl.querySelector('.li.hi');
    if (hi) {
      requestAnimationFrame(() => {
        const top = hi.offsetTop - bodyEl.clientHeight / 2 + hi.offsetHeight / 2;
        bodyEl.scrollTop = Math.max(0, top);
      });
    }
    return true;
  }

  /** 点某个视频时，把台账跳到那一条并高亮。 */
  function focusItem(clipId) {
    const r = L.rounds.find((x) => x.items.some((it) => String(it.id) === String(clipId)));
    if (!r) { renderSection('method'); return false; }
    renderSection('r' + r.n);
    const el = bodyEl.querySelector(`[data-id="${clipId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('hi');
    }
    return true;
  }

  // ---------------- 检索 ----------------
  const STOP = new Set(['的', '了', '是', '在', '和', '有', '为', '把', '被', '吗', '呢', '什么', '怎么', '为什么', '如何', '可以', '这个', '那个', '一个']);
  function grams(str) {
    const t = String(str).toLowerCase().replace(/[^\p{Script=Han}a-z0-9]+/gu, ' ');
    const out = new Set();
    for (const w of t.split(' ')) {
      if (!w) continue;
      if (w.length <= 2) { if (!STOP.has(w)) out.add(w); continue; }
      for (let i = 0; i + 1 < w.length; i++) {
        const g = w.slice(i, i + 2);
        if (!STOP.has(g)) out.add(g);
      }
    }
    return out;
  }

  const docs = [];
  for (const r of L.rounds) {
    for (const it of r.items) {
      const text = [it.title, it.quote, it.scene, it.how, it.nums, it.where, it.pit].filter(Boolean).join(' ');
      docs.push({ kind: 'item', round: r.n, it, g: grams(text) });
    }
  }
  for (const qa of L.qa) {
    docs.push({ kind: 'qa', qa, g: grams([qa.q, qa.keys.join(' '), qa.a, qa.ref].join(' ')), gk: grams(qa.keys.join(' ')) });
  }

  function score(qg, doc) {
    let hit = 0;
    for (const g of qg) if (doc.g.has(g)) hit++;
    const cover = hit / Math.max(1, qg.size);
    let bonus = 0;
    if (doc.gk) { let k = 0; for (const g of qg) if (doc.gk.has(g)) k++; bonus = (k / Math.max(1, qg.size)) * 1.2; }
    return cover + bonus;
  }

  function search(q) {
    const qg = grams(q);
    if (!qg.size) return { qa: null, items: [] };
    const scored = docs.map((d) => ({ d, s: score(qg, d) })).sort((a, b) => b.s - a.s);
    const qaHits = scored.filter((x) => x.d.kind === 'qa' && x.s > 0.30).slice(0, 1);
    const items = scored.filter((x) => x.d.kind === 'item' && x.s > (qaHits.length ? 0.16 : 0.26))
      .slice(0, qaHits.length ? 2 : 3);
    return { qa: qaHits[0] || null, items };
  }

  const hist = [];
  function answerHTML(entry) {
    const { q, res } = entry;
    const { qa, items } = res;
    let html = '';
    if (qa) {
      const x = qa.d.qa;
      const dup = x.q.replace(/[？?]/g, '').includes(q.replace(/[？?]/g, '').slice(0, 10));
      html += `<div class="ans">${dup ? '' : `<div class="q">问：${md(q)}</div>`}
        <h3>${md(x.q)}</h3><div class="body">${md(x.a)}</div>
        <div class="rf">出处：${code(x.ref)}</div></div>`;
    } else if (items.length) {
      html += `<div class="ans"><div class="q">问：${md(q)}</div>
        <h3>没有直接对应的条目，但这几条最接近</h3>
        <div class="body">问得更具体一点命中会更准，例如"雪的点大小怎么定""图集看不到怎么办"。下面几条可以顺着看。</div></div>`;
    } else {
      html += `<div class="ans"><div class="q">问：${md(q)}</div><h3>没有命中</h3>
        <div class="body">换个说法试试。可问：河道流向 / 流场 / 打包器 / 顶点位移 / 图集不可见 / 瀑布判据 / 雪片大小 / shader 静默失败 / 参数域开洞 / 连通性 / 怎么验证 / 怎么接进工程。</div></div>`;
    }
    if (items.length) {
      html += '<div class="mut" style="margin-top:14px">相关笔记</div>';
      html += items.map((x) => `<div class="li"><h3>第 ${x.d.round} 轮 · ${esc(x.d.it.title)}<span class="tag">${esc(String(x.d.it.id).slice(-6))}</span></h3>
        <dl>${x.d.it.scene ? `<dt>画面</dt><dd>${md(x.d.it.scene)}</dd>` : ''}
        ${x.d.it.how ? `<dt>做法</dt><dd>${md(x.d.it.how)}</dd>` : ''}
        ${x.d.it.nums ? `<dt>数字</dt><dd class="n">${md(x.d.it.nums)}</dd>` : ''}
        ${x.d.it.where ? `<dt>落点</dt><dd>${code(x.d.it.where)}</dd>` : ''}</dl>
        <div class="more"><button data-sec="r${x.d.round}">看这一轮全部 ${L.rounds.find((r) => r.n === x.d.round).items.length} 条 →</button></div></div>`).join('');
    }
    return html;
  }

  function showAnswer(entry) {
    bodyEl.innerHTML = answerHTML(entry);
    bodyEl.scrollTop = 0;
    renderToc(null);
  }

  function renderLog() {
    logEl.innerHTML = hist.slice(0, 12).map((h, i) => `<div class="msg u" data-hist="${i}" title="点一下重新看这条">${esc(h.q)}</div>`).join('')
      + (hist.length ? '' : `<div class="msg a"><b>先看左边，也可以直接问</b>这里是 ${L.meta.rounds} 轮、${L.meta.ledger ?? L.meta.total} 条的台账：每条都写了"原文说了什么 / 画面长什么样 / 怎么做 / 量到多少 / 落在哪 / 踩了什么坑"。</div>`);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function ask(q) {
    const text = String(q || '').trim();
    if (!text) return;
    const entry = { q: text, res: search(text) };
    hist.unshift(entry);
    renderLog();
    showAnswer(entry);
  }

  // ---------------- 摆放：float / docked ----------------
  let mode = 'closed';          // closed | float | docked
  let ready = false;

  function ensureReady() {
    if (ready) return;
    ready = true;
    renderSection('method');
    renderLog();
    chipsEl.innerHTML = L.qa.slice(0, 6).map((x) => `<button type="button">${esc(x.q)}</button>`).join('');
  }

  const POS_KEY = 'reacode.learn.pos';
  function loadPos() {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
    } catch { /* 忽略 */ }
    return null;
  }
  function clampPos(x, y) {
    const w = floatEl.offsetWidth || 900, h = floatEl.offsetHeight || 600;
    const maxX = Math.max(8, innerWidth - w - 8), maxY = Math.max(8, innerHeight - h - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }
  function applyPos(x, y) {
    const p = clampPos(x, y);
    floatEl.style.left = p.x + 'px';
    floatEl.style.top = p.y + 'px';
    return p;
  }

  function placeDefault() {
    const saved = loadPos();
    if (saved) return applyPos(saved.x, saved.y);
    const w = floatEl.offsetWidth || 900, h = floatEl.offsetHeight || 600;
    return applyPos(Math.max(8, innerWidth - w - 28), Math.max(8, innerHeight - h - 84));
  }

  function open() {
    ensureReady();
    if (mode === 'docked') { floatEl.hidden = true; return; }
    if (mode === 'closed') {
      floatEl.hidden = false;
      placeDefault();
    }
    mode = 'float';
    updatePopBtn();
    inputEl.focus({ preventScroll: true });
  }

  function close() {
    floatEl.hidden = true;
    const docked = mode === 'docked';
    mode = 'closed';
    if (docked) {
      document.body.classList.remove('vid-open');
      videoDlg.classList.remove('withPanel');
      floatEl.appendChild(panelEl);   // 从 #dockHost 收回容器里，下次打开还能用
      panelEl.classList.remove('docked');
    }
    updatePopBtn();
  }

  /** 钉进视频对话框右侧那列。 */
  function dock(clipId) {
    ensureReady();
    if (mode === 'docked') {
      if (clipId) renderClip(clipId);
      return;
    }
    floatEl.hidden = true;
    dockHost.appendChild(panelEl);
    panelEl.classList.add('docked');
    videoDlg.classList.add('withPanel');
    mode = 'docked';
    document.body.classList.add('vid-open');
    updatePopBtn();
    if (clipId) renderClip(clipId);
  }

  /** 从视频旁边收回成浮动窗口。 */
  function undock() {
    if (mode !== 'docked') return;
    videoDlg.classList.remove('withPanel');
    floatEl.appendChild(panelEl);
    panelEl.classList.remove('docked');
    mode = 'float';
    document.body.classList.remove('vid-open');
    floatEl.hidden = false;
    placeDefault();
    updatePopBtn();
  }

  function updatePopBtn() {
    popBtn.textContent = mode === 'docked' ? '浮起' : '钉到视频旁';
    popBtn.title = mode === 'docked' ? '收回成可拖拽的浮动窗口' : '钉到当前视频右侧（视频会为它让出一列）';
  }

  // 拖拽（只在 float 模式；把手是标题栏，但别抢标题栏里按钮的点击）
  let drag = null;
  dragBar.addEventListener('pointerdown', (e) => {
    if (mode !== 'float') return;
    if (e.target.closest('button')) return;
    const r = floatEl.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
    dragBar.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  dragBar.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    applyPos(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = (e) => {
    if (!drag) return;
    const { id } = drag;
    drag = null;
    const r = floatEl.getBoundingClientRect();
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch { /* 忽略 */ }
    if (e && e.pointerId === id && dragBar.hasPointerCapture && dragBar.hasPointerCapture(id)) {
      dragBar.releasePointerCapture(id);
    }
  };
  dragBar.addEventListener('pointerup', endDrag);
  dragBar.addEventListener('pointercancel', endDrag);
  addEventListener('resize', () => {
    if (mode === 'float') {
      const r = floatEl.getBoundingClientRect();
      applyPos(r.left, r.top);
    }
  });

  // ---------------- 事件 ----------------
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-learn-open]')) { e.preventDefault(); open(); }
  });
  closeBtn.addEventListener('click', close);
  popBtn.addEventListener('click', () => {
    if (mode === 'docked') { undock(); return; }
    if (videoDlg && videoDlg.open) dock();
    else { popBtn.title = '先在页面上点一个 ▶ 打开视频，再钉过去'; }
  });
  tocEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sec]');
    if (b) renderSection(b.dataset.sec);
  });
  bodyEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sec]');
    if (b) renderSection(b.dataset.sec);
  });
  logEl.addEventListener('click', (e) => {
    const h = e.target.closest('[data-hist]');
    if (h) showAnswer(hist[Number(h.dataset.hist)]);
  });
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(inputEl.value);
    inputEl.value = '';
  });
  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) ask(b.textContent);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'float') close();
  });

  if (location.hash === '#learn-open') setTimeout(open, 60);

  window.__learnUI = {
    open, close, ask, search, renderSection, focusItem, renderClip, clipInfo,
    dockFor: (clipId) => dock(clipId),
    undock,
    get mode() { return mode; },
  };
})();
