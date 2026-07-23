// 记忆绑定页：四层记忆的查看 / 写入 / 封存 / 凭吊 / 导入导出 / 遗嘱草稿
// 零依赖原生 ES Module；物种清单读取模式参考 js/config.js、js/species.js（只读参考，未改动）
import { MemoryCore, listCreatureIds } from "./memory-core.js";
import {
  isSealed,
  listSealedIds,
  seal,
  memorial,
  WILL_SCHEMA,
  draftWill,
} from "./legacy.js";

/* ---------- 内置兜底生物列表（虎 / 兔 / 锦鸡 / 大雁） ---------- */
const BUILTIN_CREATURES = [
  { id: "tiger", name: "虎 · 斑斓" },
  { id: "rabbit", name: "兔 · 母亲" },
  { id: "bird", name: "锦鸡" },
  { id: "goose", name: "大雁" },
];

/** 生物清单：/api/species → species.json 静态文件 → 内置兜底；并并入记忆里出现过的 id */
async function loadCreatures() {
  const list = BUILTIN_CREATURES.map((c) => ({ ...c }));
  let custom = null;
  try {
    const res = await fetch("api/species");
    if (res.ok) custom = (await res.json())?.species ?? null;
  } catch (_) { /* 离线回退 */ }
  if (!custom) {
    try {
      const res = await fetch("species.json");
      if (res.ok) {
        const data = await res.json();
        custom = data?.species ?? data ?? null;
      }
    } catch (_) { /* 静态文件不存在则忽略 */ }
  }
  if (!custom) {
    try {
      const raw = localStorage.getItem("living-classical-art-species");
      if (raw) custom = JSON.parse(raw);
    } catch (_) { /* ignore */ }
  }
  if (custom && custom.enabled !== false) {
    list.push({ id: "custom", name: custom.cnName || "自定义物种" });
  }
  const known = new Set(list.map((c) => c.id));
  for (const id of [...listCreatureIds(), ...listSealedIds()]) {
    if (!known.has(id)) list.push({ id, name: id });
  }
  return list;
}

/* ---------- 小工具 ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
const fmtT = (t) => (Number.isFinite(+t) ? new Date(+t).toLocaleString("zh-CN", { hour12: false }) : "—");

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- 页面状态 ---------- */
const state = {
  creatures: [],
  current: null, // {id, name}
  core: null, // MemoryCore（活体）
  frozen: null, // memorial 快照（凭吊）
  sealed: false,
  tab: "pane-log",
};

/* ---------- 生物列表 ---------- */
function renderCreatureList() {
  const box = $("#creature-list");
  box.innerHTML = state.creatures
    .map(
      (c) => `
      <button type="button" class="mem-creature ${state.current?.id === c.id ? "active" : ""}" data-id="${esc(c.id)}">
        <span>${esc(c.name)}</span>
        <span class="c-id">${esc(c.id)}</span>
        ${isSealed(c.id) ? '<span class="seal-stamp">已封存</span>' : ""}
      </button>`,
    )
    .join("");
  box.querySelectorAll(".mem-creature").forEach((btn) =>
    btn.addEventListener("click", () => selectCreature(btn.dataset.id)),
  );
}

function selectCreature(id) {
  const c = state.creatures.find((x) => x.id === id);
  if (!c) return;
  state.current = c;
  state.sealed = isSealed(id);
  state.core = state.sealed ? null : new MemoryCore(id);
  state.frozen = state.sealed ? memorial(id) : null;
  renderCreatureList();
  renderBindBar();
  renderTab();
}

/* ---------- 绑定状态条 ---------- */
function renderBindBar() {
  const bar = $("#bind-bar");
  bar.hidden = false;
  $("#bind-name").textContent = state.current.name;
  $("#bind-status").innerHTML = state.sealed
    ? `状态：<em>已封存</em> · 封于 ${fmtT(state.frozen?.sealedAt)} · 凭吊模式`
    : "状态：存活 · 记忆持续写入中";
  $("#btn-seal").disabled = state.sealed;
  $("#btn-import").disabled = state.sealed;
  $("#memorial-banner").hidden = !state.sealed;
  $("#memorial-replay").hidden = !state.sealed;
  $("#mem-tabs").hidden = false;
  if (state.sealed) setupMemorialReplay();
}

