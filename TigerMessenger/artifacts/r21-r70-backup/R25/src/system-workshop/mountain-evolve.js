/**
 * 山形进化墙：一次繁殖一墙候选山，点哪座，实景里的山当场换成哪座；给喜欢的留种，再繁殖下一代。
 * 基因 = 6 个山形能力的参数（mountain/evolve.js）。每座候选都过独立验证，硬检查不过的不能留种、不能采用。
 * 留过种的基因记在本机（tm.mountain.taste.v1），下次第一代会掺入——系统记住你的口味。
 */
import { PALETTES } from './mountain/palettes.js';
import { describeGenome } from './mountain/evolve.js?v=evolve-r1';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const TASTE_KEY = 'tm.mountain.taste.v1', SEA = 0.3, pc = (v) => Math.round(v * 100) + '%';
const CSS = `
#mountain-evolve{display:none;margin:14px 0 4px;padding:14px 16px;border:1px solid #2c4a44;border-radius:10px;background:linear-gradient(180deg,#0f1f1d,#0c1615)}
body[data-tier=scene][data-scene-edit=view][data-scene-mountain="1"] #mountain-evolve{display:block}
#mountain-evolve h3{margin:0;font-size:15px;letter-spacing:.04em}#mountain-evolve .ev-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#mountain-evolve .ev-head .grow{flex:1}#mountain-evolve .ev-sub{margin:6px 0 10px;color:#9fb5ae;font-size:12px}
#mountain-evolve .ev-line{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 10px;font-size:12px;color:#9fb5ae}
#mountain-evolve .ev-gen{padding:2px 8px;border-radius:999px;border:1px solid #2c4a44;background:#12211f;color:#d7efe6}#mountain-evolve .ev-gen b{color:#f2c46b}
#mountain-evolve .ev-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:10px}
#mountain-evolve .ev-card{position:relative;border:1px solid #24413b;border-radius:8px;background:#0b1413;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;animation:evIn .35s ease both}
#mountain-evolve .ev-card:hover{transform:translateY(-2px);border-color:#5fd0b0}#mountain-evolve .ev-card.live{border-color:#f2c46b;box-shadow:0 0 0 2px #f2c46b55}
#mountain-evolve .ev-card.seed{border-color:#7fe0a0}#mountain-evolve .ev-card.bad{opacity:.5;cursor:not-allowed}
#mountain-evolve .ev-card canvas{display:block;width:100%;aspect-ratio:11/8;background:#0d2530}
#mountain-evolve .ev-meta{padding:6px 8px 8px;font-size:11px;line-height:1.5;color:#b9cdc6}#mountain-evolve .ev-meta b{color:#eaf6f1;font-size:12px}
#mountain-evolve .ev-tag{position:absolute;top:6px;left:6px;padding:1px 7px;border-radius:999px;font-size:10px;background:#000a;color:#f2c46b}
#mountain-evolve .ev-score{position:absolute;top:6px;right:6px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;background:#000a;color:#eaf6f1}
#mountain-evolve .ev-star{position:absolute;right:6px;bottom:6px;border:1px solid #2c4a44;background:#0b1413;color:#9fb5ae;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer}
#mountain-evolve .ev-card.seed .ev-star{background:#1d4a34;color:#bff5d0;border-color:#7fe0a0}
#mountain-evolve .ev-diff{color:#8fb3ff}#mountain-evolve .ev-fail{color:#ff9a8a}
@keyframes evIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}`;

/** 斜视柱状地形图：从后往前画，每格一根柱子；颜色取能力算出的材质，明暗按坡向。所有卡片同一比例尺，可以直接比高矮。 */
export function drawRelief(cv, plan, field, topRef) {
  const n = plan.n, W = cv.width, H = cv.height, ctx = cv.getContext('2d'), s = W / n, dz = s * 0.5, k = (H * 0.5) / Math.max(20, topRef), y0 = H - n * dz - 6;
  const pal = PALETTES[plan.style?.palette ?? 0] || PALETTES[0], h = plan.h, cls = field.cls;
  ctx.fillStyle = '#0d2530'; ctx.fillRect(0, 0, W, H);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i, v = h[q], x = i * s, yb = y0 + (j + 1) * dz;
    if (v == null || v <= SEA) { ctx.fillStyle = '#1b5568'; ctx.fillRect(x, y0 + j * dz, s + .6, dz + .6); continue; }
    const t = Math.min(j, n - 2) * (n - 1) * 2 + Math.min(i, n - 2) * 2, c = pal[plan.mat?.[t]] || pal[0];
    const gx = (h[q - 1] ?? v) - (h[q + 1] ?? v), gz = (h[q - n] ?? v) - (h[q + n] ?? v), l = Math.max(.42, Math.min(1.18, .8 + gx * .035 + gz * .03));
    const b = cls[q] === 1 ? [.93, .82, .62] : cls[q] === 2 ? [.35, .33, .36] : c;
    ctx.fillStyle = `rgb(${b[0] * l * 255 | 0},${b[1] * l * 255 | 0},${b[2] * l * 255 | 0})`;
    ctx.fillRect(x, yb - dz - v * k, s + .6, v * k + dz + .6);
  }
}

