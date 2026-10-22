import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createWorktreeManager, WorktreeError } from "../core.mjs";
import { createHerdrBridge } from "../herdr.mjs";

async function fixture(t) {
	const dir = mkdtempSync(join(tmpdir(), "ox-herdr-contract."));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const repo = join(dir, "project"); mkdirSync(repo);
	const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
	git("init", "--quiet", "--initial-branch=dev");
	git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "Initial");
	const manager = createWorktreeManager();
	const record = await manager.prepare(repo, { slug: "test", mode: "worktree" });
	let agent;
	let paneCwd = record.cwd;
	let failure;
	let otherPanes = [];
	const calls = [];
	const run = async args => {
		calls.push(args);
		if (failure === args[1]) throw new WorktreeError("HERDR_FAILED", "fixture failure");
		if (args[0] === "worktree") return { workspace: { workspace_id: "opaque-workspace" }, root_pane: { pane_id: "opaque-pane" } };
		const rootPane = { pane_id: "opaque-pane", workspace_id: "opaque-workspace", cwd: paneCwd, foreground_cwd: paneCwd, agent };
		if (args[0] === "pane" && args[1] === "get") return { pane: [rootPane, ...otherPanes].find(pane => pane.pane_id === args[2]) };
		if (args[0] === "pane" && args[1] === "list") return { panes: [rootPane, ...otherPanes] };
		if (args[0] === "agent" && args[1] === "start") { agent = "pi"; return { ready: true }; }
		return {};
	};
	const bridge = createHerdrBridge(manager, { env: { HERDR_ENV: "1", HERDR_PANE_ID: "caller" }, run });
	return { repo, manager, record, calls, bridge, run, setCwd: value => paneCwd = value, setAgent: value => agent = value, setOtherPanes: value => otherPanes = value, failOn: value => failure = value };
}

test("opening starts one named Pi with a stable session and preserves focus by default", async t => {
	const { repo, record, bridge, calls } = await fixture(t);
	const opened = await bridge.open(repo, { spec: record.spec, task: "Authorized task" });
	assert.equal(opened.disposition, "started");
	assert.equal(opened.taskDelivered, true);
	const start = calls.find(args => args[0] === "agent" && args[1] === "start");
	assert.ok(start.includes("--session-id"));
	assert.ok(start.includes("ox-spec-01-test"));
	assert.ok(calls[0].includes("--no-focus"));
	assert.equal(calls.some(args => args[0] === "workspace" && args[1] === "focus"), false);
	assert.equal(calls.filter(args => args[0] === "agent" && args[1] === "prompt").length, 1);
});

test("reopening a live Pi neither launches another writer nor sends it another task", async t => {
	const { repo, record, bridge, calls } = await fixture(t);
	await bridge.open(repo, { spec: record.spec, task: "First" });
	const resumed = await bridge.open(repo, { spec: record.spec, task: "Do not inject", focus: true });
	assert.equal(resumed.disposition, "reused");
	assert.equal(resumed.taskDelivered, false);
	assert.equal(calls.filter(args => args[1] === "start").length, 1);
	assert.equal(calls.filter(args => args[1] === "prompt").length, 1);
	assert.ok(calls.some(args => args[0] === "agent" && args[1] === "focus" && args[2] === "opaque-pane"));
});

test("concurrent requests for the same SPEC cannot start duplicate Pi sessions", async t => {
	const { repo, record, bridge, calls } = await fixture(t);
	const result = await Promise.all([bridge.open(repo, { spec: record.spec }), bridge.open(repo, { spec: record.spec })]);
	assert.deepEqual(result.map(item => item.disposition).sort(), ["reused", "started"]);
	assert.equal(calls.filter(args => args[1] === "start").length, 1);
});

test("a Pi already running in a non-root pane is reused instead of creating a second writer", async t => {
	const { repo, record, bridge, calls, setOtherPanes } = await fixture(t);
	setOtherPanes([{ pane_id: "existing-pi", cwd: record.cwd, foreground_cwd: record.cwd, agent: "pi" }]);
	const opened = await bridge.open(repo, { spec: record.spec });
	assert.equal(opened.disposition, "reused");
	assert.equal(opened.paneId, "existing-pi");
	assert.equal(calls.some(args => args[1] === "start"), false);
});

test("multiple existing Pi sessions in the same checkout require the user to choose", async t => {
	const { repo, record, bridge, calls, setAgent, setOtherPanes } = await fixture(t);
	setAgent("pi");
	setOtherPanes([{ pane_id: "other-pi", cwd: record.cwd, foreground_cwd: record.cwd, agent: "pi" }]);
	await assert.rejects(bridge.open(repo, { spec: record.spec }), error => error.code === "AMBIGUOUS_PI");
	assert.equal(calls.some(args => args[1] === "start" || args[1] === "prompt"), false);
});

