import * as T from 'three';

/** Original overlapping circles form a crescent contour, not a polygon with a hole.
 * Coordinates use the lake's original Shape XY plane (rendered with X rotation -PI/2).
 */
export function moonCrescentBoundary({outer=3.5,holeRadius=2.52,holeX=1.1,holeY=.7,step=.075}={}){
 const d=Math.hypot(holeX,holeY);
 if(!(d>Math.abs(outer-holeRadius)&&d<outer+holeRadius))throw new RangeError('Expected intersecting lake circles');
 const axis=Math.atan2(holeY,holeX),a=(outer*outer-holeRadius*holeRadius+d*d)/(2*d);
 const theta=Math.acos(a/outer),start=axis+theta,end=axis+2*Math.PI-theta,points=[];
 const append=(cx,cy,r,lo,hi,skipFirst=false)=>{const n=Math.max(8,Math.ceil(Math.abs(hi-lo)*r/step));for(let i=skipFirst?1:0;i<=n;i++){const t=lo+(hi-lo)*i/n;points.push(new T.Vector2(cx+r*Math.cos(t),cy+r*Math.sin(t)));}};
 append(0,0,outer,start,end);
 const lower=points.at(-1),upper=points[0],innerStart=Math.atan2(lower.y-holeY,lower.x-holeX);
 let innerEnd=Math.atan2(upper.y-holeY,upper.x-holeX);while(innerEnd>innerStart)innerEnd-=2*Math.PI;
 append(holeX,holeY,holeRadius,innerStart,innerEnd,true);points.pop();
 return points;
}

export function inMoonWater(x,y,epsilon=1e-6){return Math.hypot(x,y)<=3.5+epsilon&&Math.hypot(x-1.1,y-.7)>=2.52-epsilon;}

export function moonWaterGeometry(){return new T.ShapeGeometry(new T.Shape(moonCrescentBoundary()),1);}

/** Clip a deep-water disk against every triangle of the exact water triangulation.
 * No independent disk can spill into the dry crescent notch. */
export function moonDeepGeometry(waterGeometry,{x=-.5,y=.2,radius=1.6}={}){
 const p=waterGeometry.attributes.position,ix=waterGeometry.index,vertices=[];
 const clip=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;clip.push([x+radius*Math.cos(a),y+radius*Math.sin(a)]);}
 for(let k=0;k<ix.count;k+=3){let polygon=[0,1,2].map(j=>[p.getX(ix.getX(k+j)),p.getY(ix.getX(k+j))]);
  for(let c=0;c<clip.length&&polygon.length;c++){const a=clip[c],b=clip[(c+1)%clip.length],side=q=>(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),next=[];
   for(let j=0;j<polygon.length;j++){const u=polygon[j],v=polygon[(j+1)%polygon.length],du=side(u),dv=side(v);if(du>=-1e-9)next.push(u);if((du>=0)!==(dv>=0)){const t=du/(du-dv);next.push([u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t]);}}polygon=next;
  }
  for(let j=1;j+1<polygon.length;j++)for(const q of[polygon[0],polygon[j],polygon[j+1]])vertices.push(q[0],q[1],0);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return geo;
}

/** Real low bank and a shallow submerged shelf, following both crescent edges.
 * Taper width at the two pointed tips, rather than extruding broad miter spikes.
 * No terrain/actors/colliders are moved and the existing path starts outside this band.
 */
export function createMoonLakeShore(){
 const group=new T.Group();group.name='moon-lake-natural-shore';
 const contour=moonCrescentBoundary(),n=contour.length,outerEnd=contour.reduce((best,p,i)=>Math.hypot(p.x,p.y)>3.499?i:best,0);
 const positions=[],colors=[],indices=[],sand=new T.Color(0xbdb997),wet=new T.Color(0x839b8b),shallow=new T.Color(0x78b5b4),edge=new T.Color(0x96b7a0);
 for(let i=0;i<n;i++){
  const p=contour[i],prev=contour[(i+n-1)%n],next=contour[(i+1)%n],tangent=next.clone().sub(prev).normalize(),out=new T.Vector2(tangent.y,-tangent.x);
  const tipDistance=Math.min(p.distanceTo(contour[0]),p.distanceTo(contour[outerEnd])),taper=Math.min(1,tipDistance/.4);
  const width=.27*taper*(.94+.06*Math.sin(i*.16));
  const rings=[[-.16*taper,-.035,shallow],[0,.003,edge],[width*.42,-.025,wet],[width,-.18-(p.x*p.x+p.y*p.y)/(2*160),sand]];
  for(const[d,h,color]of rings){positions.push(p.x+out.x*d,h,-p.y-out.y*d);colors.push(color.r,color.g,color.b);}
 }
 for(let i=0;i<n;i++){const next=(i+1)%n;for(let r=0;r<3;r++){const a=i*4+r,b=next*4+r;indices.push(a,b,a+1,b,b+1,a+1);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
 const mesh=new T.Mesh(geo,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}));mesh.name='moon-lake-shallow-wet-bank';mesh.receiveShadow=true;group.add(mesh);
 group.userData.report={revision:'shore-r2-20261025',boundaryVertices:n,maxOutwardWidth:.27,maxRadius:3.77,pathInner:3.8,originalCirclesPreserved:true,terrainChanged:false,collidersChanged:false};
 return group;
}

/** Seat only our outer bank vertices on the FINAL visible ground. No grass mesh
 * edits, no global water changes, no props used as ground, no fake terrain height. */
export function bindMoonLakeShoreToGround(lake,ground){
 if(!lake?.shore||!ground?.isMesh)return null;
 lake.group.updateWorldMatrix(true,true);ground.updateWorldMatrix(true,false);
 const ray=new T.Raycaster(),up=new T.Vector3(0,1,0).transformDirection(lake.group.matrixWorld),geometry=lake.shore.children[0].geometry,p=geometry.attributes.position;
 let seated=0,missing=0;
 for(let i=3;i<p.count;i+=4){const origin=lake.group.localToWorld(new T.Vector3(p.getX(i),14,p.getZ(i)));ray.set(origin,up.clone().negate());ray.far=30;const hit=ray.intersectObject(ground,false)[0];
  if(!hit){missing++;continue;}const local=lake.group.worldToLocal(hit.point.clone());p.setY(i,local.y+.002);seated++;
 }
 p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return lake.shore.userData.report.groundBinding={source:'final-hills-mesh',seated,missing};
}
