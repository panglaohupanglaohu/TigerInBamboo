import * as T from 'three';
import {actualUserMarkedStructureFixture} from '../../tests/world/targetUserMarkedStructure.fixture.mjs';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {refineRockFaces} from '../../src/world/citadel/mountainRockGeometry.js';
import {rockSurfaceOptions,rockCrestFold} from '../../src/world/citadel/mountainRockNormals.js';
import {inspectEastCliffSourceEpoch} from '../../src/world/citadel/targetEastCliffRemeshPreview.js';
/** Mirrors mountainStudy terrainFirst refinement, without modifying the shared fixture.
 * Exact epoch must still be compared against the actual loaded page before use. */
export function eastCliffFinalSurfaceFixture({radius=160,search='',sourceOffsetX=-52}={}) {
 const f=actualUserMarkedStructureFixture(),mesh=f.terrain;let raw=mesh.geometry;
 mesh.position.x=sourceOffsetX;mesh.updateMatrix();f.scene.updateMatrixWorld(true);
 const previous=globalThis.location;globalThis.location={search:'?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
 try{applyTargetTerrainCandidate(f.castle,{curves:f.curves,coastalCliffCuts:f.release.coastalCliffCuts,cliffTransitRelease:f.release});}finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
 raw.dispose();raw=mesh.geometry;
 f.scene.updateMatrixWorld(true);
 const before=inspectEastCliffSourceEpoch({castle:f.castle,sourceMesh:mesh});
 const opts=rockSurfaceOptions(search),refined=refineEastCliffSurface({castle:f.castle,mesh,curves:f.curves,radius,search});
 mesh.geometry=refined;raw.dispose();
 return {...f,epoch:{before,after:inspectEastCliffSourceEpoch({castle:f.castle,sourceMesh:mesh}),options:opts,radius,productionMatch:'awaiting live epoch comparison'}};
}

export function refineEastCliffSurface({castle,mesh,curves,radius=160,search=''}){
 const opts=rockSurfaceOptions(search),rail=[];
 for(const curve of Object.values(curves))for(let i=0;i<1000;i++)rail.push(curve.getPointAt(i/1000));
 const normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),toCastle=castle.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
 const refined=refineRockFaces(mesh.geometry,{amplitude:opts.relief,surfaceNormals:opts.pass?{
  pass:opts.pass,protectedFace:points=>points.some(point=>{const world=point.clone().applyMatrix4(mesh.matrixWorld);return world.length()<radius+4||rail.some(p=>p.distanceToSquared(world)<144);}),
  featureEdge:(points,a,b)=>rockCrestFold(points,a,b,{toCastle,normalMatrix,ridgeGraph:[]}),
  protectionBounds:opts.pass>=3?'shore-and-geometric-feature-edges-only':opts.pass===2?'oriented-landform-bounds':'world-aabb'
 }:null,selectTriangle:(a,b,c,n)=>{
  const center=a.clone().add(b).add(c).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld),up=center.clone().normalize();
  return center.length()>=radius+4&&Math.abs(n.clone().applyMatrix3(normalMatrix).normalize().dot(up))<=.68&&!rail.some(p=>p.distanceToSquared(center)<144);
 }});
 Object.assign(refined.userData.rockRefinement,{reliefAmplitude:opts.relief,reliefCandidate:opts.relief!==.65});
 return refined;
}
