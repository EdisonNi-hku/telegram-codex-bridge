#!/usr/bin/env python3
"""Owner-login cookie proxy for the local Codex Console Web preview.

This is intentionally small and personal-use oriented. It accepts an owner
password at /owner-login, sets a signed HttpOnly/Secure/SameSite=Lax cookie,
and forwards authenticated GET/HEAD traffic to the localhost read-only Web app
with the bearer token injected from the environment.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import http.client
import json
import os
import secrets
import sys
import threading
import time
import urllib.parse
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, Iterable, Mapping, MutableMapping, Optional, Tuple

COOKIE_NAME = "ctb_web_owner"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PROXY_PORT = 45683
DEFAULT_UPSTREAM = "http://127.0.0.1:45682"
DEFAULT_SESSION_MAX_AGE = 6 * 60 * 60
DEFAULT_THROTTLE_LIMIT = 5
DEFAULT_THROTTLE_SECONDS = 60
MAX_FORM_BYTES = 4096

LOGIN_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Owner preview login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { width: min(28rem, calc(100vw - 2rem)); padding: 2rem; border: 1px solid #334155; border-radius: 1rem; background: #111827; box-shadow: 0 24px 80px rgb(0 0 0 / 0.35); }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: #94a3b8; line-height: 1.5; }
    label { display: grid; gap: 0.5rem; margin: 1rem 0; color: #cbd5e1; }
    input { border: 1px solid #475569; border-radius: 0.7rem; padding: 0.8rem 0.9rem; background: #020617; color: #f8fafc; font-size: 1rem; }
    button { width: 100%; border: 0; border-radius: 0.7rem; padding: 0.85rem 1rem; background: #38bdf8; color: #082f49; font-weight: 700; cursor: pointer; }
    .error { color: #fecaca; }
  </style>
</head>
<body>
  <main>
    <h1>Owner preview login</h1>
    <p>Enter the local owner preview password to view the read-only Codex Console.</p>
    __MESSAGE__
    <form method="post" action="/owner-login">
      <label>Preview password<input name="password" type="password" autocomplete="current-password" required autofocus></label>
      <button type="submit">Open preview</button>
    </form>
  </main>
</body>
</html>
"""


@dataclass(frozen=True)
class ProxyConfig:
    host: str
    port: int
    upstream: str
    readonly_token: str
    owner_password: str
    session_secret: str
    session_max_age: int = DEFAULT_SESSION_MAX_AGE
    throttle_limit: int = DEFAULT_THROTTLE_LIMIT
    throttle_seconds: int = DEFAULT_THROTTLE_SECONDS


