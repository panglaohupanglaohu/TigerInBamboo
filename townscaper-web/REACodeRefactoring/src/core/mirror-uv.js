/** 1061221291137605633: eight orientations from one texture, centre mirrors.
 * Exact source mapping unknown. Local metric triangle-fold repeats at fixed
 * pixel scale; optional stretch retains the existing ornament renderer.
 */
export function fold(t){if(!Number.isFinite(t))throw new RangeError('finite coordinate');const p=((t%2)+2)%2;return p<=1?p:2-p;}
export function orientUV(u,v,orientation=0){if(!Number.isInteger(orientation)||orientation<0||orientation>7)throw new RangeError('orientation 0..7');if(orientation>=4)u=1-u;for(let i=0;i<(orientation%4);i++)[u,v]=[1-v,u];return[u,v];}
export function mirrorUV(x,y,width,height,{orientation=0,tileSize=128}={}){if(![x,y,width,height,tileSize].every(Number.isFinite)||width<=0||height<=0||tileSize<=0)throw new RangeError('positive finite panel dimensions');return orientUV(fold((x-width*.5)/tileSize),fold((y-height*.5)/tileSize),orientation);}
export const MIRROR_UV_GLSL=`
vec2 orientMirrorUV(vec2 p,float orientation){
  if(orientation>=4.0)p.x=1.0-p.x;
  float turn=mod(orientation,4.0);
  if(turn>.5)p=vec2(1.0-p.y,p.x);
  if(turn>1.5)p=vec2(1.0-p.y,p.x);
  if(turn>2.5)p=vec2(1.0-p.y,p.x);
  return p;
}
vec2 foldMirrorUV(vec2 p){return 1.0-abs(mod(p,2.0)-1.0);}
`;
