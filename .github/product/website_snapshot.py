"""Read-only snapshot validation shared with trusted release workflows."""

import hashlib
import io
import json
import re
import tarfile
from pathlib import PurePosixPath

try:
    from .accounting import Denied
except ImportError:  # Standalone workflow bundle.
    Denied = ValueError

MAX_SNAPSHOT = 20_000_000
PRIVATE_PARTS = {".git", ".github", ".hermes", ".ssh", ".aws", ".npmrc", ".netrc",
                 "state", "secrets", "node_modules", "__pycache__", ".venv"}
STATIC_SUFFIXES = {".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".webp",
                   ".svg", ".ico", ".ttf", ".woff", ".woff2", ".txt", ".mp4", ".webm"}


def snapshot_files(data, *, kind="static"):
    """Read bytes only. Never extract untrusted links, devices, Git config or hooks."""
    if len(data) > MAX_SNAPSHOT:
        raise Denied("project snapshot exceeds bound")
    files, total = {}, 0
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as archive:
        for item in archive:
            path = PurePosixPath(item.name)
            if (path.is_absolute() or str(path) != item.name.rstrip("/")
                    or any(part in {"..", "."} or part.lower() in PRIVATE_PARTS
                           or part.lower().startswith(".env") for part in path.parts)
                    or not re.fullmatch(r"[a-zA-Z0-9_./-]{1,240}", item.name)):
                raise Denied("private or invalid project path")
            if item.isdir():
                continue
            if not item.isfile() or item.name in files:
                raise Denied("project links and special files are unavailable")
            total += item.size
            if total > MAX_SNAPSHOT or len(files) >= 1000:
                raise Denied("project snapshot exceeds bound")
            files[item.name] = archive.extractfile(item).read()
    if kind not in {"static", "application"}:
        raise Denied("unsupported project snapshot kind")
    required = {"LICENSE", "ASSET-LICENSES.md", "DESIGN.md"}
    required.add("Dockerfile" if kind == "application" else "public/index.html")
    if not required <= files.keys():
        raise Denied("project needs license, asset licenses, design rationale and its release entrypoint")
    if b"MIT License" not in files["LICENSE"]:
        raise Denied("original project code requires MIT licensing")
    for name, body in files.items():
        if re.search(rb"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}", body):
            raise Denied("project snapshot contains credential material")
        if kind == "static" and name.startswith("public/") and PurePosixPath(name).suffix.lower() not in STATIC_SUFFIXES:
            raise Denied("only static output may be deployed")
    return files


def content_digest(files):
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
    return hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
