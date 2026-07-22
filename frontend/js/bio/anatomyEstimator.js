// 解剖结构推断：上传图片 → 轮廓/主轴/主色分析 → 推断解剖类型与体型比例
// 纯前端离线实现（Canvas 2D 像素统计），不引入任何外部 ML 推理服务。
// 物理约束：照片无绝对尺度，故绝对尺寸为「典型基线 × 形态因子」的合理猜测，
// 比例（颈长/腿长/尾长相对身高）才是推断重点，最终由用户覆盖确认。

// 各解剖类型的先验：典型身高基线(m)、腿长/颈长/尾长占身高比、轮廓形态先验
const ANATOMY_PRIOR = {
  AVES:        { baseH: 0.62, leg: 0.55, neck: 1.10, tail: 0.35, name: "禽（长颈/长肢）" },
  UNGULIGRADE: { baseH: 1.10, leg: 0.62, neck: 0.45, tail: 0.30, name: "蹄行（修长四肢）" },
  DIGITIGRADE: { baseH: 0.55, leg: 0.50, neck: 0.35, tail: 0.55, name: "趾行（猫科式）" },
  SALTATORIAL: { baseH: 0.30, leg: 0.42, neck: 0.30, tail: 0.70, name: "跳跃行（紧凑）" },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 由轮廓特征推断解剖类型，输出各类型评分（0..1） */
function scoreAnatomy(f) {
  const { ratio, elongation, angle, fgRatio } = f;
  // 主轴相对竖直的程度：|sin(angle)|≈1 表示主轴竖直（禽类长颈/长腿）
  const verticalness = Math.abs(Math.sin(angle));
  const horizontalness = Math.abs(Math.cos(angle));
  const scores = {};
  // 禽类：极细长 + 主轴偏竖（脖/腿立起）
  scores.AVES = clamp((elongation - 2.4) / 2.2, 0, 1) * 0.7 + verticalness * 0.3;
  // 跳跃行：方胖（ratio≈1、伸长率低）
  scores.SALTATORIAL = clamp((1.5 - elongation) / 0.8, 0, 1) * 0.6 +
    clamp((1.25 - (ratio ?? 1)) / 0.5, 0, 1) * 0.4;
  // 蹄行：高伸长且偏横向舒展（瘦高四足）
  scores.UNGULIGRADE = clamp((elongation - 1.9) / 1.6, 0, 1) * 0.6 + horizontalness * 0.4 * clamp((ratio ?? 1) - 1.1, 0, 1);
  // 趾行：中等形态（默认兜底）
  scores.DIGITIGRADE = 0.45;
  // 主体占比越大、轮廓越干净，信号越可信
  const clean = clamp((fgRatio - 0.03) / 0.25, 0, 1);
  for (const k of Object.keys(scores)) scores[k] *= 0.6 + 0.4 * clean;
  return scores;
}

/**
 * 推断物种解剖结构
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @returns {{
 *   anatomyType:string, confidence:number,
 *   dimensions:{width:number,height:number,length:number},
 *   proportions:{neckLen:number,legLen:number,tailLen:number},
 *   palette:string[], bestHex:string|null, ratio:number|null,
 *   scores:Object, features:Object
 * }}
 */
export function estimateAnatomy(img, analyze = null) {
  const a = analyze || analyzeImageInline(img);
  const f = {
    ratio: a.ratio, elongation: a.elongation, angle: a.angle, fgRatio: a.fgRatio,
  };
  const scores = scoreAnatomy(f);
  // 取最高分类型
  let anatomyType = "DIGITIGRADE", best = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > best) { best = v; anatomyType = k; }
  }
  const prior = ANATOMY_PRIOR[anatomyType];
  const confidence = clamp(best, 0.35, 0.96);

  // 绝对尺寸猜测：典型身高基线 × 伸长率微调（照片无尺度，仅作合理初值）
  const hFactor = clamp((a.elongation - 1) / 3, 0, 1);
  const height = +(prior.baseH * (0.8 + 0.4 * hFactor)).toFixed(2);
  const ratio = a.ratio ?? (anatomyType === "SALTATORIAL" ? 1 : 1.6);
  const length = +(Math.min(3.5, Math.max(0.2, height * ratio))).toFixed(2);
  const width = +(Math.min(1.6, Math.max(0.08, height * (anatomyType === "SALTATORIAL" ? 0.55 : 0.4)))).toFixed(2);

  // 比例（相对身高）
  const proportions = {
    neckLen: +(prior.neck * (0.8 + 0.4 * hFactor)).toFixed(2),
    legLen: +(prior.leg).toFixed(2),
    tailLen: +(prior.tail).toFixed(2),
  };

  return {
    anatomyType,
    confidence,
    dimensions: { width, height, length },
    proportions,
    palette: a.palette,
    bestHex: a.bestHex,
    ratio: a.ratio,
    scores,
    features: { elongation: a.elongation, angle: a.angle, fgRatio: a.fgRatio, subjectW: a.subjectW, subjectH: a.subjectH },
  };
}

// 内联调用 lab.js 的 analyzeImage（避免循环依赖：由调用方注入或直接复用全局）
function analyzeImageInline(img) {
  if (typeof window !== "undefined" && window.__analyzeImage) return window.__analyzeImage(img);
  throw new Error("anatomyEstimator 需要 analyzeImage：请由 lab.js 调用 estimateAnatomy(img, analyzeImage(img))");
}

export { ANATOMY_PRIOR };
