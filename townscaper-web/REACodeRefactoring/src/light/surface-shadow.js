import * as THREE from 'three';
// 1704218784028905984 / 1705195380457996629 texture-based surface shadows on the shared World (2.5D).
// "the shadow casting height is independent of the z test height. Now I only get shadows over grass-cliff
//  edges and under roofs." Two independent knobs:
//   castHeight — who may cast. 'prominence' (REACode src/surfaceshadow.js): caster height above its blurred
//                local base; 'relative' (REACode engine/surfaceshadow.js): caster − (receiver + zBias) ≥ castHeight.
//   zBias      — ray depth bias only.
// Casters may differ from receivers: built tops add a roof rise (eaves cast, roofs never receive their own rise).
// No invented UV seams; islandSeams() only MEASURES a seam if a caller supplies tiled input.
const RAY_SPREAD=[-.028,0,.028];
export function bakeSurfaceShadow({width,height,heights,casters=heights,stepWorld=1,dx=1,dz=0,slope=1,castHeight=.15,zBias=.02,steps=32,rays=1,eligibility='prominence',baseRadius=2}) {
  if(!Number.isInteger(width)||width<2||!Number.isInteger(height)||height<2||heights.length!==width*height||casters.length!==heights.length||![stepWorld,dx,dz,slope,castHeight,zBias].every(Number.isFinite)||stepWorld<=0||Math.hypot(dx,dz)<1e-9||slope<0||castHeight<0||zBias<0||!Number.isInteger(steps)||steps<1||steps>128||!heights.every(Number.isFinite)||!casters.every(Number.isFinite)||(rays!==1&&rays!==3)||!['prominence','relative'].includes(eligibility)||!Number.isInteger(baseRadius)||baseRadius<1||baseRadius>16)throw new RangeError('surface shadow inputs');
  const prominence=new Float32Array(heights.length),shadow=new Uint8Array(heights.length);let eligible=0,hits=0;const len=Math.hypot(dx,dz);dx/=len;dz/=len;
  // local base = box mean of casters (prefix sums: radius may be large like REACode's 14px)
  const W=width+1,sat=new Float64Array(W*(height+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++)sat[(y+1)*W+x+1]=casters[y*width+x]+sat[y*W+x+1]+sat[(y+1)*W+x]-sat[y*W+x];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const x0=Math.max(0,x-baseRadius),x1=Math.min(width-1,x+baseRadius),y0=Math.max(0,y-baseRadius),y1=Math.min(height-1,y+baseRadius),s=sat[(y1+1)*W+x1+1]-sat[y0*W+x1+1]-sat[(y1+1)*W+x0]+sat[y0*W+x0],n=(x1-x0+1)*(y1-y0+1),i=y*width+x;prominence[i]=casters[i]-s/n;if(prominence[i]>=castHeight)eligible++}
  const spread=rays===3?RAY_SPREAD:[0];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(heights[i]<=0)continue;let got=0;
    for(const a of spread){const ca=Math.cos(a),sa=Math.sin(a),rx=dx*ca-dz*sa,rz=dx*sa+dz*ca;
      for(let t=1;t<=steps;t++){const qx=Math.round(x+rx*t),qy=Math.round(y+rz*t);if(qx<0||qx>=width||qy<0||qy>=height)break;const j=qy*width+qx;
        const rayH=heights[i]+slope*t*stepWorld+zBias;
        const ok=eligibility==='prominence'?prominence[j]>=castHeight&&casters[j]>rayH:casters[j]-rayH>=castHeight;
        if(ok){got++;break}}}
    if(got){shadow[i]=Math.round(255*got/spread.length);hits++}}
  return {shadow,prominence,eligible,hits};
}
/** Receiver heights (top·L) and caster heights (+roof rise on built tops) sampled from the shared World.
 * shape（第 55 批，可选）：worldMesh.shape —— 按形变后的顶面多边形栅格化（shape.at(p, top)），
 * 影子图贴着「笼形变形 / 层级平滑」后的实际网格，而不是未变形的格子。不给 shape 时与旧版逐值一致。 */
