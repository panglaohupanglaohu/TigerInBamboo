// 母女对话系统：虎（女儿）问 → 兔（母亲）答，一问一答成对抽取
// 母女各自独立配置：语音（嗓音/语速/音高/音量）与大模型接口（OpenAI 兼容），
// 接口留空的一方走内置脚本；语音为浏览器 speechSynthesis 中文女声
import * as THREE from "three";

// 内置问答脚本（女儿·虎 问 → 母亲·兔 答）：成对抽取，一问一答
const DIALOGUES = [
  { ask: "妈妈，你睡的好吗？", reply: "睡的好，你别踹被子。" },
  { ask: "妈妈，你饿吗？", reply: "妈妈不饿，但是你得多吃。" },
  { ask: "妈妈，我饿了。", reply: "虎虎，妈妈给做做水煎肉。" },
];

// 女儿接话（收尾一轮）
const DAUGHTER_FOLLOWS = ["知道啦，妈妈。", "妈妈最好了。", "嗯，虎虎记下了。", "妈妈放心，我壮着呢。"];

const _pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _v = new THREE.Vector3();

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

  /** 每帧：气泡跟随 + 会话推进 + 触发判定（母女相距 2.8m 内才搭话） */
  update(dt, camera) {
    this._place(camera);
    if (!this.cfg.enabled || this.tiger.group.visible === false) { this._hideAll(); return; }

    if (this._convo) {
      this._convo.left -= dt;
      if (this._convo.left <= 0) this._nextLine();
      return;
    }
    this._cd -= dt;
    if (this._cd > 0) return;
    const d = this.tiger.group.position.distanceTo(this.rabbit.group.position);
    if (d < 2.8) this._start();
    else this._cd = 2; // 尚未近身，两秒后再探
  }

  async _start() {
    const pair = _pick(DIALOGUES);
    const ask = await this._askDaughter(pair);
    const reply = await this._askMother(pair, ask);
    this._convo = {
      lines: [
        { who: "tiger", text: ask },
        { who: "rabbit", text: reply },
        { who: "tiger", text: _pick(DAUGHTER_FOLLOWS) },
      ],
      i: 0,
      left: 0,
    };
    this._playLine();
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
    const el = this._bubbles[line.who];
    if (el) {
      el.textContent = line.text;
      el.classList.add("show");
    }
    this._speak(line.text, line.who);
    this._convo.left = THREE.MathUtils.clamp(1.6 + line.text.length * 0.14, 2.5, 6.5);
  }

  _hideAll() {
    for (const el of Object.values(this._bubbles)) el?.classList.remove("show");
  }

  /** 女儿问安：配了她自己的接口则由 LLM 生成（失败回落内置问安脚本） */
  async _askDaughter(pair) {
    const text = await this._llm(
      this.cfg.daughter,
      "你是一只小老虎，对方是你亲爱的妈妈（一只雪兔）。用中文口语向妈妈问安或撒娇，" +
      "一两句，天真孺慕，不要书面腔。",
      "你蹦到妈妈身边，开口说话。"
    );
    return text ?? pair.ask;
  }

  /** 母亲应答：配了她自己的接口则问 LLM（失败回落内置应答脚本） */
  async _askMother(pair, ask) {
    const text = await this._llm(
      this.cfg.mother,
      "你是一只雪兔母亲，对方是你溺爱的女儿（一只小老虎）。用中文口语回一两句：" +
      "先回答她的问安，再反过来叮嘱疼爱她，句句体现溺爱。不要书面腔。",
      ask
    );
    // 回落：问句是内置原句则成对取答，否则给通用溺爱应答
    return text ?? (ask === pair.ask ? pair.reply : "妈妈在呢，乖，妈妈都听见了。");
  }

  /** OpenAI 兼容接口调用：无接口/请求失败皆返回 null（调用方回落内置脚本） */
  async _llm(roleCfg, system, user) {
    const { llmEndpoint, llmApiKey, llmModel } = roleCfg ?? {};
    if (!llmEndpoint) return null;
    try {
      const res = await fetch(llmEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: llmModel || "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 80,
        }),
      });
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (_) {
      return null;
    }
  }

  /** 语音朗读：母女各自的中文女声配置（嗓音/语速/音高/音量） */
  _speak(text, who) {
    if (!("speechSynthesis" in window)) return;
    const rc = (who === "rabbit" ? this.cfg.mother : this.cfg.daughter) ?? {};
    const u = new SpeechSynthesisUtterance(text);
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
