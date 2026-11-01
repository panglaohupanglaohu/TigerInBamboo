import * as THREE from 'three';
import {createSwampGroundSampler} from './swampGround.js';
// Independent authored opposite shore: full 4-unit lane = 2 metres at .5 scale.
export function installSwampOppositeLanding(swamp,{angle=.5+Math.PI}={}){
 if(swamp.userData.oppositeLanding)return swamp.userData.oppositeLanding;
 const group=new THREE.Group();group.name='swamp-opposite-drinking-stair';
 const steps=[],surfaces=[],stone=new THREE.MeshBasicMaterial({color:0xc5c5ac});
 // Rise away from water, leaving the original entrance and collision surfaces intact.
 for(let i=0;i<16;i++){
  const r=26+i*.7,y=25.25+i*.98,p=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(4.4,.34,.84),stone);mesh.position.copy(p);mesh.position.y-=.17;mesh.rotation.y=Math.PI/2-angle;mesh.name='swamp-opposite-tread-'+i;
  group.add(mesh);surfaces.push(mesh);steps.push(p);
 }
 const top=new THREE.Mesh(new THREE.BoxGeometry(4.4,.34,2),stone);top.position.set(Math.cos(angle)*37.1,39.95-.17,Math.sin(angle)*37.1);top.rotation.y=Math.PI/2-angle;group.add(top);surfaces.push(top);
 const drinking=steps[0].clone();
 const slab=new THREE.Mesh(new THREE.BoxGeometry(6,.4,3.4),stone);slab.position.set(Math.cos(angle)*25.5,25.05,Math.sin(angle)*25.5);slab.rotation.y=Math.PI/2-angle;group.add(slab);surfaces.push(slab);
 swamp.add(group);swamp.userData.tigerWalkSurfaces=(swamp.userData.tigerWalkSurfaces||[]).concat(surfaces);
 // Expose the authored opposite stair through the bowl wall; retain every other attribute.
 const wall=swamp.getObjectByName('swamp-sinkhole-wall');
 if(wall){const source=wall.geometry.index?wall.geometry.toNonIndexed():wall.geometry,p=source.attributes.position;
  const attributes=Object.entries(source.attributes),values=Object.fromEntries(attributes.map(([name])=>[name,[]])),groups=[];let vertexCount=0;
  const emit=(vertices,materialIndex)=>{const start=vertexCount;for(const vertex of vertices){for(const [name]of attributes)values[name].push(...vertex[name]);vertexCount++;}if(vertices.length){const last=groups.at(-1);if(last&&last.materialIndex===materialIndex&&last.start+last.count===start)last.count+=vertices.length;else groups.push({start,count:vertices.length,materialIndex});}};
  const vertex=i=>Object.fromEntries(attributes.map(([name,attr])=>[name,Array.from(attr.array.slice(i*attr.itemSize,(i+1)*attr.itemSize))]));
  const threshold=24.6-wall.position.y;
  for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3,a=Math.atan2(Math.sin(Math.atan2(z,x)-angle),Math.cos(Math.atan2(z,x)-angle)),index=source.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0;
   const vertices=[vertex(i),vertex(i+1),vertex(i+2)];if(Math.abs(a)>.12){emit(vertices,index);continue;}
   // Clip only above-water portal area. Original submerged wall remains a closed shell.
   const polygon=[];for(let k=0;k<3;k++){const u=vertices[k],v=vertices[(k+1)%3],inside=u.position[1]<=threshold,nextInside=v.position[1]<=threshold;if(inside)polygon.push(u);if(inside!==nextInside){const t=(threshold-u.position[1])/(v.position[1]-u.position[1]);polygon.push(Object.fromEntries(attributes.map(([name])=>[name,u[name].map((n,j)=>n+(v[name][j]-n)*t)])));}}
   for(let k=1;k<polygon.length-1;k++)emit([polygon[0],polygon[k],polygon[k+1]],index);
  }
  const cut=new THREE.BufferGeometry();for(const [name,attr]of attributes)cut.setAttribute(name,new THREE.BufferAttribute(new Float32Array(values[name]),attr.itemSize,attr.normalized));if(source.groups.length)for(const g of groups)cut.addGroup(g.start,g.count,g.materialIndex);cut.computeBoundingBox();cut.computeBoundingSphere();wall.geometry=cut;
 }

 // Player radial-ground sampler also sees the new path; original crater sampler remains authoritative elsewhere.
 const previous=swamp.userData.sampleGroundRadius,sample=createSwampGroundSampler(swamp,surfaces);
 swamp.userData.sampleGroundRadius=position=>{const a=previous?.(position),b=sample(position);return a==null?b:b==null?a:Math.max(a,b);};
 const result={group,steps,surfaces,drinking,angle,laneWidth:4.4};swamp.userData.oppositeLanding=result;return result;
}
