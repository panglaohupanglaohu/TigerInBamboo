/** User policy: located world effects are silent at and beyond ten metres. */
export const WORLD_SOURCE_RANGE=10;
export function sourceSpatial(pos,listener,maxDistance=WORLD_SOURCE_RANGE,reference=3){
 if(!pos||!listener?.has)return{gain:1,pan:0,dist:0};
 const max=Math.min(WORLD_SOURCE_RANGE,Math.max(0,maxDistance)),ref=Math.min(3,Math.max(.01,reference)),dx=pos.x-listener.x,dy=pos.y-listener.y,dz=pos.z-listener.z,dist=Math.hypot(dx,dy,dz);
 if(!(dist<max))return null;let gain=dist<=ref?1:Math.pow(ref/dist,.85);const edge=max*.75;if(dist>edge)gain*=1-(dist-edge)/(max-edge);return{gain,pan:dist>.5?(dx*listener.rx+dy*listener.ry+dz*listener.rz)/dist*.75:0,dist};
}
