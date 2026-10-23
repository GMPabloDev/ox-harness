import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const temp = mkdtempSync(resolve(tmpdir(), "pi-focus-types-"));
try {
	const config = resolve(temp, "tsconfig.json");
	writeFileSync(config, JSON.stringify({
		compilerOptions: {
			target: "ES2023", module: "NodeNext", moduleResolution: "NodeNext", strict: true,
			noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true,
			paths: { "@earendil-works/*": [`${modules}/@earendil-works/*`] },
		},
		files: ["index.ts", "view.ts", "policy.ts", "preferences.ts", "tests/fixture.ts"].map(file => resolve(root, file)),
	}));
	const result = spawnSync(process.execPath, [resolve(modules, "typescript/bin/tsc"), "-p", config], { stdio: "inherit" });
	process.exitCode = result.status ?? 1;
} finally { rmSync(temp, { recursive: true, force: true }); }
