#!/usr/bin/env python3
"""Auth reverse proxy in front of Ollama. Run on Spark, Funnel THIS port.

Ollama on 127.0.0.1:11434 has no auth. Do not Funnel 11434.
This process checks Authorization: Bearer $SPARK_OLLAMA_SECRET, then
proxies to Ollama.

  SPARK_OLLAMA_SECRET=... python3 scripts/spark-ollama-proxy.py

Default listen: 127.0.0.1:11435
"""
from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

UPSTREAM = os.environ.get("OLLAMA_UPSTREAM", "http://127.0.0.1:11434").rstrip("/")
LISTEN_HOST = os.environ.get("PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("PROXY_PORT", "11435"))
SECRET = os.environ.get("SPARK_OLLAMA_SECRET", "")
HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _unauthorized(self) -> None:
        body = b'{"error":"unauthorized"}'
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not SECRET:
            return False
        header = self.headers.get("Authorization", "")
        return header == f"Bearer {SECRET}"

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()

    def do_HEAD(self) -> None:
        self._proxy()

    def do_OPTIONS(self) -> None:
        self._proxy()

    def _proxy(self) -> None:
        if not self._authorized():
            self._unauthorized()
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(length) if length else None
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in HOP_BY_HOP and k.lower() != "authorization"
        }
        headers["Accept-Encoding"] = "identity"
        headers["Connection"] = "close"
        req = Request(
            f"{UPSTREAM}{self.path}",
            data=payload,
            headers=headers,
            method=self.command,
        )
        try:
            with urlopen(req, timeout=600) as resp:
                self.send_response(resp.status)
                for key, value in resp.headers.items():
                    if key.lower() in HOP_BY_HOP or key.lower() == "content-length":
                        continue
                    self.send_header(key, value)
                self.send_header("Connection", "close")
                self.end_headers()
                if self.command == "HEAD":
                    return
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except HTTPError as err:
            body = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", err.headers.get("Content-Type", "text/plain"))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except URLError as err:
            body = f'{{"error":"ollama unreachable","detail":"{err.reason}"}}'.encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


def main() -> None:
    if not SECRET:
        sys.stderr.write("SPARK_OLLAMA_SECRET is required\n")
        sys.exit(1)
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    sys.stderr.write(
        f"ollama proxy {LISTEN_HOST}:{LISTEN_PORT} -> {UPSTREAM} (auth required)\n"
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
