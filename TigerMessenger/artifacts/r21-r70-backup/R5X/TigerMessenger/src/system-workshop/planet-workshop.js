/**
 * 球系统工坊：管线作用在「星球配方」上。改造 Worker 编译候选星球（compilePlanetV8，8 个阶段），
 * 验证 Worker 独立复算 + 编译器检查 + 场景锚点 + 预算。定稿写入 tm.planet.final.v1，
 * 游戏的星球运行时（src/world/planetV8/runtime.js）启动时读取它。
 */
import { describePlanetCapabilities, DEFAULT_PLANET_RECIPE, FINAL_KEY, cleanRecipe } from './planet/capabilities.js?v=sys-r15';
import { mountTierWorkshop } from './tier-workshop.js?v=preload-r1';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const strip = (s) => (s ? { ...s, raster: undefined } : s);
export const finalPlanetRecipe = () => cleanRecipe(read(FINAL_KEY, null)?.recipe || DEFAULT_PLANET_RECIPE);

function mapCanvas(label, onPick) {
  const box = el('figure', undefined, 'planet-map'), c = el('canvas'); c.width = 384; c.height = 192;
  let last = null;
  c.title = '点场景锚点：实景镜头转过去';
  c.onclick = (e) => { if (!last?.ok || !onPick) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * c.width, y = (e.clientY - r.top) / r.height * c.height;
    const X = (lon) => (lon + Math.PI) / (2 * Math.PI) * c.width, Y = (lat) => (0.5 - lat / Math.PI) * c.height;
    let best = null, bd = 1e9; for (const m of last.landmarks) { const d = Math.hypot(X(m.lon) - x, Y(m.lat) - y); if (d < bd) { bd = d; best = m; } }
    const lon = best && bd < 24 ? best.lon : (x / c.width) * 2 * Math.PI - Math.PI, lat = best && bd < 24 ? best.lat : (0.5 - y / c.height) * Math.PI; onPick(lon, lat, best && bd < 24 ? best : null); };
  const cap = el('figcaption', label); box.append(c, cap);
  const draw = (s) => {
    last = s; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    if (!s?.ok) { g.fillStyle = '#2a1d1d'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#f1a397'; g.font = '13px system-ui'; g.fillText(s ? '编译失败：停在 ' + s.stage : '等待扫描', 14, 26); return; }
    const { W, H, px } = s.raster, img = new ImageData(new Uint8ClampedArray(px), W, H), off = new OffscreenCanvas(W, H);
    off.getContext('2d').putImageData(img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(off, 0, 0, c.width, c.height);
    const X = (lon) => (lon + Math.PI) / (2 * Math.PI) * c.width, Y = (lat) => (0.5 - lat / Math.PI) * c.height;
    g.fillStyle = '#ffffffaa'; for (const k of s.clouds) { g.beginPath(); g.arc(X(k.lon), Y(k.lat), 2, 0, 7); g.fill(); }
    g.font = '9px system-ui';
    for (const m of s.landmarks) {
      const drowned = !m.water && m.height <= s.recipe.seaLevel;
      g.fillStyle = drowned ? '#ff7766' : m.water ? '#9fd4ff' : '#ffe08a'; g.beginPath(); g.arc(X(m.lon), Y(m.lat), 3.5, 0, 7); g.fill();
      g.fillStyle = '#0b1214cc'; const t = m.id; g.fillRect(X(m.lon) + 5, Y(m.lat) - 9, g.measureText(t).width + 4, 12); g.fillStyle = drowned ? '#ff9a8c' : '#e8efe9'; g.fillText(t, X(m.lon) + 7, Y(m.lat));
    }
  };
  return { box, draw, caption: (t) => (cap.textContent = t) };
}

export function mountPlanetWorkshop({ host, sideHost, request, reloadGame, onConnect, isConnected, lookAt, openSource, status }) {
  const caps = describePlanetCapabilities();
  const pick = (lon, lat, m) => { lookAt?.(lon, lat); status?.(m ? `实景镜头转向场景锚点 ${m.id}` : '实景镜头转向所点位置'); };
  const now = mapCanvas('当前星球', pick), cand = mapCanvas('候选', pick);
  const root = el('div', undefined, 'planet-preview'), stats = el('p', '', 'muted planet-stats'), layers = el('p', '', 'muted planet-layers');
  const shots = el('div', undefined, 'planet-shots'), shotA = el('figure'), shotB = el('figure');
  shotA.append(el('img'), el('figcaption', '候选前 · 同镜头')); shotB.append(el('img'), el('figcaption', '候选后 · 同镜头')); shots.append(shotA, shotB); shots.hidden = true;
  root.append(layers, now.box, cand.box, stats, shots);
  let base = null, game = null, live = null;   // live：实景正在显示的候选配方
  const fmt = (s) => s?.ok ? `陆地 ${Math.round(s.stats.land * 100)}% · 湖 ${s.stats.lakes} · 路线 ${s.stats.routes} · 云 ${s.stats.clouds} · 植被 ${s.stats.vegetation} · 切图 ${s.stats.charts} · ${s.ms} ms` : '';
  const readState = async () => { try { return await request('planet.state'); } catch { return null; } };
  const changedVs = (recipe, ref) => { const out = {}; for (const k of ['seed', 'subdivision', 'chartLimit', 'resolution', 'seaLevel']) if (Number.isFinite(recipe[k]) && recipe[k] !== ref[k]) out[k] = recipe[k]; return out; };
  const shot = async () => { try { return (await request('screenshot')).png; } catch { return null; } };
  const waitConnected = () => new Promise((res) => onConnect.push(res));
  async function showInGame(c, { setNote, rerender }) {
    if (!game) throw Error('游戏还没连接，读不到实景星球的配方');
    setNote('截取候选前的实景（同一镜头）…');
    shots.hidden = false; shotA.querySelector('img').src = (await shot()) || ''; shotB.querySelector('img').removeAttribute('src');
    const preview = changedVs(c.run.recipe, game.gameRecipe);
    setNote('用候选配方重新加载实景游戏（游戏启动需要一段时间）…');
    live = c.run.recipe; const back = waitConnected(); reloadGame({ planetPreview: JSON.stringify(preview) }); await back;
    await new Promise((r) => setTimeout(r, 2500));
    shotB.querySelector('img').src = (await shot()) || '';
    setNote('实景正在显示候选星球。对照下方同镜头截图；写入前可点「恢复实景」。'); rerender();
  }
  async function restoreGame(setNote) { if (!live) return; live = null; setNote?.('恢复实景（重新加载游戏）…'); const back = waitConnected(); reloadGame({}); await back; setNote?.('实景已恢复为当前星球。'); }
  // 海面统一：直接在实景里叠加（不重载游戏），同镜头前后截图 + 实景检查（距离场 / 海面形状 / 圣城海湾 / 莫西斯湖 / 倒影 / 帧耗时）
  async function previewSea(c) {
    const add = (id, name, status, detail, blame) => c.verification.checks.push({ id, name, status, detail, ...(blame ? { blame } : {}) });
    if (!isConnected()) { add('sea-live', '实景海面', 'warn', '游戏没连接：海面样式没法预览，执行时只算了配方'); return; }
    const cost0 = await request('sea.cost', { ms: 1200 }).catch(() => null);
    shots.hidden = false; shotA.querySelector('figcaption').textContent = '海面统一前 · 同镜头'; shotB.querySelector('figcaption').textContent = '海面统一后 · 同镜头';
    shotA.querySelector('img').src = (await shot()) || ''; shotB.querySelector('img').removeAttribute('src');
    let r;
    try { r = await request('sea.preview', { style: c.run.sea }); }
    catch (e) { add('sea-live', '实景海面', 'fail', '叠加失败：' + e.message, ['planet.sea-shore-field']); c.verification.status = 'fail'; return; }
    await new Promise((res) => setTimeout(res, 800));
    shotB.querySelector('img').src = (await shot()) || '';
    const cost1 = await request('sea.cost', { ms: 1200 }).catch(() => null);
    const f = r.field || {};
    add('sea-field', '岸带距离场', f.shoreTexels > 0 ? 'pass' : 'fail', `${(f.res || []).join('×')} 经纬格 · 每格约 ${f.metersPerTexel} 米 · 量了 ${f.landMeshes} 个陆地网格 · 陆地占 ${Math.round((f.landShare || 0) * 100)}% · 岸边格 ${f.shoreTexels} · ${f.ms} ms`, ['planet.sea-shore-field']);
    add('sea-geometry', '海面形状', r.geometryUnchanged ? 'pass' : 'fail', r.geometryUnchanged ? '海面网格没有改动（只改外观）' : '海面网格变了');
    add('sea-bay', '高山圣城海湾', 'pass', r.citadelBay);
    add('sea-morris', '莫西斯湖', 'pass', '不参与：湖面材质和倒影都不碰');
    if (c.run.sea.reflection?.on) add('sea-reflection', '倒影', r.reflection?.meshes ? 'pass' : 'warn', r.reflection?.meshes ? `${r.reflection.meshes} 个岸边网格（候选 ${r.reflection.candidates}）· ${r.reflection.tris} 三角形 · ${r.reflection.materials} 种颜色` : '没有找到底部贴着海面的建筑', ['planet.sea-reflection']);
    if (cost0 && cost1) {
      const up = cost0.medianMs > 0 ? cost1.medianMs / cost0.medianMs - 1 : 0;
      add('sea-cost', '帧耗时', up > 0.6 ? 'fail' : up > 0.25 ? 'warn' : 'pass', `${cost0.medianMs} → ${cost1.medianMs} ms/帧（中位数）· 绘制调用 ${cost0.calls} → ${cost1.calls}`, ['planet.sea-reflection', 'planet.sea-waves']);
    }
    const sts = c.verification.checks.map((x) => x.status);
    c.verification.status = sts.includes('fail') ? 'fail' : sts.includes('warn') ? 'warn' : 'pass';
  }
  // 天气：直接改实景的天气参数（不重载），同镜头前后截图 + 检查
  async function previewWeather(c) {
    const add = (id, name, status, detail, blame) => c.verification.checks.push({ id, name, status, detail, ...(blame ? { blame } : {}) });
    if (!isConnected()) { add('weather-live', '实景天气', 'warn', '游戏没连接：天气没法预览'); return; }
    const cost0 = await request('sea.cost', { ms: 1000 }).catch(() => null);
    shots.hidden = false; shotA.querySelector('figcaption').textContent = '天气之前 · 同镜头'; shotB.querySelector('figcaption').textContent = '天气之后 · 同镜头';
    shotA.querySelector('img').src = (await shot()) || ''; shotB.querySelector('img').removeAttribute('src');
    let r; try { r = await request('weather.preview', { style: c.run.weather }); } catch (e) { add('weather-live', '实景天气', 'fail', '天气没生效：' + e.message, ['planet.weather-kind']); c.verification.status = 'fail'; return; }
    await new Promise((res) => setTimeout(res, 2500));   // 雨雪粒子、雾需要一点时间落下 / 渐入
    shotB.querySelector('img').src = (await shot()) || '';
    const st = await request('weather.state').catch(() => null);
    const cost1 = await request('sea.cost', { ms: 1000 }).catch(() => null);
    const ok = st && st.params.weather === (c.run.weather.kind | 0);
    add('weather-live', '实景天气', ok ? 'pass' : 'fail', ok ? `${r.applied.kind} · 风 ${r.applied.wind} · 雾 ${r.applied.fog}${r.followCamera ? ' · 雨雪下在工坊镜头前方（游玩时在玩家周围）' : ''}` : '游戏里的天气参数没有变成候选值', ['planet.weather-kind']);
    if (c.run.weather.time?.on) add('light-time', '时刻', 'pass', `时刻 ${c.run.weather.time.at}（游戏现在 ${st?.params?.timeOfDay ?? '?'}）· ${c.run.weather.time.speed ? '昼夜速度 ' + c.run.weather.time.speed : '停在这个时刻'}`, ['planet.light-time']);
    if (c.run.weather.light) { const L = st?.light; add('light', '光照', L ? 'pass' : 'warn', L ? `直射 ×${L.sun} · ${L.shadowType}${L.shadows ? '' : '（投影关）'} · 天光 ×${L.ambient} · 反弹 ${L.bounce} · ${L.ao} · ${L.ink} · ${L.rock} · 视图 ${L.view} · 饱和 ${L.saturation} · 曝光 ${L.exposure}` : '光照样式模块没装上'); }
    if (c.run.weather.snow?.on) add('weather-snow-cover', '积雪', st?.morrisStage ? 'pass' : 'warn', st?.morrisStage ? `莫西斯湖城镇积雪 ${c.run.weather.snow.amount}（正在盖上：${st.snowCover}）` : '没找到莫西斯湖城镇（__tmMorrisStage），积雪没处可盖', ['planet.weather-snow-cover']);
    if (c.run.weather.clouds?.on) add('weather-clouds', '云', st?.cloudMesh ? 'pass' : 'warn', st?.cloudMesh ? `阴云 ${c.run.weather.clouds.gloom} · 云影用了离镜头最近的 ${st.cloudShadows} 朵云（投在海面上）` : '游戏里没有找到 impostor 云（planet-v8-cloud-impostors）', ['planet.weather-clouds']);
    if (c.run.weather.fog?.on) add('weather-fog', '天气雾', st?.fog > 0.01 ? 'pass' : 'warn', st?.fog > 0.01 ? `已渐入（当前 ${st.fog}，目标 ${c.run.weather.fog.density}）` : '雾还没渐入', ['planet.weather-fog']);
    if (cost0 && cost1) { const up = cost0.medianMs > 0 ? cost1.medianMs / cost0.medianMs - 1 : 0; add('weather-cost', '帧耗时', up > 0.6 ? 'fail' : up > 0.25 ? 'warn' : 'pass', `${cost0.medianMs} → ${cost1.medianMs} ms/帧（中位数）`, ['planet.weather-kind']); }
    const sts = c.verification.checks.map((x) => x.status); c.verification.status = sts.includes('fail') ? 'fail' : sts.includes('warn') ? 'warn' : 'pass';
  }
  const view = mountTierWorkshop({
    host, sideHost, tier: 'planet', caps, openSource, status,
    intro: '球系统管线作用在整颗星球的配方上（种子 / 海平面 / 网格 / 切图 / 分辨率）。黄点是场景锚点，点一下实景镜头就转过去。',
    goalHint: '例如：海平面抬高一点，让海岸更曲折',
    scopeText: () => game ? `整颗星球（实景配方 seed ${game.gameRecipe.seed}${Object.keys(game.finalOverride || {}).length ? ' · 已有定稿覆盖' : ''}）` : '整颗星球',
    agentConfig: {
      transformUrl: new URL('./planet/transform-worker.js?v=engine-r1', import.meta.url), verifyUrl: new URL('./planet/verify-worker.js?v=sys-r15', import.meta.url),
      timeouts: { run: { idle: 20000, total: 60000 } },
      hooks: {
        input: async () => {
          game = await readState();
          if (game?.gameRecipe) {
            const L = game.layers || {};
            layers.textContent = `实景游戏渲染：编译地形 ${L.terrain ? '开' : '关'} · 曲面海 ${L.water ? '开' : '关'} · 云 ${L.clouds ? '开' : '关'}（${L.version || ''}）` + (L.terrain ? '' : '。默认游戏的地形是手工搭的，配方改动在实景里主要体现在云和海；完整编译地形需用 planetTerrainV1=1 打开游戏。');
            view?.renderScope();
            return { recipe: cleanRecipe({ ...game.gameRecipe, ...(game.finalOverride || {}) }) };
          }
          layers.textContent = '游戏未连接：使用本机记录的定稿配方编译，实景对照不可用。';
          return { recipe: finalPlanetRecipe() };
        },
        scanMsg: (i) => ({ recipe: i.recipe }),
        runMsg: (i, steps) => ({ recipe: i.recipe, steps }),
        verifyMsg: (i, scan, run) => ({ before: strip(scan.summary), after: strip(run.summary) }),
        preview: async (c) => {
          cand.draw(c.run.summary); cand.caption('候选 · ' + fmt(c.run.summary));
          if (c.run.sea) await previewSea(c);
          if (c.run.weather) await previewWeather(c);
          return {};
        },
        compare: async (c, on) => { cand.draw(on ? base : c.run.summary); cand.caption(on ? '（对照：当前星球）' : '候选 · ' + fmt(c.run.summary)); if (c.run.sea && isConnected()) await request('sea.compare', { on }).catch(() => {}); if (c.run.weather && isConnected()) await request('weather.compare', { on }).catch(() => {}); },
        revert: async (c) => { cand.draw(null); cand.caption('候选'); if (c?.run?.sea && isConnected()) await request('sea.revert').catch(() => {}); if (c?.run?.weather && isConnected()) await request('weather.revert').catch(() => {}); await restoreGame(); },
        commit: async (c) => {
          const changed = changedVs(c.run.recipe, game?.gameRecipe || DEFAULT_PLANET_RECIPE);
          const row = { at: Date.now(), recipe: c.run.recipe, changed, goal: c.goal, steps: c.steps, verify: c.verification.status, hashes: c.run.summary.hashes };
          const hist = read('tm.planet.versions.v1', []); hist.push(row); localStorage.setItem('tm.planet.versions.v1', JSON.stringify(hist.slice(-30)));
          localStorage.setItem(FINAL_KEY, JSON.stringify(row));
          if (c.run.sea) { await request('sea.commit', { style: c.run.sea }); localStorage.setItem('tm.sea.style.final.v1', JSON.stringify(c.run.sea)); }
          if (c.run.weather) { await request('weather.commit', { style: c.run.weather }); localStorage.setItem('tm.weather.style.final.v1', JSON.stringify(c.run.weather)); }
          if (live) { live = null; const back = waitConnected(); reloadGame({}); await back; }
          return { recipe: c.run.recipe, changed, sea: !!c.run.sea, weather: !!c.run.weather };
        },
        draft: async (c) => { const d = read('tm.planet.drafts.v1', []); d.push({ at: Date.now(), recipe: c.run.recipe, goal: c.goal, verify: c.verification.status }); localStorage.setItem('tm.planet.drafts.v1', JSON.stringify(d.slice(-30))); return { count: d.length }; },
      },
    },
    preview: { root, onScan: (s) => { base = s.summary; now.draw(base); now.caption('当前星球 · ' + fmt(base)); stats.textContent = '配方：' + Object.entries(base.recipe).map(([k, v]) => k + ' ' + v).join(' · '); }, scanNote: (s) => `星球 ${s.summary.ms} ms 编译完成。` },
    actions: {
      commitLabel: '✓ 定稿进入游戏',
      committed: (r) => (r.sea ? '海面统一已定稿：游戏启动、场景加载完后自动叠加。' : '') + (r.weather ? '天气已定稿：游戏启动时生效。' : '') + (Object.keys(r.changed).length ? `已定稿：游戏启动时覆盖 ${Object.entries(r.changed).map(([k, v]) => k + '=' + v).join(' ')}。` : (r.sea || r.weather ? '' : '已定稿：与游戏当前配方相同，没有覆盖项。')),
      draft: true, drafted: (r) => `已存草稿（共 ${r.count} 份）。`,
      extra: (c, ui) => {
        if (c.verification.status === 'fail' || !isConnected()) return [];
        if (!Object.keys(changedVs(c.run.recipe, game?.gameRecipe || DEFAULT_PLANET_RECIPE)).length) return [];   // 只有海面能力：已经直接在实景里预览，不用重载
        if (live) return [view.btn('恢复实景', () => restoreGame(ui.setNote).then(ui.rerender))];
        return [view.btn('在实景中预览（重载游戏）', () => showInGame(c, ui).catch((e) => ui.setNote('实景预览失败：' + e.message)))];
      },
    },
  });
  return view;
}
