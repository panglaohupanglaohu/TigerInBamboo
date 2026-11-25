/** 1897266928961700215 / 1890018647655272491: optional shared-World wall finish. */
import * as THREE from 'three';
import{makeDoodleWall}from'../build/doodle-wall.js';
import{MAX_LEVEL}from'../core/world.js';
export class DoodleOverlay{
  // offset：地形墙面自己画在格边外 0.004（terrainmesh.js 墙四边）。r145 把外偏做成参数并实测
  // 0.004（默认，与地形墙齐平）与 0.012 都可见、0.004→0.012 的整帧差 12636px 是 8mm 位移而非深度打架 →
  // 保持 0.004 不动，只在需要排查遮挡时用参数抬高。
  constructor(world,{levelHeight=.5,offset=.004}={}){this.world=world;this.L=levelHeight;this.offset=offset;this.version=-1;this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));this.mesh.visible=false;this.mesh.frustumCulled=false;this.gray=false;}
  refresh(){if(!this.mesh.visible||this.version===this.world.version)return;if(!this.texture){const wall=makeDoodleWall({gray:this.gray});this.stats=wall.stats;this.texture=new THREE.CanvasTexture(wall.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.wrapS=this.texture.wrapT=THREE.ClampToEdgeWrapping;this.mesh.material.map=this.texture;this.mesh.material.needsUpdate=true;}
    const pos=[],uv=[],L=this.L,off=this.offset;let faces=0;
    for(const c of this.world.cells)for(let lv=2;lv<=MAX_LEVEL;lv++){if(!this.world.isBuilt(c,lv))continue;for(let edge=0;edge<c.n;edge++){const nb=this.world.neighbor(c,edge);if(nb&&this.world.isSolid(nb,lv))continue;const a=c.pts[edge],b=c.pts[(edge+1)%c.n],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);let nx=dz/len,nz=-dx/len;if(nx*((a.x+b.x)/2-c.cx)+nz*((a.z+b.z)/2-c.cz)<0){nx=-nx;nz=-nz;}const P=[a.x+nx*off,(lv-1)*L,a.z+nz*off],Q=[b.x+nx*off,(lv-1)*L,b.z+nz*off],R=[...Q],S=[...P];R[1]=S[1]=lv*L;pos.push(...P,...Q,...R,...P,...R,...S);const u=Math.min(1,len/2);uv.push(0,0,u,0,u,1,0,0,u,1,0,1);faces++;}}
    this.mesh.geometry.dispose();this.mesh.geometry=new THREE.BufferGeometry();this.mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));this.mesh.geometry.computeVertexNormals();this.faces=faces;this.version=this.world.version;
  }
  setVisible(on){this.mesh.visible=on;this.refresh();}
  setGray(on){if(this.gray===!!on)return;this.gray=!!on;this.texture?.dispose();this.texture=null;this.version=-1;this.refresh();}
  dispose(){this.texture?.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
