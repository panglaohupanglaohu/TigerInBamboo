// 母女对话系统：虎（女儿）问 → 兔（母亲）答，一问一答成对抽取
// 应答默认走内置问答脚本；配置 dialog.llmEndpoint 后由大模型生成母亲回复（OpenAI 兼容接口）
// 语音：浏览器 speechSynthesis 中文女声（配置页可调嗓音/语速/音高/音量）
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
    const reply = await this._askMother(pair);
    this._convo = {
      lines: [
        { who: "tiger", text: pair.ask },
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

  /** 母亲应答：配了大模型接口则问 LLM（失败回落内置脚本），否则用内置问答 */
  async _askMother(pair) {
    const { llmEndpoint, llmApiKey, llmModel } = this.cfg;
    if (!llmEndpoint) return pair.reply;
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
            {
              role: "system",
              content:
                "你是一只雪兔母亲，对方是你溺爱的女儿（一只小老虎）。用中文口语回一两句：" +
                "先回答她的问安，再反过来叮嘱疼爱她，句句体现溺爱。不要书面腔。",
            },
            { role: "user", content: pair.ask },
          ],
          max_tokens: 80,
        }),
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (_) { /* 接口不可用则回落内置脚本 */ }
    return pair.reply;
  }

  /** 语音朗读：中文女声；母兔音偏高柔、虎女略低嫩 */
  _speak(text, who) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    const v = this._pickVoice();
    if (v) u.voice = v;
    u.rate = this.cfg.voiceRate ?? 1.0;
    u.pitch = (this.cfg.voicePitch ?? 1.15) * (who === "rabbit" ? 1.05 : 0.9);
    u.volume = this.cfg.voiceVolume ?? 0.9;
    speechSynthesis.speak(u);
  }

  _pickVoice() {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    const name = (this.cfg.voiceName ?? "auto").trim();
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
