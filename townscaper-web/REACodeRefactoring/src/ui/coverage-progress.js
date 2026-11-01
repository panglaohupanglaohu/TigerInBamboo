// Shared progress for index and pipeline; updated by the 30-minute learning workflow.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function refreshCoverage() {
  let host = document.getElementById('coverage-progress');
  if (!host) {
    host = document.createElement('details'); host.id = 'coverage-progress';
    host.style.cssText = 'position:fixed;left:16px;bottom:46px;z-index:7;max-width:min(500px,90vw);max-height:40vh;overflow:auto;background:#f4faf7;color:#20343c;border:1px solid #9ebcbc;border-radius:10px;padding:10px;font:13px/1.6 system-ui;box-shadow:0 2px 12px #0002';
    document.body.appendChild(host);
  }
  try {
    const [map, progress] = await Promise.all(['learn/coverage.json','learn/coverage-progress.json'].map(async u => { const res = await fetch(u,{cache:'no-store'}); if(!res.ok) throw Error(`${u}: ${res.status}`); return res.json(); }));
    host.innerHTML = `<summary><b>模块覆盖进度 · ${map.modules.length} 个原版模块</b> · 展开</summary><p>更新：${esc(progress.updatedAt)}<br>${Object.entries(map.counts).map(([k,v])=>`${esc(k)} ${v}`).join(' · ')}<br>静态迁移记录与逐帧学习、运行验收分别记录。</p><p><a href="coverage.html">原版 → 重构完整映射表 →</a></p><b>本轮完成</b><ul>${progress.completed.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><b>后续学习任务</b><ol>${progress.next.map(t=>`<li>${esc(t.title)} · ${t.clips.map(id=>`<a href="gifs/${id}.mp4">${id}</a>`).join(' / ')}</li>`).join('')}</ol>`;
  } catch (e) { host.innerHTML = `<summary>模块覆盖进度暂不可用</summary>${esc(e.message)}`; }
}
refreshCoverage();
setInterval(refreshCoverage, 30 * 60 * 1000);
