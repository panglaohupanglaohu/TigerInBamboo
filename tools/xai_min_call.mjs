#!/usr/bin/env node
// 最小 xAI 调用：无需 npm 依赖
// 1) 到 https://console.x.ai/team/default/api-keys 创建钥匙
// 2) export XAI_API_KEY="xai-..."
// 3) node tools/xai_min_call.mjs
//    node tools/xai_min_call.mjs "用一句话介绍西芳寺"

const key = process.env.XAI_API_KEY;
if (!key) {
  console.error("缺少 XAI_API_KEY。先：export XAI_API_KEY=\"xai-...\"");
  process.exit(1);
}

const prompt = process.argv.slice(2).join(" ").trim() || "Say hello in one short sentence.";

const res = await fetch("https://api.x.ai/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "grok-4.6",
    input: prompt,
  }),
});

const body = await res.json();
if (!res.ok) {
  console.error(res.status, body);
  process.exit(1);
}

const text =
  body.output_text
  || body.output?.flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" || part.text)
    .map((part) => part.text)
    .join("")
  || JSON.stringify(body, null, 2);

console.log(text);
