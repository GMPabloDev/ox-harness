import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createWorktreeManager } from "../core.mjs";

function fixture(t) {
	const dir = mkdtempSync(join(tmpdir(), "ox-worktrees."));
	const repo = join(dir, "project with spaces");
	mkdirSync(repo);
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	git("init", "--quiet", "--initial-branch=dev");
	git("config", "user.email", "ox-test@example.invalid");
	git("config", "user.name", "Ox test");
	git("config", "core.hooksPath", join(dir, "no-hooks"));
	writeFileSync(join(repo, "shared.txt"), "original\n");
	git("add", "shared.txt");
	git("commit", "--quiet", "-m", "Initial fixture");
	return { dir, repo, git, manager: createWorktreeManager() };
}

const owner = "test-session";

test("auto preserves the simple flow and a second SPEC gets an isolated checkout", async t => {
	const { repo, git, manager } = fixture(t);
	const first = await manager.prepare(repo, { slug: "exportar", mode: "auto" });
	assert.equal(first.spec, "01-exportar");
	assert.equal(first.cwd, repo);
	assert.equal(git("branch", "--show-current"), first.branch);
	writeFileSync(first.specPath, "# SPEC 01\n> **Estado:** Borrador\n");
	const second = await manager.prepare(repo, { slug: "notificar", mode: "auto" });
	assert.equal(second.spec, "02-notificar");
	assert.notEqual(second.cwd, repo);
	assert.equal(git("branch", "--show-current"), first.branch);
	assert.equal(readFileSync(first.specPath, "utf8"), "# SPEC 01\n> **Estado:** Borrador\n");
	assert.equal(existsSync(join(second.cwd, "specs", "01-exportar.md")), false);
	assert.equal(second.repositoryRoot, repo);
});

test("two worktrees may edit the same path without changing each other or dev", async t => {
	const { repo, git, manager } = fixture(t);
	const a = await manager.prepare(repo, { slug: "primero", mode: "worktree" });
	const b = await manager.prepare(repo, { slug: "segundo", mode: "worktree" });
	writeFileSync(join(a.cwd, "shared.txt"), "change A\n");
	writeFileSync(join(b.cwd, "shared.txt"), "change B\n");
	assert.equal(readFileSync(join(repo, "shared.txt"), "utf8"), "original\n");
	assert.equal(readFileSync(join(a.cwd, "shared.txt"), "utf8"), "change A\n");
	assert.equal(readFileSync(join(b.cwd, "shared.txt"), "utf8"), "change B\n");
	assert.equal(git("branch", "--show-current"), "dev");
});

test("reservation counts branches, dev documents and uncommitted documents across worktrees", async t => {
	const { repo, git, manager } = fixture(t);
	mkdirSync(join(repo, "specs"));
	writeFileSync(join(repo, "specs", "07-antigua.md"), "old\n");
	git("add", "specs");
	git("commit", "--quiet", "-m", "Existing spec");
	git("branch", "spec-09-reservada");
	const a = await manager.prepare(repo, { slug: "a", mode: "worktree" });
	assert.equal(a.spec, "10-a");
	writeFileSync(join(a.cwd, "specs", "15-local.md"), "uncommitted\n");
	const b = await manager.prepare(repo, { slug: "b", mode: "worktree" });
	assert.equal(b.spec, "16-b");
	await assert.rejects(manager.prepare(repo, { slug: "collision", number: 9 }), /reservad|ocupad/i);
});

test("concurrent processes reserve different numbers using the common Git directory", async t => {
	const { repo, manager } = fixture(t);
	const moduleURL = new URL("../core.mjs", import.meta.url).href;
	const children = ["a", "b", "c"].map(slug => new Promise((resolve, reject) => {
		const script = `import {createWorktreeManager} from ${JSON.stringify(moduleURL)}; console.log(JSON.stringify(await createWorktreeManager().prepare(${JSON.stringify(repo)},{slug:${JSON.stringify(slug)},mode:"worktree"})));`;
		const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
		let out = "", error = "";
		child.stdout.on("data", chunk => out += chunk);
		child.stderr.on("data", chunk => error += chunk);
		child.on("error", reject);
		child.on("exit", code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(error)));
	}));
	const results = await Promise.all(children);
	assert.deepEqual(results.map(item => item.spec.slice(0, 2)).sort(), ["01", "02", "03"]);
	const listing = await manager.list(results[0].cwd);
	assert.equal(listing.specs.length, 3);
	assert.equal(listing.repositoryRoot, repo);
});

