"""serve.py — 本地静态服务器（start.sh 用）。和 python -m http.server 一样，
但每个响应都带 Cache-Control: no-store：页面是一堆 ES module，浏览器默认会按
Last-Modified 启发式缓存，改了代码刷新页面还在跑旧版本（音效"听不到"就是这么来的）。"""
import sys, http.server, functools, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

class NoCache(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/__rea_identity__":
            body = json.dumps({"root": str(ROOT), "edition": "REACodeRefactoring"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoCache, directory=str(ROOT))).serve_forever()
