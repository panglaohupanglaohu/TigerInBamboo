/** 1699038611125985317 / 1699146321318314094. Local vertical shear field.
 * Exact source field unknown. W changes only Y, so inverse is exact subtraction;
 * shading can evaluate W(p) while geometry stays at p (no geometry drift).
 */
function validate({period=.5,amplitude=.14}={}){if(!Number.isFinite(period)||period<=0||!Number.isFinite(amplitude)||amplitude<0)throw new RangeError('positive period and nonnegative amplitude');return {period,amplitude}}
export function sedimentOffset(x,z,amplitude=.14){if(![x,z,amplitude].every(Number.isFinite)||amplitude<0)throw new RangeError('finite coordinates/amplitude');return amplitude*(.65*Math.sin(.73*x+Math.sin(.41*z))+.35*Math.sin(.57*z-.24*x));}
export function warpSediment(p,opts={}){const {amplitude}=validate(opts);return[p[0],p[1]+sedimentOffset(p[0],p[2],amplitude),p[2]];}
export function unwarpSediment(p,opts={}){const {amplitude}=validate(opts);return[p[0],p[1]-sedimentOffset(p[0],p[2],amplitude),p[2]];}
export function sedimentPhase(p,opts={}){const {period,amplitude}=validate(opts);return(p[1]+sedimentOffset(p[0],p[2],amplitude))/period;}
export const SEDIMENT_GLSL=`
uniform float uStrataMode;
uniform vec3 uStrata;
float sedimentOffset(vec2 p,float amplitude){return amplitude*(.65*sin(.73*p.x+sin(.41*p.y))+.35*sin(.57*p.y-.24*p.x));}
vec3 sedimentColor(vec3 color,vec3 p){
  float phase=(p.y+(uStrataMode>1.5?sedimentOffset(p.xz,uStrata.y):0.0))/uStrata.x;
  float width=max(fwidth(phase),.0001);
  float s=sin(phase*6.28318530718);
  float tone=smoothstep(-width*6.28318530718,width*6.28318530718,s);
  tone=mix(tone,.5,smoothstep(.3,.8,width));
  float d=abs(fract(phase+.5)-.5);
  float line=(1.0-smoothstep(0.0,width,d))*(1.0-smoothstep(.25,.5,width));
  return mix(color,color*mix(.88,1.08,tone)*mix(1.0,.7,line),uStrata.z);
}
`;
