"""Apply the versioned local Source extension only to the pinned isolated checkout."""
import argparse,hashlib,json,pathlib,subprocess,shutil
HERE=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--source',type=pathlib.Path,default=pathlib.Path.home()/'.local/share/tigermessenger-superagent/source-6337fc823ce2');args=parser.parse_args();root=args.source.resolve();manifest=json.loads((HERE/'manifest.json').read_text());patch=HERE/'upstream.patch'
def check(*options):return subprocess.run(['git','apply',*options,str(patch)],cwd=root,capture_output=True).returncode==0
already=check('--reverse','--check')
if not already:
 for name,digest in manifest['baseFiles'].items():
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=digest:raise SystemExit('Refusing different upstream base: '+name)
 if not check('--check'):raise SystemExit('Upstream patch does not apply; no changes made')
 subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
shutil.copy2(HERE/'source.ts',root/'src/sources/local.ts');shutil.copy2(HERE/'source.test.ts',root/'tests/local-scene-source.spec.ts');shutil.copy2(HERE/'local-deployment.test.ts',root/'tests/local-deployment.spec.ts')
print(json.dumps({'extensionInstalled':True,'patchAlreadyApplied':already,'upstreamCommit':manifest['upstreamCommit'],'requiresBuildAndRestart':True}))
