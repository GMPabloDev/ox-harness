#!/usr/bin/env python3
"""Capture review inputs without staging, committing, or editing the source tree."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile


ENV = {
    **{key: value for key, value in os.environ.items() if not key.startswith("GIT_")},
    "GIT_OPTIONAL_LOCKS": "0",
    "GIT_TERMINAL_PROMPT": "0",
    "LC_ALL": "C",
}
DIFF = ["diff", "--no-ext-diff", "--no-textconv", "--binary", "--submodule=short"]


def git(repo, *args, allowed=(0,)):
    result = subprocess.run(
        ["git", "--no-pager", "-C", str(repo), *args],
        env=ENV, capture_output=True,
    )
    if result.returncode not in allowed:
        raise ValueError(result.stderr.decode("utf-8", "replace").strip() or "Git failed")
    return result.stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True).encode()


def paths(data):
    return [os.fsdecode(value) for value in data.split(b"\0") if value]


def untracked(repo):
    return sorted(
        name for name in paths(git(repo, "ls-files", "--others", "--exclude-standard", "-z"))
        if not name.startswith(".pi/subagents/")
    )


def file_identity(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode):
        return [info.st_mode, digest(os.fsencode(os.readlink(path)))]
    if not stat.S_ISREG(info.st_mode):
        raise ValueError(f"Unsupported untracked entry: {path.name}")
    checksum = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(block)
    return [info.st_mode, checksum.hexdigest()]


def resolve(repo, ref):
    return git(repo, "rev-parse", "--verify", "--end-of-options", ref + "^{commit}").decode().strip()


def workspace(repo, base_ref):
    names = untracked(repo)
    facts = {
        "head": resolve(repo, "HEAD"),
        "base_tip": resolve(repo, base_ref),
        "branch": git(repo, "symbolic-ref", "--quiet", "--short", "HEAD", allowed=(0, 1)).decode().strip(),
        "index": digest(git(repo, "ls-files", "--stage", "-z")),
        "tracked": digest(git(repo, *DIFF, "--ignore-submodules=none", "HEAD", "--")),
        "untracked": [[name, *file_identity(repo / name)] for name in names],
    }
    return facts, digest(json_bytes(facts))


def capture(args):
    repo = Path(os.fsdecode(git(Path(args.repo).resolve(), "rev-parse", "--show-toplevel")).strip()).resolve()
    if git(repo, "ls-files", "--unmerged", "-z"):
        raise ValueError("Resolve the unmerged index before capturing a review")
    before, fingerprint = workspace(repo, args.base)
    base_tip = before["base_tip"]
    if args.exact_base:
        base_sha = base_tip
    else:
        bases = git(repo, "merge-base", "--all", base_tip, before["head"]).decode().splitlines()
        if len(bases) != 1:
            raise ValueError("Choose an explicit base commit: merge-base is not unique")
        base_sha = bases[0]
    available = untracked(repo)
    if args.committed and (
        git(repo, *DIFF, "HEAD", "--")
        or git(repo, *DIFF, "--cached", "HEAD", "--")
        or available
    ):
        raise ValueError("A committed-only review requires a clean checkout; use the default worktree scope for WIP")
    selected = sorted(set(args.untracked))
    if any(name not in available for name in selected):
        raise ValueError("Each --untracked path must be an exact, non-ignored repository-relative filename")
    targets = [before["head"]] if args.committed else []
    patch = git(repo, *DIFF, "--ignore-submodules=none", base_sha, *targets, "--")
    changed = paths(git(repo, "diff", "--name-only", "-z", base_sha, *targets, "--"))
    entries = git(repo, "ls-files", "--stage", "-z") + git(repo, "ls-tree", "-r", "-z", base_sha)
    gitlinks = [
        os.fsdecode(entry.split(b"\t", 1)[1])
        for entry in entries.split(b"\0") if entry.startswith(b"160000 ")
    ]
    if any(name == link or name.startswith(link + "/") for name in changed for link in gitlinks):
        raise ValueError("Review each changed submodule separately; a parent Git diff does not capture its contents")
    for name in selected:
        path = repo / name
        if not stat.S_ISREG(path.lstat().st_mode):
            raise ValueError("Select only regular untracked files, not symlinks or special entries")
        patch += git(repo, *DIFF, "--no-index", "--", "/dev/null", name, allowed=(0, 1))
        changed.append(name)
    if not patch:
        raise ValueError("There are no changes to review")
    after, after_fingerprint = workspace(repo, args.base)
    if before != after:
        raise ValueError("The workspace changed during capture; capture again when writers stop")
    if Path(tempfile.gettempdir()).resolve().is_relative_to(repo):
        raise ValueError("Set TMPDIR to a directory outside the repository before capturing")
    packet = Path(tempfile.mkdtemp(prefix="ox-review-"))
    try:
        manifest = {
            "version": 1,
            "repo": str(repo),
            "branch": before["branch"],
            "base_ref": args.base,
            "base_tip_sha": base_tip,
            "base_sha": base_sha,
            "head_sha": before["head"],
            "comparison": "exact" if args.exact_base else "merge-base",
            "scope": "committed" if args.committed else "worktree",
            "files": sorted(set(changed)),
            "selected_untracked": selected,
            "omitted_untracked": sorted(set(available) - set(selected)),
            "fingerprint": after_fingerprint,
            "patch_sha256": digest(patch),
        }
        (packet / "diff.patch").write_bytes(patch)
        (packet / "manifest.json").write_bytes(json_bytes(manifest) + b"\n")
        (packet / "commits.txt").write_bytes(
            git(repo, "log", "--format=%h%x09%s", base_sha + ".." + before["head"], "--")
        )
    except BaseException:
        shutil.rmtree(packet)
        raise
    return {"packet": str(packet), "files": len(manifest["files"]), "omitted_untracked": manifest["omitted_untracked"]}


def verify(args):
    packet = Path(args.packet).resolve()
    manifest = json.loads((packet / "manifest.json").read_text())
    if digest((packet / "diff.patch").read_bytes()) != manifest["patch_sha256"]:
        raise ValueError("The captured diff changed; do not reuse this review")
    _, current = workspace(Path(manifest["repo"]), manifest["base_ref"])
    if current != manifest["fingerprint"]:
        raise ValueError("The workspace or base changed; capture and review the new state")
    return {"valid": True, "packet": str(packet)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture_parser = commands.add_parser("capture", help="Capture commits plus the current working tree by default")
    capture_parser.add_argument("--repo", required=True)
    capture_parser.add_argument("--base", required=True)
    capture_parser.add_argument("--exact-base", action="store_true", help="Compare literally with the resolved base, not merge-base")
    capture_parser.add_argument("--committed", action="store_true", help="Review committed changes only")
    capture_parser.add_argument("--untracked", action="append", default=[], metavar="PATH", help="Include one inspected new file; repeat as needed")
    verify_parser = commands.add_parser("verify", help="Reject a changed diff, workspace, branch, HEAD, or base ref")
    verify_parser.add_argument("packet")
    args = parser.parse_args()
    try:
        result = capture(args) if args.command == "capture" else verify(args)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f"Review packet error: {error}\n")
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
