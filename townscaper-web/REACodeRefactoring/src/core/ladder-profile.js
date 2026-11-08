/** Rail length follows actual 3D foot→lip anchors, never just storey height. */
export function ladderProfile(foot,lip,{side={x:1,y:0,z:0},width=.18,over=.08,spacing=.08}={}){
 if(![foot?.x,foot?.y,foot?.z,lip?.x,lip?.y,lip?.z,side.x,side.y,side.z,width,over,spacing].every(Number.isFinite)||width<=0||over<0||spacing<=0)throw new RangeError('ladder settings');
 const dx=lip.x-foot.x,dy=lip.y-foot.y,dz=lip.z-foot.z,length=Math.hypot(dx,dy,dz);if(length<=1e-8||dy<=0||Math.ceil((length+over)/spacing)>1000)throw new RangeError('ladder anchors/budget');
 const axis={x:dx/length,y:dy/length,z:dz/length},dot=side.x*axis.x+side.y*axis.y+side.z*axis.z,s={x:side.x-dot*axis.x,y:side.y-dot*axis.y,z:side.z-dot*axis.z},sl=Math.hypot(s.x,s.y,s.z);if(sl<1e-8)throw new RangeError('parallel ladder side');for(const k of['x','y','z'])s[k]/=sl;
 const at=(d,offset=0)=>({x:foot.x+axis.x*d+s.x*offset,y:foot.y+axis.y*d+s.y*offset,z:foot.z+axis.z*d+s.z*offset}),head=at(length+over),rails=[-1,1].map(sign=>({a:at(0,sign*width/2),b:at(length+over,sign*width/2)})),rungs=[];
 for(let i=1;i*spacing<length+over;i++)rungs.push({a:at(i*spacing,-width/2),b:at(i*spacing,width/2),distance:i*spacing});
 return{foot:{...foot},lip:{...lip},head,length,axis,width,spacing,rails,rungs};
}
