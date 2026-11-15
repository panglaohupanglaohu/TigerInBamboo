import {analyzeVideoFrames} from '../core/video-cycle-metrics.js';
self.onmessage=({data})=>{try{self.postMessage({job:data.job,result:analyzeVideoFrames(data.frames,data.options)});}catch(error){self.postMessage({job:data.job,error:error.message});}};
