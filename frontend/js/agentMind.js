// 生物智能体统一心智接口：共享 LLM 配置、身份标记、意图队列与生态规则查询。
// API Key 只在后端；浏览器中的每个 AgentMind 只访问同源 /api/llm/chat。

export const FOOD_CHAIN_LEVEL = Object.freeze({
  APEX: "apex",
  CONSUMER: "consumer",
  PRODUCER: "producer",
});

let nextAgentId = 1;

function resolveMark(config, speciesId, fallbackName) {
  const configured = config?.ecology?.agentMarks?.[speciesId] || {};
  return Object.freeze({
    displayName: configured.displayName || fallbackName || speciesId,
    foodChainLevel: configured.foodChainLevel || FOOD_CHAIN_LEVEL.CONSUMER,
    tags: Object.freeze([...(configured.tags || [])]),
  });
}

export class AgentMind {
  constructor(owner, identity, config = {}) {
    const speciesId = identity.speciesId || identity.id || "agent";
    this.owner = owner;
    this.identity = Object.freeze({
      id: identity.id || `${speciesId}-${nextAgentId++}`,
      speciesId,
      species: identity.species || "",
      role: identity.role || "creature",
      name: identity.name || speciesId,
    });
    this.mark = resolveMark(config, speciesId, this.identity.name);
    const shared = config.agentLlm || {};
    this.llm = Object.freeze({
      enabled: shared.enabled !== false,
      endpoint: shared.endpoint || "/api/llm/chat",
      model: shared.model || "glm-5.1",
    });
    this._intents = [];
    this._lastIntentAt = new Map();
  }

  /** 智能体产生意图；同类意图在窗口内去重，供协调器消费。 */
  signal(type, payload = {}, dedupeMs = 1800) {
    const now = performance.now();
    const pending = this._intents.find((intent) => intent.type === type);
    if (pending) {
      pending.payload = payload;
      pending.at = Date.now();
      return false;
    }
    const last = this._lastIntentAt.get(type) || -Infinity;
    if (now - last < dedupeMs) return false;
    this._lastIntentAt.set(type, now);
    this._intents.push({ type, payload, at: Date.now(), agent: this.identity.id });
    if (this._intents.length > 12) this._intents.shift();
    return true;
  }

  consume(type) {
    const index = this._intents.findIndex((intent) => intent.type === type);
    return index < 0 ? null : this._intents.splice(index, 1)[0];
  }

  /**
   * 食物链逻辑接口：当前只返回标记与建议，不改变既有行为状态机。
   * 后续捕食/结盟规则可在真正执行动作前统一查询此接口。
   */
  relationGate(action, targetMind) {
    const source = this.mark.foodChainLevel;
    const target = targetMind?.mark?.foodChainLevel || FOOD_CHAIN_LEVEL.CONSUMER;
    return {
      action,
      source,
      target,
      markedApexPair: source === FOOD_CHAIN_LEVEL.APEX && target === FOOD_CHAIN_LEVEL.APEX,
      policy: "reserved",
    };
  }

  /** 调用统一后端模型；失败返回 null，让行为层决定是否采用本地脚本。 */
  async chat(messages, { maxTokens = 120, temperature = 0.75 } = {}) {
    if (!this.llm.enabled || !this.llm.endpoint) return null;
    try {
      const response = await fetch(this.llm.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.llm.model,
          agent: {
            ...this.identity,
            displayName: this.mark.displayName,
            foodChainLevel: this.mark.foodChainLevel,
            tags: this.mark.tags,
          },
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.choices?.[0]?.message?.content?.trim() || null;
    } catch (_) {
      return null;
    }
  }
}

export function attachAgentMind(owner, identity, config) {
  const mind = new AgentMind(owner, identity, config);
  owner.mind = mind;
  owner.agentProfile = {
    ...mind.identity,
    displayName: mind.mark.displayName,
    foodChainLevel: mind.mark.foodChainLevel,
    tags: [...mind.mark.tags],
  };
  if (owner.group?.userData) owner.group.userData.agentProfile = owner.agentProfile;
  return mind;
}
