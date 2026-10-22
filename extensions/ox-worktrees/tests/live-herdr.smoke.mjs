import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createWorktreeManager } from "../core.mjs";
import { createHerdrBridge, runHerdr } from "../herdr.mjs";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test("real Herdr opens two isolated Pi sessions and reuses the first, without model calls", { skip: process.env.OX_HERDR_SMOKE !== "1", timeout: 120000 }, async t => {
	const root = mkdtempSync(join(tmpdir(), "ox-herdr-live."));
	const repo = join(root, "project");
	const agentDir = join(root, "agent");
	mkdirSync(repo); mkdirSync(agentDir);
	writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ packages: [], quietStartup: true }));
	const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
	git("init", "--quiet", "--initial-branch=dev");
	git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "Initial");
	const name = `ox-test-${randomUUID().slice(0, 8)}`;
	const env = { ...process.env, XDG_CONFIG_HOME: join(root, "config"), PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: "1", SHELL: "/bin/bash" };
	for (const key of Object.keys(env)) if (key.startsWith("HERDR_")) delete env[key];
	const child = spawn("herdr", ["--session", name, "server"], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
	let logs = "";
	child.stdout.on("data", data => logs += data);
	child.stderr.on("data", data => logs += data);
	const run = args => runHerdr(["--session", name, ...args], { env });
	t.after(async () => {
		try { await run(["server", "stop"]); } catch { /* Only this named test server is stopped. */ }
		for (let i = 0; child.exitCode === null && child.signalCode === null && i < 50; i++) await delay(100);
		if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
		rmSync(root, { recursive: true, force: true });
	});
	let ready = false;
	for (let i = 0; i < 60; i++) {
		try { await run(["workspace", "list"]); ready = true; break; }
		catch {
			if (child.exitCode !== null || child.signalCode !== null) break;
			await delay(100);
		}
	}
	assert.ok(ready, `Test server did not start: ${logs}`);
	const manager = createWorktreeManager();
	const a = await manager.prepare(repo, { slug: "a", mode: "worktree" });
	const b = await manager.prepare(repo, { slug: "b", mode: "worktree" });
	const bridge = createHerdrBridge(manager, { env: { HERDR_ENV: "1", HERDR_PANE_ID: "test-caller" }, run, piArgs: ["--no-extensions", "-e", fileURLToPath(new URL("../index.ts", import.meta.url)), "-e", fileURLToPath(new URL("../../herdr-agent-state.ts", import.meta.url)), "--no-skills", "--no-mcp", "--no-context-files", "--no-approve", "--offline"] });
	const openedA = await bridge.open(repo, { spec: a.spec });
	const openedB = await bridge.open(repo, { spec: b.spec });
	assert.equal(openedA.disposition, "started");
	assert.equal(openedB.disposition, "started");
	assert.notEqual(openedA.workspaceId, openedB.workspaceId);
	assert.notEqual(openedA.paneId, openedB.paneId);
	for (const opened of [openedA, openedB]) {
		const pane = (await run(["pane", "get", opened.paneId])).pane;
		assert.equal(pane.agent, "pi");
		assert.equal(pane.foreground_cwd, opened.cwd);
		assert.equal(opened.taskDelivered, false);
	}
	assert.equal((await bridge.open(repo, { spec: a.spec })).disposition, "reused");
	const agents = await run(["agent", "list"]);
	assert.equal(agents.agents.filter(item => item.agent === "pi").length, 2);
});
