/** 1897266928961700215 "Yet another hallway design";
 * 1890018647655272491 "Further iterations on hallway design".
 * Retains the original procedural motif paths; clips each panel and measures an
 * independent ink mask so background tint never counts as drawn linework.
 */
import {planDoodlePanels} from '../core/doodle-layout.js';
export const INK='rgba(58,51,44,.92)';
export const PANEL_TINTS=['#c9d6ea','#c9e3c5','#f0dfc0','#efd2d4','#dcd8ea','#d9e6df'];
export const PAPER='#f4f2ec';
const MOTIFS = {
  /** 鱼：椭圆身体 + 三角尾 + 鳃 + 三片鳍 + 眼睛。 */
  fish(ctx, s, t) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.78, s * 0.40, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.74, 0); ctx.lineTo(-s * 1.18, -s * 0.40); ctx.lineTo(-s * 1.18, s * 0.40);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.46, -s * 0.08, s * 0.09, 0, Math.PI * 2); ctx.stroke();
    // 鳃
    ctx.beginPath(); ctx.arc(s * 0.22, 0, s * 0.26, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    // 背鳍 / 腹鳍 / 侧鳍
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.36); ctx.quadraticCurveTo(0, -s * 0.72, s * 0.24, -s * 0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.36); ctx.quadraticCurveTo(0, s * 0.66, s * 0.22, s * 0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.02, s * 0.16); ctx.lineTo(s * 0.22, s * 0.5); ctx.stroke();
  },

  /** 猫头鹰：两个大眼 + 身体 + 耳羽 + 爪。 */
  owl(ctx, s, t) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.16, s * 0.52, s * 0.66, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.26, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.24, -s * 0.26, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.26, s * 0.06, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.24, -s * 0.26, s * 0.06, 0, Math.PI * 2); ctx.stroke();
    // 喙
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.06); ctx.lineTo(-s * 0.09, s * 0.10); ctx.lineTo(s * 0.09, s * 0.10);
    ctx.closePath(); ctx.stroke();
    // 耳羽
    ctx.beginPath(); ctx.moveTo(-s * 0.46, -s * 0.42); ctx.lineTo(-s * 0.34, -s * 0.78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.46, -s * 0.42); ctx.lineTo(s * 0.34, -s * 0.78); ctx.stroke();
    // 翅膀
    ctx.beginPath(); ctx.arc(-s * 0.30, s * 0.30, s * 0.26, -Math.PI * 0.2, Math.PI * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.30, s * 0.30, s * 0.26, Math.PI * 0.5, Math.PI * 1.2); ctx.stroke();
  },

  /** 花：五瓣 + 花心 + 茎 + 两片叶。 */
  flower(ctx, s, t) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34, s * 0.22, s * 0.30, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.55); ctx.lineTo(0, s * 1.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.82); ctx.quadraticCurveTo(s * 0.34, s * 0.72, s * 0.30, s * 1.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.92); ctx.quadraticCurveTo(-s * 0.34, s * 0.84, -s * 0.30, s * 1.12); ctx.stroke();
  },

  /** 四叶草：三片心形 + 梗。 */
  clover(ctx, s, t) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const cx = Math.cos(a) * s * 0.30, cy = Math.sin(a) * s * 0.30;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, cy + s * 0.12);
      ctx.lineTo(cx, cy + s * 0.34);
      ctx.lineTo(cx + s * 0.10, cy + s * 0.12);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.lineTo(0, s * 1.05); ctx.stroke();
  },

  /** 甲虫：椭圆身 + 中缝 + 六条腿 + 触角。 */
  bug(ctx, s, t) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.40, s * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.48); ctx.lineTo(0, s * 0.58); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.52, s * 0.20, 0, Math.PI * 2); ctx.stroke();
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y = s * (-0.18 + k * 0.26);
        ctx.beginPath();
        ctx.moveTo(side * s * 0.34, y);
        ctx.quadraticCurveTo(side * s * 0.72, y + s * 0.10, side * s * 0.80, y + s * 0.28);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(side * s * 0.12, -s * 0.66);
      ctx.quadraticCurveTo(side * s * 0.30, -s * 0.95, side * s * 0.10, -s * 1.05);
      ctx.stroke();
    }
  },

  /** 山羊头（参考帧里最大的一只）。 */
  mask(ctx, s, t) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.55);
    ctx.quadraticCurveTo(-s * 0.46, s * 0.35, 0, s * 0.92);
    ctx.quadraticCurveTo(s * 0.46, s * 0.35, s * 0.34, -s * 0.55);
    ctx.quadraticCurveTo(0, -s * 0.78, -s * 0.34, -s * 0.55);
    ctx.stroke();
    // 角
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.30, -s * 0.60);
      ctx.quadraticCurveTo(side * s * 0.78, -s * 0.86, side * s * 0.62, -s * 1.16);
      ctx.stroke();
    }
    // 眼 + 鼻
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.16, s * 0.075, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.16, s * 0.075, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(0, s * 0.30); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, s * 0.34, s * 0.12, 0, Math.PI * 2); ctx.stroke();
  },

  /** 波浪（窄花边用）。 */
  wave(ctx, s, t) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = -s + (i / 8) * s * 2;
      const y = Math.sin((i / 8) * Math.PI * 2) * s * 0.35;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },

  /** 三角（窄花边用）。 */
  zig(ctx, s, t) {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const x = -s + (i / 6) * s * 2;
      const y = i % 2 ? s * 0.3 : -s * 0.3;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
};

