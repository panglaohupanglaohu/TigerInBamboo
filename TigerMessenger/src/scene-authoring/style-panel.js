/**
 * style-panel.js — 场景工坊「风格」分区（父页面）：当前场景的风格包 + 本场景覆盖。
 * 改色即时预览（不保存）；「保存为本场景风格」写本机覆盖，并随「保存场景草稿」进草稿 / 定稿。
 */
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const BUILD_LABEL = { roof: '屋顶', roofAlt: '屋顶（次）', roofTrim: '屋檐', plaster: '灰泥墙', stone: '石材', stoneDark: '深石', band: '腰线', paving: '铺地', pavingAlt: '铺地（次）', lawn: '草坪', lawnAlt: '草坪（次）', tree: '树', treeLight: '树（亮）', trunk: '树干', steel: '钢', frame: '窗框', glass: '玻璃', door: '门', chimney: '烟囱', rail: '栏杆' };
const ROLE_LABEL = { botany: '湖岸植物', flora: '花卉', horse: '马', island: '岛', lake: '湖', princess: '公主', wildlife: '动物', townStage: '湖上建筑', landscape: '地形', landscapeDetails: '地形细节' };

export function mountStylePanel({ host, request, status }) {
  const box = el('details', undefined, 'style-dock'); box.id = 'style-dock';
  const sum = el('summary', '风格 · 风格包与本场景覆盖'); box.append(sum);
  const body = el('div', undefined, 'style-body'); box.append(body);
  host.append(box);
  let st = null, over = {}, timer = null;
  const say = (t) => { status(t); };
  const preview = () => { clearTimeout(timer); timer = setTimeout(async () => { try { st = await request('style.preview', { overrides: over }); draw(false); } catch (e) { say('风格预览失败：' + e.message); } }, 250); };
  const colorInput = (value, onChange) => { const i = el('input'); i.type = 'color'; i.value = value; i.oninput = () => onChange(i.value); return i; };

  function draw(full = true) {
    if (!st) return;
    if (!full) { head(); return; }
    body.replaceChildren();
    head();
    // 墙面色槽
    const walls = over.walls || st.base.walls;
    const wl = el('section', undefined, 'style-sec'); wl.append(el('h4', '湖上建筑 · 墙面 15 色槽'));
    const row = el('div', undefined, 'style-swatches');
    walls.forEach((c, i) => row.append(colorInput(c, (v) => { over.walls = [...(over.walls || st.base.walls)]; over.walls[i] = v; preview(); })));
    wl.append(row); body.append(wl);
    // 建筑固定色
    const bl = el('section', undefined, 'style-sec'); bl.append(el('h4', '建筑固定色'));
    const grid = el('div', undefined, 'style-grid');
    for (const [k, c] of Object.entries(st.base.build)) { const lab = el('label', BUILD_LABEL[k] || k); lab.append(colorInput(over.build?.[k] || c, (v) => { over.build = { ...(over.build || {}), [k]: v }; preview(); })); grid.append(lab); }
    bl.append(grid); body.append(bl);
    // 材质角色
    const rl = el('section', undefined, 'style-sec'); rl.append(el('h4', '材质角色（styleMat）'));
    const live = new Map(st.live.map((r) => [r.role, r.count]));
    for (const [role, r] of Object.entries(st.base.roles)) {
      const parts = role.split('.'), o = over.roles?.[role] || {};
      const line = el('div', undefined, 'style-role');
      line.append(el('span', `${ROLE_LABEL[parts[1]] || parts[1]} · ${parts.slice(2).join('.')}${live.has(role) ? '' : '（本场景未出现）'}`));
      const sw = el('span', undefined, 'style-swatches');
      if (r.color) sw.append(colorInput(o.color || r.color, (v) => { over.roles = { ...(over.roles || {}), [role]: { ...o, color: v } }; preview(); }));
      if (r.colorMap) for (const c of Object.keys(r.colorMap)) sw.append(colorInput(o.colorMap?.[c] || c, (v) => { const cur = over.roles?.[role] || {}; over.roles = { ...(over.roles || {}), [role]: { ...cur, colorMap: { ...(cur.colorMap || {}), [c]: v } } }; preview(); }));
      line.append(sw); rl.append(line);
    }
    body.append(rl);
  }
  function head() {
    let h = body.querySelector('.style-head');
    if (!h) { h = el('div', undefined, 'style-head'); body.prepend(h); }
    h.replaceChildren();
    h.append(el('p', `风格包：${st.pack.name}${st.pack.refs?.length ? '（参考 ' + st.pack.refs.join('、') + '）' : ''}。${st.dirty ? '有未保存的改动（只在实景预览）。' : Object.keys(st.saved || {}).length ? '已保存本场景覆盖。' : '与风格包一致。'}`, 'muted'));
    const b = (t, fn, cls) => { const x = el('button', t, cls); x.type = 'button'; x.onclick = async () => { try { st = await fn(); over = structuredClone(st.overrides || {}); draw(); } catch (e) { say(e.message); } }; return x; };
    h.append(
      b(st.comparing ? '■ 结束对照' : '对照原始参数', async () => { const r = await request('style.compare', { on: !st.comparing }); say(r.comparing ? '正在显示原始参数（未套风格包与覆盖）。' : '已回到当前风格。'); return r; }),
      b('保存为本场景风格', async () => { const r = await request('style.save'); say('本场景风格覆盖已保存到本机；「保存场景草稿」会一并存入草稿。'); return r; }, 'primary'),
      b('放弃未保存改动', async () => { const r = await request('style.revert'); say('已回到上次保存的风格。'); return r; }),
      b('清空覆盖（回到风格包）', async () => { const r = await request('style.reset'); say('已清空覆盖（未保存；点「保存」才生效）。'); return r; }));
  }
  async function load() { try { st = await request('style.get'); over = structuredClone(st.overrides || {}); draw(); } catch (e) { body.replaceChildren(el('p', '此场景尚未接入风格包：' + e.message, 'muted')); } }
  box.addEventListener('toggle', () => { if (box.open && !st) load(); });
  return { load };
}
