/**
 * 通用场景的「场景管线」：书店镇、湖沼、苔庭……这些场景不是体素世界，场景管线作用在场景的材质色表上
 * （风格统一 / 整体色调 / 套用风格包），同一套 super agent：改造 Worker → 验证 Worker → 实景预览 → 写入。
 * 旁边是这个场景的「风格（逐个材质）」和「草稿 / 定稿」面板（参考 GenAIWorkPipeline：交付前人工确认，定稿 = 游戏启动用的版本）。
 */
import { describeGsceneCapabilities } from './gscene/capabilities.js?v=sys-r11';
import { mountTierWorkshop } from './tier-workshop.js?v=sys-r11';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };

export function mountGsceneWorkshop({ host, sideHost, request, openSource, status, sceneLabel }) {
  const caps = describeGsceneCapabilities();
  const root = el('div', undefined, 'gscene-side');
  const swatches = el('div', undefined, 'gscene-swatches'), draftsBox = el('div', undefined, 'gscene-drafts');
  root.append(el('h4', '风格 · 逐个材质'), el('p', '点色块改颜色，先预览，确认后保存；别的场景共用的材质会先为本场景复制一份。', 'muted'), swatches, el('h4', '草稿 / 定稿'), draftsBox);
  let manual = {};
  async function drawSwatches() {
    let st; try { st = await request('gscene.style.get'); } catch (e) { swatches.textContent = e.message; return; }
    swatches.replaceChildren();
    const grid = el('div', undefined, 'swatch-grid');
    for (const m of st.materials.slice(0, 120)) {
      const lab = el('label', undefined, 'swatch'); lab.title = `${m.name} · 用于 ${m.uses} 处${m.shared ? ' · 其他场景也在用' : ''}`;
      const inp = el('input'); inp.type = 'color'; inp.value = manual[m.id] || m.color;
      inp.oninput = () => { manual[m.id] = inp.value; request('gscene.style.preview', { colors: manual }).catch((e) => status?.(e.message)); };
      lab.append(inp, el('small', m.name.slice(0, 10))); grid.append(lab);
    }
    const row = el('div', undefined, 'gscene-actions');
    const mk = (t, fn, cls) => { const b = el('button', t, cls); b.type = 'button'; b.onclick = () => fn().catch((e) => status?.(e.message)); return b; };
    row.append(mk('保存风格', async () => { await request('gscene.style.save'); manual = {}; status?.('风格已保存（本机，可存进草稿）'); drawSwatches(); }, 'primary'),
      mk('放弃预览', async () => { await request('gscene.style.revert'); manual = {}; drawSwatches(); }),
      mk('恢复原色', async () => { await request('gscene.style.reset'); manual = {}; drawSwatches(); }));
    swatches.append(el('small', `${st.materials.length} 种材质 · 已覆盖 ${Object.keys(st.saved).length} 种`, 'muted'), grid, row);
  }
  async function drawDrafts() {
    let d; try { d = await request('gscene.drafts.list'); } catch (e) { draftsBox.textContent = e.message; return; }
    draftsBox.replaceChildren();
    const goal = el('input'); goal.placeholder = '这一版的说明（可空）';
    const save = el('button', '保存草稿', 'primary'); save.type = 'button';
    save.onclick = async () => { try { await request('gscene.drafts.save', { goal: goal.value }); status?.('已保存草稿（物件改动 + 风格 + 物件名）'); drawDrafts(); } catch (e) { status?.(e.message); } };
    draftsBox.append(el('div', undefined, 'gscene-actions'));
    draftsBox.lastChild.append(goal, save);
    if (!d?.rows?.length) { draftsBox.append(el('p', '还没有草稿。定稿 = 人工确认后的版本，游戏启动时用它。', 'muted')); return; }
    const ul = el('ul', undefined, 'draft-list');
    for (const r of d.rows) {
      const li = el('li', undefined, r.final ? 'final' : '');
      li.append(el('span', `${r.final ? '定稿 · ' : ''}${new Date(r.time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} ${r.goal || ''}`), el('small', `物件 ${r.objects} · 风格 ${r.style} · 改名 ${r.names}`, 'muted'));
      const act = el('div', undefined, 'gscene-actions');
      for (const [t, cmd] of [['恢复', 'gscene.drafts.restore'], ['确认定稿', 'gscene.drafts.finalize'], ['删除', 'gscene.drafts.remove']]) {
        if (r.final && cmd !== 'gscene.drafts.restore') continue;
        const b = el('button', t); b.type = 'button'; b.onclick = async () => { try { await request(cmd, { id: r.id }); status?.(t + '：完成'); drawDrafts(); drawSwatches(); } catch (e) { status?.(e.message); } }; act.append(b);
      }
      li.append(act); ul.append(li);
    }
    draftsBox.append(ul);
  }
  const view = mountTierWorkshop({
    host, sideHost, tier: 'scene', sideTier: 'gscene', storageKey: 'gscene', caps, openSource, status,
    intro: '通用场景的场景管线：作用在当前场景的材质色表上（风格统一、整体色调、套用风格包），实景直接预览。',
    goalHint: '例如：颜色太杂，统一成几种主色，整体暖一点',
    scopeText: () => sceneLabel() + ' · 全部材质',
    agentConfig: {
      experienceKey: 'gscene',
      transformUrl: new URL('./gscene/transform-worker.js?v=sys-r11', import.meta.url), verifyUrl: new URL('./gscene/verify-worker.js?v=sys-r11', import.meta.url),
      hooks: {
        input: async () => (await request('gscene.style.get')).materials,
        scanMsg: (materials) => ({ materials }),
        runMsg: (materials, steps) => ({ materials, steps }),
        verifyMsg: (materials, scan, run) => ({ materials, colors: run.colors }),
        preview: async (c) => request('gscene.style.preview', { colors: c.run.colors }),
        compare: (c, on) => request('gscene.style.compare', { on }),
        revert: () => request('gscene.style.revert'),
        commit: async () => { const r = await request('gscene.style.save'); drawSwatches(); return r; },
      },
    },
    preview: { root, onScan: () => { drawSwatches(); drawDrafts(); }, scanNote: () => '' },
    actions: { commitLabel: '✓ 写入风格', committed: () => '已写入这个场景的风格（本机）；在右侧「草稿 / 定稿」里保存并确认定稿。' },
  });
  return { ...view, refresh: () => { manual = {}; view.scan(); } };
}
