import {describe,it,expect} from 'vitest'
import {mkdtemp,readFile,realpath,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {resolveLocalDeployment,requireGithub} from '../src/deployment.ts'
import {testMachine} from './fixtures/deployment.ts'
import {writeEnvironment,workerGitConfig,workerBin} from '../src/infra/environment.ts'
import {Commands} from '../src/infra/commands.ts'
describe('explicit local deployment',()=>{
 it('uses a real local workspace with no fabricated GitHub identity or credentials',async()=>{const dir=await mkdtemp(join(tmpdir(),'dsh-local-deployment-'));try{const d=resolveLocalDeployment(testMachine({stateDir:dir,localRoot:dir}));expect(d.local?.root).toBe(await realpath(dir));expect(d.github).toBeUndefined();expect(()=>requireGithub(d)).toThrow('unavailable');await writeEnvironment(d,[]);expect(await readFile(join(workerBin(dir),'gh'),'utf8')).toContain('unavailable in local-only');expect(await readFile(workerGitConfig(dir),'utf8')).not.toContain('[credential "https://github.com"]');const commands=new Commands(()=>d,{},new AbortController().signal);await expect(commands.gh(['api','user'])).rejects.toThrow('unavailable');}finally{await rm(dir,{recursive:true,force:true});}})
 it('rejects missing and relative workspaces',()=>{expect(()=>resolveLocalDeployment(testMachine())).toThrow();expect(()=>resolveLocalDeployment(testMachine({localRoot:'relative'}))).toThrow();})
})
