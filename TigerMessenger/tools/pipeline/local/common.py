"""Standard-library transport. No implicit proxy, redirects, downloads or execution."""
import ipaddress,json,os,re,urllib.request
from urllib.error import HTTPError
from urllib.parse import urlsplit

def endpoint(url, allow_nonlocal=False):
    if not isinstance(url,str):raise ValueError('endpoint_not_configured')
    p=urlsplit(url)
    if p.scheme not in ('http','https') or not p.hostname or p.username or p.password or p.query or p.fragment:raise ValueError('invalid_endpoint')
    local=p.hostname=='localhost'
    try:local=local or ipaddress.ip_address(p.hostname).is_loopback
    except ValueError:pass
    if not local and not allow_nonlocal:raise ValueError('nonlocal_endpoint_not_authorized')
    return url.rstrip('/')

def headers(config):
    if 'apiKey' in config:raise ValueError('inline_api_key_not_supported_use_env_name')
    name=config.get('apiKeyEnv')
    result={'Content-Type':'application/json'}
    if name:
        if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*',name):raise ValueError('invalid_api_key_env_name')
        value=os.environ.get(name)
        if not value:raise ValueError('api_key_environment_variable_missing')
        result['Authorization']='Bearer '+value
    return result

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise ValueError('redirect_not_allowed')

def request_json(url,config,payload=None,timeout=3):
    request=urllib.request.Request(url,data=None if payload is None else json.dumps(payload).encode(),headers=headers(config))
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    try:response=opener.open(request,timeout=timeout)
    except HTTPError as error:
        error.close()
        raise
    with response:
        data=response.read(1048577)
        if len(data)>1048576:raise ValueError('response_too_large')
        return json.loads(data)

def error_code(error):
    # Never report server bodies, exception URLs, credentials or env values.
    if isinstance(error,ValueError) and str(error) in {
        'endpoint_not_configured','invalid_endpoint','nonlocal_endpoint_not_authorized',
        'inline_api_key_not_supported_use_env_name','invalid_api_key_env_name',
        'api_key_environment_variable_missing','redirect_not_allowed','response_too_large'}:return str(error)
    if hasattr(error,'code'):return 'http_'+str(error.code)
    return type(error).__name__

def read_config(path):
    with open(path,encoding='utf8') as stream:config=json.load(stream)
    if not isinstance(config,dict) or config.get('version')!=1:raise ValueError('unsupported_config')
    return config
