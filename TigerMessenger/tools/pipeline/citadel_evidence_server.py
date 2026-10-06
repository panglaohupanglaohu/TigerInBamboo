"""Loopback-only review capture receiver; explicit harness button, no gameplay APIs."""
import base64, json, re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
DEST = Path(__file__).resolve().parents[2] / 'artifacts/pipeline/citadel-four-hour-20261005'
class Handler(BaseHTTPRequestHandler):
 def respond(self, status):
  self.send_response(status); self.send_header('Access-Control-Allow-Origin','http://localhost:8931'); self.send_header('Access-Control-Allow-Headers','Content-Type'); self.end_headers()
 def do_OPTIONS(self): self.respond(204)
 def do_POST(self):
  if self.path not in ('/capture','/motion') or self.headers.get('Origin') != 'http://localhost:8931': self.respond(403); return
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0 < size < 24000000: raise ValueError('capture too large')
   data=json.loads(self.rfile.read(size)); name=data['name']
   if not re.fullmatch(r'[a-zA-Z0-9_-]{1,160}',name): raise ValueError('invalid label')
   motion=self.path=='/motion'
   prefix='data:video/webm;base64,' if motion else 'data:image/png;base64,'
   encoded=data['webm' if motion else 'png']
   if not encoded.startswith(prefix): raise ValueError('expected WebM' if motion else 'expected PNG')
   payload=base64.b64decode(encoded[len(prefix):],validate=True)
   if not payload.startswith(b'\x1a\x45\xdf\xa3' if motion else b'\x89PNG\r\n\x1a\n'): raise ValueError('invalid media signature')
   paths=[DEST/(name+('.webm' if motion else '.png')),DEST/(name+'.json')]
   if any(p.exists() for p in paths): raise ValueError('evidence exists; use a new label')
   paths[0].write_bytes(payload); paths[1].write_text(json.dumps(data['state'],ensure_ascii=False,indent=2))
   self.respond(201); self.wfile.write(json.dumps({'files':[str(p) for p in paths]}).encode())
  except Exception as e: self.respond(400); self.wfile.write(str(e).encode())
HTTPServer(('127.0.0.1',8932),Handler).serve_forever()
