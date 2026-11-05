/** 1242824460325052417: "playful by just tilting them slightly".
 * Local deterministic visual jitter. Untransformed slots remain the hit targets;
 * constrain both AABB overhangs to less than half the inter-slot gap.
 */
export function playfulJitter(key,{seed=7,width=240,height=44,gap=10,maxRot=2.4,maxDx=4,maxDy=1}={}){
 if(typeof key!=='string'||!key||!Number.isSafeInteger(seed)||![width,height,gap,maxRot,maxDx,maxDy].every(Number.isFinite)||width<=0||height<=0||gap<0||maxRot<0||maxRot>10||maxDx<0||maxDy<0)throw new RangeError('Invalid playful layout');
 let h=seed>>>0;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619)>>>0;
 const rnd=()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296*2-1;};
 const raw={rot:rnd()*maxRot,dx:rnd()*maxDx,dy:rnd()*maxDy};
 const shape=k=>{const rot=raw.rot*k,dx=raw.dx*k,dy=raw.dy*k,a=Math.abs(rot)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),hw=(width*c+height*s)/2,hh=(height*c+width*s)/2;return{rot,dx,dy,bounds:{x:dx-hw,y:dy-hh,width:2*hw,height:2*hh},overhang:Math.max(hw-width/2+Math.abs(dx),hh-height/2+Math.abs(dy))};};
 let result=shape(1);if(result.overhang>gap*.45){let lo=0,hi=1;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(shape(mid).overhang<=gap*.45)lo=mid;else hi=mid;}result=shape(lo);}
 return result;
}