test("resumption reuses its branch and worktree and sees the uncommitted SPEC", async t => {
	const { repo, manager } = fixture(t);
	const a = await manager.prepare(repo, { slug: "retomar", mode: "worktree" });
	writeFileSync(a.specPath, "# SPEC\n> **Estado:** Aprobada\n");
	const again = await manager.prepare(repo, { spec: "01" });
	assert.equal(again.cwd, a.cwd);
	assert.equal(again.created, false);
	assert.equal(again.specState, "Aprobada");
	assert.equal((await manager.resolve(repo, "retomar")).spec, a.spec);
	await assert.rejects(manager.resolve(repo, "missing"), /SPEC/i);
});

test("dirty source changes stay in place; explicit here refuses to move them", async t => {
	const { repo, git, manager } = fixture(t);
	writeFileSync(join(repo, "shared.txt"), "do not move\n");
	await assert.rejects(manager.prepare(repo, { slug: "here", mode: "here" }), /limpi|cambio/i);
	const isolated = await manager.prepare(repo, { slug: "safe", mode: "auto" });
	assert.notEqual(isolated.cwd, repo);
	assert.equal(readFileSync(join(repo, "shared.txt"), "utf8"), "do not move\n");
	assert.equal(readFileSync(join(isolated.cwd, "shared.txt"), "utf8"), "original\n");
	assert.equal(git("branch", "--show-current"), "dev");
});

test("base is local dev, not the caller's HEAD, and missing dev fails closed", async t => {
	const { repo, git, manager } = fixture(t);
	git("switch", "--quiet", "-c", "other");
	writeFileSync(join(repo, "other.txt"), "not in dev\n");
	git("add", "other.txt"); git("commit", "--quiet", "-m", "Other branch");
	const a = await manager.prepare(repo, { slug: "from-dev", mode: "worktree" });
	assert.equal(existsSync(join(a.cwd, "other.txt")), false);
	git("branch", "-D", "dev");
	await assert.rejects(manager.prepare(repo, { slug: "blocked" }), /dev/);
});

test("an already cancelled operation cannot create a branch or worktree", async t => {
	const { repo, git } = fixture(t);
	const controller = new AbortController(); controller.abort();
	const manager = createWorktreeManager({ signal: controller.signal });
	await assert.rejects(manager.prepare(repo, { slug: "cancelled", mode: "worktree" }));
	assert.equal(git("branch", "--list", "spec-*"), "");
});

test("invalid names cannot inject Git arguments or escape the managed directory", async t => {
	const { repo, manager } = fixture(t);
	for (const slug of ["../escape", "--force", "a;touch pwned", "", "á"]) {
		await assert.rejects(manager.prepare(repo, { slug, mode: "worktree" }), /slug/i);
	}
});

async function committedSpec(t, isolated = true) {
	const setup = fixture(t);
	const a = await setup.manager.prepare(setup.repo, { slug: "complete", mode: isolated ? "worktree" : "here" });
	writeFileSync(a.specPath, "# SPEC\n> **Estado:** Implementada\n");
	execFileSync("git", ["-C", a.cwd, "add", "specs"], { stdio: "pipe" });
	execFileSync("git", ["-C", a.cwd, "commit", "--quiet", "-m", "Close fixture"], { stdio: "pipe" });
	return { ...setup, a, sourceHead: setup.git("rev-parse", a.branch), devHead: setup.git("rev-parse", "dev") };
}

test("integration lease uses the actual dev checkout and excludes another integrator", async t => {
	const { repo, manager, a, sourceHead, devHead } = await committedSpec(t);
	const lease = await manager.acquireIntegration(repo, { spec: a.spec, sourceHead, devHead, owner });
	assert.equal(lease.devCwd, repo);
	await assert.rejects(manager.acquireIntegration(a.cwd, { spec: a.spec, sourceHead, devHead, owner: "other" }), /integra|ocupad/i);
	await assert.rejects(manager.releaseIntegration(repo, { token: lease.token, owner: "other" }), /propiet|sesión/i);
	await manager.releaseIntegration(repo, { token: lease.token, owner });
	assert.equal((await manager.list(repo)).integration, null);
});

