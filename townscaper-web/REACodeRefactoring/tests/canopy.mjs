import assert from 'node:assert/strict';import{buildCanopy}from'../src/core/canopy.js';
const blobs=[{x:0,y:.3,z:0,r:.16},{x:.11,y:.25,z:.04,r:.12},{x:-.1,y:.26,z:-.03,r:.12},{x:.02,y:.4,z:-.02,r:.11},{x:0,y:.24,z:.11,r:.1}],before=JSON.stringify(blobs),mesh=buildCanopy(blobs);
assert(mesh.stats.closed);assert(mesh.hardEdges.length>0);assert(mesh.stats.hardAfter<mesh.stats.hardBefore);assert.equal(JSON.stringify(blobs),before);assert.deepEqual(mesh,buildCanopy(blobs));
assert(mesh.positions.flat().every(Number.isFinite));for(const n of mesh.normals)assert(Math.abs(Math.hypot(...n)-1)<1e-8);
const sphere=buildCanopy([{x:0,y:0,z:0,r:1}],{passes:0}),volume=sphere.triangles.reduce((sum,[a,b,c])=>{const A=sphere.positions[a],B=sphere.positions[b],C=sphere.positions[c];return sum+(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6},0);assert(volume>3.5&&volume<4.5);assert.equal(sphere.hardEdges.length,0);
for(const args of [[],[{x:0,y:0,z:0,r:0}]])assert.throws(()=>buildCanopy(args),RangeError);assert.throws(()=>buildCanopy(blobs,{resolution:1000}),RangeError);
console.log('PASS closed oriented canopy, outward volume, seams, relaxation and validation',mesh.stats,volume);

const saddle=[[0,.26,0,.19],[.14,.22,.05,.13],[-.13,.22,.03,.13],[.03,.36,.08,.12],[-.04,.38,-.08,.12],[.08,.2,-.12,.11]].map(([x,y,z,r])=>({x,y,z,r}));
assert.throws(()=>buildCanopy(saddle),/closed oriented manifold/);assert(buildCanopy(saddle,{resolution:16}).stats.closed);
console.log('PASS ambiguous low-resolution topology rejected; production resolution closed');
