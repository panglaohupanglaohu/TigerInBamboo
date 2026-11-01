// Code-native planning diagram from the actual lake factory; not a GPU render.
import fs from 'node:fs';
import {COURIER_HEIGHT} from '../../../src/core/characterScale.js';
import {createCanvas} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js';
import {GREG_LAKE_PALETTE as P} from '../../../src/world/swampGregVisuals.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');
const wrap=createMoebiusSwampPlacement({scale:.5,seed:7711}),zone=wrap.userData.inner,plan=zone.userData.gregSpatialPlan;
const data={kind:'measured planning diagram, not GPU',scale:.5,levels:plan.levels,route:plan.route,worldTree:[-8,-7],dock:zone.userData.shipyard.dock.position.toArray(),palette:P,ecology:zone.userData.gregEcology?.records,habitation:zone.userData.gregHabitation?.site?.position};
fs.writeFileSync(new URL('board-data.json',import.meta.url),JSON.stringify(data,null,2));
const W=1600,H=1420,canvas=createCanvas(W,H),c=canvas.getContext('2d');
const ink=P.ink,paper='#f3efe5',line='#c9d3cb';
c.fillStyle=paper;c.fillRect(0,0,W,H);
function text(s,x,y,size=20,color=ink,weight='normal'){c.font=`${weight} ${size}px "Heiti SC", "PingFang SC", Arial`;c.fillStyle=color;c.fillText(s,x,y);}
function box(x,y,w,h,fill='#faf8f0',stroke=line){c.fillStyle=fill;c.fillRect(x,y,w,h);c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x,y,w,h);}
function poly(points,color,width=2,dash=[]){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
function circle(x,y,r,fill,stroke=ink){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
text('GREG TEAM  /  湖沼首轮施工图',48,63,34,ink,'bold');
text('先让层级和抵达成立，再加入色块、结构线与生态。',48,101,22);
text('实际工厂数据＋规划示意 · world unit · 非游戏渲染 · GPU与玩家通行待验',48,132,18,'#647771');
box(48,164,730,650);box(800,164,752,650);
text('01  局部俯视 / 路径与故事锚点',70,204,24,ink,'bold');
text('沿湖沼自身坐标绘制；球面位置另有朝向变换',70,233,16,'#647771');
const ox=405,oy=516,k=7.7,xy=(x,z)=>[ox+x*k,oy+z*k];
circle(ox,oy,34*k,'#d7dfcd','#819b90');
circle(ox,oy,33*k,'#bfd4d0','#93b1aa');
circle(ox,oy,23.5*k,P.water,'#668f93');
for(const plant of data.ecology||[]){const q=xy(plant.position[0],plant.position[2]);circle(...q,3.4,[P.foliage,P.foliageShade,P.warm][plant.speciesIndex],P.foliageShade);}
text('水位处碗壁截面示意',75,751,16,'#647771');
text('外圈水盘超宽为待核问题，图中不隐瞒',75,776,16,'#647771');
text('植被：折扇叶 / 杯叶蕨 / 灯穗草 · 66株',75,803,15,'#647771');
poly(plan.route.map(v=>xy(v[0],v[2])),P.path,25);
poly(plan.route.map(v=>xy(v[0],v[2])),'#bb7759',2);
for(const l of plan.levels){const a=(l.angleStart+l.angleEnd)/2,r=l.radius*2,pt=xy(Math.cos(a)*r,Math.sin(a)*r);circle(...pt,16,paper);text(String(l.id),pt[0]-6,pt[1]+7,20,ink,'bold');}
const tp=xy(-8,-7);circle(...tp,30,P.foliageShade);text('世界树',tp[0]-30,tp[1]-39,18);
const dock=zone.userData.shipyard.dock.position,dp=xy(dock.x,dock.z);box(dp[0]-25,dp[1]-11,50,22,P.bark,ink);text('维修船 / 原故事区',dp[0]-92,dp[1]+44,17);
const first=xy(...[plan.route[0][0],plan.route[0][2]]);poly([first,[713,first[1]+35]],ink);text('原阶侧接',639,first[1]+61,17);
if(data.habitation){const q=xy(data.habitation[0],data.habitation[2]);circle(...q,5,P.warm);text('维护架',q[0]+13,q[1]-13,16);}
poly([[94,687],[171,687]],ink,3);text('5 world unit',94,716,16);
text('↑ −Z',691,274,16);
text('02  展开剖面 / 看清层级落差',826,204,24,ink,'bold');
text('H = (inner Y − 40) × 0.5；相对坑缘切平面',826,233,16,'#647771');
const sx=846,sy=303,ys=24;
const layers=[['坑缘',0],['上岸 ①',-2.6],['中岸 ②',-4.6],['下岸 ③',-6.6],['湖面',-7.5],['湖床',-14.8]];
for(const [name,h]of layers){const y=sy-h*ys;poly([[sx,y],[1519,y]],line,1,[5,5]);text(`${name}  H ${h.toFixed(1)}`,sx,y-10,17);}
const route=plan.route;let distance=0;const unfolded=[];
route.forEach((p,i)=>{if(i){const q=route[i-1];distance+=Math.hypot(p[0]-q[0],p[2]-q[2])*.5;}unfolded.push([distance,(p[1]-40)*.5]);});
const plot=unfolded.map(([d,h])=>[936+d/distance*547,sy-h*ys]);
c.fillStyle=P.water;c.globalAlpha=.55;c.fillRect(sx,sy+7.5*ys,674,(14.8-7.5)*ys);c.globalAlpha=1;
poly([[853,sy],[875,sy],[934,sy+2.6*ys]],P.stoneShade,12);
poly(plot,P.path,12);poly(plot,ink,2);
text('保留原虎主阶',955,sy+27,16);text('新侧岸缓阶',1112,sy+78,17);
text('通路有效宽 2.0',1136,581,19);text('下岸高水面 0.9',1136,611,19);
text(`样区中心线水平长度 ${distance.toFixed(1)}`,1136,641,17);
const personX=1063,personY=sy+2.6*ys;
poly([[personX,personY],[personX,personY-COURIER_HEIGHT*ys]],ink,7);circle(personX,personY-COURIER_HEIGHT*ys+4,5,ink);
text(`玩家高 ${COURIER_HEIGHT} world`,964,714,17);
text('树冠是生态层，尚不是已可达楼层',826,751,18,'#647771');
text('原主阶坡度、水盘尺寸：下一批P0修正',826,779,18,'#647771');
text('03  抵达过程',48,859,25,ink,'bold');
const names=['桥与环岸','入口原阶','上岸 ①','下行缓阶','中岸 ②','下岸 ③'];
const desc=['辨认世界树','看见侧岸入口','俯看水面与去路','始终看清下一落脚点','地标再显现','近水停留，再沿原路返回'];
for(let i=0;i<6;i++){const x=48+i*253;box(x,881,237,107,i<2?'#e3e7dc':'#dce9e1');text(`${i+1}  ${names[i]}`,x+15,916,21,ink,'bold');text(desc[i],x+15,956,15);}
text('04  月夜湖沼色板 / 五色族＋明暗变体',48,1031,25,ink,'bold');
const labels={ink:'墨线',water:'水',waterDeep:'深水',stone:'岩石',stoneShade:'阴石',wall:'崖壁',bark:'根与木',foliage:'叶',foliageShade:'阴叶',flower:'花',warm:'暖光',path:'可走面'};
Object.entries(P).forEach(([key,color],i)=>{const x=48+i*126;box(x,1051,115,66,color,color);text(labels[key],x,1144,18);text(color.toUpperCase(),x,1173,16,'#647771');});
text('构图面积目标：水40% · 植被27% · 岩土/路16% · 木质12% · 暖色≤5%',48,1223,21);
text('颜色为本项目方案，并非作者原始数值；角色与花蕊动画保留身份。面积不是当前实景测量。',48,1256,18,'#647771');
poly([[48,1291],[1552,1291]],line);
text('依据：默认 seed7711 / swampV2=50 工厂  ·  三层承托CPU已测  ·  生态与居住见团队报告',48,1330,18);
text('学习依据：GDC 32:13 全篇字幕逐段分析＋32关键帧；Sable方法转化为项目实现，不冒称复刻源码。',48,1363,18,'#647771');
fs.writeFileSync(new URL('lake-plan-board.png',import.meta.url),canvas.toBuffer('image/png'));
console.log('saved lake-plan-board.png and board-data.json');
