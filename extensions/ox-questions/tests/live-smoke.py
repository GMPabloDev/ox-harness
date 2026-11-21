import fcntl
import os
from pathlib import Path
import pty
import select
import signal
import struct
import subprocess
import termios
import time

root = Path(__file__).resolve().parents[1]

for mode in ("regular", "fullscreen"):
    master, slave = pty.openpty()
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 70, 0, 0))
    env = {**os.environ, "TERM": "xterm-256color", "COLORTERM": "truecolor", "PI_OFFLINE": "1"}
    process = subprocess.Popen(["pi", "--offline", "--no-session", "--no-mcp", "--tui-mode", mode,
                                "--provider", "ox-questions-fixture", "--model", "fixture", "-e", str(root / "tests/fixture.ts")], stdin=slave, stdout=slave, stderr=slave,
                               env=env, start_new_session=True)
    os.close(slave)
    output = bytearray()

    def drain(seconds):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            ready, _, _ = select.select([master], [], [], 0.05)
            if ready:
                try:
                    data = os.read(master, 65536)
                    if not data:
                        break
                    output.extend(data)
                except OSError:
                    break

    try:
        drain(3)
        assert process.poll() is None, output.decode(errors="replace")
        os.write(master, b"Probar preguntas\r")
        drain(1)
        assert b"PREGUNTA" in output and b"CABECERA" in output, output.decode(errors="replace")
        waiting_start = len(output)
        drain(0.5)
        waiting = output[waiting_start:].decode(errors="replace")
        for label in ("Trabajando", "Pensando", "Redactando"):
            assert label not in waiting, waiting
        for _ in range(8):
            os.write(master, b"j")
            drain(0.1)
        assert b"FINAL_PREGUNTA" in output and b"OPCION_B" in output, output.decode(errors="replace")
        next_start = len(output)
        os.write(master, b"\x1b[B\r")
        drain(0.3)
        assert b"SEGUNDA_PREGUNTA" in output[next_start:], output[next_start:].decode(errors="replace")
        # Return to the first question and correct B to A, then answer the second.
        os.write(master, b"\x1b[Z")
        drain(0.2)
        os.write(master, b"\x1b[A\r")
        drain(0.2)
        review_start = len(output)
        os.write(master, b"\x1b[B\r")
        drain(0.3)
        review = output[review_start:].decode(errors="replace")
        assert "CABECERA: OPCION_A" in review and "SEGUNDA: OPCION_D" in review, review
        assert "Enviar respuestas" in review, review
        assert b"RESULTADO_VISIBLE" not in output, output.decode(errors="replace")
        waiting_start = len(output)
        drain(0.5)
        waiting = output[waiting_start:].decode(errors="replace")
        for label in ("Trabajando", "Pensando", "Redactando"):
            assert label not in waiting, waiting
        answered_start = len(output)
        os.write(master, b"\x1b[B\x1b[B\r")
        drain(1)
        assert b"Pensando" in output[answered_start:], output[answered_start:].decode(errors="replace")
        assert b"RESULTADO_VISIBLE" in output, output.decode(errors="replace")
        text = output.decode(errors="replace")
        for error in ("Failed to load extension", "TypeError:", "exceeds terminal width", "Extension error"):
            assert error not in text, text
        print(f"{mode}: paging, back-navigation, correction, review, submission and activity hide/restore passed")
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        os.close(master)
