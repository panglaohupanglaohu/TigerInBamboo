// =====================================================================
//  故事板工作台（与开发者菜单并列）
//  - 写故事 / 分镜头
//  - 从资产库拖拽场景·器物·生物·植物到分镜
//  - LLM 解析 → 执行（storyEngine.play）
// =====================================================================
import { getStoryCatalog } from "./storyCatalog.js";
import { makePanelDraggable } from "../ui/dragPanel.js";

const CAT_KEY = {
  动物: "animal",
  植物: "plant",
  "建筑/载具": "build",
  环境: "env",
  物品: "prop",
};

const STORAGE_KEY = "tm.storyboard.workspace.v1";

function uid() {
  return `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * @param {object} deps
 * @param {(text: string) => Promise<object>} deps.onExecute  组合文本 → LLM + play，返回校验后的 spec
 * @param {() => void} [deps.onClear]
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 */
export function createStoryboardPanel({ onExecute, onClear, toast = () => {} }) {
  const catalog = getStoryCatalog();

  // ---------- Toggle（与 🤖 并列） ----------
  const toggle = document.createElement("button");
  toggle.id = "storyboard-toggle";
  toggle.type = "button";
  toggle.title = "故事板工作台";
  toggle.textContent = "🎬";
  document.body.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = "storyboard-panel";
  panel.style.display = "none";
  document.body.appendChild(panel);

  /** @type {{ id: string, title: string, note: string, assets: {id:string,label:string,category:string}[] }[]} */
  let shots = [{ id: uid(), title: "分镜 1", note: "", assets: [] }];
  let open = false;
  let busy = false;

  function saveLocal() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          story: panel.querySelector("#sb-story")?.value || "",
          title: panel.querySelector("#sb-title")?.value || "",
          shots,
        })
      );
    } catch {
      /* private mode */
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.shots?.length) shots = data.shots;
      return data;
    } catch {
      return null;
    }
  }

  const saved = loadLocal();

  // ---------- DOM skeleton ----------
  panel.innerHTML = `
    <div class="sb-head" id="sb-drag-handle" title="拖动摆放面板">
      <strong>故事板工作台</strong>
      <button type="button" id="sb-close" class="sb-icon-btn" title="关闭">✕</button>
    </div>
    <p class="sb-hint">拖标题栏可摆放 · 写故事 · 资产拖到分镜 · LLM 解析 · 执行</p>

    <label class="sb-field">
      <span>故事标题</span>
      <input type="text" id="sb-title" maxlength="40" placeholder="例如：月下送信"
        value="${escapeAttr(saved?.title || "")}" />
    </label>

    <label class="sb-field">
      <span>故事正文</span>
      <textarea id="sb-story" rows="4" placeholder="叙述整体剧情……">${escapeHtml(saved?.story || "")}</textarea>
    </label>

    <div class="sb-body">
      <div class="sb-shots-col">
        <div class="sb-col-head">
          <span>分镜头</span>
          <button type="button" id="sb-add-shot" class="sb-mini">＋ 分镜</button>
        </div>
        <div id="sb-shots" class="sb-shots"></div>
      </div>
      <div class="sb-palette-col">
        <div class="sb-col-head"><span>资产库</span></div>
        <div id="sb-palette" class="sb-palette"></div>
      </div>
    </div>

    <div class="sb-actions">
      <button type="button" id="sb-llm" class="sb-btn primary">🤖 LLM 解析并执行</button>
      <button type="button" id="sb-run" class="sb-btn">▶ 仅执行（用当前草稿文本）</button>
      <button type="button" id="sb-clear" class="sb-btn danger">清除场景</button>
    </div>
    <div id="sb-status" class="sb-status">拖拽资产到分镜；点「LLM 解析并执行」生成并播放</div>
    <details class="sb-preview">
      <summary>预览 · 发给 LLM 的合成文本</summary>
      <pre id="sb-compose"></pre>
    </details>
  `;

  const elStory = panel.querySelector("#sb-story");
  const elTitle = panel.querySelector("#sb-title");
  const elShots = panel.querySelector("#sb-shots");
  const elPalette = panel.querySelector("#sb-palette");
  const elStatus = panel.querySelector("#sb-status");
  const elCompose = panel.querySelector("#sb-compose");

  // 标题栏拖拽摆放
  makePanelDraggable(
    panel,
    panel.querySelector("#sb-drag-handle"),
    "tm.ui.storyboardPanel.pos"
  );

  // ---------- 资产库（可拖拽） ----------
  function renderPalette() {
    const byCat = {};
    for (const c of catalog) {
      (byCat[c.category] ??= []).push(c);
    }
    elPalette.innerHTML = "";
    for (const [cat, items] of Object.entries(byCat)) {
      const key = CAT_KEY[cat] || "prop";
      const block = document.createElement("div");
      block.className = "sb-cat";
      block.innerHTML = `<div class="sb-cat-title">${cat}</div>`;
      const wrap = document.createElement("div");
      wrap.className = "sb-cat-items";
      for (const it of items) {
        const chip = document.createElement("span");
        chip.className = `sb-chip cat-${key}`;
        chip.draggable = true;
        chip.textContent = it.label;
        chip.title = it.id;
        chip.dataset.id = it.id;
        chip.dataset.label = it.label;
        chip.dataset.category = it.category;
        chip.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData(
            "application/x-tm-asset",
            JSON.stringify({ id: it.id, label: it.label, category: it.category })
          );
          e.dataTransfer.effectAllowed = "copy";
          chip.classList.add("dragging");
        });
        chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
        wrap.appendChild(chip);
      }
      block.appendChild(wrap);
      elPalette.appendChild(block);
    }
  }

  // ---------- 分镜头 ----------
  function renderShots() {
    elShots.innerHTML = "";
    shots.forEach((shot, index) => {
      const card = document.createElement("div");
      card.className = "sb-shot";
      card.dataset.shotId = shot.id;

      const head = document.createElement("div");
      head.className = "sb-shot-head";
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "sb-shot-title";
      titleInput.value = shot.title || `分镜 ${index + 1}`;
      titleInput.addEventListener("input", () => {
        shot.title = titleInput.value;
        saveLocal();
        updateCompose();
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "sb-icon-btn";
      del.title = "删除分镜";
      del.textContent = "⌫";
      del.disabled = shots.length <= 1;
      del.addEventListener("click", () => {
        if (shots.length <= 1) return;
        shots = shots.filter((s) => s.id !== shot.id);
        renderShots();
        saveLocal();
        updateCompose();
      });
      head.append(titleInput, del);

      const note = document.createElement("textarea");
      note.className = "sb-shot-note";
      note.rows = 2;
      note.placeholder = "本镜动作 / 对白 / 氛围…";
      note.value = shot.note || "";
      note.addEventListener("input", () => {
        shot.note = note.value;
        saveLocal();
        updateCompose();
      });

      const drop = document.createElement("div");
      drop.className = "sb-drop";
      drop.dataset.shotId = shot.id;
      if (!shot.assets.length) {
        drop.innerHTML = `<span class="sb-drop-hint">拖入资产到此分镜</span>`;
      } else {
        for (const a of shot.assets) {
          const key = CAT_KEY[a.category] || "prop";
          const chip = document.createElement("span");
          chip.className = `sb-chip cat-${key} in-shot`;
          chip.textContent = a.label;
          chip.title = a.id;
          const x = document.createElement("button");
          x.type = "button";
          x.className = "sb-chip-x";
          x.textContent = "×";
          x.addEventListener("click", (e) => {
            e.stopPropagation();
            shot.assets = shot.assets.filter((x) => x.id !== a.id);
            renderShots();
            saveLocal();
            updateCompose();
          });
          chip.appendChild(x);
          drop.appendChild(chip);
        }
      }

      drop.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        drop.classList.add("over");
      });
      drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("over");
        let payload = null;
        try {
          payload = JSON.parse(e.dataTransfer.getData("application/x-tm-asset") || "null");
        } catch {
          payload = null;
        }
        if (!payload?.id) return;
        if (shot.assets.some((a) => a.id === payload.id)) return;
        shot.assets.push({
          id: payload.id,
          label: payload.label || payload.id,
          category: payload.category || "物品",
        });
        renderShots();
        saveLocal();
        updateCompose();
      });

      card.append(head, note, drop);
      elShots.appendChild(card);
    });
  }

  /** 合成发给 LLM / 执行的文本 */
  function composePromptText() {
    const title = (elTitle?.value || "").trim() || "未命名故事板";
    const story = (elStory?.value || "").trim();
    const lines = [`标题：${title}`];
    if (story) {
      lines.push("", "【整体叙述】", story);
    }
    lines.push("", "【分镜头】");
    shots.forEach((s, i) => {
      lines.push(`${i + 1}. 「${s.title || `分镜 ${i + 1}`}」`);
      if (s.note?.trim()) lines.push(`   说明：${s.note.trim()}`);
      if (s.assets.length) {
        lines.push(
          `   资产：${s.assets.map((a) => `${a.id}（${a.label}）`).join("、")}`
        );
      } else {
        lines.push("   资产：（无）");
      }
    });
    lines.push(
      "",
      "请将以上分镜展开为故事板 JSON。entities 必须覆盖各分镜列出的资产 id；",
      "timeline 按分镜顺序编排 spawn / say / moveTo / wait / focusCamera 等动作。"
    );
    return lines.join("\n");
  }

  function updateCompose() {
    if (elCompose) elCompose.textContent = composePromptText();
  }

  function setStatus(msg) {
    if (elStatus) elStatus.textContent = msg;
  }

  // ---------- 事件 ----------
  toggle.addEventListener("click", () => setOpen(!open));
  panel.querySelector("#sb-close")?.addEventListener("click", () => setOpen(false));
  panel.querySelector("#sb-add-shot")?.addEventListener("click", () => {
    shots.push({
      id: uid(),
      title: `分镜 ${shots.length + 1}`,
      note: "",
      assets: [],
    });
    renderShots();
    saveLocal();
    updateCompose();
  });

  elStory?.addEventListener("input", () => {
    saveLocal();
    updateCompose();
  });
  elTitle?.addEventListener("input", () => {
    saveLocal();
    updateCompose();
  });

  async function runWithText(text, label) {
    if (busy) return;
    const t = String(text || "").trim();
    if (!t) {
      setStatus("请先填写故事或添加分镜资产");
      return;
    }
    if (!onExecute) {
      setStatus("执行回调未配置");
      return;
    }
    busy = true;
    setStatus(`${label}…`);
    try {
      const spec = await onExecute(t);
      const dropped = spec?.warnings?.length || 0;
      setStatus(
        `已执行「${spec?.title || "故事板"}」：${spec?.entities?.length || 0} 实体 / ` +
          `${spec?.timeline?.length || 0} 步` +
          (dropped ? `（丢弃 ${dropped} 条）` : "")
      );
      toast(`故事板「${spec?.title || ""}」已开始`, 2);
    } catch (err) {
      setStatus(`失败：${err?.message || err}`);
      toast(`故事板失败：${err?.message || err}`, 3);
    } finally {
      busy = false;
    }
  }

  panel.querySelector("#sb-llm")?.addEventListener("click", () => {
    runWithText(composePromptText(), "LLM 解析并执行");
  });
  panel.querySelector("#sb-run")?.addEventListener("click", () => {
    // 仅执行：同样走 LLM（引擎只接受 LLM JSON）；若无资产则用正文
    runWithText(composePromptText(), "解析并执行");
  });
  panel.querySelector("#sb-clear")?.addEventListener("click", () => {
    onClear?.();
    setStatus("已清除故事场景");
    toast("故事场景已清除", 1.5);
  });

  function setOpen(next) {
    open = !!next;
    panel.style.display = open ? "flex" : "none";
    toggle.classList.toggle("active", open);
    if (open) {
      renderPalette();
      renderShots();
      updateCompose();
    }
  }

  // 初始渲染（面板关闭时也建好 palette 结构）
  renderPalette();
  renderShots();
  updateCompose();

  return {
    setOpen,
    toggle: () => setOpen(!open),
    isOpen: () => open,
    composePromptText,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
