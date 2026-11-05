/** OpenGL cube order: +X,-X,+Y,-Y,+Z,-Z. v increases with texture row. */
export function cubeDirection(face,u,v){
 if(!Number.isInteger(face)||face<0||face>5||![u,v].every(n=>Number.isFinite(n)&&Math.abs(n)<=1))throw new RangeError('Invalid cube coordinate');
 const p=[[1,-v,-u],[-1,-v,u],[u,1,v],[u,-1,-v],[u,-v,1],[-u,-v,-1]][face],length=Math.hypot(...p);
 return p.map(n=>n===0?0:n/length);
}
export function bakeCubeHeight(sample,{size=16,minHeight=0,maxHeight=1}={}){
 if(typeof sample!=='function'||!Number.isInteger(size)||size<2||size>64||![minHeight,maxHeight].every(Number.isFinite)||maxHeight<=minHeight||!Number.isFinite(maxHeight-minHeight))throw new RangeError('Invalid cube height bake');
 const faces=Array.from({length:6},()=>new Uint8Array(size*size*4));
 for(let face=0;face<6;face++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const direction=cubeDirection(face,2*(x+.5)/size-1,2*(y+.5)/size-1),height=sample(direction);
  if(!Number.isFinite(height))throw new RangeError('Nonfinite cube height sample');
  const value=Math.round(Math.max(0,Math.min(1,(height-minHeight)/(maxHeight-minHeight)))*255),offset=(y*size+x)*4;
  faces[face].set([value,value,value,255],offset);
 }
 return {faces,size,minHeight,maxHeight,samples:6*size*size};
}
