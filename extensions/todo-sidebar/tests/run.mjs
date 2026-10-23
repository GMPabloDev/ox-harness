import { cpSync, mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const globalModules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const temp = mkdtempSync(resolve(tmpdir(), "pi-todo-test-"));
try {
	// Resolve Pi's existing dependencies outside the project. No install or local node_modules.
	const copy = resolve(temp, "extensions/todo-sidebar");
	cpSync(root, copy, { recursive: true });
	symlinkSync(globalModules, resolve(temp, "node_modules"), "dir");
	symlinkSync(resolve(root, "../../themes"), resolve(temp, "themes"), "dir");
	const result = spawnSync("bun", ["test", resolve(copy, "tests/sidebar.test.ts")], { stdio: "inherit" });
	process.exitCode = result.status ?? 1;
} finally { rmSync(temp, { recursive: true, force: true }); }
