import { cpSync, mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const temp = mkdtempSync(resolve(tmpdir(), "pi-focus-test-"));
try {
	const copy = resolve(temp, "extensions/focus");
	cpSync(root, copy, { recursive: true });
	cpSync(resolve(root, "../todo-sidebar/core.ts"), resolve(temp, "extensions/todo-sidebar/core.ts"));
	cpSync(resolve(root, "../tool-status"), resolve(temp, "extensions/tool-status"), { recursive: true });
	symlinkSync(modules, resolve(temp, "node_modules"), "dir");
	const result = spawnSync("bun", ["test", resolve(copy, "tests/focus.test.ts"), resolve(temp, "extensions/tool-status/tests/status.test.ts")], { stdio: "inherit" });
	process.exitCode = result.status ?? 1;
} finally { rmSync(temp, { recursive: true, force: true }); }
