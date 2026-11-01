/**
 * learnpanel.js — the learning navigation overlaid on the live scene.
 *
 * Organised as pipelines (learn/pipeline.js):
 *   共享底座   grid, water layer, lighting — switch each one on/off in the scene
 *   建筑管线   Townscaper — the scene itself; camera tours to each stage
 *   地形管线   engine — stages, with links to the engine scenes
 *   融合       the post-Townscaper project: terrain + houses on one grid → sphere
 * Every row has ▶ to play the clip it came from.
 *
 * URL: index.html?on=grid,shorelines&off=waves&tour=arch&time=night
 */

const DEFAULT_ON = new Set(['waves', 'reflection', 'ao', 'shadows']);

const GUIDE_RULES = [
  ['先读原文，再看画面', '原文在 REA-agent/gifs/README.md，连同前后几条一起读；不要看画面猜，也别去抓 x.com。'],
  ['不盲信已有说明', 'ENGINE.md / STUDY-INDEX.md / README.md 里有推断，用视频和原文核实过才算数。'],
  ['原文 → 画面 → 代码 → 截图', '写完必须在浏览器里截图看过；window.reaTown 可直接操作镜头、开关、统计。'],
  ['注释写帖子 ID', '每处实现注明帖子 ID 和原文关键句，保证可追溯。'],
  ['学完登记三处', 'learn/data.js（状态与笔记）、learn/pipeline.js（步骤状态、toggle）、LEARNING.md。登记了才会出现在这个面板和管线图里。'],
  ['别破坏别人的文件', '目录没有 git，常有两条会话同时写。src/grid.js、mesh.js、town.js 被 engine 依赖；写回前先看修改时间；新能力放新文件。'],
  ['说清做了什么', '部分就标部分、没做就标未做；不把推断写成事实。'],
];

const PAGES = [
  ['GUIDE.md', '接手指南（给其他 LLM）', '规矩、完整目录、学一段视频的流程、可复用接口、踩过的坑、下一步'],
  ['pipeline.html', '完整管线图', '三条管线 + 融合点，每一步的视频、状态、代码'],
  ['learn.html', '学习笔记', '237 段视频：原文 → 学到什么 → 代码位置，按项目 / 主题筛选'],
  ['compare.html', '新旧对比', '学习前 / 学习后左右并排，也可换成 engine 场景'],
  ['engine/world.html', 'engine · 台地岛', '地形管线：台地、河流、岸浪、逆光边'],
  ['engine/terrain.html', 'engine · 四边形地形', '同一体素场读成地貌'],
  ['engine/demo.html', 'engine · 岛屿生成', 'Bad North 式高度场 + 导航'],
  ['Townscaper.html', '旧版 Townscaper', '学习前的基线（单文件）'],
  ['overview.html', '成果总览', '统计与各页截图'],
];

