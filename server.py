#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
青衿题库 · 后端服务
====================
仅使用 Python 标准库，零第三方依赖（无需 pip install）。

职责：
  1. 托管 static/ 目录下的前端页面；
  2. POST /api/chat —— 把请求透明转发到 OpenAI 兼容接口（默认 DeepSeek）。
     使用「浏览器传入」的用户自带 API Key（Authorization 头），
     服务器不记录、不保存、不打印任何密钥；
  3. GET/POST /api/feedback —— 留言反馈（存到 data/feedback.jsonl）。

运行：
  python server.py
  然后浏览器打开 http://127.0.0.1:8000

环境变量（可选）：
  PORT  监听端口，默认 8000
  HOST  监听地址，默认 127.0.0.1（仅本机；要分享给局域网同学改成 0.0.0.0）
"""

import json
import os
import sys
import threading
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "127.0.0.1")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
FEEDBACK_FILE = os.path.join(DATA_DIR, "feedback.jsonl")
DEFAULT_BASE_URL = os.environ.get("API_BASE_URL", "https://api.deepseek.com").rstrip("/")
MAX_BODY = 5 * 1024 * 1024   # 请求体上限 5MB
TIMEOUT = 600                # 代理超时（秒），出卷可能较慢
_feedback_lock = threading.Lock()


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Base-Url",
        "Access-Control-Max-Age": "86400",
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "QingjinTiku/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        # 只记录方法/路径/状态，绝不记录 Authorization 头
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    # ---------- 响应工具 ----------
    def _send(self, status, body=b"", ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in cors_headers().items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, obj):
        self._send(status, json.dumps(obj, ensure_ascii=False))

    def _read_body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n <= 0:
            return b""
        if n > MAX_BODY:
            return None
        return self.rfile.read(n)

    # ---------- 路由 ----------
    def do_OPTIONS(self):
        self._send(204)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            return self._json(200, {"ok": True, "service": "qingjin-tiku"})
        if path == "/api/feedback":
            return self._feedback_list()
        self._serve_static(path)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/chat":
            return self._proxy_chat()
        if path == "/api/feedback":
            return self._feedback_add()
        self._json(404, {"error": {"message": "接口不存在"}})

    # ---------- 静态文件 ----------
    def _serve_static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        rel = path.lstrip("/")
        safe = os.path.normpath(rel)
        if safe.startswith("..") or os.path.isabs(safe):
            return self._json(403, {"error": {"message": "forbidden"}})
        full = os.path.join(STATIC_DIR, safe)
        if not os.path.isfile(full):
            full = os.path.join(STATIC_DIR, "index.html")  # SPA 兜底
        try:
            with open(full, "rb") as f:
                data = f.read()
        except OSError:
            return self._json(404, {"error": {"message": "文件不存在"}})
        self._send(200, data, self._guess_type(full))

    @staticmethod
    def _guess_type(p):
        e = os.path.splitext(p)[1].lower()
        return {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".ico": "image/x-icon",
            ".txt": "text/plain; charset=utf-8",
            ".md": "text/plain; charset=utf-8",
        }.get(e, "application/octet-stream")

    # ---------- /api/chat 代理 ----------
    def _proxy_chat(self):
        body = self._read_body()
        if body is None:
            return self._json(413, {"error": {"message": "请求体过大"}})

        key = self.headers.get("Authorization") or ""
        if not key.lower().startswith("bearer "):
            return self._json(401, {
                "error": {"message": "请先在「使用说明」里设置你的 API Key"},
                "code": "missing_key",
            })

        base = (self.headers.get("X-Api-Base-Url") or DEFAULT_BASE_URL).rstrip("/")
        url = base + "/chat/completions"

        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json(400, {"error": {"message": "请求体不是合法 JSON"}})

        # 统一走非流式，前端按一次性返回解析
        payload["stream"] = False

        req = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": key,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = resp.read()
                status = resp.status
                ctype = resp.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            data = e.read()
            status = e.code
            ctype = e.headers.get("Content-Type", "application/json")
        except urllib.error.URLError as e:
            return self._json(502, {"error": {"message": "无法连接模型服务：%s" % e.reason}})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": {"message": "代理出错：%s" % e}})

        self._send(status, data, ctype or "application/json")

    # ---------- 留言反馈 ----------
    def _feedback_add(self):
        body = self._read_body()
        if body is None:
            return self._json(413, {"error": {"message": "请求体过大"}})
        try:
            obj = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json(400, {"error": {"message": "请求体不是合法 JSON"}})

        content = (obj.get("content") or "").strip()
        nickname = (obj.get("nickname") or "").strip() or "匿名"
        if not content:
            return self._json(400, {"error": {"message": "留言内容不能为空"}})
        if len(content) > 2000:
            return self._json(400, {"error": {"message": "留言内容过长（最多 2000 字）"}})
        nickname = nickname[:50]

        entry = {
            "id": int(time.time() * 1000),
            "nickname": nickname,
            "content": content,
            "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        try:
            os.makedirs(DATA_DIR, exist_ok=True)
        except OSError:
            pass

        line = json.dumps(entry, ensure_ascii=False) + "\n"
        try:
            with _feedback_lock:
                with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
                    f.write(line)
        except OSError as e:
            return self._json(500, {"error": {"message": "保存失败：%s" % e}})

        return self._json(200, {"ok": True, "entry": entry})

    def _feedback_list(self):
        limit = 100
        try:
            qs = self.path.split("?", 1)[1] if "?" in self.path else ""
            for kv in qs.split("&"):
                if "=" not in kv:
                    continue
                k, v = kv.split("=", 1)
                if k == "limit":
                    limit = max(1, min(int(v), 500))
        except (ValueError, IndexError):
            limit = 100

        entries = []
        if os.path.isfile(FEEDBACK_FILE):
            with _feedback_lock:
                with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        entries.reverse()  # 最新在前
        return self._json(200, {"ok": True, "entries": entries[:limit]})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("青衿题库已启动： http://%s:%d" % (HOST, PORT))
    print("按 Ctrl+C 停止。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.server_close()


if __name__ == "__main__":
    main()
