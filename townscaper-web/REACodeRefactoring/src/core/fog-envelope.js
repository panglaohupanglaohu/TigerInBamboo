/** Local finite-disc fog fades at both boundaries; no physical volumetric claim. */
export const fogEnvelopeGLSL = `
float fogEnvelope(float r, float inner, float outer) {
  float width=max(outer-inner,0.001);
  return smoothstep(inner,outer,r)*(1.0-smoothstep(outer-width*0.2,outer,r));
}`;
export function fogEnvelope(r,inner,outer){
 if(![r,inner,outer].every(Number.isFinite)||inner<0||outer<=inner)throw new RangeError('Fog radii');
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 return smooth(inner,outer,r)*(1-smooth(outer-Math.max(outer-inner,.001)*.2,outer,r));
}