export function surfaceHeightsFromWorld(world,index,{res=96,L=.5,roofRise=.35,bounds=null,shape=null}={}){
  const cells=world.cells.filter(c=>world.top(c));if(!cells.length)return null;
  const minX=bounds?.minX??Math.min(...cells.map(c=>c.minX)),minZ=bounds?.minZ??Math.min(...cells.map(c=>c.minZ)),span=bounds?.span??Math.max(Math.max(...cells.map(c=>c.maxX))-minX,Math.max(...cells.map(c=>c.maxZ))-minZ),step=span/res;
  const heights=new Float32Array(res*res),casters=new Float32Array(res*res),roof=new Uint8Array(res*res),owner=new Int32Array(res*res).fill(-1);
  const put=(k,c)=>{const t=world.top(c);owner[k]=c.id;heights[k]=t*L;casters[k]=t*L;roof[k]=0;if(t&&world.topIsBuilt(c)){roof[k]=1;casters[k]+=roofRise}};
  if(!shape){for(let z=0;z<res;z++)for(let x=0;x<res;x++){const c=index.cellAt(minX+(x+.5)*step,minZ+(z+.5)*step);if(!c)continue;put(z*res+x,c)}}
  else for(const c of cells){const poly=c.pts.map(p=>shape.at(p,world.top(c)));let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const [px,pz] of poly){x0=Math.min(x0,px);x1=Math.max(x1,px);z0=Math.min(z0,pz);z1=Math.max(z1,pz)}
    for(let z=Math.max(0,Math.floor((z0-minZ)/step-.5));z<=Math.min(res-1,Math.ceil((z1-minZ)/step-.5));z++)for(let x=Math.max(0,Math.floor((x0-minX)/step-.5));x<=Math.min(res-1,Math.ceil((x1-minX)/step-.5));x++){
      const qx=minX+(x+.5)*step,qz=minZ+(z+.5)*step;let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [ax,az]=poly[i],[bx,bz]=poly[j];if((az>qz)!==(bz>qz)&&qx<(bx-ax)*(qz-az)/(bz-az)+ax)inside=!inside}
      if(inside&&world.top(c)*L>=heights[z*res+x])put(z*res+x,c)}}
  return {width:res,height:res,heights,casters,roof,owner,minX,minZ,span,stepWorld:step,version:world.version,deformed:!!shape};
}
/**
 * 洞 / 悬挑下的接收面（第 55 批，src/surfaceshadow.js 缺口「洞内不接收」）：2.5D 影子图只记顶面，
 * 这里给每个纹素再找「本列最低的、头顶还有实心的地面」（悬挑、拱洞、房子底下的空层），
 * 从那块地面沿太阳方向在共享 World 的体素里走三条散开的射线，挡住的比例写进第二张图。
 * 返回 {floor: Float32 高度(无则 -1), shadow: Uint8}。
 */
export function bakeFloorShadow(world,index,field,{L=.5,sun,maxT=8,rays=3}={}){
  const {width:w,height:h,minX,minZ,stepWorld:step,owner}=field,floor=new Float32Array(w*h).fill(-1),shadow=new Uint8Array(w*h);
  const len=Math.hypot(sun[0],sun[1],sun[2]);if(!(len>0)||sun[1]<=0)throw new RangeError('sun');const S=sun.map(v=>v/len);let floors=0,hits=0;
  const solidAt=(x,y,z)=>{if(y<0)return true;const c=index.cellAt(x,z);if(!c)return false;return !!world.isSolid(c,Math.floor(y/L)+1)};
  const spread=rays===3?RAY_SPREAD:[0];
  for(let k=0;k<w*h;k++){const id=owner?owner[k]:-1,c=id>=0?world.cells[id]:index.cellAt(minX+(k%w+.5)*step,minZ+((k/w|0)+.5)*step);if(!c)continue;const t=world.top(c);if(!t)continue;
    let lv=0;for(let l=1;l<t;l++){if(!world.isSolid(c,l)&&(l===1||world.isSolid(c,l-1))){lv=l;break}}if(!lv)continue;   // 第 lv 层是空的、下面实心（或海平面）→ 地面在 (lv-1)·L
    const y0=(lv-1)*L+.02,x0=minX+(k%w+.5)*step,z0=minZ+((k/w|0)+.5)*step;floor[k]=y0;floors++;let got=0;
    for(const a of spread){const ca=Math.cos(a),sa=Math.sin(a),dx=S[0]*ca-S[2]*sa,dz=S[0]*sa+S[2]*ca;for(let s=step*.6;s<maxT;s+=step*.6){if(solidAt(x0+dx*s,y0+S[1]*s,z0+dz*s)){got++;break}}}
    if(got){shadow[k]=Math.round(255*got/spread.length);hits++}}
  return {floor,shadow,floors,hits};
}

