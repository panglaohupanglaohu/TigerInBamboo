/** 863019585162932224: "nested/recursive coroutines ... multi-frame algorithms".
 * Cooperative work budgeting, explicit iterator stack, bounded transitions.
 * A generator's next() itself cannot be preempted; keep each yielded chunk small.
 */
export const frame=(ops=1)=>{if(!Number.isInteger(ops)||ops<1)throw new RangeError('Invalid work cost');return {ops};};
export class Scheduler {
  constructor({opsPerFrame=24,maxTransitions=512}={}){
    if(!Number.isInteger(opsPerFrame)||opsPerFrame<1||!Number.isInteger(maxTransitions)||maxTransitions<1)throw new RangeError('Invalid scheduler budget');
    this.opsPerFrame=opsPerFrame;this.maxTransitions=maxTransitions;this.stack=[];this.done=true;this.frames=0;this.totalOps=0;this.depthMax=0;this.trace=[];this.peakOps=0;
  }
  add(gen){
    if(!gen||typeof gen.next!=='function')throw new TypeError('Expected iterator');
    this.cancel();this.stack=[{gen,value:undefined,error:null,hasError:false}];this.done=false;this.cancelled=false;this.result=undefined;this.error=null;this.frames=0;this.totalOps=0;this.depthMax=1;this.trace=[];this.peakOps=0;return this;
  }
  cancel(){
    const errors=[];while(this.stack.length){try{this.stack.pop().gen.return?.();}catch(e){errors.push(e);}}
    this.done=true;this.cancelled=true;if(errors.length)throw new AggregateError(errors,'Coroutine cleanup failed');
  }
  step(){
    if(this.done)return {ops:0,done:true};let ops=0,transitions=0;
    while(this.stack.length&&ops<this.opsPerFrame&&transitions++<this.maxTransitions){
      const top=this.stack.at(-1);let r;
      try{const error=top.error,hasError=top.hasError;top.error=null;top.hasError=false;r=hasError?top.gen.throw(error):top.gen.next(top.value);top.value=undefined;}
      catch(e){this.stack.pop();if(this.stack.length){this.stack.at(-1).error=e;this.stack.at(-1).hasError=true;continue;}this.done=true;this.error=e;throw e;}
      if(r.done){this.stack.pop();if(this.stack.length)this.stack.at(-1).value=r.value;else{this.result=r.value;this.done=true;}continue;}
      const value=r.value;
      if(value&&typeof value.next==='function'){this.stack.push({gen:value,value:undefined,error:null,hasError:false});this.depthMax=Math.max(this.depthMax,this.stack.length);continue;}
      if(value===undefined)break; // explicit frame boundary
      const cost=typeof value==='number'?value:value?.ops;
      if(!Number.isInteger(cost)||cost<1){this.cancel();throw new TypeError('Yield a child iterator, positive work cost or undefined');}
      ops+=cost;
    }
    this.frames++;this.totalOps+=ops;this.peakOps=Math.max(this.peakOps,ops);this.trace.push(ops);if(this.trace.length>128)this.trace.shift();return {ops,done:this.done};
  }
  run(maxFrames=100000){if(!Number.isInteger(maxFrames)||maxFrames<1)throw new RangeError('Invalid frame limit');for(let i=0;i<maxFrames&&!this.done;i++)this.step();if(!this.done)throw new Error('Coroutine frame limit reached');return this.result;}
  stats(){return {frames:this.frames,totalOps:this.totalOps,maxDepth:this.depthMax,opsPerFrame:this.opsPerFrame,peakOps:this.peakOps,fill:this.frames?this.totalOps/(this.frames*this.opsPerFrame):0,lastFrameOps:this.trace.at(-1)??0,done:this.done,cancelled:this.cancelled};}
}
