import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
import {isHighlandWaterfrontCutout} from '../highlandCitadelDesign.js';

const NAME = 'citadel-coastal-cliff-seal';
const WELD_SCALE = 10000;

/** Call after castle placement/composition transforms AND terrain refinement.
 * Closes only open coastal edges; leaves every source triangle/vertex intact.
 * The one supplemental mesh lives in the source terrain mesh's local frame.
 */
export function sealCitadelCoastalCliffs(castle, radius) {
  const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
  if(!terrain?.geometry?.attributes.position || !(radius>0))return null;
  castle.updateWorldMatrix(true,true);
  const source=terrain.geometry, position=source.attributes.position, colors=source.attributes.color;
  const welded=[], lookup=new Map(), ids=new Uint32Array(position.count);
  for(let i=0;i<position.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(position,i);
    const key=[p.x,p.y,p.z].map(n=>Math.round(n*WELD_SCALE)).join(',');
    let id=lookup.get(key);
    if(id===undefined){id=welded.length;lookup.set(key,id);welded.push({p,sourceIndex:i});}
    ids[i]=id;
  }
  const edges=new Map(),triangles=new Set(),index=source.index;
  const count=index?index.count:position.count;
  for(let i=0;i+2<count;i+=3){
    const tri=[0,1,2].map(j=>ids[index?index.getX(i+j):i+j]);
    if(new Set(tri).size<3)continue;
    // Duplicate nonindexed faces must not hide an otherwise open boundary.
    const faceKey=[...tri].sort((a,b)=>a-b).join(':');
    if(triangles.has(faceKey))continue;triangles.add(faceKey);
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3],key=a<b?a+':'+b:b+':'+a;
      const edge=edges.get(key);
      if(edge)edge.count++;else edges.set(key,{a,b,count:1});
    }
  }
  const toLocal=terrain.matrixWorld.clone().invert(), output=[],tints=[];
  const blue=new THREE.Color(0x294965), deep=new THREE.Color(0x1a3049);
  const report={source:terrain.name,sourceVertices:position.count,weldedVertices:welded.length,
    boundaryEdges:0,sealedEdges:0,skippedInland:0,skippedSubmerged:0,skippedHigh:0,triangles:0,
    oceanSource:'officialOceanLevelAt(final world direction)',bottomDepth:2,
    maxCoastalHeight:48,topVerticesUnchanged:true};
  const worldPoint=p=>p.clone().applyMatrix4(terrain.matrixWorld);
  const height=p=>p.length()-radius-officialOceanLevelAt(p);
  const bottom=p=>{
    const r=p.length(),target=Math.min(r,radius+officialOceanLevelAt(p)-2);
    return p.clone().multiplyScalar(target/r).applyMatrix4(toLocal);
  };
  function colorAt(v){
    if(!colors)return blue.clone();
    return new THREE.Color().fromBufferAttribute(colors,v.sourceIndex).lerp(blue,.26);
  }
  function vertex(p,c){output.push(p.x,p.y,p.z);tints.push(c.r,c.g,c.b);}
  for(const edge of edges.values()){
    if(edge.count!==1)continue;
    report.boundaryEdges++;
    const a=welded[edge.a],b=welded[edge.b],mid=a.p.clone().add(b.p).multiplyScalar(.5);
    // A deleted waterfront grid cell may put its last retained edge one cell
    // away from the analytic cutout. Sample a bounded local neighborhood using
    // the exact same predicate that removed the source cells, not a lake box.
    const reach=Math.min(6,Math.max(.75,Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)*1.25));
    let coastal=false;
    for(const p of [a.p,mid,b.p]){
      for(const [dx,dz] of [[0,0],[reach,0],[-reach,0],[0,reach],[0,-reach]]){
        if(isHighlandWaterfrontCutout(p.x+dx,p.z+dz)){coastal=true;break;}
      }
      if(coastal)break;
    }
    if(!coastal){report.skippedInland++;continue;}
    const wa=worldPoint(a.p),wb=worldPoint(b.p),ha=height(wa),hb=height(wb);
    if(Math.max(ha,hb)<=.02){report.skippedSubmerged++;continue;}
    // Defensive limit: background mountain perimeter must not become a giant
    // curtain. The harbor cliff banks are well below this height above water.
    if(Math.max(ha,hb)>report.maxCoastalHeight){report.skippedHigh++;continue;}
    const ba=bottom(wa),bb=bottom(wb),ca=colorAt(a),cb=colorAt(b);
    vertex(a.p,ca);vertex(b.p,cb);vertex(ba,deep);
    vertex(b.p,cb);vertex(bb,deep);vertex(ba,deep);
    report.sealedEdges++;
  }
  const previous=terrain.children.find(o=>o.name===NAME);
  if(previous){previous.removeFromParent();previous.geometry.dispose();previous.material.dispose();}
  report.triangles=report.sealedEdges*2;
  castle.userData.coastalCliffSeal=report;
  if(!output.length)return null;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(output,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({name:'citadel-coastal-rock',color:0xffffff,
    vertexColors:true,roughness:.97,flatShading:true,side:THREE.DoubleSide});
  const skirt=new THREE.Mesh(geometry,material);skirt.name=NAME;
  skirt.castShadow=false;skirt.receiveShadow=true;
  Object.assign(skirt.userData,{sourceId:NAME,isCitadelTerrain:true,westCityWalkable:false,
    nonWalkable:true,presentationOnly:false,skipInkOutline:true,coastalCliffSeal:report});
  terrain.add(skirt);
  return skirt;
}
