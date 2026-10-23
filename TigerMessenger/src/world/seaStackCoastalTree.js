import * as T from 'three';
import {createCoastalScrubGeometry} from './seaStackScrubGeometry.js';
// Small wind-pruned broadleaf: branched woody trunk and opaque leaf clusters.
// Root at zero, conservative horizontal radius .72, height 2.2 local metres.
export function createSeaStackCoastalTree(){
 const positions=[],normals=[],colors=[],wood=new T.Color(0x8c8164);
 function append(g,matrix,tint){const mesh=g.index?g.toNonIndexed():g,p=mesh.attributes.position,n=mesh.attributes.normal,c=mesh.attributes.color,nm=new T.Matrix3().getNormalMatrix(matrix);for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix),no=new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(nm).normalize(),col=c?new T.Color().fromBufferAttribute(c,i):tint;positions.push(...v.toArray());normals.push(...no.toArray());colors.push(col.r,col.g,col.b);}if(mesh!==g)mesh.dispose();g.dispose();}
 function branch(a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),delta=vb.clone().sub(va);append(new T.CylinderGeometry(r*.65,r,delta.length(),6),new T.Matrix4().compose(va.add(vb).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()),new T.Vector3(1,1,1)),wood);}
 branch([0,0,0],[.05,1.18,.03],.065);
 for(const[x,y,z,s]of[[-.30,1.27,0,.50],[.25,1.46,.18,.57],[.02,1.75,-.1,.48]]){branch([.03,.75,0],[x,y,z],.032);append(createCoastalScrubGeometry(),new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion(),new T.Vector3(s,s*.65,s)),wood);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
