import {describe,it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {persistRequest,LocalRequestSchema} from '../src/sources/local.ts'
describe('local scene Source',()=>{
 it('persists idempotently, rejects reused ID changes and preserves snapshot',async()=>{const root=await mkdtemp(join(tmpdir(),'tm-local-source-'));try{const request={id:randomUUID(),scene:'morris-lake',goal:'Keep original buildings',snapshot:{data:'synthetic-test-codec',settings:{time:'day'},recipe:{version:1}}};const first=await persistRequest(root,request);expect(first.duplicate).toBe(false);expect((await persistRequest(root,request)).duplicate).toBe(true);await expect(persistRequest(root,{...request,goal:'different'})).rejects.toThrow('request-id-conflict');expect(request.snapshot.data).toBe('synthetic-test-codec');}finally{await rm(root,{recursive:true,force:true});}})
 it('rejects unsafe IDs, wrong scene and unknown shell command fields',()=>{expect(LocalRequestSchema.safeParse({id:'../../elsewhere'}).success).toBe(false);const good={id:randomUUID(),scene:'morris-lake',goal:'goal',snapshot:{data:'x',settings:{},recipe:{}}};expect(LocalRequestSchema.safeParse({...good,command:'run shell'}).success).toBe(false);expect(LocalRequestSchema.safeParse({...good,scene:'unregistered'}).success).toBe(false);})
})