const css = `
#learnpanel { position: fixed; right: 16px; top: 76px; width: 340px; max-height: calc(100vh - 96px); overflow: auto;
  padding: 12px 14px; z-index: 6; font: 13px/1.45 -apple-system, system-ui, "PingFang SC", sans-serif; color: #1f3139; }
#learnpanel.collapsed { width: auto; padding: 8px 12px; overflow: hidden; }
#learnpanel.collapsed .lp-body { display: none; }
#learnpanel .lp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; user-select: none; }
#learnpanel .lp-head b { font-size: 14px; }
#learnpanel .lp-head span { color: #5e737a; font-size: 12px; }
#learnpanel .lp-verdict { margin: 8px 0 2px; padding: 8px 10px; border-radius: 10px; background: rgba(123,95,176,.1); font-size: 12.5px; }
#learnpanel .lp-verdict b { display: block; margin-bottom: 4px; }
#learnpanel .lp-flow { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 6px; font-size: 11.5px; }
#learnpanel .lp-flow span { padding: 1px 7px; border-radius: 999px; color: #fff; }
#learnpanel details { border-top: 1px solid rgba(30,60,70,.1); margin-top: 8px; padding-top: 6px; }
#learnpanel summary { cursor: pointer; font-weight: 600; font-size: 13px; list-style: none; display: flex; align-items: center; gap: 6px; }
#learnpanel summary::-webkit-details-marker { display: none; }
#learnpanel summary::before { content: '▸'; color: #5e737a; transition: transform .15s; }
#learnpanel details[open] summary::before { transform: rotate(90deg); }
#learnpanel summary i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
#learnpanel summary em { margin-left: auto; font-style: normal; font-weight: 400; color: #5e737a; font-size: 11.5px; }
#learnpanel .lp-note { color: #5e737a; font-size: 11.5px; margin: 4px 0 2px; }
#learnpanel .lp-g { color: #5e737a; font-size: 11px; margin: 6px 0 0; letter-spacing: .03em; }
#learnpanel .lp-row { display: grid; grid-template-columns: 18px 1fr auto 40px; gap: 6px; align-items: center; padding: 3px 0; }
#learnpanel .lp-row input { width: 15px; height: 15px; margin: 0; accent-color: #2f7f8a; }
#learnpanel .lp-row .dot { width: 9px; height: 9px; border-radius: 50%; justify-self: center; }
#learnpanel .lp-row label { cursor: pointer; }
#learnpanel .lp-row small { display: block; color: #5e737a; font-size: 11px; line-height: 1.3; }
#learnpanel .lp-act { border: 1px solid rgba(30,60,70,.18); background: rgba(255,255,255,.75); border-radius: 6px; padding: 1px 6px; font: inherit; font-size: 11.5px; cursor: pointer; color: inherit; text-decoration: none; white-space: nowrap; }
#learnpanel .lp-thumb { width: 40px; height: 28px; border-radius: 5px; border: 0; padding: 0; cursor: pointer; background: #9cc center / cover no-repeat; position: relative; }
#learnpanel .lp-thumb::after { content: '▶'; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 9px; text-shadow: 0 0 4px #000; }
#learnpanel .lp-seg { display: flex; gap: 4px; margin: 2px 0 4px 24px; }
#learnpanel .lp-seg button { flex: 1; border: 1px solid rgba(30,60,70,.15); background: rgba(255,255,255,.7); border-radius: 7px; padding: 3px 6px; cursor: pointer; font: inherit; font-size: 12px; color: inherit; }
#learnpanel .lp-seg button.on { background: #1f3139; color: #fff; }
#learnpanel a.lp-page { display: block; padding: 5px 8px; border-radius: 8px; text-decoration: none; color: inherit; }
#learnpanel a.lp-page:hover { background: rgba(255,255,255,.75); }
#learnpanel a.lp-page b { font-weight: 600; }
#learnpanel a.lp-page small { display: block; color: #5e737a; font-size: 11.5px; }
#learnpanel .lp-legend { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px; color: #5e737a; margin-top: 6px; }
#learnpanel .lp-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 3px; }
#lp-dlg { border: 0; border-radius: 12px; padding: 0; width: min(92vw, 820px); background: #111; }
#lp-dlg::backdrop { background: rgba(0,0,0,.55); }
#lp-dlg video { width: 100%; display: block; max-height: 72vh; background: #000; }
#lp-dlg p { color: #e8eeee; margin: 0; padding: 10px 14px 14px; font: 13px/1.5 -apple-system, system-ui, "PingFang SC", sans-serif; }
#lp-dlg button { position: absolute; right: 10px; top: 8px; background: rgba(255,255,255,.15); color: #fff; border: 0; border-radius: 6px; padding: 4px 10px; cursor: pointer; }
@media (max-width: 720px) { #learnpanel { left: 16px; right: 16px; width: auto; top: auto; bottom: 86px; max-height: 50vh; } }
`;

