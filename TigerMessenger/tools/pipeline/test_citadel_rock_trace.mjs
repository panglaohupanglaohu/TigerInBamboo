import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shapeMountainLandform} from '../../src/world/citadel/mountainLandform.js';
import {refineRockFaces} from '../../src/world/citadel/mountainRockGeometry.js';
import {exportCitadelRockFaceTrace} from './citadel_rock_trace.js';
function build(trace){globalThis.location={search:`?citadelRidgePass=6&citadelRockTrace=${+trace}`};const castle=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(24,24,4,4));mesh.geometry.rotateX(-Math.PI/2);mesh.geometry.translate(-68,40,-40);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);shapeMountainLandform(castle);mesh.geometry=refineRockFaces(mesh.geometry,{trace,amplitude:.22,maxEdge:2});return {castle,mesh};}
const previous=globalThis.location;try{
 const a=build(false),b=build(true);for(const n of Object.keys(a.mesh.geometry.attributes))assert.deepEqual(a.mesh.geometry.attributes[n].array,b.mesh.geometry.attributes[n].array);
 assert.equal(exportCitadelRockFaceTrace(a.castle,[0]).status,'unsupported-or-trace-disabled');
 const out=exportCitadelRockFaceTrace(b.castle,[0,35,110]);assert.equal(out.status,'complete');assert(out.sourceFaces.length>0&&out.shapeFaces.length>0&&out.reliefFaces.length>0);
 for(const m of out.mappings){assert(!m.error);assert(m.finalFace>=m.range[0]&&m.finalFace<m.range[1]);assert.equal(m.sourceFace,Math.floor(m.inputFace/4));assert(out.reliefFaces.some(f=>f.faceIndex===m.finalFace&&f.inputFace===m.inputFace));}
 assert(out.mappings.some(m=>m.sourceFace!==Math.floor(m.finalFace/4)),'variable refinement ancestry must not be finalFace/4');
 console.log(JSON.stringify({passed:true,positionsNormalsAndAttributesIdentical:true,explicitAncestry:true,sourceFaces:out.sourceFaces.length,shapeFaces:out.shapeFaces.length,reliefFaces:out.reliefFaces.length}));
}finally{globalThis.location=previous;}
