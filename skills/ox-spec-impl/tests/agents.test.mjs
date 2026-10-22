import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import test, { after } from "node:test";

const agentDir = fileURLToPath(new URL("../../../", import.meta.url));
const packageDir = join(agentDir, "npm/node_modules/pi-subagents");

function findHost() {
	const explicit = process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT;
	if (explicit) return explicit;
	for (const directory of (process.env.PATH ?? "").split(delimiter)) {
		const executable = join(directory, process.platform === "win32" ? "pi.exe" : "pi");
		if (!existsSync(executable)) continue;
		let candidate = dirname(realpathSync(executable));
		while (candidate !== dirname(candidate)) {
			const manifest = join(candidate, "package.json");
			if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@earendil-works/pi-coding-agent") return candidate;
			candidate = dirname(candidate);
		}
	}
	throw new Error("Set PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT to the installed Pi package");
}

// Resolve the host-owned peers as Pi's extension loader does. No packages are installed.
const host = findHost();
const hostURL = pathToFileURL(join(host, "dist/index.js")).href;
const peers = ["@earendil-works/pi-coding-agent", "@earendil-works/pi-ai", "@earendil-works/pi-agent-core", "@earendil-works/pi-tui", "typebox"];
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (peers.some(peer => specifier === peer || specifier.startsWith(`${peer}/`))) return nextResolve(specifier, { ...context, parentURL: hostURL });
		return nextResolve(specifier, context);
	},
});
process.env.PI_OFFLINE = "1";
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT = host;

const sdk = await import(pathToFileURL(join(host, "dist/index.js")));
const { getSupportedThinkingLevels, clampThinkingLevel } = await import("@earendil-works/pi-ai");
const { discoverAgents } = await import(pathToFileURL(join(packageDir, "src/agents/agents.js")));
const { resolveSubagentLaunchContract } = await import(pathToFileURL(join(packageDir, "src/api/preflight.js")));
const { flattenSubagentToolOptions } = await import(pathToFileURL(join(packageDir, "src/extension/subagent-options.js")));
const { createDefaultChildSessionFactory } = await import(pathToFileURL(join(packageDir, "src/runs/shared/child-session.js")));
const { createChildHooks } = await import(pathToFileURL(join(packageDir, "src/runs/shared/child-hooks.js")));
const { resolveEffectiveAcceptance, validateAcceptanceInput, captureStagedIndexBaseline, evaluateAcceptance } = await import(pathToFileURL(join(packageDir, "src/runs/shared/acceptance.js")));
const { loadSkillsFromDir, formatSkillsForPrompt } = await import(pathToFileURL(join(host, "dist/core/skills.js")));
const root = mkdtempSync(join(tmpdir(), "ox-agents-test."));
const cwd = join(root, "project");
mkdirSync(cwd);
after(() => rmSync(root, { recursive: true, force: true }));

const runtime = await sdk.ModelRuntime.create({ allowModelNetwork: false });
const expected = {
	"ox-scout": { model: "opencode-go/mimo-v2.6-flash", thinking: "high", tools: ["read", "grep", "find", "ls"] },
	"ox-researcher": { model: "opencode-go/deepseek-v4.1-flash", thinking: "high", tools: ["read", "web_search", "fetch_content", "get_search_content", "source_check"] },
	"ox-worker": { model: "openai/gpt-6-luna", thinking: "max", tools: ["read", "grep", "find", "ls", "bash", "edit", "write", "contact_supervisor"] },
	"ox-reviewer": { model: "opencode-go/deepseek-v4.1-flash", thinking: "max", tools: ["read", "grep", "find", "ls"] },
};
const availableModels = runtime.getModels().map(model => ({ provider: model.provider, id: model.id, reasoning: model.reasoning }));
const discovery = discoverAgents(cwd, "user", "openai", { globalNpmRoot: null });

async function preflight(name) {
	const result = await resolveSubagentLaunchContract({
		agent: name, cwd, agentScope: "user", context: "fresh", skill: false,
		parentModel: { provider: "openai", id: "gpt-6.1-sol" }, availableModels,
		sessionRoot: root, outputMode: "file-only",
	});
	assert.equal(result.ok, true, JSON.stringify(result));
	return result.contract;
}

async function invoke(session, name, params) {
	const definition = session.getToolDefinition(name);
	assert.ok(definition, `${name} was not registered`);
	const result = await definition.execute(randomUUID(), params, undefined, () => {}, session.extensionRunner.createContext());
	assert.ok(!result.isError, JSON.stringify(result));
	return result;
}

