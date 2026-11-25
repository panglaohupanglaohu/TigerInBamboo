/**
 * 山形验收台（Guide §9 B 组 R25–R28）：山形面板下方一块，四节，每节对应一轮，都能在页面上直接看、直接点。
 *   R25 玩家地面：新山形接管玩家地面后「走一圈检验」（新山面 / 玩家真用的地面链 / 射线打网格 三方对比 + 轨道 / 建筑高差复检）；可把玩家放到新山上。
 *   R26 固定机位（正面 / 侧面 / 俯视 / 斜后 / 玩家视角）+ 地形线擂台（固定种子测试岛，上一代 vs 这一代，比较规则写死）。
 *   R27 配色二选一：Bad North 夏季 / Townscaper 并排（同一座山两套颜色的缩略图 + 草坡面积 / 不偏灰检查），实景一键切换、一键回计划配色。
 *       选哪套要用户定（docs/PENDING_USER_DECISIONS.md），这里只做候选与对照。
 *   R28 采用状态（采用后进游戏自动换上；一键回原山形）+ 30 种子分布（Worker 逐座回传）+ 最好 / 最差 / 最典型三张缩略图
 *       （本页画的地形缩略图；e2e 拍的实景截图在 artifacts/mountain-seeds-e2e/latest/，有就并排显示）。
 * 只读请求游戏（pipeline-bridge 的 mountain.*）；不改存档、不设默认。
 */
import { drawRelief } from './mountain-evolve.js?v=evolve-r25';
import { compareCandidates, PALETTE_RULES } from './mountain/palette-check.js?v=palette-r27';
import { ARENA_LABELS, ARENA_BETTER, ARENA_TOLERANCE } from './mountain/arena.js?v=arena-r26';
import { SEED_METRICS } from './mountain/seeds.js?v=seeds-r28';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const btn = (text, cls) => { const b = el('button', text, cls); b.type = 'button'; return b; };
const pc = (v) => (v == null ? '—' : Math.round(v * 1000) / 10 + '%');
const CSS = `
#mountain-accept{display:none;margin:14px 0 4px;padding:14px 16px;border:1px solid #3a4a2c;border-radius:10px;background:linear-gradient(180deg,#171f0f,#11160c);color:#dfe8d2}
body[data-tier=scene][data-scene-mountain="1"][data-scene-edit=view] #mountain-accept,body[data-layer-focus=mountain][data-scene-mountain="1"] #mountain-accept{display:block}
body[data-layer-focus=battle] #mountain-accept,body[data-layer-focus=fx] #mountain-accept{display:none!important}
#mountain-accept h3{margin:0 0 4px;font-size:15px;letter-spacing:.04em}#mountain-accept .ma-sub{margin:0 0 10px;color:#a9b89a;font-size:12px}
#mountain-accept .ma-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}
#mountain-accept .ma-sec{border:1px solid #33422a;border-radius:8px;padding:10px 12px;background:#0f140b}
#mountain-accept .ma-sec h4{margin:0 0 6px;font-size:13px}#mountain-accept .ma-sec h4 small{color:#a9b89a;font-weight:400;margin-left:6px}
#mountain-accept .ma-row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
#mountain-accept button{font-size:12px;padding:3px 9px;border-radius:6px;border:1px solid #4a5d3a;background:#1a2412;color:#e6f0da;cursor:pointer}
#mountain-accept button.on{background:#3c5a22;border-color:#9fd36b}#mountain-accept button:disabled{opacity:.45;cursor:not-allowed}
#mountain-accept .ma-out{font-size:12px;line-height:1.55;color:#c9d6bb;white-space:pre-wrap;margin:4px 0}
#mountain-accept .pass{color:#9fe07f}#mountain-accept .fail{color:#ff9a8a}#mountain-accept .warn{color:#f2c46b}
#mountain-accept table{border-collapse:collapse;font-size:12px;width:100%;margin:4px 0}#mountain-accept td,#mountain-accept th{border-bottom:1px solid #2a3622;padding:2px 6px;text-align:right}#mountain-accept td:first-child,#mountain-accept th:first-child{text-align:left}
#mountain-accept .ma-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#mountain-accept .ma-card{border:1px solid #33422a;border-radius:6px;overflow:hidden;background:#0b0f08;font-size:11px}
#mountain-accept .ma-card canvas,#mountain-accept .ma-card img{display:block;width:100%;aspect-ratio:11/8;background:#0d2530;object-fit:cover}
#mountain-accept .ma-card .ma-meta{padding:5px 7px;line-height:1.5}#mountain-accept .ma-card b{font-size:12px}
#mountain-accept .ma-three{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#mountain-accept .ma-hist{display:grid;grid-template-columns:88px 1fr 150px;gap:4px 8px;align-items:center;font-size:11px;margin:6px 0}
#mountain-accept .ma-bars{display:flex;gap:1px;align-items:flex-end;height:22px}#mountain-accept .ma-bars i{flex:1;background:#7fb35a;min-height:1px}`;

