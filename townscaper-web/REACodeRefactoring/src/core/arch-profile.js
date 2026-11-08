/** Elliptical inner profile, adapted from REACode/archvoid archInner/clearance.
 * Preserve the existing building curve; choose angular samples by world-space
 * chord-error bound instead of ten equal horizontal intervals. No wedge ring.
 */
export function archProfile(span,rise,{tolerance=.0025,maxSegments=128}={}){
 if(![span,rise,tolerance].every(Number.isFinite)||span<=0||rise<=0||tolerance<=0||!Number.isInteger(maxSegments)||maxSegments<8||maxSegments>4096)throw new RangeError('invalid arch dimensions or sampling budget');
 const radius=Math.max(span/2,rise),angle=2*Math.acos(Math.max(-1,1-Math.min(tolerance/radius,2)));
 let segments=Math.max(8,Math.ceil(Math.PI/angle));if(segments%2)segments++;
 if(!Number.isFinite(segments)||segments>maxSegments)throw new RangeError('arch tolerance exceeds sampling budget');
 const points=Array.from({length:segments+1},(_,i)=>{const t=i*Math.PI/segments;return{u:i===0?0:i===segments?1:(1-Math.cos(t))/2,height:i===0||i===segments?0:rise*Math.sin(t)};});
 return{points,segments,errorBound:radius*(1-Math.cos(Math.PI/(2*segments)))};
}
export function archClearance(span,rise,x){
 if(![span,rise,x].every(Number.isFinite)||span<=0||rise<=0)throw new RangeError('invalid arch clearance input');
 return Math.abs(x)>span/2?0:rise*Math.sqrt(Math.max(0,1-(2*x/span)**2));
}