test("a session started in a subdirectory is still the current SPEC checkout", async t => {
	const { record, bridge, calls } = await fixture(t);
	const nested = join(record.cwd, "nested"); mkdirSync(nested);
	assert.equal((await bridge.open(nested, { spec: record.spec })).disposition, "current");
	assert.deepEqual(calls, []);
});

test("the current SPEC needs no Herdr command or second session", async t => {
	const { record, bridge, calls } = await fixture(t);
	assert.equal((await bridge.open(record.cwd, { spec: record.spec })).disposition, "current");
	assert.deepEqual(calls, []);
});

test("outside Herdr automatic opening fails without losing the prepared worktree", async t => {
	const { repo, manager, record } = await fixture(t);
	const bridge = createHerdrBridge(manager, { env: {}, run: () => assert.fail("must not contact Herdr") });
	await assert.rejects(bridge.open(repo, { spec: record.spec }), error => error.code === "HERDR_REQUIRED");
	assert.equal((await manager.resolve(repo, record.spec)).cwd, record.cwd);
});

test("a pane in a different directory or occupied by another agent is not replaced", async t => {
	const fixtureData = await fixture(t);
	const { repo, record, bridge, calls, setCwd, setAgent } = fixtureData;
	setCwd(repo);
	await assert.rejects(bridge.open(repo, { spec: record.spec }), error => error.code === "PANE_CWD_MISMATCH");
	setCwd(record.cwd); setAgent("codex");
	await assert.rejects(bridge.open(repo, { spec: record.spec }), error => error.code === "PANE_OCCUPIED");
	assert.equal(calls.some(args => args[1] === "start" || args[1] === "prompt"), false);
});

test("an existing principal's real session is remembered and restored after Pi exits", async t => {
	const { repo, manager, record, calls, run, bridge, setAgent } = await fixture(t);
	setAgent("pi");
	const sessionPath = join(repo, "existing-session.jsonl");
	writeFileSync(sessionPath, JSON.stringify({ type: "session", id: "original-session", cwd: record.cwd }) + "\n");
	const current = createHerdrBridge(manager, { env: { HERDR_ENV: "1", HERDR_PANE_ID: "opaque-pane" }, run });
	assert.equal((await current.rememberCurrent(record.cwd, { spec: record.spec, sessionId: "original-session", sessionPath })).remembered, true);
	assert.equal((await manager.getPane(repo, record.spec)).sessionPath, sessionPath);
	setAgent(undefined);
	await bridge.open(repo, { spec: record.spec });
	const start = calls.find(args => args[1] === "start");
	assert.ok(start.includes("--session"));
	assert.ok(start.includes(sessionPath));
	assert.equal(start.includes("--session-id"), false);
});

test("switching sessions in one pane does not reopen the previous conversation", async t => {
	const { repo, manager, record, calls, run, bridge, setAgent } = await fixture(t);
	setAgent("pi");
	const sessionPath = join(repo, "previous-session.jsonl");
	writeFileSync(sessionPath, JSON.stringify({ type: "session", id: "previous-session", cwd: record.cwd }) + "\n");
	const current = createHerdrBridge(manager, { env: { HERDR_ENV: "1", HERDR_PANE_ID: "opaque-pane" }, run });
	await current.rememberCurrent(record.cwd, { spec: record.spec, sessionId: "previous-session", sessionPath });
	await current.rememberCurrent(record.cwd, { spec: record.spec, sessionId: "previous-session" });
	assert.equal((await manager.getPane(repo, record.spec)).sessionPath, sessionPath);
	await current.rememberCurrent(record.cwd, { spec: record.spec, sessionId: "new-session" });
	assert.equal((await manager.getPane(repo, record.spec)).sessionPath, undefined);
	setAgent(undefined);
	await bridge.open(repo, { spec: record.spec });
	const start = calls.find(args => args[1] === "start");
	assert.ok(start.includes("--session-id"));
	assert.ok(start.includes("new-session"));
	assert.equal(start.includes(sessionPath), false);
});

test("startup failures keep the binding and worktree for a same-workspace retry", async t => {
	const { repo, record, manager, bridge, failOn } = await fixture(t);
	failOn("start");
	await assert.rejects(bridge.open(repo, { spec: record.spec }), /fixture failure/);
	assert.equal((await manager.resolve(repo, record.spec)).cwd, record.cwd);
	assert.equal((await manager.getPane(repo, record.spec)).paneId, "opaque-pane");
});
