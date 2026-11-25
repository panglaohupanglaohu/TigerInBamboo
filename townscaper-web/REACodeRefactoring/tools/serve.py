"""serve.py — 本地静态服务器（start.sh 用）。和 python -m http.server 一样，
但每个响应都带 Cache-Control: no-store：页面是一堆 ES module，浏览器默认会按
Last-Modified 启发式缓存，改了代码刷新页面还在跑旧版本（音效"听不到"就是这么来的）。

另外：`job-c08.html`（1670064751181791233，job 里的 Thread.Sleep）必须开
cross-origin isolation 才有 SharedArrayBuffer —— 否则页面只能退到「倍率启动时复制一次 + 忙等」，
片子那件事（主线程写、job 里读）等于没发生。COOP/COEP 只对这条链路加（文档 + 它的 worker），
不全局加，免得动到别的页面（COEP: require-corp 会改变所有子资源的口径）。"""
import sys, http.server, functools, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
# 需要 cross-origin isolation 的路径前缀（文档页 + 它的 module worker）
COI_PREFIXES = ('/job-c08.html', '/src/terrain/pipeline-job')

class NoCache(http.server.SimpleHTTPRequestHandler):
    def _needs_coi(self):
        return self.path.split('?')[0].startswith(COI_PREFIXES)
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
        if self._needs_coi():
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoCache, directory=str(ROOT))).serve_forever()
