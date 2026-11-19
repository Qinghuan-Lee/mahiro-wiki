"""Run the article editor on this computer."""

import argparse
import hashlib
import json
import mimetypes
import os
import re
import subprocess
import tempfile
import threading
import webbrowser
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml

from build import MARKDOWN, POST_ID, ROOT, split_post, validate_post
from publishing import article_changes, pending_commits, publish


POSTS = ROOT / "posts"
ASSETS = ROOT / "assets"
EDITOR = ROOT / "editor"
IMAGE_TYPES = {".avif", ".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"}
EDITABLE_FIELDS = ("title", "date", "category", "summary", "cover", "readingTime")
WRITE_LOCK = threading.Lock()
MAX_REQUEST = 2 * 1024 * 1024


def article_path(slug):
    if not isinstance(slug, str) or not POST_ID.fullmatch(slug) or len(slug) > 100:
        raise ValueError("文章链接可使用 1 至 100 个小写英文字母、数字和连字符")
    path = POSTS / f"{slug}.md"
    if path.is_symlink() or path.resolve().parent != POSTS:
        raise ValueError("无法编辑此文章路径")
    if getattr(os.path, "isreserved", lambda _: path.is_reserved())(path):
        raise ValueError("请换一个文章链接名称")
    return path


def load_article(path):
    source = path.read_text(encoding="utf-8-sig")
    metadata, body = split_post(source)
    return source, metadata, body


def revision(source):
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def get_article(slug):
    source, metadata, body = load_article(article_path(slug))
    if metadata is None:
        heading = re.match(r"^#\s+(.+?)\n", body)
        metadata = {"title": heading[1] if heading else slug, "date": date.today(), "category": "生活阅读"}
    fields = {key: str(metadata.get(key, "")) for key in EDITABLE_FIELDS}
    return {**fields, "id": slug, "body": body, "revision": revision(source)}


def save_article(data):
    title = str(data.get("title", "")).strip()
    slug = data.get("id", "")
    if not slug:
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:100].rstrip("-")
        slug = slug or datetime.now().strftime("post-%Y%m%d-%H%M%S")
    path = article_path(slug)
    source, metadata, _ = load_article(path) if path.exists() else (None, None, None)
    if data.get("revision") != (revision(source) if source is not None else None):
        raise ValueError("此文章已存在或文件有新改动，请重新打开文章，或为新文章填写另一个链接")

    metadata = metadata or {}
    body = str(data.get("body", "")).replace("\r\n", "\n").rstrip()
    for field in EDITABLE_FIELDS:
        metadata.pop(field, None)
        value = str(data.get(field, "")).strip()
        if value:
            metadata[field] = value
    metadata.setdefault("summary", title)
    validate_post(slug, metadata, body)

    front_matter = yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False, width=1000)
    POSTS.mkdir(exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=POSTS, encoding="utf-8", newline="\n", delete=False) as temporary:
        temporary_path = Path(temporary.name)
        temporary.write(f"---\n{front_matter}---\n\n{body}\n")
    try:
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return get_article(slug)


def delete_article(data):
    path = article_path(data.get("id"))
    source = path.read_text(encoding="utf-8-sig")
    if data.get("revision") != revision(source):
        raise ValueError("文件有新改动，请重新打开文章后再删除")
    path.unlink()
    return {"message": "已删除。发布后线上网站会更新。"}