async function close(session) {
	await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
	session.dispose();
}

test("only the four ox profiles are executable and their thinking levels are supported", () => {
	assert.deepEqual(discovery.agentDiagnostics ?? [], []);
	assert.deepEqual(discovery.agents.map(agent => agent.name).sort(), Object.keys(expected).sort());
	assert.ok(discovery.disabledAgents.includes("scout"));
	assert.ok(discovery.disabledAgents.includes("reviewer"));
	for (const agent of discovery.agents) {
		const policy = expected[agent.name];
		assert.equal(agent.model, policy.model);
		assert.equal(agent.thinking, policy.thinking);
		assert.deepEqual(agent.tools, policy.tools);
		assert.equal(agent.advertise, true);
		assert.equal(agent.defaultContext, "fresh");
		assert.equal(agent.defaultProgress, false);
		assert.equal(agent.defaultAsync, true);
		assert.equal(agent.inheritGlobalContext, false);
		assert.equal(agent.inheritSkills, false);
		assert.equal(agent.maxSubagentDepth, 1);
		assert.deepEqual(agent.allowedAgents, []);
		const slash = policy.model.indexOf("/");
		const model = runtime.getModel(policy.model.slice(0, slash), policy.model.slice(slash + 1));
		assert.ok(model);
		assert.ok(getSupportedThinkingLevels(model).includes(policy.thinking));
		assert.equal(clampThinkingLevel(model, policy.thinking), policy.thinking);
	}
});

test("Pi SDK loads the parent as Sol high and preserves the final review workflow", async () => {
	const settingsManager = sdk.SettingsManager.create(cwd, agentDir);
	const loader = new sdk.DefaultResourceLoader({
		cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
		noPromptTemplates: true, noThemes: true, noContextFiles: true,
		additionalExtensionPaths: [join(packageDir, "index.js")],
	});
	await loader.reload();
	assert.deepEqual(loader.getExtensions().errors, []);
	const { session } = await sdk.createAgentSession({ cwd, agentDir, settingsManager, resourceLoader: loader, sessionManager: sdk.SessionManager.inMemory(cwd) });
	try {
		const errors = [];
		await session.bindExtensions({ mode: "print", onError: error => errors.push(error.message) });
		assert.deepEqual(errors, []);
		assert.equal(`${session.model.provider}/${session.model.id}`, "openai/gpt-6.1-sol");
		assert.equal(session.thinkingLevel, "high");
		if (session.getToolDefinition("subagents_enable")) await invoke(session, "subagents_enable", {});
		const listed = await invoke(session, "subagent", { action: "list", options: { agentScope: "user", capabilities: true } });
		assert.deepEqual(listed.details.agentCapabilities.agents.map(agent => agent.name).sort(), Object.keys(expected).sort());
		const reviewDir = join(agentDir, "skills/ox-code-review");
		const validation = await invoke(session, "subagent", {
			action: "validate", workflow: join(reviewDir, "scripts/review.workflow.js"), cwd,
			args: { repo: cwd, packet: join(root, "packet"), skillDir: reviewDir, hasSpec: true },
			options: { agentScope: "user" },
		});
		const body = JSON.parse(validation.content.find(item => item.type === "text").text);
		assert.equal(body.ok, true);
		assert.deepEqual(body.errors, []);
		assert.ok(!session.messages.some(message => message.role === "assistant"));
	} finally {
		await close(session);
	}
});

test("the documented worker call passes the installed tool parser and native preflight", async () => {
	const guide = readFileSync(join(agentDir, "skills/ox-spec-impl/delegation.md"), "utf8");
	const example = guide.match(/```js\n([\s\S]*?)\n```/);
	assert.ok(example, "the delegation guide needs its executable launch example");
	let request;
	runInNewContext(example[1], { repo: cwd, encargo: "Validate the authorized block", subagent: params => { request = params; } });
	const params = flattenSubagentToolOptions(request);
	assert.equal(params.agent, "ox-worker");
	assert.equal(params.cwd, cwd);
	assert.equal(params.async, true);
	assert.equal(params.outputMode, "file-only");
	const result = await resolveSubagentLaunchContract({
		...params, parentModel: { provider: "openai", id: "gpt-6.1-sol" }, availableModels, sessionRoot: root,
	});
	assert.equal(result.ok, true, JSON.stringify(result));
	assert.equal(result.contract.tools.fanoutAuthorized, false);
});

