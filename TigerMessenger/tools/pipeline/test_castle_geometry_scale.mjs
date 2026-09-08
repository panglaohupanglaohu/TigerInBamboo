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
  const {HIGHLAND_TOWNSCAPER_TOWN_SPEC:spec}=await import('/TigerMessenger/src/world/citadelTown.js');
  const build=topology=>M.buildOdysseyCitadel({spec:structuredClone(spec),wfcTownV1:true,wfcSeed:37,wfcTopology:topology});
  const start=performance.now(),legacy=build(undefined),face=build('legacy-faces');
  const creationMs=performance.now()-start;
  const fingerprint=object=>{
    object.updateMatrixWorld(true);const triangles=[];const v=new T.Vector3();
    for(const layer of object.userData.layers)for(const level of layer.children){
      if(!level.name.startsWith('town-terrace-'))continue;
      level.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;
        const pos=o.geometry.attributes.position,idx=o.geometry.index;if(!pos)return;
        for(let i=0,n=idx?.count??pos.count;i<n;i+=3){
          const verts=[];for(let k=0;k<3;k++){v.fromBufferAttribute(pos,idx?idx.getX(i+k):i+k).applyMatrix4(o.matrixWorld);verts.push([v.x,v.y,v.z].map(n=>Math.round(n*1e4)).join(','));}
          triangles.push([verts.join(';'),[verts[1],verts[2],verts[0]].join(';'),[verts[2],verts[0],verts[1]].join(';')].sort()[0]);
        }
      });
    }
    return triangles.sort();
  };
  const a=fingerprint(legacy),b=fingerprint(face);
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Original full castle geometry changed under shared-edge graph');
  if(!face.userData.highlandLatestDesign||!face.userData.townStats.wfcTown.ok)throw Error('Expected current mountain-valley production castle');
  const reports={source:'Original HIGHLAND_TOWNSCAPER_TOWN_SPEC, complete mountain-valley factory, WFC seed37 old graph vs shared-edge graph',geometryMatches:true,triangles:a.length,creationMs,topology:face.userData.wfcTopology,wfc:face.userData.townStats.wfcTown,scope:'town-layer positions and winding at 1e-4 tolerance; not pixel/material/gameplay acceptance'};
  return reports;
 });
 await mkdir('TigerMessenger/artifacts/pipeline/townscaper-contract',{recursive:true});
 await writeFile('TigerMessenger/artifacts/pipeline/townscaper-contract/castle-geometry-scale.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
