# Dev server for local testing: python serve.py (then open http://localhost:8123/)
# Same as python -m http.server but sends no-store so the browser never caches
# stale game files between edits.
import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    print('Serving on http://localhost:8123/')
    http.server.ThreadingHTTPServer(('127.0.0.1', 8123), NoCacheHandler).serve_forever()
