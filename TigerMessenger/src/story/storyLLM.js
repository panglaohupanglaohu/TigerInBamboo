// =====================================================================
//  故事板 LLM 解析：组 prompt → 同源 /api/llm/chat → 受限 JSON
//  - 密钥只在服务端（backend/main.py），浏览器永不接触
//  - prompt 内注入白名单 id；返回后仍由 storyEngine 二次校验（双重锁）
// =====================================================================
import { getStoryCatalog, KNOWN_ACTORS, STORY_ACTIONS } from "./storyCatalog.js";

/** 同源代理端点（backend/main.py @app.post("/api/llm/chat")） */
export const LLM_ENDPOINT = "/api/llm/chat";

function buildSystemPrompt() {
  const catalog = getStoryCatalog();
  const byCat = catalog.reduce((m, c) => {
    (m[c.category] ??= []).push(`${c.id}(${c.label})`);
    return m;
  }, {});
  return [
    "你是 TigerMessenger 小星球游戏的故事板解析器。",
    "只能使用下列系统内已存在的资产 id，禁止编造新 id：",
    ...Object.entries(byCat).map(([cat, ids]) => `【${cat}】${ids.join("、")}`),
    `已知可对话角色：${KNOWN_ACTORS.join("、")}`,
    `时间线动作只能是：${STORY_ACTIONS.join("、")}`,
    "",
    "只输出严格 JSON，不要 markdown 代码块，不要多余文字。",
    'JSON 结构：{"title":string,"entities":[{"uid":string,"type":白名单id,"count"?:number}],"timeline":[步骤...]}',
    "",
    "时间线步骤字段：",
    '- {"type":"spawn","uid":"e1"}',
    '- {"type":"say","actor":"e1或player","text":"台词"}',
    '- {"type":"moveTo","actor":"e1","target":"near_player"或uid,"speed":2}',
    '- {"type":"wait","seconds":1}',
    '- {"type":"focusCamera","target":"e1","seconds":1.5}',
    '- {"type":"toast","text":"提示文字"}',
    '- {"type":"weather","value":"clear"|"rain"|"snow"}',
    "",
    "要求：entities 的 uid 唯一；timeline 里的 actor/target 必须是 entities 的 uid 或已知角色；",
    "先 spawn 再 say/moveTo；count 最多 8；台词不超过 60 字。",
  ].join("\n");
}

/**
 * 调用同源代理解析故事板文本。
 * @param {string} storyText
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<object>} 未校验的 spec（交给 storyEngine 过白名单）
 */
export async function requestStoryboard(storyText, opts = {}) {
  const text = String(storyText || "").trim();
  if (!text) throw new Error("故事板内容为空");

  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      agent: "storyboard",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: text.slice(0, 2000) },
      ],
      max_tokens: 1200,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    // 后端约定：503 未配置密钥 / 504 上游超时
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    const hint =
      res.status === 503
        ? "（服务端未配置 LLM_API_KEY）"
        : res.status === 504
          ? "（上游响应超时）"
          : "";
    throw new Error(`LLM 请求失败 ${res.status}${hint}${detail ? `：${String(detail).slice(0, 160)}` : ""}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new Error("LLM 返回内容为空");
  return extractJson(raw);
}

/** 从模型输出里抠出 JSON（容忍 ```json 包裹与前后废话） */
export function extractJson(raw) {
  if (raw && typeof raw === "object") return raw;
  const s = String(raw);
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型输出中未找到 JSON 对象");
  return JSON.parse(body.slice(start, end + 1));
}