export function mountMountainEvolve({ request, status, sceneId }) {
  if (document.getElementById('mountain-evolve')) return null;
  document.head.append(Object.assign(el('style'), { textContent: CSS }));
  const root = el('section'); root.id = 'mountain-evolve'; root.setAttribute('aria-label', '山形进化墙');
  const breedBtn = el('button', '🧬 繁殖第 1 代', 'primary'), revertBtn = el('button', '回到原山'), adoptBtn = el('button', '✓ 采用正在看的这座'), count = el('span', '', 'muted');
  const head = el('div', undefined, 'ev-head'); head.append(el('h3', '山形进化墙'), count, el('span', '', 'grow'), breedBtn, revertBtn, adoptBtn);
  const sub = el('p', '点一座候选山，实景里的山当场换成它。喜欢的点「留种」，再繁殖下一代：下一代从留种的山交叉变异而来，留种的原样保留，所以每一代的最好成绩不会倒退。', 'ev-sub');
  const line = el('div', undefined, 'ev-line'), wall = el('div', undefined, 'ev-wall');
  root.append(head, sub, line, wall); adoptBtn.disabled = revertBtn.disabled = true;
  (document.getElementById('gscene-workshop') || document.getElementById('mountain-workshop')).before(root);

  let field = null, topRef = 60, generation = 0, pop = [], busy = false, live = null, worker = null, runId = 0;
  const seeds = new Map(), history = [], seed0 = (Date.now() % 100000) + 1;
  const taste = () => { try { return JSON.parse(localStorage.getItem(TASTE_KEY) || '[]'); } catch { return []; } };
  const remember = (c) => { const t = taste().filter((x) => JSON.stringify(x.genome) !== JSON.stringify(c.genome)); t.unshift({ genome: c.genome, score: c.score, metrics: c.metrics, scene: sceneId?.(), at: Date.now() }); try { localStorage.setItem(TASTE_KEY, JSON.stringify(t.slice(0, 12))); } catch {} };
  const say = (t) => status?.(t);

  async function probe() {
    if (field) return field;
    const deadline = Date.now() + 240000; let r;
    for (;;) { r = await request('mountain.probe', { id: sceneId?.() }).catch((e) => ({ ok: false, reason: e.message })); if (r.ok || !/尚未就绪/.test(String(r.reason || '')) || Date.now() > deadline) break; await new Promise((res) => setTimeout(res, 3000)); }
    if (!r.ok) throw Error(r.reason || '这个场景不支持山形管线');
    field = r.field; topRef = Math.max(40, r.site?.top || 60) * 1.15; return field;
  }
  function card(c) {
    const d = el('div', undefined, 'ev-card' + (c.score < 0 ? ' bad' : '')), cv = el('canvas'); cv.width = 330; cv.height = 240; d.dataset.id = c.id;
    drawRelief(cv, c.plan, field, topRef);
    const tag = { baseline: '基线', parent: '上代留种', taste: '你的口味', explore: '探索', child: '后代' }[c.origin] || c.origin;
    const meta = el('div', undefined, 'ev-meta'), m = c.metrics, diff = describeGenome(c.genome);
    meta.append(el('b', c.score < 0 ? '未过硬检查' : `主峰 ${m.prominence.toFixed(0)} m · 中等坡 ${pc(m.mid)} · 竖崖 ${pc(m.cliff)}`), el('br'));
    if (c.score < 0) meta.append(el('span', c.hard.join('、'), 'ev-fail'));
    else meta.append(el('span', diff.length ? diff.slice(0, 3).map((x) => `${x.label.replace(/（.*）/, '')} ${x.from}→${x.to}`).join(' · ') + (diff.length > 3 ? ` 等 ${diff.length} 处` : '') : '默认参数', 'ev-diff'));
    const star = el('button', '☆ 留种', 'ev-star');
    d.append(cv, el('span', tag, 'ev-tag'), el('span', c.score < 0 ? '✗' : String(c.score), 'ev-score'), meta, star);
    if (c.score >= 0) {
      d.onclick = () => show(c, d);
      star.onclick = (e) => { e.stopPropagation(); if (seeds.has(c.id)) { seeds.delete(c.id); d.classList.remove('seed'); star.textContent = '☆ 留种'; } else { if (seeds.size >= 3) return say('最多留 3 座做亲本。'); seeds.set(c.id, c); d.classList.add('seed'); star.textContent = '★ 已留种'; remember(c); } refreshBtn(); };
    } else star.remove();
    return d;
  }
  async function show(c, d) {
    try { const r = await request('mountain.preview', { id: sceneId?.(), plan: c.plan }); live = c; wall.querySelectorAll('.live').forEach((x) => x.classList.remove('live')); d.classList.add('live'); adoptBtn.disabled = revertBtn.disabled = false;
      say(`实景已换成第 ${c.generation} 代 ${c.id}：主峰 ${c.metrics.prominence.toFixed(0)} m · 中等坡 ${pc(c.metrics.mid)} · 竖崖 ${pc(c.metrics.cliff)}${c.warn.length ? ' · 留意：' + c.warn.join('、') : ''}${r?.triangles ? ' · ' + r.triangles + ' 面' : ''}`); }
    catch (e) { say('实景预览失败：' + e.message); }
  }
  function refreshBtn() { breedBtn.textContent = busy ? '繁殖中…' : `🧬 繁殖第 ${generation + 1} 代${generation ? seeds.size ? `（${seeds.size} 座留种）` : '（没留种：取最好的 2 座）' : ''}`; breedBtn.disabled = busy; }
  function drawLine() {
    line.replaceChildren(el('span', '代际：'));
    history.forEach((h, i) => { if (i) line.append(el('span', '→')); const g = el('span', undefined, 'ev-gen'); g.append(`第 ${h.generation} 代 最好 `, el('b', String(h.best)), ` · ${h.ok}/${h.total} 过硬检查`); line.append(g); });
    if (history.length > 1) { const a = history[0].best, b = history.at(-1).best; line.append(el('span', `　比第 1 代 ${b >= a ? '+' : ''}${(b - a).toFixed(1)} 分`)); }
  }
  async function breedNext() {
    if (busy) return; busy = true; refreshBtn();
    try {
      await probe();
      const ranked = pop.filter((c) => c.score >= 0).sort((a, b) => b.score - a.score), parents = generation ? (seeds.size ? [...seeds.values()] : ranked.slice(0, 2)).map((c) => c.genome) : [];
      generation++; pop = []; seeds.clear(); wall.replaceChildren(); count.textContent = `第 ${generation} 代 · 计算中`;
      worker ||= new Worker(new URL('./mountain/evolve-worker.js?v=evolve-r1', import.meta.url), { type: 'module' });
      const id = ++runId;
      await new Promise((resolve, reject) => {
        worker.onerror = (e) => reject(Error(e.message || '进化 Worker 出错'));
        worker.onmessage = (e) => { const m = e.data; if (m.runId !== id) return; if (m.error) return reject(Error(m.error)); if (m.done) return resolve();
          pop.push(m.candidate); wall.append(card(m.candidate)); count.textContent = `第 ${generation} 代 · ${pop.length} 座`; };
        worker.postMessage({ runId: id, field, opts: { parents, favourites: generation === 1 ? taste().map((t) => t.genome) : [], count: 12, generation, seed: seed0 } });
      });
      const ok = pop.filter((c) => c.score >= 0); history.push({ generation, best: ok.length ? Math.max(...ok.map((c) => c.score)) : -1, ok: ok.length, total: pop.length }); drawLine();
      root.dataset.generation = String(generation); root.dataset.ready = '1';
      say(`第 ${generation} 代：${pop.length} 座候选，${ok.length} 座过硬检查。点卡片在实景里看。`);
    } catch (e) { say('繁殖失败：' + e.message); count.textContent = '失败：' + e.message; }
    busy = false; refreshBtn();
  }
  breedBtn.onclick = breedNext;
  revertBtn.onclick = async () => { await request('mountain.revert').catch(() => {}); live = null; wall.querySelectorAll('.live').forEach((x) => x.classList.remove('live')); adoptBtn.disabled = revertBtn.disabled = true; say('已回到原山。'); };
  adoptBtn.onclick = async () => { if (!live) return; try { const r = await request('mountain.commit', { id: sceneId?.(), plan: live.plan }); remember(live); say(r?.note || `已采用 ${live.id}（存本机）。`); } catch (e) { say('采用失败：' + e.message); } };
  refreshBtn();
  return { root, breedNext, state: () => ({ generation, candidates: pop.length, seeds: seeds.size, live: live?.id || null, history }) };
}
