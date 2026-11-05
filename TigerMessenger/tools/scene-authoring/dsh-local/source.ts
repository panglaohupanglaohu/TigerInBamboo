/** Local scene requests. Records into the native Engine while setup/execution remains independently gated. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import s from '@deepseek-ai/schemastery'
import { sameOrigin } from '../app/http.ts'
import { sourceContext } from './host.ts'
import type { SourceKind } from './kind.ts'
export const LocalRequestSchema = z.object({
 id: z.string().uuid(), scene: z.literal('morris-lake'), goal: z.string().min(1).max(4000),
 snapshot: z.object({ data: z.string().min(1).max(1_000_000), settings: z.record(z.string(), z.union([z.boolean(),z.string()])), recipe: z.record(z.string(),z.unknown()), locks: z.record(z.string(),z.unknown()).optional() }).strict()
}).strict()
export type LocalRequest = z.infer<typeof LocalRequestSchema>
export const localKind: SourceKind = { kind:'scene-local',title:{zh:'本地场景',en:'Local scene'},description:{zh:'同机显式场景请求；不使用GitHub身份。',en:'Explicit local scene requests, without a GitHub identity.'},schema:z.object({}).strict(),fields:[],health:['scene-local'],policy:{schema:z.object({allowed:z.array(z.object({id:z.string(),name:z.string().optional()})).default([])}).strict(),fields:[{key:'allowed',type:'rows',label:{zh:'允许的本地身份',en:'Allowed local identities'},columns:[{key:'id',type:'text',label:{zh:'身份',en:'Identity'}}]}],explicit:{zh:'通过已认证本地界面提交的显式场景请求',en:'Explicit scene requests through authenticated local UI'}} }
function canonical(value: unknown): unknown { return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value }
export function requestHash(value: LocalRequest): string { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex') }
export async function persistRequest(root:string,input:unknown):Promise<{request:LocalRequest;hash:string;duplicate:boolean}> {
 const request=LocalRequestSchema.parse(input),hash=requestHash(request);await mkdir(root,{recursive:true,mode:0o700});const path=join(root,request.id+'.json');
 try{const old=JSON.parse(await readFile(path,'utf8')) as {hash:string};if(old.hash!==hash)throw Error('request-id-conflict');return {request,hash,duplicate:true};}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const temp=path+'.tmp-'+randomUUID();await writeFile(temp,JSON.stringify({version:1,hash,request},null,2),{flag:'wx',mode:0o600});
 try{await link(temp,path);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return persistRequest(root,request);throw error;}finally{await unlink(temp);}
 return {request,hash,duplicate:false};
}
export const Config=s.object({requestDir:s.string().pattern(/^\//).required()})
export const name='dsh-superagent-local'
export const inject=['orchestrator','webServer']
export function apply(ctx:Context,config:{requestDir:string}):void {
 ctx.effect(()=>ctx.orchestrator.sources.register(localKind));const source=sourceContext(ctx.orchestrator,localKind);const root=config.requestDir;
 source.report('scene-local',{state:'paused',detail:'Local intake ready. Router/Worker still governed by deployment and model setup.'});
 ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/scene-source',handler:async(req,res)=>{
  const respond=(code:number,value:unknown)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(!sameOrigin(req,ctx.webServer.port)){respond(403,{error:'same-origin-request-required'});return;}
  if(req.method==='GET'&&req.url==='/scene-source/status'){respond(200,{source:'scene-local',intakeReady:true,deploymentReady:source.configured(),executionReady:false,modelExecutionVerified:false});return;}
  if(req.method!=='POST'||req.url!=='/scene-source/requests'){respond(404,{error:'unknown-operation'});return;}
  if(!req.headers['content-type']?.startsWith('application/json')){respond(415,{error:'json-required'});return;}
  try{
   const chunks:Buffer[]=[];let bytes=0;for await(const part of req){const chunk=Buffer.from(part);bytes+=chunk.length;if(bytes>2_000_000){respond(413,{error:'request-too-large'});return;}chunks.push(chunk);}
   const saved=await persistRequest(root,JSON.parse(Buffer.concat(chunks).toString('utf8'))),request=saved.request;
   const received=await source.receive({id:'scene-local:'+request.id,source:'scene-local',threads:[{source:'scene-local',id:request.scene}],actor:{source:'scene-local',id:'local-operator'},human:true,addressed:'direct',at:new Date().toISOString(),text:request.goal,meta:{scene:request.scene,requestId:request.id,snapshotHash:saved.hash}});
   respond(saved.duplicate?200:201,{id:request.id,hash:saved.hash,duplicate:saved.duplicate,received,deploymentReady:source.configured(),executionReady:false,modelExecuted:false});
  }catch(error){respond((error as Error).message==='request-id-conflict'?409:400,{error:(error as Error).message==='request-id-conflict'?'request-id-conflict':'invalid-local-request'});}
 }}));
}
