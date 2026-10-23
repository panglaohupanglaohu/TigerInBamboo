import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const job=JSON.parse(await fs.readFile(new URL('./courier-job.json',import.meta.url),'utf8'));
const checkout=process.env.IMAGE_BLASTER_DIR||fileURLToPath(new URL('../../../../TigerInBamboo-tools/image-blaster/',import.meta.url));
await fs.access(path.join(checkout,'.claude/scripts/asset-pipeline/generate-single-asset.mjs'));
await fs.access(path.join(checkout,'worlds/tiger-messenger/source/courier-approved.png'));
const envFile=await fs.readFile(path.join(checkout,'.env'),'utf8').catch(()=> '');
const keyPresent=Boolean(process.env.FAL_KEY||envFile.split(/\r?\n/).some(line=>/^\s*FAL_KEY\s*=\s*[^\s#]/.test(line)));
if(!keyPresent){console.error(`FAL_KEY missing: configure ${path.join(checkout,'.env')}. No request submitted.`);process.exit(2);}
if(process.argv.includes('--check')){console.log('Courier input and FAL_KEY are ready; no request submitted.');process.exit(0);}
const args=[path.join(checkout,'.claude/scripts/asset-pipeline/generate-single-asset.mjs'),'--world',job.world,'--object-id',job.objectId,'--provider',job.provider,'--face-count',String(job.faceCount),'--generate-type',job.generateType,'--enable-pbr',String(job.enablePbr),'--image-edit-prompt',job.imageEditPrompt];
// Upstream reuses completed references/models and resumes recorded requests.
const child=spawn(process.execPath,args,{cwd:checkout,env:process.env,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