export function mountMountainAccept({ host, request, status, sceneId }) {
  if (document.getElementById('mountain-accept')) return null;
  document.head.append(Object.assign(el('style'), { textContent: CSS }));
  const root = el('section'); root.id = 'mountain-accept'; root.setAttribute('aria-label', '山形验收台');
  root.append(el('h3', '山形验收台 · R25–R28'), el('p', '先在上面的山形管线里「执行」或在进化墙里点一座候选，让实景换上新山形，再用这里四节验收。这里只看、只对照：设为默认、配色二选一、峰高可改范围都要你点头（见 docs/PENDING_USER_DECISIONS.md）。', 'ma-sub'));
  const grid = el('div', undefined, 'ma-grid'); root.append(grid);
  host.after(root);
  const say = (t) => status?.(t);
  const sec = (round, title, note) => { const s = el('div', undefined, 'ma-sec'); s.dataset.round = round; const h = el('h4', `${round} ${title}`); h.append(el('small', note)); s.append(h); grid.append(s); return s; };
  const ask = (a, p) => request(a, p);

  // ── R25 玩家地面 ─────────────────────────────────────────────
  const s25 = sec('R25', '玩家地面', '新山形接管碰撞：能在新山上走');
  const walkBtn = btn('走一圈检验'), placeBtn = btn('把玩家放到新山上'), readBtn = btn('读玩家离地'), out25 = el('div', '还没检验。验证结果里的「玩家地面与山形一致」「山上能走」两项是 Worker 独立复算；这里是实景复核。', 'ma-out');
  const row25 = el('div', undefined, 'ma-row'); row25.append(walkBtn, placeBtn, readBtn); s25.append(row25, out25);
  walkBtn.onclick = async () => {
    try { const r = await ask('mountain.walk', {}); s25.dataset.walk = JSON.stringify(r);
      if (!r.ok) { out25.textContent = '没法检验：' + r.reason; out25.className = 'ma-out warn'; return; }
      const S = r.samples, C = r.recheck, P = r.path;
      out25.textContent = `${r.pass ? '✓ 通过' : '✗ 没通过'}${r.comparing ? '（正在对照原样：地面已交回原地形）' : ''}\n`
        + `自由地形取点 ${S.count} 个：洞 ${S.holes} · 玩家地面链一致 ${S.chainAgree} / 偏高 ${S.chainHigher} / 偏低 ${S.chainLower} / 无地面 ${S.chainNull}（最大差 ${S.maxChainErr} m）· 射线打新山网格最大差 ${S.maxMeshErr} m\n`
        + `复检：轨道 ${C.railCells} 格高差 ${C.railDiff} m · 建筑 ${C.structureCells} 格高差 ${C.structureDiff} m（都应为 0）\n`
        + `穿过最高处一条线：${P.steps} 步 · 洞 ${P.holes} · 相邻最大落差 ${P.maxJump} m`;
      out25.className = 'ma-out ' + (r.pass ? 'pass' : 'fail'); say('走一圈检验：' + (r.pass ? '通过' : '没通过'));
    } catch (e) { out25.textContent = '检验失败：' + e.message; out25.className = 'ma-out fail'; }
  };
  const playerRead = async (place) => {
    try { const r = await ask('mountain.walk', place ? { placePlayer: true } : { readPlayer: true }); s25.dataset.player = JSON.stringify(r);
      if (!r.ok) { out25.textContent = r.reason; out25.className = 'ma-out warn'; return; }
      const p = r.player; out25.textContent = `${place ? `玩家已放到新山上（格 ${r.placed.cell.join(',')}，地面高 ${r.placed.groundY} m，从 1.2 m 处自己落地）\n` : ''}玩家离新山面 ${p.aboveGround ?? '—'} m · 着地 ${p.onGround ? '是' : '否'} · 所在格类型 ${p.cls === 0 ? '自由地形' : p.cls === 1 ? '建筑' : p.cls === 2 ? '轨道' : '—'} · 地面链半径 ${p.chainR ?? '—'} / 新山面半径 ${p.groundR ?? '—'}`;
      out25.className = 'ma-out';
    } catch (e) { out25.textContent = '失败：' + e.message; out25.className = 'ma-out fail'; }
  };
  placeBtn.onclick = () => playerRead(true); readBtn.onclick = () => playerRead(false);

  // ── R26 固定机位 + 擂台 ───────────────────────────────────────
  const s26 = sec('R26', '固定机位 · 地形线擂台', '同一组机位拍原样与候选，逐张对照');
  const camRow = el('div', undefined, 'ma-row'), camOut = el('div', '', 'ma-out');
  const views = [['front', '正面'], ['side', '侧面'], ['top', '俯视'], ['oblique', '斜后'], ['eye', '玩家视角'], ['free', '放开机位']];
  for (const [v, label] of views) { const b = btn(label); b.dataset.view = v; b.onclick = async () => {
    try { const r = await ask('mountain.camera', { view: v }); camRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b && v !== 'free')); s26.dataset.view = v;
      camOut.textContent = r.ok ? (v === 'free' ? '已放开固定机位。' : `机位：${r.label}（舞台坐标 ${r.stage.pos.map((x) => Math.round(x)).join(', ')} → ${r.stage.at.map((x) => Math.round(x)).join(', ')}）`) : r.reason; }
    catch (e) { camOut.textContent = '机位失败：' + e.message; } }; camRow.append(b); }
  const arenaBtn = btn('在擂台上跑两代'), arenaOut = el('div', '擂台：固定种子测试岛（与实景无关），四项指标只看产出地形。下面先显示登记表里记的成绩。', 'ma-out'), arenaTable = el('table'), arenaPair = el('div', undefined, 'ma-pair');
  s26.append(camRow, camOut, el('div', undefined, 'ma-row'), arenaOut, arenaTable, arenaPair); s26.children[3].append(arenaBtn);
  const drawArena = (rows, verdict, src) => {
    arenaTable.replaceChildren(); const head = el('tr'); head.append(el('th', '指标'), ...rows.map((r) => el('th', r.short)), el('th', '规则')); arenaTable.append(head);
    for (const k of Object.keys(ARENA_BETTER)) { const tr = el('tr'); tr.append(el('td', ARENA_LABELS[k]), ...rows.map((r) => el('td', r.metrics?.[k] == null ? '—' : k === 'hardEdge' ? r.metrics[k].toFixed(2) : pc(r.metrics[k]))), el('td', `${ARENA_BETTER[k] === 'higher' ? '越高越好' : '越低越好'} ±${ARENA_TOLERANCE[k]}`)); arenaTable.append(tr); }
    arenaOut.textContent = `${src}：${verdict}`; arenaOut.className = 'ma-out ' + (/^赢了/.test(verdict) ? 'pass' : 'fail');
  };
  fetch(new URL('../scene-authoring/catalog/arena/terrain.json', import.meta.url), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j || s26.dataset.arena) return; s26.dataset.registry = '1';
    drawArena([{ short: '原样', metrics: j.original }, ...j.generations.map((g, i) => ({ short: i === j.generations.length - 1 ? '这一代' : '上一代', metrics: g.metrics }))], j.verdict?.text || '', '登记表（catalog/arena/terrain.json）');
  }).catch(() => {});
  let arenaWorker = null, arenaRun = 0;
  arenaBtn.onclick = () => {
    arenaBtn.disabled = true; arenaOut.textContent = '擂台计算中（两代 × 101×101 格）…'; arenaOut.className = 'ma-out';
    arenaWorker ||= new Worker(new URL('./mountain/arena-worker.js?v=arena-r26', import.meta.url), { type: 'module' }); const id = ++arenaRun;
    arenaWorker.onmessage = (e) => { const m = e.data; if (m.runId !== id) return; arenaBtn.disabled = false;
      if (m.error) { arenaOut.textContent = '擂台失败：' + m.error; arenaOut.className = 'ma-out fail'; return; }
      s26.dataset.arena = JSON.stringify({ beats: m.compare.beats, rows: m.compare.rows, original: m.original, ms: m.ms });
      drawArena([{ short: '原样', metrics: m.original }, ...m.gens.map((g, i) => ({ short: i === m.gens.length - 1 ? '这一代' : '上一代', metrics: g.metrics }))], m.compare.text, `本页实算（${m.ms} ms）`);
      arenaPair.replaceChildren(); const top = Math.max(40, ...m.gens.map((g) => g.metrics.top || 0)) * 1.15;
      for (const g of m.gens) { const c = el('div', undefined, 'ma-card'), cv = el('canvas'); cv.width = 330; cv.height = 240; drawRelief(cv, g.plan, m.field, top); const meta = el('div', undefined, 'ma-meta'); meta.append(el('b', g.label)); c.append(cv, meta); arenaPair.append(c); }
      say('擂台：' + m.compare.text); };
    arenaWorker.onerror = (e) => { arenaBtn.disabled = false; arenaOut.textContent = '擂台 Worker 出错：' + (e.message || ''); };
    arenaWorker.postMessage({ runId: id });
  };

  // ── R27 配色二选一 ───────────────────────────────────────────
  const s27 = sec('R27', '配色二选一', '候选 + 对照，选哪套由你定');
  const palBtn = btn('对照两套配色'), backBtn = btn('实景回计划配色'), out27 = el('div', `两套候选：Bad North 夏季 / Townscaper。检查线：草坡面积 ≥ ${PALETTE_RULES.grassMin * 100}%，灰面 ≤ ${PALETTE_RULES.greyMax * 100}%，草坡饱和度 ≥ ${PALETTE_RULES.grassSatMin}。`, 'ma-out'), pair27 = el('div', undefined, 'ma-pair');
  const row27 = el('div', undefined, 'ma-row'); row27.append(palBtn, backBtn); s27.append(row27, out27, pair27);
  palBtn.onclick = async () => {
    try { const cur = await ask('mountain.current'); if (!cur.ok) { out27.textContent = cur.reason + '（先让实景换上一座新山形）'; out27.className = 'ma-out warn'; return; }
      const rows = compareCandidates(cur.field, cur.plan); s27.dataset.palette = JSON.stringify(rows.map(({ id, label, grassShare, greyShare, grassSat, status: st, checks }) => ({ id, label, grassShare, greyShare, grassSat, status: st, checks: checks.map((c) => c.status) })));
      pair27.replaceChildren(); const top = Math.max(40, ...cur.plan.h.filter(Number.isFinite)) * 1.15;
      for (const r of rows) {
        const c = el('div', undefined, 'ma-card'), cv = el('canvas'); cv.width = 330; cv.height = 240; c.dataset.palette = r.id; drawRelief(cv, { ...cur.plan, style: { ...(cur.plan.style || {}), palette: r.id } }, cur.field, top);
        const meta = el('div', undefined, 'ma-meta'), live = btn('实景换上这套'); meta.append(el('b', r.label), el('br'));
        for (const k of r.checks) { const line = el('div', `${k.status === 'pass' ? '✓' : '✗'} ${k.name}：${k.detail}`, k.status); meta.append(line); }
        live.onclick = async () => { const x = await ask('mountain.palette', { palette: r.id }).catch((e) => ({ ok: false, reason: e.message })); pair27.querySelectorAll('.ma-card').forEach((d) => d.querySelector('button')?.classList.toggle('on', d === c && x.ok)); s27.dataset.live = x.ok ? String(r.id) : ''; say(x.ok ? `实景已换成「${r.label}」配色（只换颜色，不动形状与地面；没写进采用记录，除非你接着点采用）` : '换配色失败：' + x.reason); };
        meta.append(el('div', `来源：${r.source}`, 'muted'), live); c.append(cv, meta); pair27.append(c);
      }
      out27.textContent = `当前实景配色：${{ 0: '原配色', 1: 'Bad North 夏季', 2: 'Townscaper' }[cur.palette] || cur.palette}。两套都只是候选：选哪套请在 docs/PENDING_USER_DECISIONS.md 里定。`; out27.className = 'ma-out';
    } catch (e) { out27.textContent = '对照失败：' + e.message; out27.className = 'ma-out fail'; }
  };
  backBtn.onclick = async () => { const x = await ask('mountain.palette', { palette: null }).catch((e) => ({ ok: false, reason: e.message })); pair27.querySelectorAll('button.on').forEach((b) => b.classList.remove('on')); s27.dataset.live = ''; say(x.ok ? '实景已回到计划里的配色。' : x.reason); };

  // ── R28 采用状态 + 30 种子分布 ───────────────────────────────
  const s28 = sec('R28', '采用 · 30 种子分布', '采用后进游戏自动换上；一键回原山形');
  const adoptOut = el('div', '采用状态读取中…', 'ma-out'), unadoptBtn = btn('回到原山形（删除采用记录）'), refreshBtn = btn('刷新采用状态'), seedsBtn = btn('跑 30 个种子');
  const row28 = el('div', undefined, 'ma-row'); row28.append(refreshBtn, unadoptBtn, seedsBtn);
  const seedsOut = el('div', '分布：同一条管线、默认参数，只换噪声种子（massif.seed = s，rolling.seed = 37s mod 1000）。一张好看的截图可能是运气，分布不会。', 'ma-out'), hist = el('div', undefined, 'ma-hist'), three = el('div', undefined, 'ma-three');
  s28.append(adoptOut, row28, seedsOut, hist, three);
  const showAdopted = async () => {
    try { const a = await ask('mountain.adopted', { id: sceneId?.() }); s28.dataset.adopted = JSON.stringify({ adopted: a.adopted, v: a.v, autoDeploy: a.autoDeploy, deployedNow: a.deployedNow, auto: a.auto?.status || null });
      adoptOut.textContent = a.adopted ? `已采用（${new Date(a.at).toLocaleString()}，记录 v${a.v}${a.autoDeploy ? '，进游戏自动换上' : '，旧记录：只存档不自动部署'}）· 这次进游戏：${a.auto ? `${a.auto.status} — ${a.auto.reason}` : '未检查'}${a.deployedNow ? ' · 实景现在就是采用的山形' : ''}` : `没有采用记录：游戏里是原山形。${a.auto?.reason ? '（' + a.auto.reason + '）' : ''}`;
      adoptOut.className = 'ma-out ' + (a.adopted ? 'pass' : ''); unadoptBtn.disabled = !a.adopted && !a.deployedNow;
    } catch (e) { adoptOut.textContent = '读不到采用状态：' + e.message; }
  };
  refreshBtn.onclick = showAdopted;
  unadoptBtn.onclick = async () => { try { const r = await ask('mountain.unadopt', { id: sceneId?.() }); say(r.note); } catch (e) { say('回原失败：' + e.message); } showAdopted(); };
  setTimeout(showAdopted, 4000);

  let thumbs = null; fetch(new URL('../../artifacts/mountain-seeds-e2e/latest/thumbs.json', import.meta.url), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { thumbs = j; }).catch(() => {});
  let seedsWorker = null, seedsRun = 0;
  seedsBtn.onclick = async () => {
    seedsBtn.disabled = true; hist.replaceChildren(); three.replaceChildren(); seedsOut.className = 'ma-out';
    let field; try { const r = await ask('mountain.probe', { id: sceneId?.() }); if (!r.ok) throw Error(r.reason); field = r.field; } catch (e) { seedsOut.textContent = '采样失败：' + e.message; seedsBtn.disabled = false; return; }
    seedsWorker ||= new Worker(new URL('./mountain/seeds-worker.js?v=seeds-r28', import.meta.url), { type: 'module' }); const id = ++seedsRun, rows = [];
    seedsWorker.onmessage = (e) => { const m = e.data; if (m.runId !== id) return;
      if (m.error) { seedsOut.textContent = '分布失败：' + m.error; seedsOut.className = 'ma-out fail'; seedsBtn.disabled = false; return; }
      if (m.row) { rows.push(m.row); seedsOut.textContent = `计算中：${rows.length} / 30 座（${rows.filter((r) => r.score >= 0).length} 座过硬检查）`; return; }
      if (!m.done) return; seedsBtn.disabled = false;
      const passed = rows.filter((r) => r.score >= 0).length; s28.dataset.seeds = JSON.stringify({ count: rows.length, passed, pick: m.pick });
      seedsOut.textContent = `30 座：${passed} 座过硬检查。最好 种子 ${m.pick.best ?? '—'} · 最差 种子 ${m.pick.worst ?? '—'} · 最典型 种子 ${m.pick.typical ?? '—'}（离各指标中位数的标准化距离最小）`;
      for (const { key, label, unit } of SEED_METRICS) { const d = m.distribution[key]; if (!d) continue; const mx = Math.max(...d.bins, 1), bars = el('div', undefined, 'ma-bars'); for (const b of d.bins) { const i = el('i'); i.style.height = Math.round(b / mx * 100) + '%'; i.title = String(b); bars.append(i); }
        const f = (v) => (unit === '%' ? pc(v) : v.toFixed(1) + ' m'); hist.append(el('span', label), bars, el('span', `${f(d.min)} · 中位 ${f(d.median)} · ${f(d.max)}`)); }
      const top = Math.max(40, ...Object.values(m.picked).map((p) => Math.max(...p.plan.h.filter(Number.isFinite)))) * 1.15;
      for (const [k, name] of [['best', '最好'], ['typical', '最典型'], ['worst', '最差']]) { const p = m.picked[k]; if (!p) continue; const row = rows.find((r) => r.seed === p.seed);
        const c = el('div', undefined, 'ma-card'), cv = el('canvas'); cv.width = 330; cv.height = 240; c.dataset.pick = k; c.dataset.seed = p.seed; drawRelief(cv, p.plan, field, top); c.append(cv);
        const t = thumbs?.shots?.[k]; if (t) { const img = el('img'); img.alt = `e2e 实景截图 · ${name}`; img.src = new URL('../../artifacts/mountain-seeds-e2e/latest/' + t.file, import.meta.url).href; img.onerror = () => img.remove(); c.append(img); }
        const meta = el('div', undefined, 'ma-meta'), look = btn('实景看这座'); meta.append(el('b', `${name} · 种子 ${p.seed}`), el('br'), el('span', row ? `分数 ${row.score} · 中等坡 ${pc(row.metrics.mid)} · 竖崖 ${pc(row.metrics.cliff)} · 排水 ${pc(row.metrics.drain)} · 主峰 ${row.metrics.prominence.toFixed(0)} m` : ''));
        if (t) meta.append(el('div', t.seed === p.seed ? '下面是 e2e 拍的实景截图' : `下面是上次 e2e 的截图（当时种子 ${t.seed}）`, 'muted'));
        look.onclick = async () => { try { const r = await ask('mountain.preview', { id: sceneId?.(), plan: p.plan }); three.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === look)); s28.dataset.live = k; say(`实景已换成${name}的一座（种子 ${p.seed}，${r?.triangles || 0} 面）`); } catch (e) { say('实景预览失败：' + e.message); } };
        meta.append(look); c.append(meta); three.append(c); }
      say('30 种子分布已出：' + seedsOut.textContent);
    };
    seedsWorker.onerror = (e) => { seedsBtn.disabled = false; seedsOut.textContent = '分布 Worker 出错：' + (e.message || ''); };
    seedsWorker.postMessage({ runId: id, field, count: 30 });
  };
  root.dataset.ready = '1';
  return { root, refreshAdopted: showAdopted };
}
