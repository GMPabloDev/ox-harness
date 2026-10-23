"""Exercise real Pi PTYs with a deterministic offline provider, no paid calls."""
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import signal
import struct
import subprocess
import tempfile
import termios
import time

ROOT = Path(__file__).resolve().parents[1]


def normalize(value):
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize(item) for key, item in value.items()
                if key not in {"timestamp", "durationMs"} and not (key == "id" and isinstance(item, str))}
    return value


def run(mode, enabled, folder):
    label = f"{mode}-{'on' if enabled else 'off'}"
    output_dir = folder / label
    output_dir.mkdir()
    agent_dir = output_dir / "agent"
    agent_dir.mkdir()
    (agent_dir / "settings.json").write_text(json.dumps({
        "theme": "dark", "quietStartup": True, "lastChangelogVersion": "1.4.0", "cacheWarming": "off",
        "defaultProvider": "focus-fixture", "defaultModel": "fixture", "defaultProjectTrust": "never",
    }))
    (agent_dir / "focus.json").write_text(json.dumps({"version": 1, "enabled": enabled}))
    master, slave = pty.openpty()

    def resize(columns, rows=35):
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))

    resize(160)
    env = {**os.environ, "TERM": "xterm-256color", "COLORTERM": "truecolor", "PI_OFFLINE": "1", "PI_TELEMETRY": "0",
           "PI_CODING_AGENT_DIR": str(agent_dir), "FOCUS_TEST_OUTPUT": str(output_dir)}
    for key in list(env):
        if key.startswith("HERDR_") or key.startswith("PI_SESSION_"):
            env.pop(key)
    process = subprocess.Popen([
        "pi", "--offline", "--no-extensions", "--no-mcp", "--no-skills", "--no-context-files", "--no-prompt-templates",
        "--tui-mode", mode, "--provider", "focus-fixture", "--model", "fixture",
        "-e", str(ROOT / "tests/fixture.ts"), "-e", str(ROOT / "index.ts"), "-e", str(ROOT.parent / "todo-sidebar/index.ts"),
    ], stdin=slave, stdout=slave, stderr=slave, cwd=folder, env=env, start_new_session=True)
    os.close(slave)
    output = bytearray()

    def drain(seconds=0.2):
        chunk = bytearray()
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            ready, _, _ = select.select([master], [], [], 0.03)
            if not ready:
                continue
            try:
                data = os.read(master, 65536)
            except OSError:
                break
            if not data:
                break
            chunk.extend(data)
        output.extend(chunk)
        return chunk.decode("utf-8", errors="replace")

    def command(text, delay=0.5):
        os.write(master, text.encode() + b"\r")
        return drain(delay)

    try:
        startup = drain(3)
        assert process.poll() is None, f"{label}: startup exit: {startup}"
        assert "TAREAS" in startup, f"{label}: sidebar absent: {startup}"
        status = command("/focus status")
        assert ("Focus activo" if enabled else "Focus desactivado") in status, f"{label}: status wrong: {status}"
        command("/fixture", 0.1)
        deadline = time.monotonic() + 15
        while not (output_dir / "streaming").exists() and time.monotonic() < deadline:
            drain(0.05)
        assert (output_dir / "streaming").exists(), f"{label}: fixture did not stream: {output.decode(errors='replace')}"
        drain(0.15)
        if enabled:
            assert b"FINAL_VISIBLE" not in output, f"{label}: final response leaked while streaming"
        deadline = time.monotonic() + 8
        while not (output_dir / "settled").exists() and time.monotonic() < deadline:
            drain(0.05)
        drain(0.4)
        assert (output_dir / "settled").exists(), f"{label}: fixture did not settle"
        transcript = output.decode("utf-8", errors="replace")
        assert "FINAL_VISIBLE" in transcript, f"{label}: final answer missing: {transcript}"
        assert "ENOENT" in transcript, f"{label}: routine tool error hidden"
        secrets = ["THINKING_SECRET", "PROGRESS_SECRET", "ROUTINE_RESULT_SECRET", "WEB_SEARCH_RESULT_SECRET", "MEM_SEARCH_RESULT_SECRET", "SUBAGENT_RESULT_SECRET"]
        if enabled:
            for secret in secrets:
                assert secret not in transcript, f"{label}: leaked {secret}"
            assert "FIXTURE_WEB_QUERY" in transcript, f"{label}: web summary absent"
            assert "Engram" in transcript, f"{label}: memory summary absent"
            assert "FIXTURE_SUBAGENT_TASK" in transcript, f"{label}: subagent task absent"
        else:
            for secret in ["THINKING_SECRET", "PROGRESS_SECRET"]:
                assert secret in transcript, f"{label}: native view lost {secret}"
        branch = json.loads((output_dir / "branch.json").read_text())
        branch_text = json.dumps(branch)
        for secret in ["THINKING_SECRET", "PROGRESS_SECRET", "ROUTINE_RESULT_SECRET"]:
            assert secret in branch_text, f"{label}: original history lost {secret}"
        requests = [json.loads(line) for line in (output_dir / "requests.jsonl").read_text().splitlines()]
        assert len(requests) == 3, f"{label}: unexpected request count"
        assert "THINKING_SECRET" in json.dumps(requests[1]), f"{label}: model context lost thinking"
        assert "ROUTINE_RESULT_SECRET" in json.dumps(requests[1]), f"{label}: model context lost tool result"
        permission = command("/fixture-permission")
        assert "PERMISSION_VISIBLE" in permission, f"{label}: permission dialog hidden"
        os.write(master, b"\r")
        drain(0.3)
        resize(70)
        os.kill(process.pid, signal.SIGWINCH)
        drain(0.3)
        resize(170)
        os.kill(process.pid, signal.SIGWINCH)
        wide = drain(0.5)
        assert "TAREAS" in wide, f"{label}: sidebar not restored on resize"
        command("/focus off")
        assert json.loads((agent_dir / "focus.json").read_text())["enabled"] is False
        command("/reload", 2)
        status = command("/focus status")
        assert "Focus desactivado" in status, f"{label}: preference lost on reload"
        command("/focus on")
        assert json.loads((agent_dir / "focus.json").read_text())["enabled"] is True
        status = command("/focus status")
        assert "Focus activo" in status, f"{label}: could not re-enable"
        command("/reload", 2)
        status = command("/focus status")
        assert "Focus activo" in status, f"{label}: enabled preference lost on reload"
        text = output.decode("utf-8", errors="replace")
        for error in ["Failed to load extension", "TypeError:", "Unhandled rejection", "exceeds terminal width", "Extension error", "Focus no reconoce"]:
            assert error not in text, f"{label}: {error}: {text}"
        # Normal interactive quit must also print the filtered fullscreen transcript.
        before_quit = len(output)
        os.write(master, b"\x04")
        drain(2)
        if enabled:
            quit_output = output[before_quit:].decode("utf-8", errors="replace")
            assert "THINKING_SECRET" not in quit_output, f"{label}: quit printed unfiltered thinking"
        assert process.poll() is not None, f"{label}: quit did not exit"
        return normalize(requests), {"case": label, "final_only": enabled, "history_intact": True, "permissions": True,
                                     "resize": True, "sidebar": True, "reload": True}
    finally:
        # Keep raw diagnostics only on failure or when explicitly requested.
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        os.close(master)


with tempfile.TemporaryDirectory(prefix="pi-focus-pty-") as path:
    folder = Path(path)
    (folder / "fixture.txt").write_text("ROUTINE_RESULT_SECRET\n")
    contexts = {}
    for mode in ["regular", "fullscreen"]:
        for enabled in [True, False]:
            requests, result = run(mode, enabled, folder)
            contexts[(mode, enabled)] = requests
            print(json.dumps(result), flush=True)
        assert contexts[(mode, True)] == contexts[(mode, False)], f"{mode}: focus changed model context"
        print(json.dumps({"mode": mode, "identical_model_context_on_off": True}), flush=True)
