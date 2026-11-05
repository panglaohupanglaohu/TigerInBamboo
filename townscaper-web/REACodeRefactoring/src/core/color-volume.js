// H/S/L authoring ranges observed in 1710031224838771027.
// The video does not establish terrain height/slope/moisture axes or OKLab.
export function makeColorVolume({h=[.18,.35],s=[.2,.5],l=[.35,.65]}={}) {
 for(const [name,a]of Object.entries({h,s,l}))if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a.some(v=>v<0||v>1)||(name!=='h'&&a[0]>a[1]))throw new RangeError('color range');
 return Object.freeze({h:Object.freeze([...h]),s:Object.freeze([...s]),l:Object.freeze([...l])});
}
export function sampleColorVolume(vol,u,v,w){if(![u,v,w].every(Number.isFinite))throw new RangeError('finite coordinates');const clamp=x=>Math.max(0,Math.min(1,x)),end=vol.h[1]<vol.h[0]?vol.h[1]+1:vol.h[1],h=(vol.h[0]+(end-vol.h[0])*clamp(u))%1,s=vol.s[0]+(vol.s[1]-vol.s[0])*clamp(v),l=vol.l[0]+(vol.l[1]-vol.l[0])*clamp(w);const f=n=>{const k=(n+h*12)%12;return l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1))};return [f(0),f(8),f(4)];}
export const COLOR_VOLUME_GLSL=`
uniform float uColorVolumeOn;
uniform vec3 uColorVolumeMin;
uniform vec3 uColorVolumeMax;
vec3 colorVolumeSample(vec3 uvw){vec3 hi=uColorVolumeMax;if(hi.x<uColorVolumeMin.x)hi.x+=1.;vec3 hsl=mix(uColorVolumeMin,hi,clamp(uvw,0.,1.));vec3 k=mod(vec3(0.,8.,4.)+fract(hsl.x)*12.,12.);vec3 rgb=hsl.z-hsl.y*min(hsl.z,1.-hsl.z)*max(vec3(-1.),min(min(k-3.,9.-k),vec3(1.)));return mix(rgb/12.92,pow((rgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),rgb));}
`;
