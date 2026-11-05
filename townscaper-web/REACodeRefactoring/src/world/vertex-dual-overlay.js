/** Shared-World diagnostic for 959752525867036672. The input is a fan
 * triangulation of actual cells, not the game's complete traversable navmesh.
 * Heights are per source triangle; vertical cliffs are not bridged.
 */
import * as THREE from 'three';
import{vertexDual}from'../core/vertex-dual.js';
export class VertexDualOverlay{
 constructor(world,scene,{levelHeight=.5}={}){this.world=world;this.scene=scene;this.L=levelHeight;this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;this.version=-1;this.pulse={value:1};this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPulse:this.pulse},vertexShader:'uniform float uPulse;attribute vec3 aOrigin;void main(){vec3 p=position;p.xz=mix(aOrigin.xz,p.xz,uPulse);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(.82,1.,.88,.9);}'});this.dotMaterial=new THREE.PointsMaterial({color:0xffd260,size:.065,sizeAttenuation:true});}
 refresh(){if(this.version===this.world.version)return;const w=this.world,triangles=[],owners=[];for(const c of w.cells){if(w.top(c)<=0)continue;for(let i=1;i<c.n-1;i++){triangles.push([c.pts[0].id,c.pts[i].id,c.pts[i+1].id]);owners.push(c)}}
 const dual=vertexDual(w.grid.verts,triangles),pos=[],origin=[],sites=[];
 for(const c of dual.cells){if(!c.wedges.length)continue;for(const q of c.wedges){const y=w.top(owners[q.triangle])*this.L+.035;for(const a of[q.midA,q.midB]){pos.push(a.x,y,a.z,q.center.x,y,q.center.z);origin.push(c.source.x,y,c.source.z,c.source.x,y,c.source.z)}}const q=c.wedges[0],y=w.top(owners[q.triangle])*this.L+.07;sites.push((c.source.x+q.center.x)/2,y,(c.source.z+q.center.z)/2)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('aOrigin',new THREE.Float32BufferAttribute(origin,3));const dots=new THREE.BufferGeometry();dots.setAttribute('position',new THREE.Float32BufferAttribute(sites,3));for(const old of [...this.group.children]){old.geometry.dispose();this.group.remove(old)}this.group.add(new THREE.LineSegments(geometry,this.material),new THREE.Points(dots,this.dotMaterial));this.stats={triangles:triangles.length,cells:dual.cells.filter(c=>c.wedges.length).length,sites:sites.length/3,vertices:pos.length/3};this.version=w.version;}
 update(t){this.refresh();this.pulse.value=.72+.28*(.5+.5*Math.cos(t*3))}
 dispose(){for(const m of this.group.children)m.geometry.dispose();this.material.dispose();this.dotMaterial.dispose();this.group.removeFromParent()}
}