test("an unavailable dev branch gets its own checkout without moving the SPEC", async t => {
	const { repo, git, manager, a, sourceHead, devHead } = await committedSpec(t, false);
	const lease = await manager.acquireIntegration(repo, { spec: a.spec, sourceHead, devHead, owner });
	assert.notEqual(lease.devCwd, repo);
	assert.equal(git("branch", "--show-current"), a.branch);
	assert.equal(execFileSync("git", ["-C", lease.devCwd, "branch", "--show-current"], { encoding: "utf8" }).trim(), "dev");
	await manager.releaseIntegration(repo, { token: lease.token, owner });
});

test("integration rejects changed reviewed tips and dirty source or dev", async t => {
	const { repo, manager, a, sourceHead, devHead } = await committedSpec(t);
	await assert.rejects(manager.acquireIntegration(repo, { spec: a.spec, sourceHead: devHead, devHead, owner }), /punta|commit|cambi/i);
	writeFileSync(join(a.cwd, "shared.txt"), "dirty\n");
	await assert.rejects(manager.acquireIntegration(repo, { spec: a.spec, sourceHead, devHead, owner }), /limpi|cambio/i);
	execFileSync("git", ["-C", a.cwd, "restore", "shared.txt"], { stdio: "pipe" });
	writeFileSync(join(repo, "shared.txt"), "dirty dev\n");
	await assert.rejects(manager.acquireIntegration(repo, { spec: a.spec, sourceHead, devHead, owner }), /limpi|cambio/i);
});

test("two independent specs integrate sequentially and the second requires fresh dev consent", async t => {
	const { repo, git, manager, a, sourceHead, devHead } = await committedSpec(t);
	const b = await manager.prepare(repo, { slug: "second", mode: "worktree" });
	writeFileSync(b.specPath, "# SPEC\n> **Estado:** Implementada\n");
	execFileSync("git", ["-C", b.cwd, "add", "specs"], { stdio: "pipe" });
	execFileSync("git", ["-C", b.cwd, "commit", "--quiet", "-m", "Second fixture"], { stdio: "pipe" });
	const bHead = git("rev-parse", b.branch);
	const lease = await manager.acquireIntegration(repo, { spec: a.spec, sourceHead, devHead, owner });
	git("merge", "--no-ff", "--no-commit", sourceHead);
	await assert.rejects(manager.releaseIntegration(repo, { token: lease.token, owner }), /operación|merge/i);
	git("commit", "--quiet", "-m", "Integrate A");
	await manager.releaseIntegration(repo, { token: lease.token, owner });
	await assert.rejects(manager.acquireIntegration(repo, { spec: b.spec, sourceHead: bHead, devHead, owner }), /punta|commit|cambi/i);
	const next = await manager.acquireIntegration(repo, { spec: b.spec, sourceHead: bHead, devHead: git("rev-parse", "dev"), owner });
	git("merge", "--no-ff", "--no-commit", bHead);
	git("commit", "--quiet", "-m", "Integrate B");
	await manager.releaseIntegration(repo, { token: next.token, owner });
	git("merge-base", "--is-ancestor", sourceHead, "dev");
	git("merge-base", "--is-ancestor", bHead, "dev");
});

test("conflicting edits preserve both branches and the lease until a safe abort", async t => {
	const { repo, git, manager } = fixture(t);
	const a = await manager.prepare(repo, { slug: "a", mode: "worktree" });
	const b = await manager.prepare(repo, { slug: "b", mode: "worktree" });
	for (const [item, text] of [[a, "A\n"], [b, "B\n"]]) {
		writeFileSync(join(item.cwd, "shared.txt"), text);
		execFileSync("git", ["-C", item.cwd, "add", "shared.txt"], { stdio: "pipe" });
		execFileSync("git", ["-C", item.cwd, "commit", "--quiet", "-m", "Conflicting fixture"], { stdio: "pipe" });
	}
	git("merge", "--no-ff", "--no-edit", a.branch);
	const devHead = git("rev-parse", "dev");
	const lease = await manager.acquireIntegration(repo, { spec: b.spec, sourceHead: git("rev-parse", b.branch), devHead, owner });
	assert.throws(() => git("merge", "--no-ff", "--no-commit", b.branch));
	await assert.rejects(manager.releaseIntegration(repo, { token: lease.token, owner }), /operación|merge/i);
	git("merge", "--abort");
	await manager.releaseIntegration(repo, { token: lease.token, owner });
	assert.equal(git("rev-parse", "dev"), devHead);
	assert.equal(readFileSync(join(b.cwd, "shared.txt"), "utf8"), "B\n");
});

