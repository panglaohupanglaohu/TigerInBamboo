import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../../',import.meta.url));
const repo=path.dirname(root.replace(/\/$/,''));
const committed=process.argv.includes('--committed');
const esbuild=await import(process.env.ESBUILD_MODULE||'esbuild');
const sourceUrls=[],packed=[];
await fs.mkdir(path.join(root,'runtime/data'),{recursive:true});
const result=await esbuild.build({
 entryPoints:[path.join(root,'src/main.js')],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,write:false,metafile:true,
 external:['three','three/*'],legalComments:'inline',
 plugins:[{name:'preserve-source-resource-urls',setup(build){
  build.onResolve({filter:/^\./},args=>{
   if(!args.importer)return;
   const [name,...query]=args.path.split('?');
   return{path:path.resolve(args.resolveDir,name),suffix:query.length?'?'+query.join('?'):''};
  });
  build.onLoad({filter:/\.js$/},async args=>{
   const rel=path.relative(root,args.path).split(path.sep).join('/');
   let contents=committed&&!rel.startsWith('runtime/')?execFileSync('git',['show',`HEAD:TigerMessenger/${rel}`],{cwd:repo,encoding:'utf8',maxBuffer:128*1024*1024}):await fs.readFile(args.path,'utf8');
   if(contents.length>200000){
    const match=contents.match(/^(?:\s|\/\/[^\n]*\n)*export default ([\s\S]*?);?\s*$/);
    if(match){let parsed;try{parsed=JSON.parse(match[1]);}catch{}if(parsed){
     const raw=Buffer.from(match[1]),hash=createHash('sha256').update(raw).digest('hex'),name=`data/${hash.slice(0,16)}.bin`,compressed=gzipSync(raw,{level:9});
     if(!gunzipSync(compressed).equals(raw))throw Error('Packed-data roundtrip failed: '+rel);
     await fs.writeFile(path.join(root,'runtime',name),compressed);
     packed.push({source:rel,file:name,rawBytes:raw.length,bytes:compressed.length,sha256:hash});
     return{contents:`import{loadPackedData}from${JSON.stringify(path.join(root,'runtime/packedData.js'))};export default await loadPackedData(${JSON.stringify(name)});`,loader:'js',resolveDir:path.dirname(args.path)};
    }}
   }
   // Asset/worker URLs must retain their original source-file base after bundling.
   if(contents.includes('import.meta.url')){
    const literal=JSON.stringify('../'+rel);
    contents=contents.replaceAll('import.meta.url',`new URL(${literal},import.meta.url).href`);
    sourceUrls.push(rel);
   }
   return{contents,loader:'js',resolveDir:path.dirname(args.path)};
  });
 }}]
});
const bytes=result.outputFiles[0].contents,hash=createHash('sha256').update(bytes).digest('hex').slice(0,12),file=`game-${hash}.js`;
await fs.mkdir(path.join(root,'runtime'),{recursive:true});
await fs.writeFile(path.join(root,'runtime',file),bytes);
const imports=Object.values(result.metafile.outputs).flatMap(o=>o.imports).filter(i=>i.external).map(i=>i.path);
const manifest={file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,sourceModules:Object.keys(result.metafile.inputs).length,externalImports:[...new Set(imports)],preservedSourceUrls:sourceUrls,packedData:packed,sourceMode:committed?'committed HEAD':'working tree'};
await fs.writeFile(path.join(root,'runtime/build.json'),JSON.stringify(manifest,null,2)+'\n');
const indexPath=path.join(root,'index.html'),index=await fs.readFile(indexPath,'utf8');
const updated=index.replace(/(const entry = release \? ")[^"]+(" :)/,`$1./runtime/${file}$2`);
if(updated===index&&!index.includes('./runtime/'+file))throw Error('Release entry not found in index.html');
await fs.writeFile(indexPath,updated);
console.log(JSON.stringify({file,bytes:bytes.length,sourceModules:manifest.sourceModules,externalImports:manifest.externalImports,packedFiles:packed.length,packedBytes:packed.reduce((n,p)=>n+p.bytes,0)}));
