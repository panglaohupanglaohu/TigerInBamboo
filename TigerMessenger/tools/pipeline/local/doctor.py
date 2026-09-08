"""Read-only readiness inspection; no model inference or daemon startup."""
import argparse,json,socket,subprocess
from pathlib import Path
from common import endpoint,request_json,error_code,read_config

def check_qwen(config,allow_nonlocal=False):
    if config.get('configured') is not True:return {'status':'not_configured','ready':False}
    try:
        url=endpoint(config.get('baseURL'),allow_nonlocal)
        model=config.get('model')
        if not isinstance(model,str) or not model:return {'status':'model_not_configured','ready':False}
        data=request_json(url+'/models',config,timeout=max(.1,min(float(config.get('timeoutSeconds',3)),10)))
        rows=data.get('data') if isinstance(data,dict) else None
        if not isinstance(rows,list):return {'status':'invalid_models_response','ready':False}
        found=any(isinstance(row,dict) and row.get('id')==model for row in rows)
        return {'status':'model_listed' if found else 'configured_model_not_listed','ready':found,'modelCount':len(rows),'inferenceVerified':False,'toolCallsVerified':False}
    except Exception as e:return {'status':'error','ready':False,'error':error_code(e)}

def binary_version(path):
    if not isinstance(path,str) or not Path(path).is_file():return {'status':'binary_missing','ready':False}
    try:
        result=subprocess.run([path,'--version'],capture_output=True,text=True,timeout=5)
        # Only a bounded version line is retained; no full process environment.
        line=result.stdout.splitlines()[0][:160] if result.stdout else ''
        return {'status':'version_ok' if result.returncode==0 else 'version_failed','ready':result.returncode==0,'version':line,'exitCode':result.returncode}
    except Exception as e:return {'status':'error','ready':False,'error':error_code(e)}

def diagnose(config,allow_nonlocal=False):
    blender=config.get('blender',{});tcp={'status':'not_configured','ready':False,'mcpExecutionVerified':False}
    try:
        host=blender.get('tcpHost');port=int(blender.get('tcpPort',0))
        endpoint('http://'+('['+host+']' if host and ':' in host else str(host))+':'+str(port),allow_nonlocal)
        if not 1<=port<=65535:raise ValueError('invalid_endpoint')
        with socket.create_connection((host,port),timeout=2):pass
        tcp={'status':'tcp_reachable_only','ready':False,'tcpReachable':True,'mcpExecutionVerified':False}
    except Exception as e:tcp.update(status='unreachable_or_unconfigured',error=error_code(e))
    llada=config.get('llada',{})
    image={'status':'not_configured' if llada.get('configured') is not True else 'wrapper_contract_and_model_unverified','ready':False,'httpWrapperVerified':False}
    if llada.get('configured') is True:
        try:endpoint(llada.get('serviceURL'),allow_nonlocal)
        except Exception as e:image.update(status='error',error=error_code(e))
    return {'qwen':check_qwen(config.get('qwen',{}),allow_nonlocal),'blenderBinary':binary_version(blender.get('binary')),'blenderConnection':tcp,'godotBinary':binary_version(config.get('godot',{}).get('binary')),'llada':image,'pipelineReady':False,'note':'TCP and version checks do not verify MCP execution, image inference, or asset integration; use the existing asset_pipeline.py queue.'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--config',required=True);parser.add_argument('--allow-nonlocal',action='store_true');args=parser.parse_args()
    try:report=diagnose(read_config(args.config),args.allow_nonlocal)
    except Exception as e:report={'status':'invalid_config','error':error_code(e),'pipelineReady':False}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    raise SystemExit(0 if report.get('pipelineReady') else 1)
