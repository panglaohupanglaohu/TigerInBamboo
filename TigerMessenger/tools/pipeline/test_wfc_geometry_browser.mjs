import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.route('**/pipeline-test.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>`}));
 await page.goto('http://127.0.0.1:8767/TigerMessenger/pipeline-test.html');
 const result=await page.evaluate(async()=>{
  const M=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const T=await import('three');
  const blank=()=>Array.from({length:25},()=>'.'.repeat(25));
  const levels=[blank(),blank(),blank()];
  levels[0][12]='......000000000000.......';
  levels[1][12]='......000000000000.......';
  const spec={version:2,gridSize:25,floors:3,terraces:Array.from({length:5},(_,i)=>({levels:i===0?levels:[blank(),blank(),blank()]}))};
  const castle=M.buildOdysseyCitadel({spec,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:true,wfcTownV1:true,wfcSeed:37,wfcTopology:"legacy-faces"});
  const caches=castle.userData.townCtxCache.terraces;
  const before=caches[0].wfcTownSelection?.value;
  if(!before?.ok)throw Error('Initial production WFC does not solve');
  const next=structuredClone(spec);next.terraces[0].levels[2][12]='......0..................';
  const r=M.rebuildCitadelTownIncremental(castle,next,['6,2,12'],{skipDecor:true});
  if(!r.ok)throw Error(JSON.stringify(r));
  if(r.dirtyCount<24)throw Error('Solver influence not included in geometry dirty');
  if(castle.userData.wfcTopology!=='legacy-faces')throw Error('Topology mode not persisted');
  if(castle.userData.wfcSeed!==37)throw Error('Seed not persisted');
  const full=M.buildOdysseyCitadel({spec:next,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:true,wfcTownV1:true,wfcSeed:37,wfcTopology:"legacy-faces"});
  const townTriangles=(object)=>{
    let count=0;
    for(const layer of object.userData.layers)for(const level of layer.children){
      if(!level.name.startsWith('town-terrace-'))continue;
      level.traverse(o=>{if(o.isMesh&&!o.userData.isOutline)count+=(o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3;});
    }
    return count;
  };
  const legacy=M.buildOdysseyCitadel({spec:next,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:true,wfcTownV1:true,wfcSeed:37});
  const incrementalTriangles=townTriangles(castle),fullTriangles=townTriangles(full),legacyTriangles=townTriangles(legacy);
  if(legacyTriangles!==fullTriangles)throw Error('Face graph altered original geometry triangle count');
  if(JSON.stringify(full.userData.townCtxCache.terraces[0].wfcTownSelection.value.byCell)!==JSON.stringify(legacy.userData.townCtxCache.terraces[0].wfcTownSelection.value.byCell))throw Error('Face graph altered original assignments');
  if(incrementalTriangles!==fullTriangles)throw Error(`Geometry mismatch ${incrementalTriangles} != ${fullTriangles}`);
  const geometryFingerprint=object=>{
    object.updateMatrixWorld(true);const triangles=[];const v=new T.Vector3();
    for(const layer of object.userData.layers)for(const level of layer.children){
      if(!level.name.startsWith('town-terrace-'))continue;
      level.traverse(o=>{
        if(!o.isMesh||o.userData.isOutline)return;
        const pos=o.geometry.attributes.position,idx=o.geometry.index;if(!pos)return;
        for(let i=0,n=idx?.count??pos.count;i<n;i+=3){
          const verts=[];for(let k=0;k<3;k++){v.fromBufferAttribute(pos,idx?idx.getX(i+k):i+k).applyMatrix4(o.matrixWorld);verts.push([v.x,v.y,v.z].map(n=>Math.round(n*1e4)).join(','))}
          // Cyclic reorder preserves winding; tolerate Float32 merge roundoff.
          triangles.push([verts.join(';'),[verts[1],verts[2],verts[0]].join(';'),[verts[2],verts[0],verts[1]].join(';')].sort()[0]);
        }
      });
    }
    return triangles.sort().join('|');
  };
  const editSequence=[];
  let liveSpec=structuredClone(next);
  for (const [label,key,char] of [['remove-top','6,2,12','.'],['recolor-column-base','11,0,12','1'],['recolor-column-upper','11,1,12','1'],['restore-base','11,0,12','0'],['restore-upper','11,1,12','0']]) {
    const [x,y,z]=key.split(',').map(Number),row=[...liveSpec.terraces[0].levels[y][z]];row[x]=char;liveSpec.terraces[0].levels[y][z]=row.join('');
    const edited=M.rebuildCitadelTownIncremental(castle,liveSpec,[key],{skipDecor:true});
    if(!edited.ok)throw Error(`${label}: ${JSON.stringify(edited)}`);
    const rebuilt=M.buildOdysseyCitadel({spec:liveSpec,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:true,wfcTownV1:true,wfcSeed:37,wfcTopology:'legacy-faces'});
    const actual=townTriangles(castle),expected=townTriangles(rebuilt);
    const geometryMatches=geometryFingerprint(castle)===geometryFingerprint(rebuilt);
    editSequence.push({label,actual,expected,geometryMatches,dirtyCount:edited.dirtyCount});
    if(!geometryMatches)throw Error(`${label}: actual triangle positions or winding differ from full rebuild`);
    if(actual!==expected)throw Error(`${label}: incremental triangles ${actual}, full ${expected}`);
    rebuilt.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
  }
  const multiSpec=structuredClone(spec);
  multiSpec.terraces[1].levels[0][12]='............0............';
  multiSpec.terraces[1].levels[1][12]='............0............';
  const multi=M.buildOdysseyCitadel({spec:multiSpec,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:true,wfcTownV1:true,wfcSeed:37,wfcTopology:"legacy-faces"});
  const a=multi.userData.townCtxCache.terraces[0],b=multi.userData.townCtxCache.terraces[1];
  if(a===b||!a.wfcTownSelection?.value.ok||!b.wfcTownSelection?.value.ok)throw Error('Terrace cache isolation failed');
  const cacheSizes=[Object.keys(a.wfcTownSelection.value.byCell).length,Object.keys(b.wfcTownSelection.value.byCell).length];
  if(cacheSizes[0]!==24||cacheSizes[1]!==2)throw Error('Terrace prior assignments were mixed');
  const reports={editSequence,cacheIsolation:{sizes:cacheSizes,distinct:a!==b},geometry:{incrementalTriangles,fullTriangles,legacyTriangles},topology:castle.userData.wfcTopology,result:r,seed:castle.userData.wfcSeed,cacheKeys:Object.keys(castle.userData.townCtxCache.terraces),wfc:castle.userData.townStats?.wfcTown};
  const scene=new T.Scene();scene.background=new T.Color('#b9cfda');scene.add(castle);
  scene.add(new T.HemisphereLight(0xffffff,0x758176,2));const sun=new T.DirectionalLight(0xfff4de,2);sun.position.set(15,25,20);scene.add(sun);
  const camera=new T.PerspectiveCamera(42,1000/700,.1,500);camera.position.set(35,27,40);camera.lookAt(0,3,0);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.appendChild(renderer.domElement);renderer.render(scene,camera);
  reports.meshes=0;castle.traverse(o=>{if(o.isMesh)reports.meshes++});
  return reports;
 });
 await mkdir('TigerMessenger/artifacts/pipeline/townscaper-contract',{recursive:true});
 await page.screenshot({path:'TigerMessenger/artifacts/pipeline/townscaper-contract/geometry-edit.png'});
 await writeFile('TigerMessenger/artifacts/pipeline/townscaper-contract/geometry-edit.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
