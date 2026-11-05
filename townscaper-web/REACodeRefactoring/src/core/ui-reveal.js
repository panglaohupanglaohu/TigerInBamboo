/** 1024679338292256769 "Some UI flair". Local two-track example, not a
 * reconstruction of the original artwork or its exact per-part timing. */
export function uiRevealAt(seconds,{duration=4}={}){
 if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(duration)||duration<=0)throw new RangeError('Invalid reveal time');
 const p=Math.min(1,seconds/duration),smooth=(a,b)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};
 return{title:smooth(.04,.18)*(1-smooth(.64,.78)),ornament:smooth(.12,.4)*(1-smooth(.72,.99))};
}
