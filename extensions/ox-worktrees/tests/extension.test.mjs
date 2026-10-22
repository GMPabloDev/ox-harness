import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

function findHost() {
	if (process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT) return process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT;
	for (const dir of process.env.PATH.split(delimiter)) {
		if (!existsSync(join(dir, "pi"))) continue;
		let root = dirname(realpathSync(join(dir, "pi")));
		while (root !== dirname(root)) {
			const manifest = join(root, "package.json");
			if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@earendil-works/pi-coding-agent") return root;
			root = dirname(root);
		}
	}
	throw new Error("Pi installation not found");
}
const host = findHost();
const hostURL = pathToFileURL(join(host, "dist/index.js")).href;
registerHooks({ resolve(specifier, context, next) {
	if (["@earendil-works/pi-coding-agent", "@earendil-works/pi-ai", "@earendil-works/pi-agent-core", "@earendil-works/pi-tui", "typebox"].some(name => specifier === name || specifier.startsWith(name + "/"))) return next(specifier, { ...context, parentURL: hostURL });
	return next(specifier, context);
} });
process.env.PI_OFFLINE = "1";
const sdk = await import(hostURL);
const agentDir = fileURLToPath(new URL("../../../", import.meta.url));
const extensionPath = fileURLToPath(new URL("../index.ts", import.meta.url));

test("the installed Pi loader registers the tool and command without inference or startup side effects", async t => {
	const repo = mkdtempSync(join(tmpdir(), "ox-extension-loader."));
	t.after(() => rmSync(repo, { recursive: true, force: true }));
	execFileSync("git", ["init", "--quiet", "--initial-branch=dev"], { cwd: repo });
	execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "Initial"], { cwd: repo });
	const settings = sdk.SettingsManager.create(repo, agentDir);
	const loader = new sdk.DefaultResourceLoader({ cwd: repo, agentDir, settingsManager: settings, noExtensions: true, noSkills: true, noContextFiles: true, noThemes: true, noPromptTemplates: true, additionalExtensionPaths: [extensionPath] });
	await loader.reload();
	assert.deepEqual(loader.getExtensions().errors, []);
	const { session } = await sdk.createAgentSession({ cwd: repo, agentDir, settingsManager: settings, resourceLoader: loader, sessionManager: sdk.SessionManager.inMemory(repo) });
	try {
		const errors = [];
		await session.bindExtensions({ mode: "print", onError: error => errors.push(error.message) });
		assert.deepEqual(errors, []);
		const tool = session.getToolDefinition("ox_worktree");
		assert.ok(tool);
		assert.ok(tool.description.includes(join(agentDir, "skills/ox-spec/worktrees.md")));
		assert.ok(session.extensionRunner.getRegisteredCommands().some(command => command.name === "ox-worktree"));
		assert.equal(existsSync(join(repo, ".git", "ox-worktrees")), false);
		const context = session.extensionRunner.createContext();
		const listed = await tool.execute("list-test", { action: "list" }, undefined, () => {}, context);
		assert.ok(!listed.isError);
		assert.deepEqual(listed.details.specs, []);
		const prepared = await tool.execute("prepare-test", { action: "prepare", slug: "loader", mode: "worktree" }, undefined, () => {}, context);
		assert.ok(!prepared.isError, JSON.stringify(prepared));
		assert.equal(prepared.details.spec, "01-loader");
		assert.ok(existsSync(prepared.details.cwd));
		t.after(() => rmSync(dirname(prepared.details.cwd), { recursive: true, force: true }));
		const relative = await tool.execute("relative-test", { action: "list", cwd: "." }, undefined, () => {}, context);
		assert.equal(relative.isError, true);
		assert.equal(relative.details.code, "ABSOLUTE_CWD_REQUIRED");
		const blocked = await tool.execute("merge-test", { action: "integration_acquire", spec: "01" }, undefined, () => {}, context);
		assert.equal(blocked.isError, true);
		assert.equal(blocked.details.code, "CONFIRMATION_REQUIRED");
		assert.ok(!session.messages.some(message => message.role === "assistant"));
	} finally {
		await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		session.dispose();
	}
});

test("normal user resource discovery loads ox and the official Herdr integration exactly once", async t => {
	const cwd = mkdtempSync(join(tmpdir(), "ox-autoload."));
	t.after(() => rmSync(cwd, { recursive: true, force: true }));
	const loader = new sdk.DefaultResourceLoader({ cwd, agentDir, settingsManager: sdk.SettingsManager.create(cwd, agentDir), noContextFiles: true });
	await loader.reload();
	assert.deepEqual(loader.getExtensions().errors, []);
	const extensions = loader.getExtensions().extensions;
	assert.equal(extensions.filter(extension => extension.path === extensionPath).length, 1);
	assert.equal(extensions.filter(extension => extension.path === join(agentDir, "extensions/herdr-agent-state.ts")).length, 1);
});
