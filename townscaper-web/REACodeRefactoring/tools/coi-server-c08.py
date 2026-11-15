#!/usr/bin/env python3
"""r56 C08: static server with cross-origin isolation headers (COOP/COEP) so SharedArrayBuffer +
Atomics.wait work in workers (job-c08.html, 1670064751181791233). Usage: python3 tools/coi-server-c08.py 8808"""
import sys, http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8808
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('', port), H) as s: s.serve_forever()
