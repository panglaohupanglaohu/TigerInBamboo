// Read-only level configuration. No workspace storage or gameplay dependencies.
const LEVEL_URL = new URL("../../godot/data/levels/swamp-rescue-v1.json", import.meta.url);

function element(tag, text, className = "") {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

export function createStoryboardLevelPanel() {
  const section = element("details", undefined, "sb-preview sb-level");
  section.id = "sb-level-config";
  section.style.cssText = "flex-shrink:0;font-size:12px;opacity:1;min-width:0";
  const summary = element("summary", "内置关卡 · 湖沼救虎（只读）");
  summary.style.cssText = "padding:7px 0;line-height:1.5";
  const content = element("div");
  content.style.cssText = "max-height:min(280px,32vh);overflow:auto;overflow-wrap:anywhere;line-height:1.65;padding:0 6px 6px 0";
  const status = element("p", "展开后读取关卡配置；不会替换草稿或启动游戏。", "sb-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section.append(summary, content);
  content.append(status);
  let loaded = false;
  let loading = false;

  async function load() {
    if (loaded || loading) return;
    loading = true;
    content.replaceChildren(status);
    status.textContent = "正在读取内置关卡配置…";
    try {
      const response = await fetch(LEVEL_URL, { credentials: "same-origin", cache: "no-cache" });
      if (!response.ok) throw new Error("关卡文件未就绪");
      const data = await response.json();
      if (!data || !Array.isArray(data.stages) || !data.stages.length ||
          !Array.isArray(data.zones) || !data.activation || !data.title) {
        throw new Error("关卡配置不完整");
      }
      render(data);
      loaded = true;
    } catch {
      status.textContent = "关卡配置暂时无法读取。现有草稿未受影响，可重试。";
      const retry = element("button", "重新读取", "sb-mini");
      retry.type = "button";
      retry.addEventListener("click", load);
      content.append(retry);
    } finally {
      loading = false;
    }
  }

  function render(data) {
    // This viewer never claims the deployment status amounts to a playable level.
    status.textContent = data.status === "configured_not_deployed" && data.activation.enabled === false
      ? "已配置 · 尚未部署到游戏（只读查看）"
      : "仅查看关卡配置；本入口不启动或验证游戏。";
    const title = element("strong", data.title);
    const description = element("p", data.summary || "湖沼救虎与《借来的盔甲》插曲关卡编排。");
    description.style.margin = "6px 0";
    content.append(title, description);
    const note = element("p", "此配置与下方自由草稿相互独立；不会调用 LLM，也不会自动播放。", "sb-hint");
    content.append(note);
    const download = element("a", "下载关卡配置");
    download.href = LEVEL_URL.href;
    download.download = "swamp-rescue-v1.json";
    download.style.color = "#9ec5ff";
    content.append(download);

    const labels = data.conditionLabels || {};
    const conditionText = (value) => labels[value] || "待补充条件说明";
    const zoneNames = new Map(data.zones.map(zone => [zone.id, zone.title]));
    const heading = element("p", `分镜与关卡阶段 · 共 ${data.stages.length} 段（滚动查看，点击展开）`);
    heading.style.cssText = "font-weight:600;margin:10px 0 4px;color:#ffd28a";
    content.append(heading);
    for (const stage of data.stages) {
      const entry = element("details", undefined, "sb-level-stage");
      entry.style.cssText = "border-top:1px solid #ffffff20;padding:5px 0";
      const shot = Array.isArray(stage.shot) ? stage.shot.join("、") : stage.shot;
      const head = element("summary", `${shot ? `镜 ${shot} · ` : ""}${stage.title}`);
      head.style.cssText = "line-height:1.6;color:#e8eef8";
      entry.append(head);
      const fields = [
        ["目标", stage.objective],
        ["区域", zoneNames.get(stage.zone) || "待指定区域"],
        ["开始条件", (stage.requires || []).map(conditionText).join("；") || "进入本阶段"],
        ["完成条件", (stage.completeWhen || []).map(conditionText).join("；") || "待补充"],
      ];
      for (const [label, value] of fields) {
        const line = element("p", `${label}：${value}`);
        line.style.cssText = "margin:3px 0;color:#d0d8e8";
        entry.append(line);
      }
      content.append(entry);
    }
    const blockers = element("details");
    blockers.open = true;
    blockers.style.marginTop = "8px";
    blockers.append(element("summary", "部署前仍需完成"));
    const list = element("ul");
    list.style.cssText = "padding-left:20px;margin:5px 0";
    for (const blocker of data.activation.blockers || []) list.append(element("li", blocker));
    const unresolved = data.zones.filter(zone => zone.placement?.status === "unresolved");
    if (unresolved.length) list.append(element("li", `${unresolved.length} 个区域尚待实景定位与通行验收。`));
    if (!list.children.length) list.append(element("li", "须在真实场景中验证触发、角色与失败恢复。"));
    blockers.append(list);
    content.append(blockers);
  }

  section.addEventListener("toggle", () => { if (section.open) load(); });
  return section;
}
