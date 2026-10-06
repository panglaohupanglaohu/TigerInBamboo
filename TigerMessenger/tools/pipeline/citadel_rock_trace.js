import * as THREE from 'three';
import {getMountainLandformTrace} from '../../src/world/citadel/mountainLandform.js';
import {getRockRefinementTrace} from '../../src/world/citadel/mountainRockGeometry.js';

export function exportCitadelRockFaceTrace(castle,finalFaces=[32405,31068,31062,29522]){
 const mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),land=getMountainLandformTrace(mesh),refine=mesh&&getRockRefinementTrace(mesh.geometry);
 if(!land||!refine||refine.source!==land.shaped)return {status:'unsupported-or-trace-disabled',reason:'Requires citadelRockTrace=1 at construction, nonlegacy landform and same module realm; source/shape/refine chain must match'};
 const vertices=(g,f)=>[0,1,2].map(j=>g.index?g.index.getX(f*3+j):f*3+j);
 const data=(g,f)=>{const ids=vertices(g,f);return {faceIndex:f,positions:ids.flatMap(i=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(land.toCastle).toArray()),shore:ids.map(i=>g.attributes.shoreBoundaryBottom?.getX(i)??null)};};
 const mappings=finalFaces.slice(0,16).map(finalFace=>{const r=refine.ranges.find(r=>finalFace>=r.start&&finalFace<r.end);return r?{finalFace,inputFace:r.inputFace,sourceFace:Math.floor(r.inputFace/4),range:[r.start,r.end]}:{finalFace,error:'face not found'};});
 const seeds=new Set(mappings.filter(m=>m.sourceFace!==undefined).map(m=>m.sourceFace));
 const key=v=>v.map(x=>Math.round(x*1e4)).join(','),keys=new Set();
 for(const f of seeds){const d=data(land.source,f);for(let j=0;j<9;j+=3)keys.add(key(d.positions.slice(j,j+3)));}
 const total=(land.source.index?.count??land.source.attributes.position.count)/3,neighbors=[];
 for(let f=0;f<total;f++){if(seeds.has(f))continue;const d=data(land.source,f);if([0,3,6].some(j=>keys.has(key(d.positions.slice(j,j+3)))))neighbors.push(f);}
 const parents=[...seeds,...neighbors.slice(0,64)],sourceFaces=parents.map(f=>data(land.source,f)),shapeFaces=[],reliefFaces=[];let omittedFinal=0;
 const rangeMap=new Map(refine.ranges.map(r=>[r.inputFace,r]));
 for(const f of parents)for(let j=0;j<4;j++){const id=f*4+j;shapeFaces.push({...data(land.shaped,id),sourceFace:f});const r=rangeMap.get(id);if(r)for(let i=r.start;i<r.end;i++){if(reliefFaces.length<4096||finalFaces.includes(i))reliefFaces.push({...data(mesh.geometry,i),inputFace:id,sourceFace:f});else omittedFinal++;}}
 return {status:'complete',pass:land.pass,mappings,coordinateSpace:'castle local; unchanged source geometry transformed by captured toCastle',toCastle:land.toCastle.toArray(),castleMatrix:castle.matrixWorld.toArray(),sourceFaces,shapeFaces,reliefFaces,omittedNeighbors:Math.max(0,neighbors.length-64),omittedFinal,mappingBasis:{sourceToShape:land.mapping,shapeToFinal:refine.mapping,warning:'Never divide finalFace by four. Only explicitly mapped shape inputFace has uniform source ancestry.'},limitations:'Construction-stage snapshots retained by reference in WeakMaps; export before any later in-place source mutation. One-ring is source shared-vertex adjacency rounded1e-4. No protected-node mobility log.'};
}
