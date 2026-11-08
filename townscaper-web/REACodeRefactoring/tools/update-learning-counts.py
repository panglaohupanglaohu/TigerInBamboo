"""Count unique videos with matching frame metadata and a written review record.
This checks bookkeeping consistency; it does not replace the visual review.
"""
import json, pathlib, datetime
root=pathlib.Path(__file__).resolve().parents[1]
s=(root/'learn/data.js').read_text();data=json.loads(s[len('window.LEARN = '):].strip().rstrip(';'))
videos={p.stem for p in (root/'../../REA-agent/gifs').resolve().glob('*.mp4')};verified=set()
for item in data['items']:
 clip=item.get('id');frames=root/'artifacts/coverage'/str(clip)/'frames.json';evidence=item.get('reviewEvidence')
 if clip in videos and item.get('decodedFrames',0)>0 and evidence and (root/evidence).is_file() and frames.is_file():
  if json.loads(frames.read_text())['decoded']==item['decodedFrames']:verified.add(clip)
p=root/'learn/coverage-progress.json';progress=json.loads(p.read_text());pace=progress.setdefault('learningPace',{})
pace.update(totalClips=len(videos),reviewedClips=len(verified),remainingClips=len(videos-verified),countBasis='独立视频ID、对应全帧记录和学习证据；不等同全部代码验收通过')
if pace.get('startedAt'):
 now=datetime.datetime.now(datetime.timezone.utc);started=datetime.datetime.fromisoformat(pace['startedAt']);hours=max((now-started).total_seconds()/3600,.001)
 pace['actualClipsPerHour']=round(max(0,len(verified)-pace.get('baselineReviewedClips',len(verified)))/hours,2)
 pace['measuredAt']=now.astimezone(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
session_path=root/'learn/accelerated-session.json'
if session_path.is_file():
 session=json.loads(session_path.read_text())
 if session.get('status')=='active':
  now=datetime.datetime.now(datetime.timezone.utc)
  started=datetime.datetime.fromisoformat(session['startedAt'].replace('Z','+00:00'))
  elapsed=max((now-started).total_seconds()/3600,.001)
  added=max(0,len(verified)-session['baselineReviewed'])
  session.update(reviewedNow=len(verified),newReviewedClips=added,actualClipsPerElapsedHour=round(added/elapsed,2),measuredAt=now.isoformat())
  session.pop('actualClipsPerWindowHour',None)
  progress.setdefault('session',{}).update(status='active',durationHours=session['durationHours'],baselineReviewed=session['baselineReviewed'],reviewedNow=len(verified),newReviewedClips=added,startedAt=session['startedAt'],endsAt=session['endsAt'],actualClipsPerElapsedHour=session['actualClipsPerElapsedHour'])
  session_path.write_text(json.dumps(session,ensure_ascii=False,indent=2)+'\n')
p.write_text(json.dumps(progress,ensure_ascii=False,indent=2)+'\n');print(pace)
