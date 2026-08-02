// 母女对话协调器：开口意图由虎/兔各自的 AgentMind 产生；本模块只编排与呈现。
// 文本走统一同源 LLM 代理，失败回落内置脚本；语音为浏览器 speechSynthesis 中文女声。
import * as THREE from "../assets/vendor/three/three.module.js";

// 内置问答脚本（女儿·虎 问 → 母亲·兔 答）：成对抽取，一问一答
const DIALOGUES = [
  { ask: "妈妈，你睡的好吗？", reply: "睡的好，你别踹被子，冻着了。" },
  { ask: "妈妈，你饿吗？", reply: "妈妈不饿，但是你得多吃。" },
  { ask: "妈妈，我饿了。", reply: "虎虎，妈妈给做做水煎肉。" },
  { ask: "没手机，抓着玩，不无聊。", reply: "虎虎，别抓鸡了，我不吃。" },
];

// 女儿接话（收尾一轮）
const DAUGHTER_FOLLOWS = ["知道啦，妈妈。", "妈妈最好了。", "嗯，虎虎记下了。", "妈妈放心，我壮着呢。"]; 
const MOTHER_OPENINGS = ["虎虎，过来让妈妈看看。", "斑阑，今天走得累不累？", "孩子，林子里风凉，挨妈妈近些。"];
const MOTHER_FOLLOWS = ["乖，妈妈在这里。", "慢慢走，别急。", "你平安回来，妈妈就放心了。"];

const _pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _v = new THREE.Vector3();

/**
 * 对话出口规范：删除括号内的动作/语气说明，并把母亲称谓统一成“妈妈”。
 * 同时用于气泡与 TTS，避免仅靠提示词约束模型。
 */