def library():
    posts = []
    changes = article_changes()
    covers = []
    for path in ASSETS.rglob("*"):
        if path.is_file() and path.suffix.lower() in IMAGE_TYPES and path.resolve().is_relative_to(ASSETS):
            covers.append(path.relative_to(ROOT).as_posix())
    for path in sorted(POSTS.glob("*.md")):
        if not POST_ID.fullmatch(path.stem) or path.is_symlink():
            continue
        entry = {"id": path.stem, "status": changes.get(path.relative_to(ROOT).as_posix(), "published")}
        try:
            _, metadata, body = load_article(path)
            if metadata is None:
                heading = re.match(r"^#\s+([^\n]+)", body)
                metadata = {"title": heading[1] if heading else path.stem}
                entry["status"] = "draft"
            entry.update(title=str(metadata.get("title", path.stem)),
                         category=str(metadata.get("category", "")),
                         date=str(metadata.get("date", "")))
        except (ValueError, yaml.YAMLError):
            entry.update(title=path.stem, category="", date="", status="invalid")
        posts.append(entry)

    posts.sort(key=lambda post: post["date"], reverse=True)
    return {
        "posts": posts,
        "covers": sorted(covers),
        "changes": changes,
        "pendingCommits": pending_commits(),
    }


class EditorHandler(BaseHTTPRequestHandler):
    def respond(self, data, content_type, status=200, asset=False):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        policy = "default-src 'self'; img-src 'self' https: data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
        self.send_header("Content-Security-Policy", "default-src 'none'; sandbox" if asset else policy)
        self.end_headers()
        self.wfile.write(data)

    def json(self, data, status=200):
        self.respond(json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8", status)

    def handle_api(self, action):
        try:
            with WRITE_LOCK:
                result = action()
        except FileNotFoundError:
            self.json({"error": "找不到该文章或所需程序"}, 404)
        except subprocess.TimeoutExpired:
            self.json({"error": "Git 命令超时，请重试"}, 503)
        except (ValueError, yaml.YAMLError, OSError) as error:
            self.json({"error": str(error)}, 400)
        else:
            self.json(result)

    def do_GET(self):
        if self.headers.get("Host") != self.server.host:
            return self.json({"error": "无效的编辑器地址"}, 403)
        route = unquote(urlsplit(self.path).path)
        if route == "/api/library":
            return self.handle_api(library)
        if route.startswith("/api/posts/"):
            return self.handle_api(lambda: get_article(route.removeprefix("/api/posts/")))

        pages = {"/": EDITOR / "index.html", "/editor.css": EDITOR / "editor.css",
                 "/editor.js": EDITOR / "editor.js", "/style.css": ROOT / "style.css"}
        path = pages.get(route)
        is_asset = route.startswith("/assets/")
        if is_asset:
            path = (ROOT / route.lstrip("/")).resolve()
            if not path.is_relative_to(ASSETS) or path.suffix.lower() not in IMAGE_TYPES:
                path = None
        if path is None or not path.is_file():
            return self.json({"error": "找不到页面"}, 404)
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix == ".js":
            content_type = "text/javascript"
        if content_type.startswith("text/"):
            content_type += "; charset=utf-8"
        self.respond(path.read_bytes(), content_type, asset=is_asset)

    def do_POST(self):
        if self.headers.get("Host") != self.server.host or self.headers.get("Origin") != self.server.origin:
            return self.json({"error": "请从本机文章编辑器执行操作"}, 403)
        if self.headers.get_content_type() != "application/json":
            return self.json({"error": "请求格式需要为 JSON"}, 415)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_REQUEST:
                return self.json({"error": "正文长度超出限制"}, 413)
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("expected an object")
        except (ValueError, UnicodeError):
            return self.json({"error": "请求内容无效"}, 400)

        actions = {
            "/api/save": lambda: save_article(data),
            "/api/delete": lambda: delete_article(data),
            "/api/preview": lambda: {"html": MARKDOWN.render(str(data.get("body", "")))},
            "/api/publish": lambda: {"message": publish()},
        }
        action = actions.get(self.path)
        if action is None:
            return self.json({"error": "找不到此操作"}, 404)
        self.handle_api(action)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), EditorHandler) as server:
        server.host = f"127.0.0.1:{server.server_port}"
        server.origin = f"http://{server.host}"
        print(f"文章编辑器  {server.origin}/", flush=True)
        print("按 Ctrl+C 关闭编辑器。", flush=True)
        if not args.no_browser:
            webbrowser.open(server.origin)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
