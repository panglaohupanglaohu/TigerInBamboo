// Shared by the game's SFX bus and the offline audition; no external samples.
function envelope(ctx,points){const g=ctx.createGain();for(let i=0;i<points.length;i++){const [time,value]=points[i];g.gain[i?'linearRampToValueAtTime':'setValueAtTime'](value,time);}return g;}
function tone(ctx,out,type,f0,f1,start,duration,points){const o=ctx.createOscillator(),g=envelope(ctx,points);o.type=type;o.frequency.setValueAtTime(f0,start);o.frequency.exponentialRampToValueAtTime(f1,start+duration);o.connect(g).connect(out);o.start(start);o.stop(start+duration+.01);return o;}
function wind(ctx,out,start,duration,{brown=false,low=800,high=2400,q=.8,points}){const source=ctx.createBufferSource(),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);let seed=17631,last=0;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;const white=(seed>>>0)/2147483648-1;last=(last+.02*white)/1.02;data[i]=brown?last*3.5:white;}source.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type=brown?'lowpass':'bandpass';filter.Q.value=q;filter.frequency.setValueAtTime(low,start);filter.frequency.exponentialRampToValueAtTime(high,start+duration);source.connect(filter).connect(envelope(ctx,points)).connect(out);source.start(start);source.stop(start+duration+.01);return source;}
export function synthBatianBombRelease(ctx,out,start=ctx.currentTime){
  return [tone(ctx,out,'triangle',1350,720,start,.22,[[start,0],[start+.003,.35],[start+.065,.11],[start+.22,0]]),tone(ctx,out,'sine',190,85,start+.025,.20,[[start+.025,0],[start+.03,.38],[start+.225,0]])];
}
export function synthBatianBombFall(ctx,out,{start=ctx.currentTime,duration=3}={}){
  const d=Math.max(.12,duration),ramp=start+d*.75,end=start+d;
  const sources=[wind(ctx,out,start,d,{low:900,high:2500,q:1.3,points:[[start,0],[start+Math.min(.10,d*.2),.065],[ramp,.30],[end-.035,.42],[end,0]]}),tone(ctx,out,'sine',1800,650,start,d,[[start,0],[start+d*.08,.07],[ramp,.21],[end-.035,.28],[end,0]]),tone(ctx,out,'sine',3600,1300,start,d,[[start,0],[start+d*.10,.012],[ramp,.035],[end-.035,.045],[end,0]])];
  let stopped=false;return {stop(){if(stopped)return;stopped=true;for(const source of sources)try{source.stop(ctx.currentTime+.015);}catch{};}};
}
export function synthBatianBombExplosion(ctx,out,start=ctx.currentTime){
  const sources=[tone(ctx,out,'sine',95,28,start,1.35,[[start,0],[start+.006,.65],[start+.12,.34],[start+1.35,0]]),wind(ctx,out,start,1.9,{brown:true,low:1400,high:110,points:[[start,0],[start+.008,.9],[start+.16,.50],[start+.8,.16],[start+1.9,0]]}),wind(ctx,out,start,.20,{low:3000,high:900,q:.5,points:[[start,0],[start+.002,.48],[start+.20,0]]})];
  for(const [offset,freq]of [[.14,850],[.26,1250],[.43,620]])sources.push(tone(ctx,out,'triangle',freq,freq*.65,start+offset,.16,[[start+offset,0],[start+offset+.002,.035],[start+offset+.16,0]]));
  return sources;
}