export function sanitizeDialogueText(input) {
  let text = String(input ?? "");
  // 连做两轮，兼容模型偶尔输出的简单嵌套括号。
  for (let i = 0; i < 2; i++) {
    text = text
      .replace(/（[^（）]*）/g, "")
      .replace(/\([^()]*\)/g, "")
      .replace(/【[^【】]*】/g, "")
      .replace(/\[[^\[\]]*\]/g, "");
  }
  text = text
    .replace(/娘亲|阿娘|额娘|娘娘|母亲|妈咪|阿母/g, "妈妈")
    .replace(/(^|[\s，。！？、：；“”"'])娘(?=$|[\s，。！？、：；“”"'])/g, "$1妈妈")
    .replace(/妈妈(?:[\s、，]*妈妈)+/g, "妈妈")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([，。！？、：；])/g, "$1")
    .trim();
  return text;
}

export class DialogSystem {
  /**
   * @param {Tiger} tiger - 女儿
   * @param {Rabbit} rabbit - 母亲
   * @param {Object} config - 全局配置（取 config.dialog）
   */
  constructor(tiger, rabbit, config) {
    this.tiger = tiger;
    this.rabbit = rabbit;
    this.cfg = config.dialog ?? {};
    this._cd = 8;          // 首次触发冷却（秒）
    this._starting = false;
    this._preferRabbit = false;
    this._convo = null;    // 进行中的会话 { lines, i, left }
    this._bubbles = {
      tiger: document.getElementById("bubble-tiger"),
      rabbit: document.getElementById("bubble-rabbit"),
    };
    if ("speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = () => {}; // 触发嗓音列表加载
      speechSynthesis.getVoices();
      // 浏览器自动播放策略：首次交互后解锁语音
      const unlock = () => {
        speechSynthesis.resume();
        window.removeEventListener("pointerdown", unlock);
      };
      window.addEventListener("pointerdown", unlock);
    }
  }

  /** 每帧：气泡跟随 + 会话推进；触发权属于虎/兔智能体的 dialog 意图。 */
  update(dt, camera) {
    this._place(camera);
    if (!this.cfg.enabled || this.tiger.group.visible === false) { this._hideAll(); return; }

    if (this._convo) {
      this._convo.left -= dt;
      if (this._convo.left <= 0) this._nextLine();
      return;
    }
    this._cd -= dt;
    if (this._cd > 0 || this._starting) {
      // 冷却期间丢弃旧意图，防止冷却结束后立即播放过期对话。
      this.tiger.mind?.consume("dialog");
      this.rabbit.mind?.consume("dialog");
      return;
    }
    const d = this.tiger.group.position.distanceTo(this.rabbit.group.position);
    if (d >= 2.8) return;
    const tigerIntent = this.tiger.mind?.consume("dialog");
    const rabbitIntent = this.rabbit.mind?.consume("dialog");
    if (!tigerIntent && !rabbitIntent) return;
    const initiator = tigerIntent && rabbitIntent
      ? (this._preferRabbit ? "rabbit" : "tiger")
      : (rabbitIntent ? "rabbit" : "tiger");
    this._preferRabbit = !this._preferRabbit;
    this._start(initiator);
  }

  async _start(initiator = "tiger") {
    if (this._starting || this._convo) return;
    this._starting = true;
    document.documentElement.dataset.dialogTrigger = "agent-intent";
    document.documentElement.dataset.lastDialogInitiator = initiator;
    document.documentElement.dataset.lastDialogAt = String(Date.now());
    try {
      const pair = _pick(DIALOGUES);
      let lines;
      if (initiator === "rabbit") {
        const opening = await this._askMotherOpening();
        const reply = await this._askDaughterReply(opening);
        lines = [
          { who: "rabbit", text: opening },
          { who: "tiger", text: reply },
          { who: "rabbit", text: _pick(MOTHER_FOLLOWS) },
        ];
      } else {
        const ask = await this._askDaughter(pair);
        const reply = await this._askMother(pair, ask);
        lines = [
          { who: "tiger", text: ask },
          { who: "rabbit", text: reply },
          { who: "tiger", text: _pick(DAUGHTER_FOLLOWS) },
        ];
      }
      this._convo = { lines, i: 0, left: 0, initiator };
      this._playLine();
    } finally {
      this._starting = false;
    }
  }

  _nextLine() {
    this._hideAll();
    this._convo.i++;
    if (this._convo.i >= this._convo.lines.length) {
      this._convo = null;
      this._cd = this.cfg.interval ?? 26; // 一轮结束，进入间隔冷却
      return;
    }
    this._playLine();
  }

  _playLine() {
    const line = this._convo.lines[this._convo.i];
    const text = sanitizeDialogueText(line.text) || (line.who === "tiger" ? "妈妈。" : "妈妈在呢。");
    line.text = text;
    const el = this._bubbles[line.who];
    if (el) {
      el.textContent = text;
      el.classList.add("show");
    }
    this._speak(text, line.who);
    this._convo.left = THREE.MathUtils.clamp(1.6 + text.length * 0.14, 2.5, 6.5);
  }

  _hideAll() {
    for (const el of Object.values(this._bubbles)) el?.classList.remove("show");
  }

  /** 女儿问安：配了她自己的接口则由 LLM 生成（失败回落内置问安脚本） */
  async _askDaughter(pair) {
    const text = await this._agentLine(
      this.tiger,
      "你是一只小老虎，对方是你亲爱的妈妈（一只雪兔）。用中文口语向妈妈问安或撒娇，" +
      "一两句，天真孺慕，不要书面腔。",
      "你蹦到妈妈身边，开口说话。"
    );
    return text ?? pair.ask;
  }

  /** 母亲应答：配了她自己的接口则问 LLM（失败回落内置应答脚本） */
  async _askMother(pair, ask) {
    const text = await this._agentLine(
      this.rabbit,
      "你是一只雪兔母亲，对方是你溺爱的女儿（一只小老虎）。用中文口语回一两句：" +
      "先回答她的问安，再反过来叮嘱疼爱她，句句体现溺爱。不要书面腔。",
      ask
    );
    // 回落：问句是内置原句则成对取答，否则给通用溺爱应答
    return text ?? (ask === pair.ask ? pair.reply : "妈妈在呢，乖，妈妈都听见了。");
  }

  async _askMotherOpening() {
    const fallback = _pick(MOTHER_OPENINGS);
    const text = await this._agentLine(
      this.rabbit,
      "你是雪兔母亲，也是会自主感知并主动开口的画中智能体。女儿斑阑是一只小老虎。" +
      "你刚决定主动和她说话。用中文口语说一两句关心或叮嘱，温柔自然，不要书面腔。",
      "女儿来到你身边，请主动开口。"
    );
    return text ?? fallback;
  }

  async _askDaughterReply(opening) {
    const text = await this._agentLine(
      this.tiger,
      "你是名叫斑阑的小老虎，是会自主感知和回应的画中智能体。对方是你亲爱的雪兔母亲。" +
      "用中文口语回应一两句，天真亲昵，不要书面腔。",
      opening
    );
    return text ?? _pick(DAUGHTER_FOLLOWS);
  }

  /** 每个生物用自己的 AgentMind 调统一模型；失败由调用方回落内置文本。 */
  async _agentLine(agent, system, user) {
    const raw = await agent?.mind?.chat([
      { role: "system", content: system +
        "最终只输出角色真正说出口的台词，不得使用圆括号、方括号或任何括号补充动作和语气。" +
        "涉及母亲称谓时只能说‘妈妈’，禁止使用‘娘亲’‘娘’‘母亲’‘妈咪’等同义称呼。" },
      { role: "user", content: user },
    ], { maxTokens: 256, temperature: 0.8 });
    return sanitizeDialogueText(raw) || null;
  }

  /** 语音朗读：母女各自的中文女声配置（嗓音/语速/音高/音量） */
  _speak(text, who) {
    if (!("speechSynthesis" in window)) return;
    const spoken = sanitizeDialogueText(text);
    if (!spoken) return;
    const rc = (who === "rabbit" ? this.cfg.mother : this.cfg.daughter) ?? {};
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "zh-CN";
    const v = this._pickVoice(rc.voiceName);
    if (v) u.voice = v;
    u.rate = rc.voiceRate ?? 1.0;
    u.pitch = rc.voicePitch ?? (who === "rabbit" ? 1.2 : 1.05);
    u.volume = rc.voiceVolume ?? 0.9;
    speechSynthesis.speak(u);
  }

  _pickVoice(voiceName) {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    const name = (voiceName ?? "auto").trim();
    if (name && name !== "auto") {
      const hit = vs.find((v) => v.name === name) ?? vs.find((v) => v.name.includes(name));
      if (hit) return hit;
    }
    const zh = vs.filter((v) => v.lang.toLowerCase().startsWith("zh"));
    const female = zh.find((v) =>
      /xiaoxiao|xiaoyi|yaoyao|tingting|ting-ting|meijia|mei-jia|sinji|huihui|female|女/i.test(v.name)
    );
    return female ?? zh[0] ?? null;
  }

  /** 气泡跟随：世界坐标（头顶）→ 屏幕像素 */
  _place(camera) {
    for (const [who, agent] of [["tiger", this.tiger], ["rabbit", this.rabbit]]) {
      const el = this._bubbles[who];
      if (!el || !el.classList.contains("show")) continue;
      const head = agent.entity.boneMap.get("Head");
      if (!head) continue;
      head.getWorldPosition(_v);
      _v.y += who === "tiger" ? 0.55 : 0.28;
      _v.project(camera);
      el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`;
      el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
    }
  }
}
