"""Trusted image release; source builds run in a separate credential-free job."""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent


class BrokerRecoveryRequired(ValueError):
    pass


def run(*args):
    result = subprocess.run(args, capture_output=True, timeout=600, check=False)
    if result.returncode:
        raise RuntimeError("product release command failed")
    return result.stdout.decode()


def metadata(image, *, pull=False):
    if pull:
        run("docker", "pull", image)
    item = json.loads(run("docker", "image", "inspect", image))[0]
    labels = item.get("Config", {}).get("Labels", {}) or {}
    commit, digest = labels.get("org.psycho.commit", ""), labels.get("org.psycho.digest", "")
    if not re.fullmatch(r"[a-f0-9]{40}", commit) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise ValueError("release image lacks verified source identity")
    return {"image": image, "commit": commit, "digest": digest}


def machines(app):
    return json.loads(run("flyctl", "machine", "list", "--app", app, "--json"))


def image_ref(machine):
    ref = machine["image_ref"]
    return f"{ref['registry']}/{ref['repository']}@{ref['digest']}"


def verify(app, expected, *, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            current = machines(app)
            if not current or any(image_ref(item) != expected["image"] for item in current):
                raise ValueError("live immutable image mismatch")
            with httpx.Client(timeout=5, follow_redirects=False, trust_env=False) as client:
                with client.stream("GET", "https://" + app + ".fly.dev/healthz",
                        headers={"Cache-Control": "no-cache"}) as response:
                    if response.status_code != 200:
                        raise ValueError("product health check failed")
                    size = 0
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > 8192:
                            raise ValueError("product health response exceeds bound")
            return True
        except (httpx.HTTPError, ValueError, KeyError, RuntimeError):
            time.sleep(1)
    return False


def previous(app):
    current = machines(app)
    if not current:
        return None
    images = {image_ref(item) for item in current}
    if len(images) != 1:
        raise ValueError("one verified rollback image is required")
    image = images.pop()
    if not re.fullmatch(r"registry\.fly\.io/" + re.escape(app) + r"@sha256:[a-f0-9]{64}", image):
        raise ValueError("invalid rollback image")
    old = metadata(image, pull=True)
    if not verify(app, old):
        return None
    return old


def deploy(cfg, image):
    path = Path("product-fly.toml")
    path.write_text(f'app = "{cfg["app"]}"\nprimary_region = "{cfg["region"]}"\n'
        '[http_service]\ninternal_port = 8080\nforce_https = true\n'
        'auto_stop_machines = "stop"\nauto_start_machines = true\nmin_machines_running = 0\n'
        '[[http_service.checks]]\ninterval = "15s"\ntimeout = "5s"\npath = "/healthz"\n'
        '[[vm]]\ncpu_kind = "shared"\ncpus = 1\nmemory = "512mb"\n')
    run("flyctl", "deploy", "--app", cfg["app"], "--config", str(path), "--image", image,
        "--ha=false", "--strategy", "immediate", "--wait-timeout", "120s")


def runtime_secrets(cfg):
    if type(cfg.get("broker_enabled")) is not bool:
        raise BrokerRecoveryRequired("trusted broker mode is unavailable")
    if not cfg["broker_enabled"]:
        # Metadata only: omitted imports do not remove previously installed access.
        try:
            data = run("flyctl", "secrets", "list", "--app", cfg["app"], "--json")
            if len(data) > 100_000:
                raise ValueError("runtime broker secret metadata exceeds bound")
            secrets = json.loads(data)
        except (RuntimeError, ValueError):
            raise BrokerRecoveryRequired("runtime broker secret metadata unavailable") from None
        if (not isinstance(secrets, list) or len(secrets) > 100
                or any(not isinstance(item, dict) or not isinstance(item.get("name"), str) for item in secrets)
                or any(item["name"] in {"PSYCHO_PRODUCT_BROKER_TOKEN", "PSYCHO_PRODUCT_BROKER_URL"} for item in secrets)):
            raise BrokerRecoveryRequired("revoke previous runtime broker secrets before release")
        return
    token = os.environ.get("PSYCHO_PRODUCT_BROKER_TOKEN", "")
    url = cfg.get("broker_url", "")
    runtime = cfg.get("runtime_app", "")
    if (not re.fullmatch(r"[A-Za-z0-9_-]{24,256}", token)
            or not re.fullmatch(r"[a-z][a-z0-9-]{2,62}", runtime)
            or url != "http://" + runtime + ".internal:9092"):
        raise ValueError("scoped runtime broker access unavailable")
    payload = "PSYCHO_PRODUCT_BROKER_TOKEN=" + token + "\nPSYCHO_PRODUCT_BROKER_URL=" + url + "\n"
    result = subprocess.run(["flyctl", "secrets", "import", "--stage", "--app", cfg["app"]],
        input=payload.encode(), capture_output=True, timeout=60, check=False)
    if result.returncode:
        raise RuntimeError("runtime broker secret installation failed")


def main():
    cfg = json.loads((ROOT / "config.json").read_text())
    commit, digest, receipt = (os.environ[k] for k in ("RELEASE_COMMIT", "RELEASE_DIGEST", "RELEASE_RECEIPT"))
    operation = os.environ["RELEASE_OPERATION"]
    if (os.environ["RELEASE_PROJECT"] != cfg["project"] or os.environ["RELEASE_ATTEMPT"] != "1"
            or operation not in {"deploy", "rollback"} or not re.fullmatch(r"[a-f0-9]{40}", commit)
            or not re.fullmatch(r"[a-f0-9]{64}", digest) or not re.fullmatch(r"[a-f0-9]{32}", receipt)):
        raise ValueError("invalid trusted release inputs")
    app = cfg["app"]
    result = {"commit": commit, "digest": digest, "receipt_id": receipt,
        "outcome": "failed", "verified": False, "stage": "prepare", "url": "https://" + app + ".fly.dev"}
    try:
        runtime_secrets(cfg)
        run("flyctl", "auth", "docker")
        old = previous(app) if operation == "deploy" else None
        if operation == "deploy":
            build = json.loads(Path("build.json").read_text())
            if any(build.get(key) != result[key] for key in ("commit", "digest", "receipt_id")):
                raise ValueError("build identity mismatch")
            if Path("image.tar").stat().st_size > 700_000_000:
                raise ValueError("image artifact exceeds bound")
            run("docker", "load", "--input", "image.tar")
            source = metadata("psycho-product-build:" + receipt)
            if source["commit"] != commit or source["digest"] != digest:
                raise ValueError("image identity mismatch")
            inspect = json.loads(run("docker", "image", "inspect", source["image"]))[0]
            if inspect["Id"] != build["image_id"]:
                raise ValueError("image artifact differs from credential-free build")
            tag = "registry.fly.io/" + app + ":release-" + receipt
            run("docker", "tag", source["image"], tag)
            run("docker", "push", tag)
            image = json.loads(run("docker", "image", "inspect", tag))[0]["RepoDigests"][0]
            target = {"image": image, "commit": commit, "digest": digest}
        else:
            target = metadata(os.environ["ROLLBACK_IMAGE"], pull=True)
            if target["commit"] != os.environ["ROLLBACK_COMMIT"] or target["digest"] != os.environ["ROLLBACK_DIGEST"]:
                raise ValueError("rollback source identity mismatch")
        if not re.fullmatch(r"registry\.fly\.io/" + re.escape(app) + r"@sha256:[a-f0-9]{64}", target["image"]):
            raise ValueError("invalid immutable deployment image")
        # Allocate public routing idempotently before the first deployment.
        addresses = json.loads(run("flyctl", "ips", "list", "--app", app, "--json"))
        if not addresses:
            run("flyctl", "ips", "allocate-v6", "--app", app)
            run("flyctl", "ips", "allocate-v4", "--shared", "--app", app)
        result.update(outcome="unresolved", stage="deploy")
        if old:
            result["previous"] = old
        Path("result.json").write_text(json.dumps(result))
        try:
            deploy(cfg, target["image"])
            if not verify(app, target):
                raise ValueError("release verification failed")
            result.update(outcome="deployed" if operation == "deploy" else "rolled_back", verified=True,
                image=target["image"], active_commit=target["commit"], active_digest=target["digest"], stage="verified")
        except Exception:
            if old:
                result["stage"] = "rollback"
                Path("result.json").write_text(json.dumps(result))
                deploy(cfg, old["image"])
                if verify(app, old):
                    result.update(outcome="rolled_back", verified=True, image=old["image"],
                        active_commit=old["commit"], active_digest=old["digest"], stage="restored")
            elif operation == "deploy":
                current = machines(app)
                if current and all(image_ref(item) == target["image"] for item in current):
                    # Exact deployment is known even though health failed. With
                    # no working baseline, allow a source fix on the next wake.
                    result.update(outcome="failed", stage="unhealthy", deployment_confirmed=True,
                        image=target["image"], active_commit=target["commit"], active_digest=target["digest"])
    except BrokerRecoveryRequired:
        result["failure_code"] = "broker_recovery_required"
    except Exception:
        pass
    finally:
        Path("result.json").write_text(json.dumps(result, sort_keys=True))
    return 0 if result["verified"] else 1


if __name__ == "__main__":
    sys.exit(main())
