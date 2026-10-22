import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const agentDir = fileURLToPath(new URL("../../../", import.meta.url));
const runtime = await import(pathToFileURL(`${agentDir}/npm/node_modules/pi-subagents/src/workflows/scripted-workflow.js`));
const scriptURL = new URL("../scripts/review.workflow.js", import.meta.url);
const args = { repo: "/tmp/repo", packet: "/tmp/packet", skillDir: fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, ""), hasSpec: true };

function child(key, params) {
	return {
		key, ok: true, runId: `test-${key}`, output: "File-only reference",
		outputReference: `/tmp/reports/${key}.md`,
		artifactPaths: [`/tmp/reports/${key}.md`],
		requestedContext: params.context, resolvedContext: params.context,
	};
}

async function execute(overrides = {}, launch = child) {
	const script = await readFile(scriptURL, "utf8");
	const validation = runtime.validateWorkflowScript(script);
	assert.equal(validation.ok, true, JSON.stringify(validation.errors));
	const calls = [];
	const result = await runtime.runWorkflowScript({
		script, args: { ...args, ...overrides }, processCwd: "/tmp",
		launch: async (key, params) => {
			calls.push({ key, ...params });
			return launch(key, params);
		},
		status: async () => { throw new Error("Unexpected status polling"); },
	});
	return { result, calls };
}

test("three distinct review axes share one packet and use fresh readonly profile", async () => {
	const { result, calls } = await execute();
	assert.deepEqual(calls.map(call => call.key), ["standards", "spec", "correctness"]);
	for (const call of calls) {
		assert.equal(call.agent, "ox-reviewer");
		assert.equal(call.context, "fresh");
		assert.equal(call.cwd, args.repo);
		assert.equal(call.agentScope, "user");
		assert.equal(call.skill, false);
		assert.equal(call.progress, false);
		assert.equal(call.outputMode, "file-only");
		assert.equal(call.async, undefined, "await final results, not launch receipts");
		assert.ok(call.task.includes(args.packet));
		assert.ok(call.task.includes(`/axes/${call.key}.md`));
		assert.ok(call.label.length > 0);
	}
	assert.equal(new Set(calls.map(call => call.output)).size, 3);
	assert.equal(result.value.reviews.length, 3);
	assert.deepEqual(result.value.omitted, []);
	assert.equal(result.value.reviews[0].outputReference, "/tmp/reports/standards.md");
	assert.equal(result.value.reviews[0].output, undefined, "keep report prose out of parent context");
});

test("missing requirements skips only the Spec axis and records the omission", async () => {
	const { result, calls } = await execute({ hasSpec: false });
	assert.deepEqual(calls.map(call => call.key), ["standards", "correctness"]);
	assert.deepEqual(result.value.omitted, ["spec"]);
});

test("invalid contract rejects before any child launches", async () => {
	let launches = 0;
	await assert.rejects(execute({ hasSpec: "yes" }, () => { launches += 1; }), /hasSpec/);
	assert.equal(launches, 0);
});

test("a failed child does not become a successful review", async () => {
	await assert.rejects(execute({}, (key, params) => ({
		...child(key, params), ok: key !== "spec", error: key === "spec" ? "provider unavailable" : undefined,
	})), /provider unavailable|failed/i);
});
