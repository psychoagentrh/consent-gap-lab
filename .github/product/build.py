"""Credential-free application build. All source execution stays in Docker."""

import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import httpx

try:
    from website_snapshot import MAX_SNAPSHOT, content_digest, snapshot_files
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
    from psycho.website_snapshot import MAX_SNAPSHOT, content_digest, snapshot_files

ROOT = Path(__file__).resolve().parent


def run(*args):
    result = subprocess.run(args, capture_output=True, timeout=900, check=False)
    if result.returncode:
        raise RuntimeError("product build command failed")
    return result.stdout.decode()


def source(repository, commit, digest):
    data = bytearray()
    with httpx.Client(timeout=60, follow_redirects=False, trust_env=False) as client:
        with client.stream("GET", f"https://codeload.github.com/{repository}/tar.gz/{commit}") as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > MAX_SNAPSHOT:
                    raise ValueError("archive exceeds bound")
    output = io.BytesIO()
    prefix = repository.split("/")[1] + "-" + commit + "/"
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive, tarfile.open(fileobj=output, mode="w:gz") as target:
        total = 0
        for index, item in enumerate(archive):
            if index > 2000:
                raise ValueError("archive exceeds bound")
            if item.name.rstrip("/") == prefix.rstrip("/") and item.isdir():
                continue
            if not item.name.startswith(prefix) or not (item.isfile() or item.isdir()):
                raise ValueError("invalid source member")
            item.name = item.name[len(prefix):]
            if item.name == ".github" or item.name.startswith(".github/"):
                continue
            total += item.size
            if total > MAX_SNAPSHOT:
                raise ValueError("archive exceeds bound")
            target.addfile(item, archive.extractfile(item) if item.isfile() else None)
    files = snapshot_files(output.getvalue(), kind="application")
    if content_digest(files) != digest:
        raise ValueError("source digest mismatch")
    return files


def inputs():
    cfg = json.loads((ROOT / "config.json").read_text())
    commit, digest, receipt = (os.environ[k] for k in ("RELEASE_COMMIT", "RELEASE_DIGEST", "RELEASE_RECEIPT"))
    if (os.environ["RELEASE_PROJECT"] != cfg["project"] or os.environ["RELEASE_ATTEMPT"] != "1"
            or not re.fullmatch(r"[a-f0-9]{40}", commit) or not re.fullmatch(r"[a-f0-9]{64}", digest)
            or not re.fullmatch(r"[a-f0-9]{32}", receipt)):
        raise ValueError("invalid trusted build inputs")
    return cfg, commit, digest, receipt


def main():
    cfg, commit, digest, receipt = inputs()
    files = source(cfg["repository"], commit, digest)
    tag = "psycho-product-build:" + receipt
    with tempfile.TemporaryDirectory() as folder:
        for name, body in files.items():
            path = Path(folder) / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        # No credential, host mounts or build secrets are supplied to source code.
        run("docker", "build", "--platform", "linux/amd64", "--label", "org.psycho.commit=" + commit,
            "--label", "org.psycho.digest=" + digest, "--tag", tag, folder)
    metadata = json.loads(run("docker", "image", "inspect", tag))[0]
    if metadata["Size"] > 512_000_000:
        raise ValueError("product image exceeds bound")
    run("docker", "save", "--output", "image.tar", tag)
    Path("build.json").write_text(json.dumps({"commit": commit, "digest": digest,
        "receipt_id": receipt, "tag": tag, "image_id": metadata["Id"]}, sort_keys=True))


if __name__ == "__main__":
    main()
