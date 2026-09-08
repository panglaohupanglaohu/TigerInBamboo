import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const path=new URL('../godot/data/bookshop-surroundings.json',import.meta.url);
const raw=await readFile(path),data=JSON.parse(raw);
const source=JSON.parse(await readFile(new URL('../artifacts/bookshop-surroundings/web-source.json',import.meta.url)));
assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);
assert.equal(data.trees.length,6);assert.equal(new Set(data.trees.map(t=>t.id)).size,6);
let triangles=0,inkTriangles=0,maxNormalError=0;
for(const tree of data.trees){
  assert(Math.hypot(tree.localPosition[0],tree.localPosition[2])<=data.nearRadius);
  assert(tree.localPosition[0]<0,'Source forest belongs on the original left-side corridor, not invented symmetric rows');
  assert(tree.scale.every(s=>s>1&&s<2.3));
  assert(tree.colliderRadius>.4&&tree.colliderRadius<.8);
  let surfaceCount=0,inkCount=0;
  for(const surface of tree.surfaces){
    assert.equal(surface.vertices.length%9,0);assert.equal(surface.vertices.length,surface.normals.length);
    assert(surface.vertices.every(Number.isFinite));assert(surface.normals.every(Number.isFinite));
    assert(surface.color.every(c=>c>=0&&c<=1));
    for(let i=0;i<surface.normals.length;i+=3){
      const error=Math.abs(Math.hypot(...surface.normals.slice(i,i+3))-1);
      maxNormalError=Math.max(maxNormalError,error);assert(error<.000002);
    }
    surfaceCount+=surface.vertices.length/9;
  }
  for(const ink of tree.ink){
    assert([.05,.07].includes(ink.dry));assert.equal(ink.vertices.length%9,0);
    assert.equal(ink.uv.length,ink.vertices.length*2/3);
    assert(ink.vertices.every(Number.isFinite));assert(ink.uv.every(Number.isFinite));
    inkCount+=ink.vertices.length/9;
  }
  assert.equal(surfaceCount,inkCount);triangles+=surfaceCount;inkTriangles+=inkCount;
}
assert.equal(triangles,source.surfaceTriangles);
const report={passed:true,trees:data.trees.length,triangles,inkTriangles,maxNormalError,sha256:source.sha256,
  scope:'Source data contract only; not a substitute for Godot layout, rendering and gameplay verification'};
await writeFile(new URL('../artifacts/bookshop-surroundings/data-validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log('BOOKSHOP_SURROUNDINGS_DATA_OK',JSON.stringify(report));
