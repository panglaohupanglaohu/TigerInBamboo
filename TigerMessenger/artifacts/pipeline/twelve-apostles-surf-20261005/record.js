const button=document.querySelector('#recordSurf'),status=document.querySelector('#status');
button.onclick=async()=>{
 const game=document.querySelector('#stage').contentWindow.__tm;
 if(!game?.renderer)return;
 button.disabled=true;
 const stream=game.renderer.domElement.captureStream(15),chunks=[],samples=[];
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const start=performance.now();
 const timer=setInterval(()=>{const foam=[];game.scene.traverse(o=>{if(o.name==='sea-stack-contact-foam')foam.push({time:o.userData.waveBinding?.time,enabled:o.userData.waveBinding?.enabled});});samples.push({elapsed:performance.now()-start,foam,glError:game.renderer.getContext().getError()});status.textContent=`正在录制实际场景碎波 ${((performance.now()-start)/1000).toFixed(1)} / 13 秒`;},500);
 recorder.onstop=()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.id='surfVideoDownload';a.textContent='下载实际碎波录像';document.body.append(a);a.download='twelve-apostles-dynamic-surf.webm';a.click();const pre=document.createElement('pre');pre.id='surfRecordingEvidence';pre.textContent=JSON.stringify({durationMs:performance.now()-start,bytes:blob.size,mime,samples},null,2);document.body.append(pre);status.textContent='13 秒实际场景录制完成';button.disabled=false;};
 recorder.start();setTimeout(()=>recorder.stop(),13000);
};