/* ---------- Tab 切换 ---------- */
$("#mem-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-pane]");
  if (!btn) return;
  state.tab = btn.dataset.pane;
  $("#mem-tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  renderTab();
});

function renderTab() {
  document.querySelectorAll(".mem-pane").forEach((p) => p.classList.toggle("active", p.id === state.tab));
  // 凭吊模式：隐藏一切写入控件
  document.querySelectorAll("[data-live]").forEach((el) => {
    el.style.display = state.sealed ? "none" : "";
  });
  if (state.tab === "pane-log") renderLog();
  else if (state.tab === "pane-perception") renderPerception();
  else if (state.tab === "pane-intentions") renderIntentions();
  else if (state.tab === "pane-affect") renderAffect();
}

/* ---------- 运行日志 ---------- */
function logEvents() {
  return state.sealed ? state.frozen?.log ?? [] : state.core.log.replay();
}

function logItemHtml(e, scoreHtml = "") {
  return `
    <li class="${(e.importance ?? 5) >= 8 ? "hot" : ""}">
      <span class="tl-time">${fmtT(e.t)}</span>${scoreHtml}
      <div class="tl-head"><b>${esc(e.subject)}</b> · ${esc(e.action)}${e.place ? ` @ ${esc(e.place)}` : ""}</div>
      ${e.detail ? `<div class="tl-detail">${esc(e.detail)}</div>` : ""}
      <div class="tl-meta">重要度 ${e.importance ?? 5}/10${(e.tags || []).length ? ` · ${e.tags.map(esc).join(" · ")}` : ""}</div>
    </li>`;
}

function renderLog(hits = null) {
  const list = $("#log-list");
  if (hits) {
    list.innerHTML = hits.length
      ? hits
          .map((h) =>
            logItemHtml(
              h.event,
              `<span class="tl-score">score ${h.score.toFixed(2)}（时新 ${h.parts.recency.toFixed(2)} / 重要 ${h.parts.importance.toFixed(2)} / 词面 ${h.parts.relevance.toFixed(2)}）</span>`,
            ),
          )
          .join("")
      : '<p class="empty-hint">没有命中。换个词试试。</p>';
    return;
  }
  const events = logEvents().slice().sort((a, b) => b.t - a.t);
  list.innerHTML = events.length
    ? events.map((e) => logItemHtml(e)).join("")
    : '<p class="empty-hint">尚无一字记忆 —— 在第一行落下第一笔。</p>';
}

$("#log-search").addEventListener("click", () => {
  if (state.sealed) return;
  const q = $("#log-query").value.trim();
  if (!q) return renderLog();
  renderLog(state.core.log.recall(q, 8));
});
$("#log-query").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#log-search").click();
});
$("#log-show-all").addEventListener("click", () => {
  $("#log-query").value = "";
  renderLog();
});
$("#log-importance").addEventListener("input", (e) => {
  $("#log-importance-val").textContent = e.target.value;
});
$("#log-add").addEventListener("click", () => {
  if (state.sealed) return;
  const detail = $("#log-detail").value.trim();
  const action = $("#log-action").value.trim();
  if (!detail && !action) return toast("至少写下动作或详情");
  state.core.log.append({
    subject: $("#log-subject").value.trim() || state.current.id,
    action,
    detail,
    place: $("#log-place").value.trim(),
    importance: +$("#log-importance").value,
    tags: $("#log-tags").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
  });
  $("#log-detail").value = "";
  $("#log-action").value = "";
  $("#log-tags").value = "";
  toast("已记入运行日志");
  renderLog();
});

