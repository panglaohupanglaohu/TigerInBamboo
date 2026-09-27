"""Prepare short browser samples from the CC0 Free Firearm Sound Library.
Supply the three originals in a directory (see assets/audio/robot-combat/SOURCES.md).
No external decoder: 24-bit stereo PCM -> DC removal -> mono 44.1 kHz / 16-bit.
"""
import sys,wave,json,hashlib
from pathlib import Path
import numpy as np
source=Path(sys.argv[1]);out=Path(__file__).resolve().parents[2]/'assets/audio/robot-combat';out.mkdir(parents=True,exist_ok=True)
manifest=[]
for kind,file,peaks,duration in [('locust','C_27P.wav',[.27,5.75],1.5),('beetle','G_20P.wav',[.34,2.26,5.26],.85),('ant','O_17P.wav',[.69,3.70],1.8)]:
 with wave.open(str(source/file)) as w:
  rate=w.getframerate();channels=w.getnchannels();assert w.getsampwidth()==3
  b=np.frombuffer(w.readframes(w.getnframes()),np.uint8).reshape(-1,3)
  a=b[:,0].astype(np.int32)|(b[:,1].astype(np.int32)<<8)|(b[:,2].astype(np.int32)<<16);a=((a^0x800000)-0x800000).reshape(-1,channels).mean(axis=1)/8388608
 for i,p in enumerate(peaks):
  # Locate onset near the transient; retain a 1ms pre-roll, not a leading silence.
  lo=max(0,int((p-.10)*rate));hi=int((p+.04)*rate);seg=np.abs(a[lo:hi]);onset=lo+int(np.flatnonzero(seg>max(.025,seg.max()*.07))[0]);start=max(0,onset-int(.001*rate));s=a[start:min(len(a),start+int(duration*rate))].copy();s-=s.mean();s=np.interp(np.arange(0,len(s),rate/44100),np.arange(len(s)),s);s*=.88/max(abs(s).max(),.001)
  fade=min(len(s),int(.12*44100));s[-fade:]*=np.linspace(1,0,fade);s[:22]*=np.linspace(0,1,22)
  name=f'{kind}-{i}.wav'
  with wave.open(str(out/name),'wb') as w:w.setparams((1,2,44100,0,'NONE','not compressed'));w.writeframes((s*32767).astype('<i2').tobytes())
  manifest.append({'file':name,'original':file,'original_sha256':hashlib.sha256((source/file).read_bytes()).hexdigest(),'onset_seconds':start/rate,'duration':len(s)/44100,'peak':float(abs(s).max())})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('Prepared',len(manifest),'recorded takes',sum(p.stat().st_size for p in out.glob('*.wav')),'bytes')
