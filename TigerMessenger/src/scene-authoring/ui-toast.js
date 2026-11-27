// 浮动提示：右下角堆叠，3.6s 自动淡出；kind = ok | warn | bad
const ICON = { ok: '✓', warn: '!', bad: '✕' };
export function toast(message, kind = 'ok', ms = 3600) {
  if (!message) return;
  let host = document.getElementById('tm-toasts');
  if (!host) { host = document.createElement('div'); host.id = 'tm-toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.append(host); }
  const t = document.createElement('div'); t.className = 'tm-toast ' + kind;
  const i = document.createElement('i'); i.textContent = ICON[kind] || '•';
  const s = document.createElement('span'); s.textContent = message;
  t.append(i, s); host.append(t);
  while (host.children.length > 4) host.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
  return t;
}
// 判断一条状态文本是成功还是需要用户先做什么
export function toneOf(text) {
  if (/失败|错误|不能|无法/.test(text)) return 'bad';
  if (/^先|请先|跳过|还没|稍等|待完成|没有/.test(text)) return 'warn';
  return 'ok';
}