/* ---------- 感知流 ---------- */
function renderPerception() {
  const statsBox = $("#perc-stats");
  const list = $("#perc-list");
  if (state.sealed) {
    const s = state.frozen?.perceptionSummary;
    statsBox.innerHTML = s && s.count
      ? `封存时的感知摘要：共 <b>${s.count}</b> 次（${Object.entries(s.byModality).map(([m, n]) => `${esc(m)} ${n} 次`).join("、")}）${s.fearMean !== null ? `，fear 均值 <b>${s.fearMean}</b>` : ""}<br>跨度 ${fmtT(s.tStart)} → ${fmtT(s.tEnd)}`
      : "封存时感知缓冲已为空。";
    list.innerHTML = "";
    return;
  }
  const buf = state.core.perception.buffer;
  const s = state.core.perception.summarize();
  statsBox.innerHTML = buf.length
    ? `缓冲 <b>${s.count}</b>/500 条 · ${Object.entries(s.byModality).map(([m, n]) => `${esc(m)} ${n} 次`).join("、")}${s.fearMean !== null ? ` · fear 均值 <b>${s.fearMean}</b>` : ""}`
    : "感知缓冲为空 —— 世界还未惊动它。";
  const recent = buf.slice(-60).reverse();
  list.innerHTML = recent
    .map(
      (i) => `
      <li>
        <span class="tl-time">${fmtT(i.t)}</span>
        <div class="tl-head"><b>${esc(i.modality)}</b></div>
        <div class="tl-detail">${esc(typeof i.payload === "string" ? i.payload : JSON.stringify(i.payload))}</div>
      </li>`,
    )
    .join("");
}

$("#perc-add").addEventListener("click", () => {
  if (state.sealed) return;
  const raw = $("#perc-payload").value.trim();
  let payload = raw;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      return toast("载荷 JSON 解析失败");
    }
  }
  state.core.perception.perceive({ modality: $("#perc-modality").value, payload });
  $("#perc-payload").value = "";
  renderPerception();
});
$("#perc-compress").addEventListener("click", () => {
  if (state.sealed) return;
  const result = state.core.perception.compress(state.core.log);
  toast(result ? "已压缩固化进运行日志" : "缓冲为空，无可压缩");
  renderPerception();
});

/* ---------- 未发送队列 ---------- */
function intentItemHtml(i, readonly) {
  const head = `
    <div class="intent-top">
      <span class="intent-instruction">${esc(i.instruction)}</span>
      ${i.status === "pending" ? `<span class="intent-due">${esc(i.dueLabel ?? "")}</span>` : ""}
    </div>
    <div class="intent-meta">
      创建者 ${esc(i.creator || "—")} · 记于 ${fmtT(i.tCreated)}
      ${i.trigger ? ` · 触发「${esc(i.trigger)}」` : ""}
      · 超时策略 ${esc(i.timeoutPolicy)}
      · provenance：${fmtT(i.provenance?.saidAt)}${i.provenance?.context ? ` · ${esc(i.provenance.context)}` : ""}
      <span class="${i.provenance?.confidence === "unclear" ? "unclear" : ""}">${esc(i.provenance?.confidence ?? "normal")}</span>
    </div>`;
  if (i.status !== "pending") {
    const label = i.status === "confirmed" ? `已确认完成 · ${fmtT(i.confirmedAt)}` : `已放弃 · ${fmtT(i.droppedAt)}`;
    return `<li class="intent-item">${head}<p class="intent-done ${i.status}">${label}</p></li>`;
  }
  const overdue = typeof i.daysLeft === "number" && i.daysLeft < 0;
  const actions = readonly
    ? ""
    : `<div class="intent-actions">
        <button class="btn ghost" data-act="confirm" data-id="${esc(i.id)}" type="button">确认完成</button>
        <button class="btn ghost" data-act="drop" data-id="${esc(i.id)}" type="button">放 弃</button>
      </div>`;
  return `<li class="intent-item ${overdue ? "overdue" : ""}">${head}${actions}</li>`;
}

