/** REACode/tools/measure.html numeric analysis, separated from browser capture.
 * Loop minima and probe spectrum are measurements, not proof of the original shader.
 * The pixel stride increases for large inputs to bound the comparison workload.
 */
export function analyzeVideoFrames(frames,{width,height,pixelStride=3,maxWork=30_000_000}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<10||height<10||width*height>65536||!Array.isArray(frames)||frames.length>600)throw new RangeError('bounded frame dimensions required');
 const size=width*height,n=frames.length;
 if(!Number.isInteger(pixelStride)||pixelStride<1||!Number.isFinite(maxWork)||maxWork<1000||maxWork>100_000_000)throw new RangeError('invalid work budget');
 for(let i=0;i<n;i++){const f=frames[i];if(!Number.isFinite(f.t)||!f.g||f.g.length!==size||(i&&f.t<=frames[i-1].t))throw new TypeError('strictly increasing timestamps and equal frame dimensions required');for(const v of f.g)if(!Number.isFinite(v)||v<0||v>1)throw new TypeError('normalized finite grayscale required');}
 if(n<8)return{frames:n,note:'not enough frames',bestLoopPeriods:[],waterProbeDominantHz:0,waterProbePeriodSec:null};
 const dt=(frames[n-1].t-frames[0].t)/(n-1),lagMax=Math.min(n-3,Math.round(9/dt),300),stride=Math.max(pixelStride,Math.ceil(n*lagMax*size/maxWork)),curve=[];
 for(let lag=1;lag<=lagMax;lag++){let sum=0,count=0;for(let i=0;i+lag<n;i++){const a=frames[i].g,b=frames[i+lag].g;for(let p=0;p<size;p+=stride){sum+=Math.abs(a[p]-b[p]);count++;}}curve.push({lag,sec:+(lag*dt).toFixed(3),diff:+(sum/count).toFixed(5)});}
 const mins=[];for(let i=2;i<curve.length-2;i++){const {diff}=curve[i];if(diff<curve[i-2].diff&&diff<curve[i+2].diff&&diff<.9*curve[2].diff)mins.push({sec:curve[i].sec,diff});}mins.sort((a,b)=>a.diff-b.diff);
 const x0=Math.min(width-10,Math.round(width*.62)),y0=Math.min(height-10,Math.round(height*.78));
 const probe=frames.map(f=>{let sum=0;for(let y=y0;y<y0+10;y++)for(let x=x0;x<x0+10;x++)sum+=f.g[y*width+x];return sum/100;});
 const mean=probe.reduce((a,b)=>a+b,0)/n,dev=probe.map(x=>x-mean),spectrum=[];let bestHz=0,bestAmp=1e-6;
 for(let k=1;k<Math.min(n/2,120);k++){let re=0,im=0;for(let i=0;i<n;i++){const angle=2*Math.PI*k*i/n;re+=dev[i]*Math.cos(angle);im-=dev[i]*Math.sin(angle);}const amp=Math.hypot(re,im)/n,hz=k/(n*dt);spectrum.push({hz:+hz.toFixed(3),amp:+amp.toFixed(5)});if(hz>.08&&amp>bestAmp){bestAmp=amp;bestHz=hz;}}
 spectrum.sort((a,b)=>b.amp-a.amp);
 return{frames:n,fps:+(1/dt).toFixed(2),spanSec:+((n-1)*dt).toFixed(2),pixelStride:stride,irregularSampling:frames.slice(1).some((f,i)=>Math.abs(f.t-frames[i].t-dt)>dt*.05),bestLoopPeriods:mins.slice(0,4),waterProbeDominantHz:+bestHz.toFixed(3),waterProbePeriodSec:bestHz?+(1/bestHz).toFixed(2):null,topSpectrum:spectrum.slice(0,4),curveSample:curve.filter((_,i)=>i%Math.max(1,Math.round(curve.length/24))===0)};
}
export function rgbaToGray(rgba){if(!rgba||rgba.length%4)throw new TypeError('RGBA required');const g=new Float32Array(rgba.length/4);for(let i=0,p=0;i<rgba.length;i+=4,p++)g[p]=(rgba[i]*.299+rgba[i+1]*.587+rgba[i+2]*.114)/255;return g;}
