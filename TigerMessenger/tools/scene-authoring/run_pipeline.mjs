// Worker-callable local execution boundary. No model tokens, network or game-file mutation.
import {readFile} from 'node:fs/promises';
import {makeCandidate,persistCandidate} from './candidates.mjs';
const [input,directory]=process.argv.slice(2);
if(!input||!directory){process.stderr.write('Usage: node run_pipeline.mjs snapshot.json candidate-directory\n');process.exitCode=2;}
else try{const snapshot=JSON.parse(await readFile(input,'utf8')),candidate=makeCandidate(snapshot),path=await persistCandidate(directory,candidate);process.stdout.write(JSON.stringify({candidateId:candidate.id,path,status:candidate.proposal.status,blocked:candidate.proposal.plan.blocked,modelExecuted:false})+'\n');}catch(e){process.stderr.write(JSON.stringify({status:'rejected',error:e.message,modelExecuted:false})+'\n');process.exitCode=1;}