function renderIntentions() {
  const list = $("#intent-list");
  if (state.sealed) {
    const items = (state.frozen?.intentions ?? []).slice().sort((a, b) => a.tCreated - b.tCreated);
    list.innerHTML = items.length
      ? items.map((i) => intentItemHtml(i, true)).join("")
      : '<p class="empty-hint">没有未送出的话。</p>';
    return;
  }
  const pending = state.core.intentions.pending();
  const settled = state.core.intentions.all().filter((i) => i.status !== "pending").reverse();
  const rows = [...pending.map((i) => intentItemHtml(i, false)), ...settled.map((i) => intentItemHtml(i, true))];
  list.innerHTML = rows.length
    ? rows.join("")
    : '<p class="empty-hint">队列空着 —— 没有悬而未决的托付。</p>';
}

$("#in-add").addEventListener("click", () => {
  if (state.sealed) return;
  const instruction = $("#in-instruction").value.trim();
  if (!instruction) return toast("先写下打算做什么");
  const dueRaw = $("#in-due").value;
  const cdRaw = $("#in-countdown").value;
  state.core.intentions.add({
    instruction,
    creator: $("#in-creator").value.trim(),
    trigger: $("#in-trigger").value.trim(),
    dueAt: dueRaw ? new Date(dueRaw).getTime() : null,
    countdown: cdRaw === "" ? null : +cdRaw * 3_600_000,
    timeoutPolicy: $("#in-timeout").value,
    provenance: { confidence: $("#in-confidence").value, context: "记忆绑定页" },
  });
  $("#in-instruction").value = "";
  $("#in-trigger").value = "";
  $("#in-due").value = "";
  $("#in-countdown").value = "";
  toast("已存入未发送队列");
  renderIntentions();
});
$("#intent-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn || state.sealed) return;
  const done = btn.dataset.act === "confirm"
    ? state.core.intentions.confirm(btn.dataset.id)
    : state.core.intentions.drop(btn.dataset.id);
  toast(done ? (btn.dataset.act === "confirm" ? "已确认完成" : "已放弃") : "该意图已不在待办中");
  renderIntentions();
});

/* ---------- 情绪残留 ---------- */
function barRow(label, value, max, cool = false) {
  const pct = Math.round((Math.abs(value) / max) * 100);
  return `
    <div class="a-bar-row">
      <span class="a-label">${esc(label)}</span>
      <div class="a-bar-track"><div class="a-bar-fill ${cool ? "cool" : ""}" style="width:${pct}%"></div></div>
      <span class="a-bar-val">${value}</span>
    </div>`;
}

function renderAffect() {
  const r = state.sealed ? state.frozen?.affectSnapshot : state.core.affect.residue();
  const labels = Object.entries(r?.labels ?? {}).sort((a, b) => b[1] - a[1]);
  $("#affect-labels").innerHTML = labels.length
    ? labels.map(([k, v]) => barRow(k, v, 1)).join("")
    : '<p class="empty-hint">余烬已凉，没有残留。</p>';
  const valence = r?.valence ?? 0;
  const arousal = r?.arousal ?? 0;
  $("#affect-va").innerHTML =
    barRow("效价", valence, 1, valence < 0) +
    barRow("唤醒", arousal, 1, true) +
    `<p class="pane-note" style="margin-top:10px">效价 −1（沉）→ +1（暖）· 唤醒 0（定）→ 1（激）· 衰减 η = 72h</p>`;
  $("#affect-tone").textContent = state.sealed
    ? `（封存定格）${r && Object.keys(r.labels ?? {}).length ? "语气里还凝着当时的余温 —— 凭吊只读，不再注入。" : "语气平静，没有明显的情绪残留。"}`
    : state.core.affect.toneHint();
}

for (const [range, out] of [
  ["#af-intensity", "#af-intensity-val"],
  ["#af-valence", "#af-valence-val"],
  ["#af-arousal", "#af-arousal-val"],
]) {
  $(range).addEventListener("input", (e) => {
    $(out).textContent = e.target.value;
  });
}
$("#af-add").addEventListener("click", () => {
  if (state.sealed) return;
  const label = $("#af-label").value.trim();
  if (!label) return toast("先给这份感受一个名字");
  state.core.affect.feel(
    label,
    +$("#af-intensity").value,
    +$("#af-valence").value,
    +$("#af-arousal").value,
  );
  $("#af-label").value = "";
  toast("感受已注入，残留将随时间衰减");
  renderAffect();
});

