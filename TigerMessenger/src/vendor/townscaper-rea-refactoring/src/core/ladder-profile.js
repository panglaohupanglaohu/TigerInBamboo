/** Rail length follows actual 3D foot→lip anchors, never just storey height. */
export function ladderProfile(foot,lip,{side={x:1,y:0,z:0},width=.18,over=.08,spacing=.08}={}){
 if(![foot?.x,foot?.y,foot?.z,lip?.x,lip?.y,lip?.z,side.x,side.y,side.z,width,over,spacing].every(Number.isFinite)||width<=0||over<0||spacing<=0)throw new RangeError('ladder settings');
 const dx=lip.x-foot.x,dy=lip.y-foot.y,dz=lip.z-foot.z,length=Math.hypot(dx,dy,dz);if(length<=1e-8||dy<=0||Math.ceil((length+over)/spacing)>1000)throw new RangeError('ladder anchors/budget');
 const axis={x:dx/length,y:dy/length,z:dz/length},dot=side.x*axis.x+side.y*axis.y+side.z*axis.z,s={x:side.x-dot*axis.x,y:side.y-dot*axis.y,z:side.z-dot*axis.z},sl=Math.hypot(s.x,s.y,s.z);if(sl<1e-8)throw new RangeError('parallel ladder side');for(const k of['x','y','z'])s[k]/=sl;
 const at=(d,offset=0)=>({x:foot.x+axis.x*d+s.x*offset,y:foot.y+axis.y*d+s.y*offset,z:foot.z+axis.z*d+s.z*offset}),head=at(length+over),rails=[-1,1].map(sign=>({a:at(0,sign*width/2),b:at(length+over,sign*width/2)})),rungs=[];
 for(let i=1;i*spacing<length+over;i++)rungs.push({a:at(i*spacing,-width/2),b:at(i*spacing,width/2),distance:i*spacing});
 return{foot:{...foot},lip:{...lip},head,length,axis,width,spacing,rails,rungs};
}

/** Anchors for one nav stair on the live cage (shared by NavLayer drawing and node checks).
 * Foot = low wall-foot midpoint pushed `run` into the low cell; lip = deformed top-edge midpoint.
 */
export function ladderAnchors(stair,h,{at=(p)=>[p.x,p.z],L=1}={}){
 const c=stair.low,i=stair.edge,a=c.pts[i],b=c.pts[(i+1)%c.n],rise=stair.rise||1;
 const[ax,az]=at(a,h),[bx,bz]=at(b,h),mx=(ax+bx)/2,mz=(az+bz)/2,ux=bx-ax,uz=bz-az,len=Math.hypot(ux,uz);
 if(len<.2)return null;
 let vx=-uz/len,vz=ux/len,ccx=0,ccz=0;for(const p of c.pts){const[x,z]=at(p,h);ccx+=x/c.n;ccz+=z/c.n;}
 if((ccx-mx)*vx+(ccz-mz)*vz<0){vx=-vx;vz=-vz;}
 const[tax,taz]=at(a,h+rise),[tbx,tbz]=at(b,h+rise),run=Math.min(.22,Math.hypot(ccx-mx,ccz-mz)*.65);
 const foot={x:mx+vx*run,y:h*L,z:mz+vz*run},lip={x:(tax+tbx)/2,y:(h+rise)*L,z:(taz+tbz)/2};
 const side=Math.hypot(lip.x-foot.x,lip.z-foot.z)>1e-8?{x:lip.z-foot.z,y:0,z:foot.x-lip.x}:{x:ux/len,y:0,z:uz/len};
 return{h,rise,mx,mz,ux,uz,len,vx,vz,ccx,ccz,run,foot,lip,side,width:Math.min(.18,len*.4)};
}
/** End-point volume contact against World voxels (REACode/terraceladder footErr/lipDist/footInside,
 * extended to the voxel column): foot stands on the low top and inside the low polygon, the low column
 * is empty for the whole rise (no ladder inside rock), the lip lies on the rail axis at the upper top,
 * the upper top is exposed (can step off), and `supportDepth` counts solid levels under the lip —
 * below `rise` means the upper floor is a thin overhanging platform with no wall to lean against.
 */
export function ladderContact(world,stair,anchors,profile,{at=(p)=>[p.x,p.z],L=1}={}){
 const{h,rise,foot,lip}=anchors,low=stair.low,high=stair.high;
 const poly=low.pts.map(p=>at(p,h));let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>foot.z)!==(zj>foot.z)&&foot.x<(xj-xi)*(foot.z-zi)/(zj-zi)+xi)inside=!inside;}
 let clear=true;for(let lv=h+1;lv<=h+rise;lv++)if(world.isSolid(low,lv))clear=false;
 let supportDepth=0;for(let lv=h+rise;lv>=1&&world.isSolid(high,lv);lv--)supportDepth++;
 const d={x:lip.x-foot.x,y:lip.y-foot.y,z:lip.z-foot.z},ax=profile.axis,cr={x:d.y*ax.z-d.z*ax.y,y:d.z*ax.x-d.x*ax.z,z:d.x*ax.y-d.y*ax.x};
 return{footOnTop:h>=1&&world.isSolid(low,h)&&!world.isSolid(low,h+1)&&Math.abs(foot.y-h*L)<1e-9,footInside:inside,columnClear:clear,
  lipOnTop:world.isSolid(high,h+rise)&&!world.isSolid(high,h+rise+1)&&Math.abs(lip.y-(h+rise)*L)<1e-9,lipDist:Math.hypot(cr.x,cr.y,cr.z),
  supportDepth,thinPlatform:supportDepth<rise,shortGap:profile.length-rise*L};
}
/** Climb sample t∈[0,1] foot→lip: body point on the centre line and the rung under the feet/hands. */
export function ladderClimb(profile,t){
 if(!Number.isFinite(t)||t<0||t>1)throw new RangeError('climb t');
 const d=profile.length*t,p={x:profile.foot.x+profile.axis.x*d,y:profile.foot.y+profile.axis.y*d,z:profile.foot.z+profile.axis.z*d};
 const below=profile.rungs.filter(r=>r.distance<=d+1e-9).length-1,hand=Math.min(profile.rungs.length-1,below+Math.round(.6/profile.spacing));
 return{position:p,footRung:below,handRung:hand,onTop:t===1};
}
