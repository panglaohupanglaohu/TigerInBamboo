/** 969860566322958336: "1 direction ... mostly symmetrical ... jarring when they flip".
 * Metrics are diagnostics, not a calibrated perceptual score. Mirror around the
 * declared sprite pivot, including transparent padding (not the fitted bbox).
 */
export function measureAmbiguity({width,height,data},{pivotX=(width-1)/2,alphaThreshold=24}={}){
  if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1||data.length!==width*height*4||!Number.isFinite(pivotX)||pivotX<0||pivotX>width-1||!Number.isInteger(pivotX*2)||!Number.isFinite(alphaThreshold)||alphaThreshold<0||alphaThreshold>255)throw new RangeError('Invalid sprite/pivot');
  let pixels=0,inter=0,uni=0,mass=0,massX=0,diff=0,samples=0;const left=Math.min(0,Math.round(2*pivotX)-(width-1)),right=Math.max(width-1,Math.round(2*pivotX));
  const rgba=(x,y)=>x<0||x>=width?[0,0,0,0]:Array.from(data.slice((y*width+x)*4,(y*width+x)*4+4));
  for(let y=0;y<height;y++)for(let x=left;x<=right;x++){const a=rgba(x,y),b=rgba(Math.round(2*pivotX-x),y),A=a[3]>alphaThreshold,B=b[3]>alphaThreshold;if(A&&B)inter++;if(A||B){uni++;samples++;const premul=p=>(.2126*p[0]+.7152*p[1]+.0722*p[2])/255*p[3]/255;diff+=Math.abs(premul(a)-premul(b));}if(x>=0&&x<width){if(A)pixels++;mass+=a[3]/255;massX+=x*a[3]/255;}}
  return {empty:pixels===0,pixels,mirrorIoU:uni?inter/uni:0,flipDiff:samples?diff/samples:0,massSkew:mass?Math.abs(massX/mass-pivotX)/Math.max(pivotX,width-1-pivotX,1):0,pivotX};
}
export function chooseSpriteFlip(facing,right,previous=false,{deadZone=.15}={}){
  if(![facing.x,facing.z,right.x,right.z,deadZone].every(Number.isFinite)||deadZone<0||deadZone>=1)throw new RangeError('Invalid facing');
  const len=Math.hypot(facing.x,facing.z)*Math.hypot(right.x,right.z);if(!len)return previous;const d=(facing.x*right.x+facing.z*right.z)/len;return d>deadZone?false:d< -deadZone?true:previous;
}