test("cleanup requires confirmation, merged commits, clean files and no live process", async t => {
	const { repo, git, manager, a } = await committedSpec(t);
	await assert.rejects(manager.remove(repo, { spec: a.spec, confirmed: true }), /integrad|dev/i);
	git("merge", "--no-ff", "--no-edit", a.branch);
	await assert.rejects(manager.remove(repo, { spec: a.spec }), /confirm/i);
	writeFileSync(join(a.cwd, "untracked.txt"), "keep\n");
	await assert.rejects(manager.remove(repo, { spec: a.spec, confirmed: true }), /limpi|cambio/i);
	rmSync(join(a.cwd, "untracked.txt"));
	const child = spawn("sleep", ["30"], { cwd: a.cwd, stdio: "ignore" });
	t.after(() => child.kill());
	await new Promise(resolve => child.once("spawn", resolve));
	await assert.rejects(manager.remove(repo, { spec: a.spec, confirmed: true }), /proceso|sesión/i);
	child.kill(); await new Promise(resolve => child.once("exit", resolve));
	try {
		await manager.remove(repo, { spec: a.spec, confirmed: true });
	} catch (error) {
		// Some desktops hide cwd for same-user services. Production must preserve unknown process state.
		assert.equal(error.code, "PROCESS_CHECK_UNAVAILABLE");
		assert.equal(existsSync(a.cwd), true);
		// A controlled process boundary tests the Git removal independently of host /proc visibility.
		const controlled = createWorktreeManager({ assertNoProcesses: async cwd => {
			assert.equal(cwd, a.cwd);
			assert.ok(child.exitCode !== null || child.signalCode !== null);
		} });
		await controlled.remove(repo, { spec: a.spec, confirmed: true });
	}
	assert.equal(existsSync(a.cwd), false);
	assert.equal(git("rev-parse", "--verify", a.branch).length, 40);
});

test("a worktree does not inherit ignored secrets or local dependency directories", async t => {
	const { repo, git, manager } = fixture(t);
	writeFileSync(join(repo, ".gitignore"), ".env\nnode_modules/\n");
	git("add", ".gitignore"); git("commit", "--quiet", "-m", "Ignore local state");
	writeFileSync(join(repo, ".env"), "fixture secret, not a real credential\n");
	mkdirSync(join(repo, "node_modules"));
	writeFileSync(join(repo, "node_modules", "local.txt"), "local\n");
	const a = await manager.prepare(repo, { slug: "safe-env", mode: "worktree" });
	assert.equal(existsSync(join(a.cwd, ".env")), false);
	assert.equal(existsSync(join(a.cwd, "node_modules")), false);
});

test("inherited Git environment cannot redirect operations to another repository", async t => {
	const { repo } = fixture(t);
	const poisoned = createWorktreeManager({ env: { ...process.env, GIT_DIR: "/nonexistent/other.git", GIT_WORK_TREE: "/nonexistent", GIT_INDEX_FILE: "/nonexistent/index" } });
	const a = await poisoned.prepare(repo, { slug: "correct-repo", mode: "worktree" });
	assert.equal(a.repositoryRoot, repo);
});

test("a tracked specs symlink cannot redirect SPEC writes outside its worktree", async t => {
	const { repo, dir, git, manager } = fixture(t);
	const outside = join(dir, "outside"); mkdirSync(outside);
	symlinkSync(outside, join(repo, "specs"));
	git("add", "specs"); git("commit", "--quiet", "-m", "Symlink fixture");
	await assert.rejects(manager.prepare(repo, { slug: "blocked", mode: "worktree" }), error => error.code === "SYMLINK_PATH");
	assert.deepEqual(execFileSync("ls", ["-A", outside], { encoding: "utf8" }).trim(), "");
});

