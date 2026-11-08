/* Learning records describe source methods, not automatic game adapters. */
(() => {
  const byId = new Map();
  for (const lane of window.PIPELINE?.lanes || []) {
    for (const [group, methods] of lane.groups || []) {
      for (const method of methods) {
        if (!method.id) continue;
        const rows = byId.get(String(method.id)) || [];
        rows.push({ ...method, group, lane: lane.name });
        byId.set(String(method.id), rows);
      }
    }
  }
  window.learningUsage = (item, esc) => {
    const methods = byId.get(String(item.id)) || [];
    const title = methods.length ? methods.map(m => m.name).join('；') : '阅读这条视频与笔记';
    const scope = [...new Set(methods.map(m => m.lane + ' / ' + m.group))].join('；');
    const links = [];
    for (const method of methods) {
      // Only source-declared relative HTML pages. Never turn arbitrary text into executable URLs.
      if (typeof method.page !== 'string' || !/^[a-zA-Z0-9_/-]+\.html(?:[?#][^\s"<>]*)?$/.test(method.page) || method.page.split('/').includes('..')) continue;
      if (links.some(link => link.page === method.page)) continue;
      links.push({ page: method.page, name: method.name });
    }
    const pending = ['todo', 'partial', 'ref', 'na'].includes(item.status);
    return `<details class="usage"><summary>ⓘ 怎么用 · 查看操作说明</summary>
      <p><b>这是什么：</b>${esc(title)}</p>
      ${scope ? `<p><b>适用方向：</b>${esc(scope)}。先确认它处理的是网格、材质、区域还是单个物件，再决定接到哪条管线。</p>` : '<p><b>当前用途：</b>这条记录尚未关联具体管线方法，先作为学习资料查看。</p>'}
      <ol><li>点击上方缩略图看来源视频，对照笔记里的效果与限制；视频不可用时可打开原帖。</li>
      <li>${links.length ? '打开下面的来源实验页，按该页提供的控件调整，并比较画面与笔记。' : '当前记录未声明可直接操作的实验页；先查看代码落点与笔记，不把源码路径当作已接入按钮。'}</li>
      <li>要用于游戏，在系统工坊选择场景或物件，再选择兼容能力、调整参数、生成候选并验证；确认后才保存。这里不会自动修改场景。</li></ol>
      ${links.map(link => `<a href="${esc(link.page)}" target="_blank" rel="noopener">打开实验：${esc(link.name)} ↗</a>`).join(' ')}
      ${item.where ? `<p><b>代码落点：</b><code>${esc(item.where)}</code></p>` : ''}
      <p class="usage-state">${pending ? '当前为未完成、参考或不适用记录；请先核对状态，不应直接视为可执行能力。' : '学习状态与源码落地，不等于系统工坊已有执行适配；需在工坊核对支持范围和验证结果。'}</p>
    </details>`;
  };
})();
