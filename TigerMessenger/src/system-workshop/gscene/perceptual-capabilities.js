// Adapt the upstream shared OKLab math to the workshop's material table.
// This does not implement the upstream per-triangle contrast texture or terrain feature volume.
import {hexToOklab,clampOklabToGamut,deltaE} from '../../../../townscaper-web/REACodeRefactoring/src/core/oklab.js';
const hex=rgb=>'#'+rgb.map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
const weight=m=>Math.max(1,Number.isFinite(m.uses)?m.uses:1);
const bounded=(from,to,budget)=>{
 const before=hexToOklab(from);let lo=0,hi=1,result=from;
 // Clipping and 8-bit quantization can increase measured distance: measure the actual output.
 for(let i=0;i<18;i++){const t=i===0?1:(lo+hi)/2,lab=before.map((v,k)=>v+(to[k]-v)*t),candidate=hex(clampOklabToGamut(lab));
  if(deltaE(before,hexToOklab(candidate))<=budget+1e-6){result=candidate;lo=t;if(t===1)break;}else hi=t;
 }return result;
};
const match=M=>M.length?[{id:'materials',count:M.length,reason:'当前场景材质色表；保留已保存的人工调色，按真实色差限制变化'}]:[];
export const PERCEPTUAL_CAPABILITIES=[
 {meta:{id:'scene.oklab-contrast',domain:'atmosphere',line:'palette',name:'感知明暗层次',
   reads:['materials'],writes:['materials'],preserves:['userSaves'],
   does:'用重构库OKLab转换，在材质使用次数加权的亮度中心两侧拉开或收拢层次，保留色彩方向。每种材质按实际输出色差限制改动；不修改灯光、体素或模型。',
   related:['1482346496460828674'],modules:['src/core/oklab.js'],ideas:['townscaper-web/REACode/engine/outline.js'],   // 同帖落点：对比贴图喂 outline 线源
   keywords:['层次','对比','明暗','灰','contrast','oklab'],
   params:{gain:{label:'层次倍率',min:.75,max:1.4,step:.05,default:1.15},maxDelta:{label:'最大感知色差',min:1,max:20,step:1,default:8}}},
  match,run(M,p){const lab=M.map(m=>hexToOklab(m.color)),W=M.reduce((s,m)=>s+weight(m),0),pivot=M.reduce((s,m,i)=>s+lab[i][0]*weight(m),0)/Math.max(1,W),colors={};
   M.forEach((m,i)=>{const [L,a,b]=lab[i];colors[m.id]=bounded(m.color,[Math.max(0,Math.min(1,pivot+(L-pivot)*p.gain)),a,b],p.maxDelta);});return{colors,note:'材质表OKLab明暗适配；不是三角面contrast texture'};
  }},
 {meta:{id:'scene.oklab-palette',domain:'style',line:'palette',name:'感知色板归并',
   reads:['materials'],writes:['materials','palette'],preserves:['userSaves'],
   does:'复用重构库OKLab颜色空间，按感知色差与材质使用次数选主色，在归并时保留各材质原始明暗。保护已保存人工调色，限制每种材质的实际色差。',
   related:['1710031224838771027','1712088611934371876'],modules:['src/core/oklab.js'],ideas:['townscaper-web/REACode/src/palette.js'],   // 同帖：颜色可能性空间色板
   keywords:['主色','色板','归并','颜色','统一','palette','oklab'],
   params:{colors:{label:'主色数',min:2,max:12,step:1,default:5},strength:{label:'归并程度',min:.1,max:1,step:.05,default:.5},maxDelta:{label:'最大感知色差',min:1,max:20,step:1,default:8}}},
  match,run(M,p){if(!M.length)return{colors:{}};
   const pts=M.map(m=>({m,lab:hexToOklab(m.color)})).sort((a,b)=>weight(b.m)-weight(a.m)||a.m.id.localeCompare(b.m.id)),cent=[pts[0].lab.slice()];
   // Farthest-first initialization is deterministic even when the source table is reordered.
   while(cent.length<Math.min(Math.round(p.colors),pts.length)){let best=null,score=-1;for(const x of pts){const d=Math.min(...cent.map(c=>deltaE(c,x.lab)));if(d>score){score=d;best=x.lab;}}if(score<1e-8)break;cent.push(best.slice());}
   const nearest=lab=>{let best=0;for(let j=1;j<cent.length;j++)if(deltaE(cent[j],lab)<deltaE(cent[best],lab))best=j;return best;};
   for(let pass=0;pass<12;pass++){const sums=cent.map(()=>[0,0,0,0]);for(const x of pts){const sum=sums[nearest(x.lab)],w=weight(x.m);for(let k=0;k<3;k++)sum[k]+=x.lab[k]*w;sum[3]+=w;}for(let j=0;j<cent.length;j++)if(sums[j][3])cent[j]=sums[j].slice(0,3).map(v=>v/sums[j][3]);}
   const colors={};for(const x of pts){const c=cent[nearest(x.lab)],target=[x.lab[0],x.lab[1]+(c[1]-x.lab[1])*p.strength,x.lab[2]+(c[2]-x.lab[2])*p.strength];colors[x.m.id]=bounded(x.m.color,target,p.maxDelta);}return{colors,note:cent.length+'组感知主色，保留材质明暗；不是World八角点色体'};
  }}
];
