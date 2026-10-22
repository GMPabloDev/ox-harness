import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

let host = process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT;
for (const directory of (process.env.PATH ?? "").split(delimiter)) {
	if (host || !existsSync(join(directory, "pi"))) continue;
	let root = dirname(realpathSync(join(directory, "pi")));
	while (root !== dirname(root)) {
		const manifest = join(root, "package.json");
		if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@earendil-works/pi-coding-agent") { host = root; break; }
		root = dirname(root);
	}
}
if (!host) throw new Error("Pi package root not found");
const modules = dirname(dirname(host));
const temporary = mkdtempSync(join(tmpdir(), "ox-worktrees-types."));
try {
	const config = join(temporary, "tsconfig.json");
	writeFileSync(config, JSON.stringify({
		compilerOptions: {
			noEmit: true, allowJs: true, checkJs: false, skipLibCheck: true, strict: true,
			module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022",
			types: ["node"], typeRoots: [join(modules, "@types")],
			paths: {
				"@earendil-works/pi-coding-agent": [join(host, "dist/index.d.ts")],
				"@earendil-works/pi-ai": [join(dirname(host), "pi-ai/dist/index.d.ts")],
			},
		},
		files: [fileURLToPath(new URL("../index.ts", import.meta.url))],
	}));
	execFileSync(process.execPath, [join(modules, "typescript/bin/tsc"), "-p", config], { stdio: "inherit" });
} finally { rmSync(temporary, { recursive: true, force: true }); }