export function mountLearnPanel(view, town) {
  const host = document.getElementById('learnpanel');
  const P = window.PIPELINE;
  if (!host || !P) return;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const L = window.LEARN;
  const byId = new Map((L?.items ?? []).map((it) => [it.id, it]));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const params = new URLSearchParams(location.search);
  const on = new Set(DEFAULT_ON);
  for (const k of (params.get('on') || '').split(',').filter(Boolean)) on.add(k);
  for (const k of (params.get('off') || '').split(',').filter(Boolean)) on.delete(k);

  const laneCount = (lane) => {
    const all = lane.groups.flatMap((g) => g[1]);
    const done = all.filter((s) => s.status === 'done' || s.status === 'engine').length;
    return `${done}/${all.length}`;
  };
  const lanesHtml = P.lanes.map((lane, li) => `
    <details ${li < 2 ? 'open' : ''} data-lane="${lane.key}">
      <summary><i style="background:${lane.color}"></i>${lane.name}<em>${laneCount(lane)}</em></summary>
      <p class="lp-note">${lane.note}</p>
      ${lane.groups.map(([gname, steps]) => `
        ${lane.groups.length > 1 ? `<p class="lp-g">${gname}</p>` : ''}
        ${steps.map((s, si) => row(lane, s, `${lane.key}-${gname}-${si}`)).join('')}`).join('')}
    </details>`).join('');

  function row(lane, s, uid) {
    const it = byId.get(s.id);
    const tip = it ? `${it.date} · ${it.text}` : s.id;
    const toggle = s.toggle && s.toggle !== 'time'
      ? `<input type="checkbox" data-toggle="${s.toggle}" id="lp-${uid}" ${on.has(s.toggle) ? 'checked' : ''} />`
      : `<span class="dot" style="background:${P.statusColor[s.status]}" title="${P.statusName[s.status]}"></span>`;
    let act = '';
    if (s.tour) act = `<button class="lp-act" data-tour="${s.tour}">去看</button>`;
    else if (s.page) act = `<a class="lp-act" href="${s.page}">打开</a>`;
    else if (s.status === 'todo') act = `<span class="lp-act" style="opacity:.55;border-style:dashed">未做</span>`;
    else act = '<span></span>';
    const seg = s.toggle === 'time'
      ? `<div class="lp-seg" id="lp-time"><button data-t="day">白天</button><button data-t="dusk">黄昏</button><button data-t="night">夜晚</button></div>` : '';
    return `<div class="lp-row">${toggle}
      <label for="lp-${uid}">${s.name}${s.where ? `<small>${s.where}</small>` : ''}</label>
      ${act}
      <button class="lp-thumb" data-play="${s.id}" data-name="${esc(s.name)}" title="${esc(tip)}" style="background-image:url(learn/thumbs/${s.id}.jpg)"></button>
    </div>${seg}`;
  }

  host.className = 'panel' + (innerWidth < 720 ? ' collapsed' : '');
  host.innerHTML = `
    <div class="lp-head"><b>学习导航 · 管线</b><span>${L ? L.items.length + ' 段视频' : ''} · 收起/展开</span></div>
    <div class="lp-body">
      <div class="lp-verdict"><b>判断</b>${esc(P.verdict.title)}。
        <div class="lp-flow"><span style="background:#8a6b4f">Bad North 2017–19</span>→<span style="background:#d9663f">Townscaper 2019–21</span>→<span style="background:#7b5fb0">第三项目 2021–25 · 球面</span></div>
        <div style="margin-top:6px">${P.verdict.points.map(([id, t]) => `<div class="lp-row" style="grid-template-columns:1fr 40px"><span style="font-size:11.5px">${esc(t)}</span><button class="lp-thumb" data-play="${id}" data-name="${esc(t)}" style="background-image:url(learn/thumbs/${id}.jpg)"></button></div>`).join('')}</div>
      </div>
      <div class="lp-legend">${Object.entries(P.statusName).map(([k, n]) => `<span><i style="background:${P.statusColor[k]}"></i>${n}</span>`).join('')}<span>☑ = 可在场景里开关</span></div>
      ${lanesHtml}
      <details>
        <summary>接手指南（给其他 LLM）<em>7 条规矩</em></summary>
        <p class="lp-note">继续这条学习线之前先读 <a href="GUIDE.md">GUIDE.md</a>（含完整目录与依赖关系），再按 <a href="pipeline.html">学习路线</a> 0 → 1 → 7 推进。</p>
        ${GUIDE_RULES.map(([t, d], i) => `<div class="lp-row" style="grid-template-columns:18px 1fr"><b style="color:#2f7f8a">${i + 1}</b><span><b>${t}</b><small>${d}</small></span></div>`).join('')}
        <p class="lp-note" style="margin-top:6px">流程：选题（路线里的一步）→ 读原文 → 抽帧看画面 → 定落点与可复用接口 → 实现 → 截图验证 → 加 setDebug 开关并在 pipeline.js 写 toggle → 登记三处。</p>
      </details>
      <details open>
        <summary>其他页面<em>${PAGES.length} 个</em></summary>
        <div style="margin-top:4px">${PAGES.map(([href, name, desc]) => `<a class="lp-page" href="${href}"><b>${name} →</b><small>${desc}</small></a>`).join('')}</div>
        <button class="lp-act" data-tour="all" style="margin:6px 8px">镜头回到全景</button>
      </details>
    </div>`;

  host.querySelector('.lp-head').onclick = () => host.classList.toggle('collapsed');

  // ---- toggles (rows that share a key stay in sync)
  const boxes = [...host.querySelectorAll('input[data-toggle]')];
  const setToggle = (key, value) => {
    view.setDebug(key, value);
    for (const b of boxes) if (b.dataset.toggle === key) b.checked = value;
  };
  for (const b of boxes) b.onchange = () => setToggle(b.dataset.toggle, b.checked);
  for (const key of new Set(boxes.map((b) => b.dataset.toggle))) {
    if (on.has(key) !== DEFAULT_ON.has(key) || !DEFAULT_ON.has(key)) setToggle(key, on.has(key));
  }

  // ---- time of day
  const seg = host.querySelector('#lp-time');
  const markTime = () => seg?.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === view.timeOfDay));
  if (seg) seg.onclick = (e) => { const t = e.target.dataset?.t; if (t) view.setTimeOfDay(t); };
  view.onTimeOfDay = markTime;
  if (params.get('time')) view.setTimeOfDay(params.get('time'));
  markTime();

  // ---- tours + video
  host.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tour]');
    if (t) { tour(t.dataset.tour, t); return; }
    const p = e.target.closest('[data-play]');
    if (p) play(p.dataset.play, p.dataset.name);
  });
  function tour(kind, btn) {
    if (kind === 'all') { view.frameTown(); return; }
    const c = findFeature(kind, town);
    if (!c) { if (btn) flash(btn, '没有'); return; }
    view.target.set(c.x, c.y, c.z);
    view.distance = c.d ?? 7;
    view.pitch = c.pitch ?? 0.42;
    view.updateCamera();
  }
  if (params.get('tour')) setTimeout(() => tour(params.get('tour')), 50);

  const dlg = document.createElement('dialog');
  dlg.id = 'lp-dlg';
  dlg.innerHTML = '<button>关闭</button><video controls loop playsinline></video><p></p>';
  document.body.appendChild(dlg);
  const vid = dlg.querySelector('video');
  const cap = dlg.querySelector('p');
  const close = () => { vid.pause(); vid.removeAttribute('src'); vid.load(); dlg.close(); };
  dlg.querySelector('button').onclick = close;
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  function play(id, name) {
    const it = byId.get(id);
    cap.innerHTML = `<b>${it?.date ?? ''}</b> · ${esc(it?.text ?? id)}<br><br>对应：${esc(name || '')}`;
    vid.poster = `learn/thumbs/${id}.jpg`;
    vid.src = `gifs/${id}.mp4`;
    vid.onerror = () => { cap.innerHTML += `<br><br><span style="color:#ffcf8a">本地没有视频：用 ./start.sh 启动会把 REA-agent/gifs 链接成 gifs/。原帖：<a style="color:#ffcf8a" target="_blank" href="https://x.com/OskSta/status/${id}">x.com</a></span>`; };
    dlg.showModal();
    vid.play().catch(() => {});
  }
}