class LoginThrottle:
    def __init__(self, limit: int, lock_seconds: int) -> None:
        self._limit = max(1, limit)
        self._lock_seconds = max(1, lock_seconds)
        self._failures: Dict[str, Tuple[int, float]] = {}
        self._lock = threading.Lock()

    def is_locked(self, key: str, now: Optional[float] = None) -> bool:
        current = time.time() if now is None else now
        with self._lock:
            failures, locked_until = self._failures.get(key, (0, 0.0))
            if locked_until > current:
                return True
            if locked_until and locked_until <= current:
                self._failures[key] = (0, 0.0)
            return False

    def record_failure(self, key: str, now: Optional[float] = None) -> None:
        current = time.time() if now is None else now
        with self._lock:
            failures, locked_until = self._failures.get(key, (0, 0.0))
            if locked_until > current:
                return
            failures += 1
            self._failures[key] = (
                failures,
                current + self._lock_seconds if failures >= self._limit else 0.0,
            )

    def record_success(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


class OwnerCookieProxyHandler(BaseHTTPRequestHandler):
    server: "OwnerCookieProxyServer"
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path_only == "/healthz":
            self._send_json(HTTPStatus.OK, {"ok": True, "service": "web-owner-cookie-proxy"})
            return
        if self.path_only == "/owner-login":
            self._send_login()
            return
        if not self._authenticated():
            self._send_login()
            return
        self._forward_authenticated(head_only=False)

    def do_HEAD(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path_only == "/healthz":
            self._send_json(HTTPStatus.OK, {"ok": True, "service": "web-owner-cookie-proxy"}, head_only=True)
            return
        if self.path_only == "/owner-login" or not self._authenticated():
            self._send_login(head_only=True)
            return
        self._forward_authenticated(head_only=True)

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path_only != "/owner-login":
            self._send_not_found()
            return

        client_key = self._client_key()
        if self.server.throttle.is_locked(client_key):
            self._send_plain(HTTPStatus.TOO_MANY_REQUESTS, "try again later")
            return

        password = self._read_password_field()
        if password is not None and hmac.compare_digest(password, self.server.config.owner_password):
            self.server.throttle.record_success(client_key)
            cookie = sign_session_cookie(self.server.config, now=int(time.time()))
            self.send_response(HTTPStatus.SEE_OTHER)
            self._send_common_headers(content_type="text/plain; charset=utf-8")
            self.send_header("Location", "/")
            self.send_header(
                "Set-Cookie",
                f"{COOKIE_NAME}={cookie}; Max-Age={self.server.config.session_max_age}; Path=/; HttpOnly; Secure; SameSite=Lax",
            )
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self.server.throttle.record_failure(client_key)
        self._send_login(HTTPStatus.UNAUTHORIZED, message="<p class=\"error\">Login failed.</p>")

    def log_message(self, fmt: str, *args: object) -> None:
        # Avoid logging paths, headers, cookies, or submitted form data.
        return

    @property
    def path_only(self) -> str:
        try:
            return urllib.parse.urlsplit(self.path).path or "/"
        except ValueError:
            return "/"

    def _authenticated(self) -> bool:
        cookie_header = self.headers.get("Cookie", "")
        cookies = parse_cookie_header(cookie_header)
        value = cookies.get(COOKIE_NAME)
        return bool(value and verify_session_cookie(value, self.server.config, now=int(time.time())))

    def _client_key(self) -> str:
        cf_ip = self.headers.get("CF-Connecting-IP", "").split(",", 1)[0].strip()
        forwarded = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        return cf_ip or forwarded or self.client_address[0]

    def _read_password_field(self) -> Optional[str]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length < 0 or length > MAX_FORM_BYTES:
            return None
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        values = urllib.parse.parse_qs(body, keep_blank_values=True, strict_parsing=False)
        candidates = values.get("password") or values.get("pass") or []
        return candidates[0] if candidates else None

    def _send_login(
        self,
        status: HTTPStatus = HTTPStatus.OK,
        *,
        message: str = "",
        head_only: bool = False,
    ) -> None:
        body = LOGIN_PAGE.replace("__MESSAGE__", message).encode("utf-8")
        self.send_response(status)
        self._send_common_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _send_json(self, status: HTTPStatus, payload: Mapping[str, object], *, head_only: bool = False) -> None:
        body = (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
        self.send_response(status)
        self._send_common_headers(content_type="application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _send_plain(self, status: HTTPStatus, body_text: str) -> None:
        body = body_text.encode("utf-8")
        self.send_response(status)
        self._send_common_headers(content_type="text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_not_found(self) -> None:
        self._send_plain(HTTPStatus.NOT_FOUND, "not found")

    def _send_common_headers(self, *, content_type: str = "text/html; charset=utf-8") -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")

    def _forward_authenticated(self, *, head_only: bool) -> None:
        upstream = urllib.parse.urlsplit(self.server.config.upstream)
        path = self.path if self.path.startswith("/") else "/"
        connection_cls = http.client.HTTPSConnection if upstream.scheme == "https" else http.client.HTTPConnection
        port = upstream.port or (443 if upstream.scheme == "https" else 80)
        host = upstream.hostname or "127.0.0.1"
        try:
            connection = connection_cls(host, port, timeout=10)
            connection.request(
                "HEAD" if head_only else "GET",
                path,
                headers={
                    "Authorization": f"Bearer {self.server.config.readonly_token}",
                    "Accept": self.headers.get("Accept", "text/html,application/xhtml+xml"),
                    "User-Agent": "codex-web-owner-cookie-proxy",
                    "Host": upstream.netloc,
                },
            )
            upstream_response = connection.getresponse()
            body = b"" if head_only else upstream_response.read()
            self.send_response(upstream_response.status)
            for name, value in upstream_response.getheaders():
                lower = name.lower()
                if lower in {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "set-cookie", "content-length"}:
                    continue
                self.send_header(name, value)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if body:
                self.wfile.write(body)
        except Exception:
            self._send_plain(HTTPStatus.BAD_GATEWAY, "upstream unavailable")
        finally:
            try:
                connection.close()  # type: ignore[possibly-undefined]
            except Exception:
                pass


class OwnerCookieProxyServer(ThreadingHTTPServer):
    def __init__(self, server_address: Tuple[str, int], config: ProxyConfig) -> None:
        super().__init__(server_address, OwnerCookieProxyHandler)
        self.config = config
        self.throttle = LoginThrottle(config.throttle_limit, config.throttle_seconds)


def sign_session_cookie(config: ProxyConfig, *, now: int) -> str:
    expires = now + config.session_max_age
    payload = json.dumps({"exp": expires, "nonce": secrets.token_urlsafe(18)}, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
    signature = hmac.new(config.session_secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return f"{payload_b64}.{signature_b64}"


def verify_session_cookie(value: str, config: ProxyConfig, *, now: int) -> bool:
    try:
        payload_b64, signature_b64 = value.split(".", 1)
        expected = hmac.new(config.session_secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
        expected_b64 = base64.urlsafe_b64encode(expected).rstrip(b"=").decode("ascii")
        if not hmac.compare_digest(signature_b64, expected_b64):
            return False
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
        payload = json.loads(payload_bytes.decode("utf-8"))
        return isinstance(payload.get("exp"), int) and payload["exp"] >= now
    except Exception:
        return False


def parse_cookie_header(header: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for item in header.split(";"):
        if "=" not in item:
            continue
        name, value = item.split("=", 1)
        result[name.strip()] = value.strip()
    return result


def read_config(env: Mapping[str, str]) -> ProxyConfig:
    password = env.get("CTB_WEB_PREVIEW_PASS") or env.get("CTB_WEB_BASIC_PASS") or ""
    token = env.get("CTB_WEB_READONLY_TOKEN", "")
    session_secret = env.get("CTB_WEB_SESSION_SECRET", "")
    missing = [
        name
        for name, value in (
            ("CTB_WEB_READONLY_TOKEN", token),
            ("CTB_WEB_PREVIEW_PASS or CTB_WEB_BASIC_PASS", password),
            ("CTB_WEB_SESSION_SECRET", session_secret),
        )
        if not value.strip()
    ]
    if missing:
        raise SystemExit(f"missing required environment: {', '.join(missing)}")

    return ProxyConfig(
        host=DEFAULT_HOST,
        port=parse_int(env.get("PROXY_PORT"), DEFAULT_PROXY_PORT, "PROXY_PORT"),
        upstream=env.get("UPSTREAM", DEFAULT_UPSTREAM).strip() or DEFAULT_UPSTREAM,
        readonly_token=token.strip(),
        owner_password=password,
        session_secret=session_secret.strip(),
        session_max_age=parse_int(env.get("CTB_WEB_SESSION_MAX_AGE"), DEFAULT_SESSION_MAX_AGE, "CTB_WEB_SESSION_MAX_AGE"),
        throttle_limit=parse_int(env.get("CTB_WEB_LOGIN_THROTTLE_LIMIT"), DEFAULT_THROTTLE_LIMIT, "CTB_WEB_LOGIN_THROTTLE_LIMIT"),
        throttle_seconds=parse_int(env.get("CTB_WEB_LOGIN_THROTTLE_SECONDS"), DEFAULT_THROTTLE_SECONDS, "CTB_WEB_LOGIN_THROTTLE_SECONDS"),
    )


def parse_int(value: Optional[str], default: int, name: str) -> int:
    if value is None or value == "":
        return default
    try:
        parsed = int(value)
    except ValueError:
        raise SystemExit(f"{name} must be an integer") from None
    if parsed < 0 or parsed > 65535 and name == "PROXY_PORT":
        raise SystemExit(f"{name} must be between 0 and 65535")
    if parsed <= 0 and name != "PROXY_PORT":
        raise SystemExit(f"{name} must be positive")
    return parsed


def serve(config: ProxyConfig) -> None:
    httpd = OwnerCookieProxyServer((config.host, config.port), config)
    print(f"web owner cookie proxy listening on {config.host}:{httpd.server_address[1]}", flush=True)
    httpd.serve_forever()


def main(argv: Iterable[str]) -> int:
    args = list(argv)
    if args == ["--self-test"]:
        return run_self_test()
    config = read_config(os.environ)
    serve(config)
    return 0


def request(port: int, method: str, path: str, *, body: str = "", headers: Optional[Mapping[str, str]] = None) -> Tuple[int, Mapping[str, str], bytes]:
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    connection.request(method, path, body=body.encode("utf-8"), headers=dict(headers or {}))
    response = connection.getresponse()
    data = response.read()
    result_headers = {name.lower(): value for name, value in response.getheaders()}
    connection.close()
    return response.status, result_headers, data


def run_self_test() -> int:
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    seen: MutableMapping[str, str] = {}

    class UpstreamHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            seen["authorization"] = self.headers.get("Authorization", "")
            body = ("upstream-interactions" if self.path == "/interactions" else "upstream-home").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_HEAD(self) -> None:  # noqa: N802
            seen["authorization"] = self.headers.get("Authorization", "")
            self.send_response(200)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def log_message(self, fmt: str, *args: object) -> None:
            return

    upstream = ThreadingHTTPServer((DEFAULT_HOST, 0), UpstreamHandler)
    upstream_thread = threading.Thread(target=upstream.serve_forever, daemon=True)
    upstream_thread.start()
    upstream_port = upstream.server_address[1]

    config = ProxyConfig(
        host=DEFAULT_HOST,
        port=0,
        upstream=f"http://127.0.0.1:{upstream_port}",
        readonly_token="readonly-token",
        owner_password="owner-password",
        session_secret="session-secret",
        throttle_limit=2,
        throttle_seconds=1,
    )
    proxy = OwnerCookieProxyServer((DEFAULT_HOST, 0), config)
    proxy_thread = threading.Thread(target=proxy.serve_forever, daemon=True)
    proxy_thread.start()
    proxy_port = proxy.server_address[1]

    try:
        status, _, body = request(proxy_port, "GET", "/healthz")
        assert status == 200 and b"web-owner-cookie-proxy" in body
        status, _, body = request(proxy_port, "GET", "/")
        assert status == 200 and b"Owner preview login" in body and "authorization" not in seen
        status, headers, _ = request(
            proxy_port,
            "POST",
            "/owner-login",
            body="password=owner-password",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert status == 303 and COOKIE_NAME in headers.get("set-cookie", "")
        cookie = headers["set-cookie"].split(";", 1)[0]
        status, _, body = request(proxy_port, "GET", "/interactions", headers={"Cookie": cookie})
        assert status == 200 and body == b"upstream-interactions"
        assert seen["authorization"] == "Bearer readonly-token"
        status, _, _ = request(
            proxy_port,
            "POST",
            "/owner-login",
            body="password=wrong",
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "203.0.113.10"},
        )
        assert status == 401
        status, _, _ = request(
            proxy_port,
            "POST",
            "/owner-login",
            body="password=wrong",
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "203.0.113.10"},
        )
        assert status == 401
        status, _, _ = request(
            proxy_port,
            "POST",
            "/owner-login",
            body="password=owner-password",
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "203.0.113.10"},
        )
        assert status == 429
    finally:
        proxy.shutdown()
        upstream.shutdown()
        proxy.server_close()
        upstream.server_close()
    print("web-owner-cookie-proxy self-test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
