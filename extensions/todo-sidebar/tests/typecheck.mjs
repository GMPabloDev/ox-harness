import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const globalModules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const temp = mkdtempSync(resolve(tmpdir(), "pi-todo-types-"));
try {
	const config = resolve(temp, "tsconfig.json");
	writeFileSync(config, JSON.stringify({
		compilerOptions: {
			target: "ES2023", module: "NodeNext", moduleResolution: "NodeNext", strict: true,
			noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true,
			paths: { "@earendil-works/*": [`${globalModules}/@earendil-works/*`], typebox: [`${globalModules}/typebox`] },
		},
		files: [resolve(root, "index.ts"), resolve(root, "core.ts")],
	}));
	const result = spawnSync(process.execPath, [resolve(globalModules, "typescript/bin/tsc"), "-p", config], { stdio: "inherit" });
	process.exitCode = result.status ?? 1;
} finally { rmSync(temp, { recursive: true, force: true }); }