for (const name of Object.keys(expected)) {
	test(`${name} launch contract preserves its tool ceiling and forbids fanout`, async () => {
		const contract = await preflight(name);
		assert.equal(contract.context, "fresh");
		assert.equal(contract.thinking, expected[name].thinking);
		assert.equal(contract.tools.fanoutAuthorized, false);
		assert.equal(contract.tools.disableAmbientExtensions, true);
		assert.deepEqual([...contract.tools.effectiveAllowlist].sort(), [...expected[name].tools].sort());
		assert.deepEqual(contract.skills.resolved, []);
		assert.ok(contract.roots.outputPath && !contract.roots.outputPath.startsWith(`${cwd}/`), contract.roots.outputPath);
		if (name === "ox-researcher") {
			assert.deepEqual(contract.tools.configuredExtensions, [join(agentDir, "npm/node_modules/pi-web-access/dist/index.js")]);
		} else {
			assert.deepEqual(contract.tools.configuredExtensions, []);
		}
	});
}

test("native child session setup registers exactly the permitted tools without inference", async () => {
	const sessions = [];
	const factory = createDefaultChildSessionFactory({ loadPiCodingAgent: async () => ({
		...sdk,
		createAgentSession: async options => {
			const result = await sdk.createAgentSession(options);
			sessions.push(result.session);
			return result;
		},
	}) });
	try {
		for (const agent of discovery.agents) {
			const contract = await preflight(agent.name);
			const config = {
				cwd, runId: randomUUID(), agent: agent.name, childIndex: 0,
				fanoutChild: false, depth: 1, maxDepth: 1, fast: false,
				orchestratorSessionId: "ox-test-parent", orchestratorTarget: "ox-test-parent",
				supervisorChannelDir: join(root, "supervisor", agent.name),
				inheritProjectContext: agent.inheritProjectContext,
				inheritGlobalContext: false, inheritSkills: false,
				requiredTools: contract.tools.requiredChildTools,
				waitTool: { enabled: true, defaultTimeoutMs: 1800000 },
			};
			const errors = [];
			const child = await factory.create({
				cwd, storage: { kind: "memory" }, model: `${agent.model}:${agent.thinking}`,
				tools: contract.tools.effectiveAllowlist, excludeTools: contract.tools.excludeTools,
				extensionPaths: contract.tools.configuredExtensions, ambientExtensions: false,
				hooks: createChildHooks(config), noSkills: true, noContextFiles: !agent.inheritProjectContext,
				systemPrompt: agent.systemPrompt, runtime: config,
				onExtensionError: error => errors.push(error),
			});
			try {
				assert.deepEqual(errors, [], agent.name);
				const session = sessions.at(-1);
				assert.equal(`${session.model.provider}/${session.model.id}`, expected[agent.name].model);
				assert.equal(session.thinkingLevel, expected[agent.name].thinking);
				assert.deepEqual(session.getActiveToolNames().sort(), [...expected[agent.name].tools].sort(), agent.name);
				assert.ok(!session.getAllTools().some(tool => ["subagent", "subagents_enable", "subagent_supervisor"].includes(tool.name)));
				assert.ok(!session.messages.some(message => message.role === "assistant"));
			} finally {
				await child.dispose();
			}
		}
	} finally {
		await factory.dispose();
	}
	assert.deepEqual(readdirSync(cwd), []);
});

function workerAcceptance() {
	const agent = discovery.agents.find(candidate => candidate.name === "ox-worker");
	assert.deepEqual(validateAcceptanceInput(agent.defaultAcceptance), []);
	return resolveEffectiveAcceptance({ explicit: agent.defaultAcceptance, agentName: agent.name, acceptanceRole: agent.acceptanceRole, async: true });
}

test("worker evidence remains checked while the principal owns accumulated review", () => {
	const acceptance = workerAcceptance();
	assert.equal(acceptance.level, "checked");
	assert.equal(acceptance.preserveStagedIndex, true);
	assert.equal(acceptance.review?.required, false);
	assert.equal(acceptance.review?.agent, undefined);
	assert.ok(acceptance.evidence.includes("commands-run"));
	assert.ok(acceptance.evidence.includes("changed-files"));
});

