"""Exercise the public packet CLI against disposable Git repositories."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "review_packet.py"


class ReviewPacketTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ox-review-test-")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-q", "-b", "dev")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "user.name", "Review test")
        self.file("app.txt", "base\n")
        self.commit("base")
        self.git("switch", "-q", "-c", "spec-01-example")

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args])

    def file(self, name, content):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def commit(self, message):
        self.git("add", "--all")
        self.git("commit", "-qm", message)

    def cli(self, *args, env=None):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *args], capture_output=True, text=True, env=env
        )
        if args[0] == "capture" and result.returncode == 0:
            self.addCleanup(shutil.rmtree, json.loads(result.stdout)["packet"], True)
        return result

    def capture(self, *args):
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        packet = Path(json.loads(result.stdout)["packet"])
        return packet, json.loads((packet / "manifest.json").read_text())

    def test_capture_includes_commits_index_worktree_and_selected_new_files(self):
        self.file("committed.txt", "committed change\n")
        self.commit("feature")
        self.file("staged.txt", "staged change\n")
        self.git("add", "staged.txt")
        self.file("app.txt", "worktree change\n")
        self.file("new file.txt", "new change\n")
        self.file("private.env", "not selected\n")
        before = self.git("status", "--porcelain=v1", "-z")
        packet, manifest = self.capture("--untracked", "new file.txt")
        patch = (packet / "diff.patch").read_text()
        for text in ["committed change", "staged change", "worktree change", "new change"]:
            self.assertIn(text, patch)
        self.assertNotIn("not selected", patch)
        self.assertEqual(manifest["omitted_untracked"], ["private.env"])
        self.assertEqual(before, self.git("status", "--porcelain=v1", "-z"))
        self.assertEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_committed_review_refuses_dirty_checkout_instead_of_reading_wrong_version(self):
        self.file("app.txt", "committed feature\n")
        self.commit("feature")
        self.file("app.txt", "uncommitted other version\n")
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", "--committed")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("clean checkout", result.stderr)

    def test_merge_base_and_literal_base_have_distinct_meanings(self):
        self.file("app.txt", "feature\n")
        self.commit("feature")
        self.git("switch", "-q", "dev")
        self.file("upstream.txt", "upstream\n")
        self.commit("advance dev")
        self.git("switch", "-q", "spec-01-example")
        merged, manifest = self.capture()
        exact, literal = self.capture("--exact-base")
        self.assertNotIn("upstream.txt", (merged / "diff.patch").read_text())
        self.assertIn("upstream.txt", (exact / "diff.patch").read_text())
        self.assertNotEqual(manifest["base_sha"], manifest["base_tip_sha"])
        self.assertEqual(literal["base_sha"], literal["base_tip_sha"])

    def test_committed_review_succeeds_on_clean_checkout(self):
        self.file("app.txt", "feature\n")
        self.commit("feature")
        packet, manifest = self.capture("--committed")
        self.assertEqual(manifest["scope"], "committed")
        self.assertEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_committed_review_refuses_staged_change_even_if_worktree_matches_head(self):
        self.file("app.txt", "staged version\n")
        self.git("add", "app.txt")
        self.file("app.txt", "base\n")
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", "--committed")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("clean checkout", result.stderr)

    def test_verify_rejects_changed_tracked_content(self):
        self.file("app.txt", "review this\n")
        packet, _ = self.capture()
        self.file("app.txt", "different implementation\n")
        self.assertNotEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_verify_rejects_changed_selected_new_content(self):
        self.file("new.txt", "review this\n")
        packet, _ = self.capture("--untracked", "new.txt")
        self.file("new.txt", "different implementation\n")
        self.assertNotEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_verify_rejects_branch_change_even_when_contents_match(self):
        self.file("app.txt", "review this\n")
        packet, _ = self.capture()
        self.git("switch", "-q", "-c", "other")
        self.assertNotEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_verify_rejects_base_ref_movement(self):
        self.file("app.txt", "feature\n")
        self.commit("feature")
        packet, _ = self.capture()
        self.git("update-ref", "refs/heads/dev", "HEAD")
        self.assertNotEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_verify_rejects_patch_tampering(self):
        self.file("app.txt", "feature\n")
        packet, _ = self.capture()
        (packet / "diff.patch").write_text("other diff\n")
        self.assertNotEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_untracked_runtime_metadata_does_not_invalidate_review(self):
        self.file("app.txt", "feature\n")
        packet, _ = self.capture()
        self.file(".pi/subagents/missions/runtime.json", "{}\n")
        self.assertEqual(self.cli("verify", str(packet)).returncode, 0)

    def test_handles_binary_and_unusual_new_filename(self):
        name = "-new file\n.bin"
        (self.repo / name).write_bytes(b"\0\1\2")
        packet, manifest = self.capture("--untracked=" + name)
        self.assertEqual(manifest["files"], [name])
        self.assertIn(b"GIT binary patch", (packet / "diff.patch").read_bytes())

    def test_refuses_symlink_as_selected_untracked_file(self):
        (self.repo / "link").symlink_to(Path(self.temp.name) / "outside")
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", "--untracked", "link")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("regular", result.stderr)

    def test_refuses_unknown_or_outside_untracked_path(self):
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", "--untracked", "../outside")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("repository-relative", result.stderr)

    def test_explicit_repo_ignores_inherited_git_routing_and_index(self):
        self.file("app.txt", "review this repository\n")
        poisoned = {
            **os.environ,
            "GIT_DIR": str(Path(self.temp.name) / "missing.git"),
            "GIT_WORK_TREE": str(Path(self.temp.name) / "wrong-worktree"),
            "GIT_INDEX_FILE": str(Path(self.temp.name) / "wrong-index"),
        }
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", env=poisoned)
        self.assertEqual(result.returncode, 0, result.stderr)
        packet = Path(json.loads(result.stdout)["packet"])
        manifest = json.loads((packet / "manifest.json").read_text())
        self.assertEqual(manifest["repo"], str(self.repo))
        self.assertIn("review this repository", (packet / "diff.patch").read_text())
        verified = self.cli("verify", str(packet), env=poisoned)
        self.assertEqual(verified.returncode, 0, verified.stderr)

    def test_refuses_empty_review(self):
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no changes", result.stderr)

    def test_refuses_packet_directory_inside_repository(self):
        self.file("app.txt", "feature\n")
        before = self.git("status", "--porcelain=v1", "-z")
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev", env={**os.environ, "TMPDIR": str(self.repo)})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("outside", result.stderr)
        self.assertEqual(before, self.git("status", "--porcelain=v1", "-z"))

    def test_refuses_changed_submodules_instead_of_claiming_nested_coverage(self):
        module = Path(self.temp.name) / "module"
        module.mkdir()
        subprocess.run(["git", "init", "-q", str(module)], check=True)
        (module / "nested.txt").write_text("base\n")
        subprocess.run(["git", "-C", str(module), "add", "--all"], check=True)
        subprocess.run(["git", "-C", str(module), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "base"], check=True)
        self.git("-c", "protocol.file.allow=always", "submodule", "add", "-q", str(module), "vendor/module")
        self.commit("add submodule")
        self.file("vendor/module/nested.txt", "uncommitted nested change\n")
        result = self.cli("capture", "--repo", str(self.repo), "--base", "dev")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("submodule", result.stderr)


if __name__ == "__main__":
    unittest.main()
