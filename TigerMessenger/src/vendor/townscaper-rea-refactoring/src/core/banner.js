/** 958410200146497537: a catalogue of coloured banners, white emblems and
 * several cut tails. This is a local procedural vocabulary, not copied art.
 * UV v=0 is the bottom edge, matching DataTexture + the Bezier cloth UVs.
 */
export const BANNER_TAILS=['straight','swallow','fork','triple','point','step'];
export const BANNER_EMBLEMS=['none','sun','tree','tower','mountain','clover','skull','sword','trident'];
export function bannerContains(u,v,{tail='fork',notch=.45}={}) {
  if(!BANNER_TAILS.includes(tail)||!Number.isFinite(notch)||notch<.1||notch>.65)throw new RangeError('invalid banner tail');
  if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)return false;
  if(tail==='swallow')return u<=1-notch*(1-Math.abs(v*2-1));
  if(tail==='fork'||tail==='triple') {
    if(u<=1-notch)return true;
    const t=(u-(1-notch))/notch,centres=tail==='fork'?[0,1]:[0,.5,1],half=(tail==='fork'?.22:.16)*(1-t);
    return centres.some(c=>Math.abs(v-c)<=half);
  }
  if(tail==='point')return u<=.78+.22*(1-Math.abs(v*2-1));
  if(tail==='step')return u<=.93||Math.min(4,Math.floor(v*5))%2===0;
  return true;
}
function inkAt(u,v,aspect,emblem) {
  const x=(u-.28)*aspect,y=v-.5,circle=(cx,cy,r)=>Math.hypot(x-cx,y-cy)<=r;
  // 827216768783495168: local white role marks; original ornate shields remain separate.
  if(emblem==='sword')return (Math.abs(x)<.025&&y>-.22&&y<.23)||(Math.abs(x)<.09&&Math.abs(y+.10)<.025)||(y>.2&&y<.29&&Math.abs(x)<(.29-y)*.3);
  if(emblem==='trident')return (Math.abs(x)<.024&&y>-.26&&y<.22)||(Math.abs(y+.02)<.024&&Math.abs(x)<.14)||(Math.abs(Math.abs(x)-.12)<.024&&y>-.02&&y<.22);
  if(emblem==='skull'){const outer=circle(0,.06,.15)||(Math.abs(x)<.10&&y>-.18&&y<-.04);const eyes=circle(-.06,.08,.035)||circle(.06,.08,.035),nose=Math.abs(x)<.018&&y>-.015&&y<.025;return outer&&!eyes&&!nose;}
  if(emblem==='sun')return circle(0,0,.14)||Array.from({length:8},(_,i)=>i*Math.PI/4).some(a=>circle(Math.cos(a)*.205,Math.sin(a)*.205,.025));
  if(emblem==='tree')return(Math.abs(x)<.025&&y>-.24&&y<.12)||circle(-.1,.08,.10)||circle(0,.16,.115)||circle(.1,.08,.10);
  if(emblem==='tower'){const body=Math.abs(x)<.09&&y>-.24&&y<.20,top=y>.16&&y<.28&&[-.07,0,.07].some(c=>Math.abs(x-c)<.025),hole=Math.abs(x)<.022&&y>-.05&&y<.06;return(body||top)&&!hole;}
  if(emblem==='mountain')return y>-.23&&y<.25&&Math.abs(x)<(.25-y)*.6;
  if(emblem==='clover')return circle(0,.12,.1)||circle(-.1,-.06,.1)||circle(.1,-.06,.1);
  return false;
}
export function bakeBanner({width=128,height=64,color=[80,170,160],tail='fork',emblem='tree',notch=.45}={}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<32||height<16||width>512||height>256||!Array.isArray(color)||color.length!==3||color.some(c=>!Number.isInteger(c)||c<0||c>255)||!BANNER_EMBLEMS.includes(emblem))throw new RangeError('invalid banner image');
  bannerContains(.5,.5,{tail,notch});
  const rgba=new Uint8Array(width*height*4),du=1/width,dv=1/height;let opaque=0,white=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const u=(x+.5)/width,v=(y+.5)/height,id=(y*width+x)*4;
    if(!bannerContains(u,v,{tail,notch}))continue;
    const edge=![[u-du,v],[u+du,v],[u,v-dv],[u,v+dv]].every(([a,b])=>bannerContains(a,b,{tail,notch}));
    const ink=inkAt(u,v,width/height,emblem);
    rgba.set(edge?[30,40,48,255]:ink?[255,255,255,255]:[...color,255],id);opaque++;if(ink&&!edge)white++;
  }
  return{width,height,rgba,opaque,white,tail,emblem,notch};
}

/* 第 53 批（G5）：827216768783495168（原文 And another one；三队各举一面浅蓝底大旗，白徽记 骷髅/剑/三叉戟）。
 * REACode/src/squadbanner.js 的两件「共用一份」：
 *   · 三格徽记图集：徽记只画一次，旗面/盾面都按格号取（旗面墨量 = 图集那一格的墨量）；
 *   · 军色 → 角色色：一队一个色相，身体/盾/头盔/旗底按同一套明度/饱和度偏移派生（队内色差恒 0）。
 *   · 旗面公告板偏航夹在 ±40°（投影宽最少 cos40°）。
 * 金饰盾纹、竖旗横杆与 Battle 里的实际替换尚未做（Battle 仍是 Bezier 飘带旗 + 单色盾）。 */
export const SQUAD_EMBLEMS=Object.freeze(['skull','sword','trident']);
export function bakeEmblemAtlas({cell=48,emblems=SQUAD_EMBLEMS}={}){
 if(!Number.isInteger(cell)||cell<16||cell>256)throw new RangeError('invalid atlas cell');
 const width=cell*emblems.length,height=cell,rgba=new Uint8Array(width*height*4),ink=new Array(emblems.length).fill(0);
 emblems.forEach((e,k)=>{if(!BANNER_EMBLEMS.includes(e))throw new RangeError('unknown emblem');
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){const u=.28+((x+.5)/cell-.5),v=(y+.5)/cell;if(inkAt(u,v,1,e)){const i=(y*width+k*cell+x)*4;rgba.set([255,255,255,255],i);ink[k]++;}}});
 return{width,height,cell,rgba,emblems:[...emblems],ink:ink.map(n=>n/(cell*cell)),uv:(k)=>({u0:k/emblems.length,u1:(k+1)/emblems.length,v0:0,v1:1})};
}
export const SQUAD_ROLES=Object.freeze({body:{dl:-.16,s:.34},shield:{dl:.04,s:.52},helmet:{dl:.30,s:.16},field:{dl:.26,s:.46}});
export function hslToRgb(h,s,l){const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return[f(0),f(8),f(4)];}
export function squadRolePalette(hue){if(!Number.isFinite(hue))throw new RangeError('invalid hue');const h=((hue%360)+360)%360;return Object.fromEntries(Object.entries(SQUAD_ROLES).map(([k,r])=>[k,hslToRgb(h,r.s,.5+r.dl)]));}
export function bannerBillboardYaw(yawDeg,clampDeg=40){if(!Number.isFinite(yawDeg))throw new RangeError('invalid yaw');const y=Math.max(-clampDeg,Math.min(clampDeg,yawDeg));return{yaw:y,clamped:y!==yawDeg,widthRatio:Math.cos(y*Math.PI/180)};}