/* ---------- 凭吊时间轴回放 ---------- */
function setupMemorialReplay() {
  const f = state.frozen;
  const slider = $("#memorial-slider");
  if (!f) return;
  const times = [...(f.log ?? []).map((e) => e.t)];
  const min = times.length ? Math.min(...times) : f.sealedAt - 3_600_000;
  const max = f.sealedAt;
  slider.min = min;
  slider.max = max;
  slider.step = Math.max(1, Math.floor((max - min) / 400));
  slider.value = max;
  const show = () => {
    const t = +slider.value;
    $("#memorial-now").textContent = fmtT(t);
    const win = Math.max(60_000, (max - min) / 40);
    const logs = (f.log ?? []).filter((e) => Math.abs(e.t - t) <= win);
    const intents = (f.intentions ?? []).filter((i) => i.tCreated <= t && i.status === "pending");
    const parts = [];
    parts.push(`此刻前后：日志 <b>${logs.length}</b> 条 · 悬置意图 <b>${intents.length}</b> 条`);
    for (const e of logs.slice(0, 4)) {
      parts.push(`· ${fmtT(e.t)} —— ${esc(e.subject)} ${esc(e.action)}${e.detail ? `：${esc(e.detail)}` : ""}`);
    }
    if (f.affectSnapshot && Object.keys(f.affectSnapshot.labels ?? {}).length) {
      parts.push(`封存定格的情绪：${Object.entries(f.affectSnapshot.labels).map(([k, v]) => `${esc(k)} ${v}`).join("、")}`);
    }
    $("#memorial-slice").innerHTML = parts.join("<br>");
  };
  slider.oninput = show;
  show();
}

/* ---------- 封存 / 导出 / 导入 / 遗嘱 ---------- */
$("#btn-seal").addEventListener("click", () => {
  if (state.sealed) return;
  $("#seal-creature-name").textContent = state.current.name;
  $("#seal-modal").hidden = false;
});
$("#seal-cancel").addEventListener("click", () => {
  $("#seal-modal").hidden = true;
});
$("#seal-confirm").addEventListener("click", () => {
  if (state.sealed) return;
  seal(state.current.id, state.core);
  $("#seal-modal").hidden = true;
  toast("封存礼成 —— 此后是回放，不是本人");
  selectCreature(state.current.id);
});

$("#btn-export").addEventListener("click", () => {
  const data = state.sealed
    ? { schema: "tib.legacy/v1", exportedAt: Date.now(), legacy: state.frozen }
    : state.core.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tib-memory-${state.current.id}-${state.sealed ? "legacy" : "live"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(state.sealed ? "已导出遗存快照" : "已导出整只记忆");
});

$("#btn-import").addEventListener("click", () => {
  if (state.sealed) return;
  $("#import-file").click();
});
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || state.sealed) return;
  try {
    const text = await file.text();
    const ok = state.core.importAll(text);
    toast(ok ? "记忆已导入（四层整体覆写）" : "导入失败：不是 tib.memory/v1 格式");
    if (ok) renderTab();
  } catch (_) {
    toast("导入失败：文件不可读");
  }
});

$("#btn-will").addEventListener("click", () => {
  $("#will-schema").textContent = JSON.stringify(WILL_SCHEMA, null, 2);
  $("#will-draft").textContent = JSON.stringify(draftWill(state.current.id), null, 2);
  $("#will-modal").hidden = false;
});
$("#will-close").addEventListener("click", () => {
  $("#will-modal").hidden = true;
});
document.querySelectorAll(".mem-modal-mask").forEach((mask) =>
  mask.addEventListener("click", (e) => {
    if (e.target === mask) mask.hidden = true;
  }),
);

/* ---------- 启动 ---------- */
(async function boot() {
  state.creatures = await loadCreatures();
  renderCreatureList();
  const fromUrl = new URLSearchParams(location.search).get("creature");
  const first = state.creatures.find((c) => c.id === fromUrl) ?? state.creatures[0];
  if (first) selectCreature(first.id);
})();
