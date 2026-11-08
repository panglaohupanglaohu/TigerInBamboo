/**
 * object-edit-panel.js — 场景工坊里选中物件后的编辑面板（父页面）。
 * 所有改动经 bridge 的 objects.* 固定命令交给游戏侧 object-edits.js；改动立即保存在本机场景对象层，
 * 「保存场景草稿」会把它和体素编码、参数、配方一起存进同一个草稿，定稿 / 恢复也一起走。
 */
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };

export function renderObjectEditPanel(host, row, { request, note, status }) {
  const box = el('section', undefined, 'object-edit');
  host.append(box);
  let st = null, dragging = false;
  const say = (t) => { note.textContent = t; };
  const btn = (text, fn, title) => { const b = el('button', text); b.type = 'button'; if (title) b.title = title; b.onclick = async () => { try { st = await fn(); draw(); } catch (e) { say(e.message); } }; return b; };
  const op = (payload) => request('objects.edit', { id: row.id, ...payload });
  const after = (what) => { status('「' + row.name + '」' + what + '；已保存到本机场景对象层（可撤销）。'); };

  function draw() {
    box.replaceChildren();
    const e = st?.edit || { dx: 0, dy: 0, dz: 0, ry: 0, s: 1, hidden: false };
    box.append(el('h3', '编辑物件'));
    // 通用场景插件：可以给物件改名（改过名的物件能被批量能力当作一类处理）
    if (row.scene) {
      const rn = el('div', undefined, 'object-rename'), inp = el('input'); inp.value = row.name || ''; inp.placeholder = '给这个物件起个名字'; inp.maxLength = 40;
      const ok = el('button', '改名'); ok.type = 'button';
      ok.onclick = async () => { try { const r = await request('objects.rename', { id: row.id, name: inp.value }); row.name = r.name; say(`已改名为「${r.name}」；同名物件会被物件管线当作一类批量处理。`); } catch (e) { say(e.message); } };
      rn.append(inp, ok); box.append(rn);
      if (row.autoNamed) box.append(el('small', '这个名字是按颜色和形状自动起的', 'muted'));
    }
    // 拖动
    const dragBtn = el('button', dragging ? '■ 停止拖动' : '✥ 在实景中拖动', dragging ? 'on' : '');
    dragBtn.type = 'button';
    dragBtn.onclick = async () => { try { dragging = !dragging; await request('objects.drag', { id: row.id, enabled: dragging }); say(dragging ? '按住实景画面拖动，物件沿地面移动；松手即保存。拖动期间镜头不转。' : '已停止拖动。'); draw(); } catch (err) { dragging = false; say(err.message); draw(); } };
    box.append(dragBtn);
    // 方向移动
    const pad = el('div', undefined, 'object-pad');
    pad.append(
      el('span'), btn('↑', async () => { const r = await op({ dz: -1 }); after('向北移 1'); return r; }, 'Z −1'), el('span'),
      btn('←', async () => { const r = await op({ dx: -1 }); after('向西移 1'); return r; }, 'X −1'), el('small', '移动 1'), btn('→', async () => { const r = await op({ dx: 1 }); after('向东移 1'); return r; }, 'X +1'),
      el('span'), btn('↓', async () => { const r = await op({ dz: 1 }); after('向南移 1'); return r; }, 'Z +1'), el('span'));
    box.append(pad);
    const row2 = el('div', undefined, 'object-row');
    row2.append(btn('升高', async () => { const r = await op({ dy: 0.25 }); after('升高 0.25'); return r; }), btn('降低', async () => { const r = await op({ dy: -0.25 }); after('降低 0.25'); return r; }),
      btn('⟲ 15°', async () => { const r = await op({ ry: Math.PI / 12 }); after('旋转 15°'); return r; }), btn('⟳ 15°', async () => { const r = await op({ ry: -Math.PI / 12 }); after('旋转 −15°'); return r; }));
    box.append(row2);
    // 缩放
    const scale = el('label', '大小 ' + Math.round(e.s * 100) + '%', 'control');
    const range = el('input'); range.type = 'range'; range.min = 30; range.max = 250; range.step = 5; range.value = Math.round(e.s * 100);
    range.oninput = () => { scale.firstChild.textContent = '大小 ' + range.value + '%'; };
    range.onchange = async () => { try { st = await op({ s: +range.value / 100 }); after('大小改为 ' + range.value + '%'); draw(); } catch (err) { say(err.message); } };
    scale.append(range); box.append(scale);
    const row3 = el('div', undefined, 'object-row');
    row3.append(btn(e.hidden ? '恢复显示' : '隐藏（移除）', async () => { const r = await op({ hidden: !e.hidden }); after(e.hidden ? '恢复显示' : '已隐藏'); return r; }),
      btn('复位此物件', async () => { const r = await op({ reset: true }); after('复位到原样'); return r; }));
    box.append(row3);
    const row4 = el('div', undefined, 'object-row');
    const u = btn('↶ 撤销', async () => { const r = await request('objects.undo'); status('已撤销上一步物件改动。'); return r; });
    const r = btn('↷ 重做', async () => { const x = await request('objects.redo'); status('已重做物件改动。'); return x; });
    u.disabled = st ? !st.canUndo : true; r.disabled = st ? !st.canRedo : true;
    row4.append(u, r); box.append(row4);
    const moved = Math.hypot(e.dx, e.dz);
    box.append(el('p', st?.edited ? `当前改动：位移 ${moved.toFixed(2)}、高度 ${e.dy >= 0 ? '+' : ''}${e.dy.toFixed(2)}、旋转 ${Math.round(e.ry * 180 / Math.PI)}°、大小 ${Math.round(e.s * 100)}%${e.hidden ? '、已隐藏' : ''}。场景里共 ${st.count} 个物件有改动。` : '尚未改动。', 'muted'));
    box.append(el('p', '改动只影响这一个物件的几何；树下草丛、动物的落点不会跟着走。存进草稿后可以和其他版本对照、定稿。', 'muted'));
  }
  window.addEventListener('message', (ev) => { if (ev.origin !== location.origin || ev.data?.type !== 'tm.scene-object.edited' || ev.data.state?.id !== row.id) return; st = ev.data.state; after('拖动到新位置'); draw(); });
  request('objects.edit.get', { id: row.id }).then((x) => { st = x; draw(); }).catch(() => draw());
  draw();
  return { stop: () => { if (dragging) request('objects.drag', { id: row.id, enabled: false }).catch(() => {}); dragging = false; } };
}