test("unknown or live reservations remain; a confirmed dead owner can be recovered", async t => {
	const { repo, manager } = fixture(t);
	await manager.prepare(repo, { slug: "reserved", mode: "worktree" });
	const { commonDir } = await manager.repository(repo);
	const lockPath = join(commonDir, "ox-worktrees", "allocation.lock");
	writeFileSync(lockPath, JSON.stringify({ token: "live", host: hostname(), pid: process.pid }));
	await assert.rejects(manager.recover(repo, { confirmed: true }), error => error.code === "OWNER_ALIVE");
	assert.equal(existsSync(lockPath), true);
	const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
	await new Promise(resolve => child.once("exit", resolve));
	writeFileSync(lockPath, JSON.stringify({ token: "dead", host: hostname(), pid: child.pid }));
	await assert.rejects(manager.recover(repo, {}), error => error.code === "CONFIRMATION_REQUIRED");
	assert.deepEqual((await manager.recover(repo, { confirmed: true })).recovered, ["allocation.lock"]);
	assert.equal(existsSync(lockPath), false);
});

test("recovery can recover its own interrupted gate and preserves a live atomic owner", async t => {
	const { repo, dir, git } = fixture(t);
	const manager = createWorktreeManager({ lockTimeoutMs: 40 });
	await manager.prepare(repo, { slug: "recovery", mode: "worktree" });
	const { stateDir } = await manager.repository(repo);
	const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
	await new Promise(resolve => child.once("exit", resolve));
	const interrupted = { token: "interrupted", host: hostname(), pid: child.pid };
	const oldGate = join(stateDir, "recovery.lock");
	writeFileSync(oldGate, JSON.stringify(interrupted));
	assert.deepEqual((await manager.recover(repo, { confirmed: true })).recovered, ["recovery.lock"]);
	assert.equal(existsSync(oldGate), false);
	const leaseFile = join(dir, "recovery-owner.json");
	const ref = "refs/ox-worktrees/recovery";
	writeFileSync(leaseFile, JSON.stringify({ ...interrupted, pid: process.pid }));
	const live = git("hash-object", "-w", leaseFile);
	git("update-ref", ref, live);
	await assert.rejects(manager.recover(repo, { confirmed: true }), error => error.code === "OWNER_ALIVE");
	assert.equal(git("rev-parse", ref), live);
	writeFileSync(leaseFile, JSON.stringify(interrupted));
	git("update-ref", ref, git("hash-object", "-w", leaseFile), live);
	await manager.recover(repo, { confirmed: true });
	assert.throws(() => git("rev-parse", "--verify", ref));
});

test("cancelling recovery releases only its own atomic reservation", { timeout: 5000 }, async t => {
	const { repo, git, manager } = fixture(t);
	await manager.prepare(repo, { slug: "cancel-recovery", mode: "worktree" });
	const { stateDir } = await manager.repository(repo);
	const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
	await new Promise(resolve => child.once("exit", resolve));
	writeFileSync(join(stateDir, "allocation.lock"), JSON.stringify({ token: "old", host: hostname(), pid: child.pid }));
	const controller = new AbortController();
	const timer = setInterval(() => {
		try { if (git("rev-parse", "--verify", "refs/ox-worktrees/recovery")) controller.abort(); }
		catch { /* No reservation has been published yet. */ }
	}, 5);
	t.after(() => clearInterval(timer));
	try {
		await assert.rejects(createWorktreeManager({ signal: controller.signal }).recover(repo, { confirmed: true }), error => error.name === "AbortError" || error.code === "GIT_FAILED");
	} finally { clearInterval(timer); }
	assert.throws(() => git("rev-parse", "--verify", "refs/ox-worktrees/recovery"));
	assert.equal(existsSync(join(stateDir, "allocation.lock")), true);
});

test("cleanup refuses ignored local files even after a successful integration", async t => {
	const { repo, git, manager, a } = await committedSpec(t);
	git("merge", "--no-ff", "--no-edit", a.branch);
	writeFileSync(join(repo, ".git", "info", "exclude"), "local.env\n");
	writeFileSync(join(a.cwd, "local.env"), "local state\n");
	await assert.rejects(manager.remove(repo, { spec: a.spec, confirmed: true }), error => error.code === "IGNORED_FILES");
	assert.equal(existsSync(a.cwd), true);
});
