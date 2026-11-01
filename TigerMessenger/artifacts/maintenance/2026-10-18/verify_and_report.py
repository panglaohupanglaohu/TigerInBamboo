from pathlib import Path
import concurrent.futures,hashlib,json,subprocess,time,urllib.request,urllib.parse,os
root=Path(__file__).resolve().parents[3]
archive=Path('/Users/panglaohu/Downloads/TigerMessenger-Archive')
out=Path(__file__).parent
records=json.loads((archive/'manifest.json').read_text())
current=[r for r in records if r['project']==str(root) and (root/r['path']).is_symlink()]
def check(r):
 p=root/r['path'];blob=archive/r['blob']
 try:
  if p.resolve()!=blob:raise ValueError('wrong archive link')
  raw=p.read_bytes()
  if len(raw)!=r['bytes'] or hashlib.sha256(raw).hexdigest()!=r['sha256']:raise ValueError('local bytes mismatch')
  url='http://localhost:8931/TigerMessenger/'+urllib.parse.quote(r['path'])
  with urllib.request.urlopen(url,timeout=20) as response:
   body=response.read()
   if response.status!=200 or len(body)!=r['bytes'] or hashlib.sha256(body).hexdigest()!=r['sha256']:raise ValueError('HTTP bytes mismatch')
  return None
 except Exception as e:return {'path':r['path'],'error':str(e)}
failures=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for result in pool.map(check,current):
  if result:failures.append(result)
verification={'checked_links_and_original_http_urls':len(current),'failures':failures,'checked_at':time.time()}
(out/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2))
restored=None
if failures:
 r=subprocess.run(['python3','tools/maintenance/archive_intermediates.py','--restore','--apply'],cwd=root,capture_output=True,text=True,check=True);restored=json.loads(r.stdout);(out/'restored.json').write_text(r.stdout)
 # Recheck former URLs after restore too, never claim an unsuccessful recovery works.
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  post=[x for x in pool.map(check,current) if x]
 (out/'post-restore-verification.json').write_text(json.dumps({'checked':len(current),'failures':post},ensure_ascii=False,indent=2))
r=subprocess.run(['python3','tools/maintenance/archive_intermediates.py'],cwd=root,capture_output=True,text=True,check=True);(out/'plan-after.json').write_text(r.stdout)
sizes={str(p):int(subprocess.check_output(['du','-sk',str(p)],text=True).split()[0])*1024 for p in [root,archive]}
now=time.time();old=[r for r in records if r.get('archived_at',now)<now-90*86400];(out/'archive-over90-days.json').write_text(json.dumps(old,ensure_ascii=False,indent=2))
gitroot=Path(subprocess.check_output(['git','-C',str(root),'rev-parse','--show-toplevel'],text=True).strip())
tracked=[]
media={'.png','.jpg','.jpeg','.webp','.mp4','.blend','.blend1','.blend2','.glb','.gltf','.zip','.exr'}
for rel in subprocess.check_output(['git','-C',str(gitroot),'ls-files','-z']).decode().split('\0'):
 if not rel:continue
 p=gitroot/rel
 try:
  local=p.relative_to(root)
  if not (str(local).startswith('artifacts/') or str(local).startswith('assets/models/optimized/')):continue
  if p.is_symlink() or not p.is_file() or p.suffix.lower() not in media:continue
  s=p.stat()
  if s.st_mtime<now-7*86400:tracked.append({'path':str(local),'bytes':s.st_size,'modified_at':s.st_mtime})
 except (ValueError,FileNotFoundError):continue
tracked.sort(key=lambda r:r['bytes'],reverse=True);(out/'tracked-old.json').write_text(json.dumps(tracked,ensure_ascii=False,indent=2))
a=json.loads((out/'applied.json').read_text());summary={'applied':a,'verification':verification,'restored':restored,'allocated_bytes_not_following_links':sizes,'archive_over90_days':len(old),'tracked_old_count':len(tracked),'tracked_old_bytes':sum(r['bytes'] for r in tracked),'largest_tracked_old':tracked[:10]};(out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
GiB=lambda x:f'{x/1024**3:.2f} GiB';MiB=lambda x:f'{x/1024**2:.1f} MiB'
lines=['# 2026-10-18 每周中间产物归档','',f"实际外移 {a['moved_files']} 文件 / {a['offloaded_bytes']:,} bytes（{MiB(a['offloaded_bytes'])}），保留7天缓冲及原Git追踪/目标图/原始模型/固定活跃批次保护规则。没有永久删除，没有修改Git追踪资产。",'',f"归档路径和原8931完整HTTP字节/SHA256验证：{len(current)} 个，失败 {len(failures)}。"+('已立即按规则恢复，见restored.json及post-restore-verification.json。' if failures else '无需恢复。'),'',f"du -sk不跟随链接：项目 {GiB(sizes[str(root)])}；外部归档 {GiB(sizes[str(archive)])}。",f"归档90天以上可审阅条目：{len(old)}。",f"仍在项目中的受Git追踪旧媒体/模型：{len(tracked)} 项 / {GiB(sum(r['bytes'] for r in tracked))}，仅列出供用户审阅，不能据此安全删除。",'','较大受追踪旧产物：','']
for row in tracked[:10]:lines.append(f"- {MiB(row['bytes'])}：`{row['path']}`")
if old:
 lines+=['','90天以上归档待审阅（不自动删除）：','']
 for row in old[:20]:lines.append(f"- {row['project']}/{row['path']}：{MiB(row['bytes'])}")
else:lines+=['','本周没有90天以上归档清理候选。']
lines+=['','外移减少项目目录占用，不等于释放总磁盘空间，也不缩小Git历史。删除外部归档对象会影响依赖链接，禁止自动删除；是否永久清理由用户另行决定。','',f"再次计划候选：{json.loads(r.stdout)['files']}。",'证据：plan.json、applied.json、verification.json、summary.json、tracked-old.json、archive-over90-days.json、plan-after.json。']
(out/'report.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({**{k:v for k,v in summary.items() if k not in ['largest_tracked_old','verification']},'verification':{'checked':len(current),'failures':len(failures)},'largest_tracked_old':tracked[:5]},ensure_ascii=False))