test("worker acceptance permits the initial staged index and rejects subsequent staging", async t => {
	const repo = join(root, "staged-fixture");
	mkdirSync(repo);
	const gitKeys = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"];
	const saved = new Map(gitKeys.map(key => [key, process.env[key]]));
	for (const key of gitKeys) delete process.env[key];
	t.after(() => {
		for (const [key, value] of saved) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});
	const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
	git("init", "--quiet");
	writeFileSync(join(repo, "existing.txt"), "preexisting change\n");
	git("add", "existing.txt");
	const stagedIndexBaseline = captureStagedIndexBaseline(repo);
	const output = git("diff", "--cached", "--name-only");
	assert.equal(output.trim(), "existing.txt");
	const acceptance = workerAcceptance();
	// This fixture exercises the host's acceptance checks, not a model's report.
	const report = {
		criteriaSatisfied: acceptance.criteria.map(item => ({ id: item.id, status: "satisfied", evidence: "acceptance test fixture" })),
		changedFiles: [], testsAddedOrUpdated: [],
		commandsRun: [{ command: "git diff --cached --name-only", result: "passed", summary: output.trim() }],
		residualRisks: [], noStagedFiles: false,
	};
	const retained = await evaluateAcceptance({ acceptance, report, cwd: repo, stagedIndexBaseline });
	assert.equal(retained.status, "checked", JSON.stringify(retained));
	writeFileSync(join(repo, "new.txt"), "child change\n");
	git("add", "new.txt");
	const changed = await evaluateAcceptance({ acceptance, report, cwd: repo, stagedIndexBaseline });
	assert.equal(changed.status, "rejected");
	assert.ok(changed.runtimeChecks.some(check => check.id === "staged-index-unchanged" && check.status === "failed"));
});

function prose(text, file) {
	let fence;
	const lines = [];
	for (const line of text.split("\n")) {
		const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
		if (match) {
			if (!fence) fence = match[1];
			else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = undefined;
			continue;
		}
		if (!fence) lines.push(line);
	}
	assert.equal(fence, undefined, `Unclosed fence in ${file}`);
	return lines.join("\n").replace(/(`+)([^\n]*?)\1/g, "");
}

test("the manual ox entry is discoverable and points to the existing procedures", () => {
	const loaded = loadSkillsFromDir({ dir: join(agentDir, "skills"), source: "user" });
	assert.deepEqual(loaded.diagnostics, []);
	const entries = loaded.skills.filter(skill => skill.name === "ox");
	assert.equal(entries.length, 1);
	assert.equal(entries[0].disableModelInvocation, true);
	assert.ok(!formatSkillsForPrompt(entries).includes("<name>ox</name>"));
	const targets = [...readFileSync(entries[0].filePath, "utf8").matchAll(/\]\(\.\.\/([^/)]+)\/SKILL\.md\)/g)].map(match => match[1]).sort();
	assert.deepEqual(targets, ["ox-foundation", "ox-prototype", "ox-spec", "ox-spec-impl", "ox-tdd-bugfix", "ox-tdd-feature", "ox-code-review"].sort());
});

test("manual SPEC skill and all reachable Markdown links remain valid", () => {
	const skillDir = join(agentDir, "skills/ox-spec-impl");
	const loaded = loadSkillsFromDir({ dir: skillDir, source: "user" });
	assert.deepEqual(loaded.diagnostics, []);
	assert.equal(loaded.skills.length, 1);
	assert.equal(loaded.skills[0].disableModelInvocation, true);
	assert.ok(!formatSkillsForPrompt(loaded.skills).includes("<name>ox-spec-impl</name>"));
	const queue = [join(agentDir, "skills/ox/SKILL.md"), join(skillDir, "SKILL.md"), ...Object.keys(expected).map(name => join(agentDir, "agents", `${name}.md`))];
	const visited = new Set();
	while (queue.length) {
		const file = queue.shift();
		if (visited.has(file)) continue;
		visited.add(file);
		for (const match of prose(readFileSync(file, "utf8"), file).matchAll(/\[[^\]\n]*\]\(([^)]+)\)/g)) {
			if (/^[a-z][a-z\d+.-]*:/i.test(match[1])) continue;
			const [name, anchor] = match[1].split("#");
			const target = name ? resolve(dirname(file), decodeURIComponent(name)) : file;
			assert.ok(existsSync(target) && statSync(target).isFile(), `${file}: ${match[1]}`);
			if (anchor) {
				const headings = [...prose(readFileSync(target, "utf8"), target).matchAll(/^#{1,6}\s+(.+)$/gm)].map(item => item[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").replace(/ /g, "-"));
				assert.ok(headings.includes(decodeURIComponent(anchor)), `${target}: #${anchor}`);
			}
			if (target.endsWith(".md")) queue.push(target);
		}
	}
});
