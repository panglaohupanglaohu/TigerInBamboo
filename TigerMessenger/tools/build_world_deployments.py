#!/usr/bin/env python3
"""Rebuild candidate placement references from the actual captured GLB hierarchy.
Name matches are discovery evidence only; never replace a runtime asset here.
"""
import argparse,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
def mul(a,b):
 return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def main(write=False):
 path=ROOT/'godot/assets/world-source/original-world-v1.glb'
 with path.open('rb') as f:
  magic,version,total=struct.unpack('<4sII',f.read(12));size,kind=struct.unpack('<II',f.read(8))
  if magic!=b'glTF' or version!=2 or kind!=0x4e4f534a:raise ValueError('Expected GLB2 JSON chunk')
  doc=json.loads(f.read(size))
 nodes=doc['nodes'];by_name={};seen=set()
 def visit(index,parent):
  if index in seen:raise ValueError('Multiple parents/cycle in captured source hierarchy')
  seen.add(index);node=nodes[index]
  if any(key in node for key in ['translation','rotation','scale']):raise ValueError('Capture contract changed to TRS; explicit conversion required')
  world=mul(parent,node.get('matrix',I))
  by_name.setdefault(node.get('name',''),[]).append({'world':'original-world-v1','node':index,'sourcePath':node.get('extras',{}).get('sourcePath'),'matrix':world,'match':'exact original root name; variant identity must be checked before replacement'})
  for child in node.get('children',[]):visit(child,world)
 for index in doc['scenes'][doc.get('scene',0)]['nodes']:visit(index,I)
 registry_path=ROOT/'godot/data/asset-registry.json';registry=json.loads(registry_path.read_text())
 matched=[];unmatched=[]
 for row in registry['assets']:
  snapshot=ROOT/row['source']['snapshot']
  source=json.loads(snapshot.read_text())
  name=source.get('nodes',[{}])[0].get('name','')
  refs=by_name.get(name,[]) if name else []
  row['placementRefs']=refs
  (matched if refs else unmatched).append(row['id'])
 report={'world':'original-world-v1','matchedAssetCount':len(matched),'unmatchedAssetCount':len(unmatched),'matched':matched,'unmatched':unmatched,'limitation':'Root-name candidates only; verify variants, child ownership and behavior before replacement.'}
 if write:
  registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
  out=ROOT/'artifacts/world-migration/asset-placement-matches.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');main(parser.parse_args().write)
