/** 958410200146497537: a catalogue of coloured banners, white emblems and
 * several cut tails. This is a local procedural vocabulary, not copied art.
 * UV v=0 is the bottom edge, matching DataTexture + the Bezier cloth UVs.
 */
export const BANNER_TAILS=['straight','swallow','fork','triple','point','step'];
export const BANNER_EMBLEMS=['none','sun','tree','tower','mountain','clover'];
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
