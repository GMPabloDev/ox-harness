"""Launch isolated real Pi PTYs without model requests or installed packages."""
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


def run(mode, temp):
    seed = temp / "seed.ts"
    seed.write_text('''export default function (pi) {
      pi.on("session_start", (_event, ctx) => {
        if (ctx.sessionManager.getBranch().some(e => e.type === "custom" && e.customType === "todo-sidebar-state")) return;
        pi.appendEntry("todo-sidebar-state", {version: 1, title: "Prueba real del sidebar con título completo en varias líneas", todos: [
          {id: "1", content: "Leer contratos de Pi", status: "completed"},
          {id: "2", content: "Comprobar terminal real", status: "in_progress"},
          {id: "3", content: "Verificar redimensionado", status: "completed"},
          ...Array.from({length: 57}, (_, index) => ({id: String(index + 4), content: `Tarea de prueba ${index + 4}`, status: "pending"}))
        ]});
      });
    }''')
    master, slave = pty.openpty()
    def resize(columns, rows=35):
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
    resize(160)
    env = {**os.environ, "TERM": "xterm-256color", "COLORTERM": "truecolor", "PI_OFFLINE": "1", "PI_TELEMETRY": "0"}
    # This child must not report itself as the user's active Herdr agent.
    for key in list(env):
        if key.startswith("HERDR_") or key.startswith("PI_SESSION_"):
            env.pop(key)
    process = subprocess.Popen([
        "pi", "--no-session", "--offline", "--no-extensions", "--no-mcp", "--no-skills", "--no-context-files", "--no-prompt-templates",
        "--tui-mode", mode, "-e", str(seed), "-e", str(ROOT / "index.ts"),
    ], stdin=slave, stdout=slave, stderr=slave, cwd=temp, env=env, start_new_session=True)
    os.close(slave)
    output = bytearray()
    def drain(seconds=1.0):
        chunk = bytearray()
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            ready, _, _ = select.select([master], [], [], 0.1)
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
    def command(text):
        os.write(master, text.encode() + b"\r")
        return drain(1.5)
    try:
        startup = drain(4)
        assert process.poll() is None, f"{mode}: Pi exited at startup"
        assert "│" in startup, f"{mode}: sidebar absent"
        assert "AGENTS" in startup and "PLAN" in startup, f"{mode}: section headers absent"
        assert "ninguno activo" in startup and "idle" in startup, f"{mode}: empty agent state absent"
        if mode == "regular":
            for label in ["Proveedor", "Proyecto", "Contexto", "Coste estimado"]:
                assert label in startup, f"{mode}: footer metric {label} absent"
        else:
            assert "ctx" in startup and "✿" in startup, f"{mode}: fixed header metrics absent"
        assert "TAREAS" not in startup, f"{mode}: old heading still visible"
        assert "Comprobar terminal real" in startup, f"{mode}: persisted state absent"
        assert "más · /todos" in startup, f"{mode}: plan did not compact in the fixed rail"
        assert "Prueba real del sidebar" not in startup, f"{mode}: plan title still rendered as a panel header"
        assert "Failed to load extension" not in startup, startup
        assert "/todos · ver lista completa" not in startup, f"{mode}: old footer still visible"
        resize(85)
        os.kill(process.pid, signal.SIGWINCH)
        drain(1)
        resize(170)
        os.kill(process.pid, signal.SIGWINCH)
        wide = drain(1)
        assert "│" in wide, f"{mode}: sidebar did not return after resize"
        assert process.poll() is None, f"{mode}: exited on resize"
        hidden = command("/todos hide")
        shown = command("/todos show")
        assert "│" in shown, f"{mode}: show command failed"
        reload_output = command("/reload") + drain(2)
        assert process.poll() is None, f"{mode}: exited on reload"
        assert "│" in reload_output, f"{mode}: sidebar absent after reload"
        assert "Comprobar terminal real" in reload_output, f"{mode}: state lost on reload"
        listed = command("/todos")
        assert "Prueba real del sidebar" in listed, f"{mode}: plan title absent from the full list"
        assert "Tarea de prueba 60" in listed or "Tarea de prueba 4" in listed, f"{mode}: plan rows absent from the full list"
        assert "\x1b[9m" in listed, f"{mode}: completed text not struck through"
        assert "Esc cerrar" in listed, f"{mode}: full-list view failed"
        os.write(master, b"\x1b")
        drain(0.5)
        roster = command("/agents")
        assert "Sin subagentes" in roster, f"{mode}: agent roster absent"
        assert "Esc cerrar" in roster, f"{mode}: agent roster close hint absent"
        os.write(master, b"\x1b")
        drain(0.5)
        text = output.decode("utf-8", errors="replace")
        for error in ["Failed to load extension", "TypeError:", "Unhandled rejection", "exceeds terminal width", "Extension error"]:
            assert error not in text, f"{mode}: {error}"
        return {"mode": mode, "sections": True, "session_info": True, "plan_compact": True, "resize": True, "hide_show": True, "reload": True, "full_list": True, "agents": True}
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        os.close(master)


with tempfile.TemporaryDirectory(prefix="pi-todo-pty-") as folder:
    temp = Path(folder)
    for mode in ["regular", "fullscreen"]:
        print(json.dumps(run(mode, temp)))