const NAMES = ['fish', 'owl', 'flower', 'clover', 'bug', 'mask'];

/**
 * 画一格涂鸦。
 *
 * `scale` 是这一格的中心到边的距离（世界/像素都行，只要有意义）。
 * 线宽 = scale * ink，**统一**传入 —— 参考帧里所有涂鸦的线宽是一样的，
 * 只是尺寸不同；如果按尺寸缩放线宽，小涂鸦会糊成一团。
 */
export function drawMotif(ctx, kind, cx, cy, scale, lineWidth, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.strokeStyle = INK;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fn = MOTIFS[kind] || MOTIFS.flower;
  fn(ctx, scale, lineWidth);
  ctx.restore();
}


export function makeDoodleWall({gray=false,...options}={}){
  const plan=planDoodlePanels(options),canvas=document.createElement('canvas'),mask=document.createElement('canvas');
  canvas.width=mask.width=Math.round(plan.width);canvas.height=mask.height=Math.round(plan.height);
  const ctx=canvas.getContext('2d'),ink=mask.getContext('2d');ctx.fillStyle=gray?'#ffffff':PAPER;ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const p of plan.panels){ctx.fillStyle=gray?'#ffffff':PANEL_TINTS[p.tint];ctx.fillRect(p.x,0,p.visibleWidth,p.wallH);ink.save();ink.beginPath();ink.rect(p.x+plan.lineWidth,plan.lineWidth,Math.max(0,p.visibleWidth-plan.lineWidth*2),Math.max(0,p.wallH-plan.lineWidth*2));ink.clip();for(const m of p.motifs)drawMotif(ink,NAMES[m.kind],m.x,m.y,m.size,plan.lineWidth,m.rotation);ink.restore();
    ctx.fillStyle='#ffffff';ctx.fillRect(p.x+p.w,0,p.gap,p.wallH);ctx.strokeStyle=gray?'#55534f':INK;ctx.lineWidth=plan.lineWidth;for(let y=10;y<p.wallH;y+=18){ctx.beginPath();ctx.moveTo(p.x+p.w+p.gap*.2,y);ctx.lineTo(p.x+p.w+p.gap*.5,y+4);ctx.lineTo(p.x+p.w+p.gap*.8,y);ctx.stroke();}}
  const pixels=ink.getImageData(0,0,mask.width,Math.ceil(plan.wallH)).data;let alpha=0;for(let i=3;i<pixels.length;i+=4)alpha+=pixels[i]/255;
  ctx.save();if(gray)ctx.filter='grayscale(1)';ctx.drawImage(mask,0,0);ctx.restore();ctx.fillStyle='#ffffff';ctx.fillRect(0,plan.wallH,canvas.width,canvas.height-plan.wallH);ctx.strokeStyle=gray?'#55534f':INK;ctx.lineWidth=1;for(let x=plan.flutePitch;x<plan.width;x+=plan.flutePitch){ctx.beginPath();ctx.moveTo(x,plan.wallH+5);ctx.lineTo(x,plan.height);ctx.stroke();}ctx.lineWidth=plan.lineWidth*1.5;ctx.beginPath();ctx.moveTo(0,plan.wallH);ctx.lineTo(plan.width,plan.wallH);ctx.stroke();
  return {canvas,mask,plan,stats:{panels:plan.panels.length,inkPct:alpha/(mask.width*Math.ceil(plan.wallH))*100,wainscotPct:(options.wainscot??.38)*100}};
}