/** Where the shadow lands: under roofs vs. at grass-cliff edges (REACode shadowStats). */
export function surfaceShadowStats(shadow,{width:w,height:h,heights,roof},{nearPx=3,edge=.4,threshold=.15}={}){
  const near=(mask,rad)=>{let a=mask,b=new Uint8Array(w*h);for(let k=0;k<rad;k++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;b[i]=a[i]||(x>0&&a[i-1])||(x<w-1&&a[i+1])||(y>0&&a[i-w])||(y<h-1&&a[i+w])?1:0}[a,b]=[b,new Uint8Array(w*h)]}return a};
  const em=new Uint8Array(w*h);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(Math.max(Math.abs(heights[i+1]-heights[i]),Math.abs(heights[i-1]-heights[i]),Math.abs(heights[i+w]-heights[i]),Math.abs(heights[i-w]-heights[i]))>edge)em[i]=1}
  const nr=near(roof,nearPx),ne=near(em,nearPx);let shadowed=0,sum=0,underRoof=0,atEdge=0,elsewhere=0;
  for(let i=0;i<w*h;i++){const v=shadow[i]/255;sum+=v;if(v<=threshold)continue;shadowed++;if(nr[i])underRoof++;else if(ne[i])atEdge++;else elsewhere++}
  return {coveragePct:100*shadowed/(w*h),meanOcclusion:sum/(w*h),underRoof,atEdge,elsewhere,shadowed,roofShare:underRoof/Math.max(1,shadowed),edgeShare:atEdge/Math.max(1,shadowed)};
}
/** Jumps across a vertical/horizontal seam line (UV-border artifact measure). */
export function islandSeams(shadow,w,h,{sx=w>>1,sy=h>>1,jump=.25}={}){let n=0,max=0;const chk=(a,b)=>{const d=Math.abs(shadow[a]-shadow[b])/255;if(d>jump)n++;max=Math.max(max,d)};for(let y=0;y<h;y++)chk(y*w+sx-1,y*w+sx);for(let x=0;x<w;x++)chk((sy-1)*w+x,sy*w+x);return {seamPx:n,seamShare:n/(w+h),maxJump:max}}
/** castHeight × zBias sweep table — the A/B the second clip is about. */
export function sweepSurfaceShadow(input,{castHeights=[0,.3,.6],zBiases=[.01,.1,.3],...rest}={}){return castHeights.map(castHeight=>({castHeight,cells:zBiases.map(zBias=>{const r=bakeSurfaceShadow({...input,...rest,castHeight,zBias});return {zBias,hits:r.hits,...surfaceShadowStats(r.shadow,input)}})}))}
export const SURFACE_SHADOW_GLSL=`
uniform sampler2D uSurfaceShadowMap;
uniform vec4 uSurfaceShadowXform;
uniform float uSurfaceShadowStrength;
uniform vec4 uSurfaceShadowExt;   // x: 扩展接收面开关（墙窄条 / 洞内地面），y: 顶面高度编码上限（G 通道 ×y = 世界高度）
float surfaceShadowTone(vec3 p){vec2 uv=(p.xz-uSurfaceShadowXform.xy)*uSurfaceShadowXform.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 1.;vec4 t=texture2D(uSurfaceShadowMap,uv);
  // 洞 / 悬挑下的地面：片元比本列顶面低 0.2 以上 → 用第二张图（体素射线烘的洞内阴影），不吃顶面的影子
  if(uSurfaceShadowExt.x>.5&&p.y<t.g*uSurfaceShadowExt.y-.2)return 1.-uSurfaceShadowStrength*t.b;
  return 1.-uSurfaceShadowStrength*t.r;}
// engine/surfaceshadow.js: up-facing receivers take the full shadow, vertical faces only a thin eave strip
float surfaceShadowToneN(vec3 p,vec3 n){vec2 uv=(p.xz-uSurfaceShadowXform.xy)*uSurfaceShadowXform.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 1.;return 1.-uSurfaceShadowStrength*texture2D(uSurfaceShadowMap,uv).r*mix(.28,1.,smoothstep(.2,.72,n.y));}
`;
export class GroundSurfaceShadow {
 constructor(view){this.view=view;this.options={castHeight:.15,zBias:.02,steps:32,rays:3,roofRise:.35,eligibility:'prominence',receivers:'top'};this.ext={value:new THREE.Vector4(0,1,0,0)};this.strength={value:0};this.xform={value:new THREE.Vector4(0,0,1,1)};this.texture=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);this.map={value:this.texture};this.texture.needsUpdate=true;this.key=null}
 set({strength=this.strength.value,castHeight=this.options.castHeight,zBias=this.options.zBias,steps=this.options.steps,rays=this.options.rays,roofRise=this.options.roofRise,eligibility=this.options.eligibility,receivers=this.options.receivers}={}){if(!['top','all'].includes(receivers))throw new RangeError('surface shadow receivers');if(![strength,castHeight,zBias,roofRise].every(Number.isFinite)||strength<0||strength>1||castHeight<0||castHeight>2||zBias<0||zBias>2||roofRise<0||roofRise>2||!Number.isInteger(steps)||steps<1||steps>128||(rays!==1&&rays!==3)||!['prominence','relative'].includes(eligibility))throw new RangeError('surface shadow settings');this.options={castHeight,zBias,steps,rays,roofRise,eligibility,receivers};this.strength.value=strength;this.ext.value.x=receivers==='all'?1:0;}
 refresh(){if(!this.strength.value)return;const v=this.view,S=v.sunDir,all=this.options.receivers==='all',shape=all?v.worldMesh?.shape??null:null,key=JSON.stringify([v.town.version,S.x,S.y,S.z,this.options,!!shape]);if(key===this.key)return;const start=performance.now(),{roofRise,receivers,...bake}=this.options,res=all?128:96,f=surfaceHeightsFromWorld(v.town,v.index,{res,L:v.levelHeight,roofRise,shape});if(!f)return;const flat=Math.hypot(S.x,S.z);const result=bakeSurfaceShadow({...f,dx:flat>1e-9?S.x:1,dz:flat>1e-9?S.z:0,slope:flat>1e-9?Math.max(0,S.y)/flat:1e6,...bake});
  // 第 55 批：R = 顶面影子（旧），G = 顶面高度 / maxH，B = 洞内地面影子（receivers:'all' 时烘）
  let maxH=1e-3;for(const y of f.heights)maxH=Math.max(maxH,y);const floor=all?bakeFloorShadow(v.town,v.index,f,{L:v.levelHeight,sun:[S.x,S.y,S.z]}):null;
  const data=new Uint8Array(res*res*4);for(let i=0;i<result.shadow.length;i++){data[i*4]=result.shadow[i];data[i*4+1]=Math.round(f.heights[i]/maxH*255);data[i*4+2]=floor?floor.shadow[i]:0;data[i*4+3]=255}const tex=new THREE.DataTexture(data,res,res,THREE.RGBAFormat);tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;this.texture.dispose();this.texture=tex;this.map.value=tex;this.xform.value.set(f.minX,f.minZ,1/f.span,1/f.span);this.ext.value.y=maxH;this.key=key;this.field=f;this.result=result;this.floor=floor;this.stats={res,eligible:result.eligible,hits:result.hits,version:v.town.version,ms:performance.now()-start,receivers:this.options.receivers,deformed:f.deformed,holeFloors:floor?.floors??0,holeShadowed:floor?.hits??0,...surfaceShadowStats(result.shadow,f)};}
 dispose(){this.texture.dispose()}
}