function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1200);
}

/** Find a cell that shows the requested feature in the current town. */
function findFeature(kind, town) {
  const cells = town.grid.cells;
  const nb = (c, i) => (c.edgeNeighbors[i] >= 0 ? cells[c.edgeNeighbors[i]] : null);
  const L = 0.5;
  for (const c of cells) {
    const top = town.top(c);
    if (!top) continue;
    if (kind === 'arch' || kind === 'stilt') {
      for (let lv = 2; lv <= top; lv++) {
        if (!town.isSolid(c, lv) || town.isSolid(c, lv - 1)) continue;
        const arch = [0, 1].some((i) => nb(c, i) && nb(c, i + 2) && town.isSolid(nb(c, i), lv - 1) && town.isSolid(nb(c, i + 2), lv - 1));
        if ((kind === 'arch') === arch) return { x: c.cx, y: (lv - 1) * L, z: c.cz, d: 6 };
      }
    } else if (kind === 'yard') {
      if (top === 1 && [0, 1, 2, 3].every((i) => nb(c, i) && town.top(nb(c, i)) >= 1) && [0, 1, 2, 3].some((i) => town.top(nb(c, i)) >= 2)) {
        return { x: c.cx, y: 0.5, z: c.cz, d: 7, pitch: 0.75 };
      }
    } else if (kind === 'gable') {
      if (top >= 2) {
        const same = [0, 1, 2, 3].filter((i) => nb(c, i) && town.top(nb(c, i)) === top).length;
        const lower = [0, 1, 2, 3].filter((i) => !nb(c, i) || town.top(nb(c, i)) < top).length;
        if (same === 1 && lower === 3) return { x: c.cx, y: top * L, z: c.cz, d: 5.5, pitch: 0.32 };
      }
    } else if (kind === 'shore') {
      if (town.isSolid(c, 1) && [0, 1, 2, 3].some((i) => !nb(c, i) || town.top(nb(c, i)) === 0)) {
        return { x: c.cx, y: 0.3, z: c.cz, d: 6, pitch: 0.55 };
      }
    }
  }
  return null;
}
