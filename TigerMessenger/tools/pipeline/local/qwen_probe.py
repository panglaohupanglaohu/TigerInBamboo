"""Explicit, bounded inference probe. Records validation only; executes no tools."""
import argparse,json
from pathlib import Path
from common import endpoint,request_json,error_code,read_config

def parse_tool_response(data):
    try:message=data['choices'][0]['message']
    except (KeyError,IndexError,TypeError):return {'passed':False,'reason':'missing_message'}
    if not isinstance(message,dict):return {'passed':False,'reason':'invalid_message'}
    calls=message.get('tool_calls')
    if not isinstance(calls,list) or len(calls)!=1:return {'passed':False,'reason':'missing_or_extra_tool_calls'}
    call=calls[0]
    if not isinstance(call,dict) or call.get('type')!='function' or not isinstance(call.get('id'),str) or not call['id']:return {'passed':False,'reason':'invalid_tool_call'}
    function=call.get('function',{})
    if not isinstance(function,dict) or function.get('name')!='report_probe':return {'passed':False,'reason':'wrong_tool_name'}
    try:arguments=json.loads(function['arguments'])
    except (KeyError,TypeError,ValueError):return {'passed':False,'reason':'invalid_arguments_json'}
    return {'passed':arguments=={'nonce':'local-pipeline-probe'},'reason':'validated' if arguments=={'nonce':'local-pipeline-probe'} else 'arguments_schema_mismatch','executed':False}

def probe(config,allow_nonlocal=False):
    q=config.get('qwen',{})
    if q.get('configured') is not True:return {'status':'not_configured','passed':False}
    try:
        base=endpoint(q.get('baseURL'),allow_nonlocal);model=q.get('model')
        if not isinstance(model,str) or not model:return {'status':'model_not_configured','passed':False}
        timeout=max(.1,min(float(q.get('probeTimeoutSeconds',30)),60))
        body={'model':model,'max_tokens':128,'temperature':0,'messages':[{'role':'user','content':'Reply with exactly LOCAL_PIPELINE_OK.'}]}
        text=request_json(base+'/chat/completions',q,body,timeout)
        try:text_ok=text['choices'][0]['message']['content'].strip()=='LOCAL_PIPELINE_OK'
        except (KeyError,IndexError,TypeError,AttributeError):text_ok=False
        body.update(messages=[{'role':'user','content':'Call report_probe with nonce local-pipeline-probe. Do not write code or prose.'}],tools=[{'type':'function','function':{'name':'report_probe','description':'Harmless schema validation only. Never executed.','parameters':{'type':'object','properties':{'nonce':{'type':'string','enum':['local-pipeline-probe']}},'required':['nonce'],'additionalProperties':False}}}],tool_choice='auto')
        tool=parse_tool_response(request_json(base+'/chat/completions',q,body,timeout))
        return {'status':'completed','passed':text_ok and tool['passed'],'textPassed':text_ok,'tool':tool,'toolsExecuted':0,'note':'Responses are validation evidence only. Model text/tool arguments are never executed.'}
    except Exception as e:return {'status':'error','passed':False,'error':error_code(e),'toolsExecuted':0}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--config',required=True);parser.add_argument('--run',action='store_true',help='Explicitly send two inference requests');parser.add_argument('--allow-nonlocal',action='store_true');parser.add_argument('--output',required=True);args=parser.parse_args()
    if not args.run:parser.error('--run is required; no requests were sent')
    if Path(args.output).exists():parser.error('Output already exists; no requests were sent')
    try:report=probe(read_config(args.config),args.allow_nonlocal)
    except Exception as e:report={'status':'invalid_config','passed':False,'error':error_code(e)}
    # Exclusive creation preserves earlier evidence.
    with Path(args.output).open('x',encoding='utf8') as stream:json.dump(report,stream,ensure_ascii=False,indent=2)
    print(json.dumps(report,ensure_ascii=False))
    raise SystemExit(0 if report.get('passed') else 1)
