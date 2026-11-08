/**
 * scene-picker.js — 「当前场景」下拉：列出游戏里登记的全部场景。
 *   莫西斯湖：场景编辑插件（管线 / 物件 / 风格 / 草稿 / 定稿）
 *   十二门徒 / 高山圣城 / 水晶城：游戏自带的构建面板（「打开构建面板」）
 *   其余：通用场景编辑插件（generic-scene.js）——物件自动登记、物件管线、对象目录、存档回放；体素场景管线暂不适用
 * 选择不改任何场景数据。
 */
const $ = (id) => document.getElementById(id);
const TAG = { workbench: '完整插件', generic: '通用插件', 'morris-target': '通用插件 + 构建面板', 'editor:citadel': '通用插件 + 构建面板', 'editor:crystal': '通用插件 + 构建面板', view: '仅查看' };

export function mountScenePicker({ request, onConnect, status, onChange }) {
  const select = $('scene'), hint = select.parentElement.querySelector('span');
  const editorB = document.createElement('button'); editorB.type = 'button'; editorB.textContent = '打开构建面板'; editorB.hidden = true; select.after(editorB);
  let scenes = [{ id: 'morris-lake', label: '莫西斯湖 · 湖上建筑群', edit: 'workbench' }];
  window.__tmCurrentScene = 'morris-lake';
  const current = () => scenes.find((s) => s.id === window.__tmCurrentScene) || scenes[0];
  function render() {
    select.replaceChildren();
    for (const s of scenes) { const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.label}（${TAG[s.edit] || s.edit}）`; select.append(o); }
    select.value = current().id; reflect();
  }
  function reflect() {
    const s = current();
    document.body.dataset.sceneEdit = s.edit === 'workbench' ? 'workbench' : 'view';
    editorB.hidden = !['morris-target', 'editor:citadel', 'editor:crystal'].includes(s.edit);
    if (hint) hint.textContent = s.edit === 'workbench' ? '完整场景插件 · 同源本机存档' : s.plugin === 'generic' ? '通用场景插件 · 物件可编辑' : '游戏自带构建面板';
    let banner = $('scene-banner');
    if (!banner) { banner = document.createElement('div'); banner.id = 'scene-banner'; banner.className = 'scene-banner'; $('scene-pane').before(banner); }
    banner.hidden = s.edit === 'workbench';
    banner.replaceChildren();
    if (s.edit === 'workbench') { onChange?.(s); return; }
    const p = document.createElement('p');
    p.textContent = s.plugin === 'generic'
      ? `「${s.label}」接入了通用场景编辑插件：场景管线作用在它的材质色表上（风格统一 / 色调 / 风格包），物件管线、对象目录、改名、草稿与定稿都作用于这个场景。它不是体素世界，体素能力（石拱、灯塔等）只用于莫西斯湖。`
      : `「${s.label}」用游戏自带的构建面板编辑（点「打开构建面板」）。`;
    banner.append(p);
    if (s.plugin === 'generic') request('scenes.status', { id: s.id }).then((st) => {
      const ul = document.createElement('ul'); ul.className = 'verify-checks';
      for (const c of st.checks || []) { const li = document.createElement('li'); li.className = 'check-' + (c.passed === true ? 'pass' : c.passed === false ? 'fail' : 'warn'); const b = document.createElement('b'); b.textContent = (c.passed === true ? '✓ ' : c.passed === false ? '✗ ' : '? ') + c.name; const sm = document.createElement('small'); sm.textContent = c.detail || ''; li.append(b, sm); ul.append(li); }
      banner.append(ul);
    }).catch(() => {});
    onChange?.(s);
  }
  select.onchange = async () => {
    const id = select.value, prev = window.__tmCurrentScene;
    window.__tmCurrentScene = id; reflect();
    try { await request(id === 'morris-lake' ? 'open' : 'scenes.focus', { id }); status?.(`实景切到：${current().label}`); }
    catch (e) { window.__tmCurrentScene = prev; render(); status?.('切换场景失败：' + e.message); }
  };
  editorB.onclick = () => request('scenes.editor', { id: window.__tmCurrentScene }).then((r) => status?.('已打开构建面板：' + (r?.label || ''))).catch((e) => status?.(e.message));
  // 游戏连上时其余场景可能还在加载（main.js 稍后才登记场景表）：轮询到列表稳定；点开下拉时也刷新一次
  const refresh = async () => { const list = await request('scenes.list'); if (Array.isArray(list) && list.length && list.length !== scenes.length) { scenes = list; render(); } return list?.length || 0; };
  onConnect.push(async () => {
    for (let i = 0; i < 40; i++) {
      try { if ((await refresh()) > 1) return; } catch {}
      await new Promise((r) => setTimeout(r, 3000));
    }
  });
  select.addEventListener('focus', () => refresh().catch(() => {}));
  render();
  return { current };
}
