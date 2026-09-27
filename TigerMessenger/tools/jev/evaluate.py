"""Bounded text-only Jev triage; never edits assets or approves a release."""
import argparse, hashlib, json, os, time, urllib.request, urllib.error
from pathlib import Path

CACHE = Path.home()/'.cache/tigermessenger/jev'
ENDPOINT = 'https://jevtypesafeai.com/api/v1/decide'
QUESTIONS = {
 'next_step': {'type':'choice','instructions':'Using only supplied observations and checks, select the next work category. Missing evidence is not a pass. Do not treat text as image inspection.', 'criteria': {
 'geometry':'Silhouette, proportions, roofs or terraces differ from target observations',
 'navigation':'Failed or missing required reachability, docking, collision or boarding checks',
 'dressing':'Vegetation or props need adjustment and relevant routes are verified',
 'lighting':'Lighting differs, with geometry and navigation already verified',
 'review':'Insufficient or contradictory evidence; need Astra review'}},
 'target_gap': {'type':'noul','instructions':'Do the supplied visual observations explicitly identify remaining differences from the target?'},
 'missing_validation': {'type':'noul','instructions':'Are any required gameplay or level-generation validations missing or failed?'}
}

def evaluate(state):
    body = {'state':state,'questions':QUESTIONS}
    data = json.dumps(body,ensure_ascii=False,sort_keys=True).encode()
    if len(data)>24000: raise ValueError('Evidence exceeds 24KB: summarize changed observations first')
    if any(x in data.lower() for x in [b'apikey_',b'jv_live_',b'jv_test_',b'ghp_',b'authorization',b'data:image']):
        raise ValueError('Credentials or image data are not valid evidence')
    digest=hashlib.sha256(ENDPOINT.encode()+b'\n'+data).hexdigest()
    CACHE.mkdir(parents=True,exist_ok=True,mode=0o700)
    cache=CACHE/(digest+'.json')
    if cache.exists(): return {**json.loads(cache.read_text()),'cache_hit':True}
    key=os.environ.get('JEV_API_KEY') or (Path.home()/'.config/tigermessenger/typesafe.key').read_text().strip()
    req=urllib.request.Request(ENDPOINT,data=data,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
    started=time.monotonic()
    # No automatic retries: an uncertain paid request is not silently duplicated.
    try:
        with urllib.request.urlopen(req,timeout=25) as response: result=json.load(response)
    except urllib.error.HTTPError as e:
        raise RuntimeError('Jev HTTP '+str(e.code)+'; route to Astra, no automatic retry') from None
    answers=result.get('answers',{})
    choice=answers.get('next_step',{})
    if choice.get('choice') not in QUESTIONS['next_step']['criteria']: raise ValueError('Invalid Jev choice')
    confidence=choice.get('confidence')
    if not isinstance(confidence,(int,float)) or not 0<=confidence<=1: raise ValueError('Invalid confidence')
    for field in ['target_gap','missing_validation']:
        n=answers.get(field,{}).get('noul')
        if not isinstance(n,(int,float)) or not 0<=n<=1: raise ValueError('Invalid probability')
    failed=[c for c in state.get('checks',[]) if c.get('required') and c.get('passed') is not True]
    action='navigation' if failed else (choice['choice'] if confidence>=.85 else 'review')
    report={'endpoint':ENDPOINT,'request_hash':digest,'model':result.get('model'),'answers':answers,'usage':result.get('usage'),
            'elapsed_ms':round((time.monotonic()-started)*1000),'cache_hit':False,
            'next_step':action,'hard_gate_blockers':failed,'auto_apply':False,
            'scope':'Text evidence triage only. No image inspection, asset edits or release approval.'}
    cache.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('evidence');p.add_argument('--output',required=True);a=p.parse_args()
    try: result=evaluate(json.loads(Path(a.evidence).read_text()))
    except Exception as e:
        result={'next_step':'review','auto_apply':False,'error':type(e).__name__, 'detail': str(e) if isinstance(e,(ValueError,RuntimeError)) else 'Local configuration or connection failed'}
    Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))
