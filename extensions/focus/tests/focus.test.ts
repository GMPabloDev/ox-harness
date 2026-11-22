import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container, Text, TuiMainScreen, visibleWidth } from "@earendil-works/pi-tui";
import { FocusView, findChat } from "../view.ts";
import { agentColor, subagentCards } from "../cards.ts";
import { activityLabel, cleanLine, customActivity, seriousToolFailure, toolHasError, toolPolicy, withoutThinking } from "../policy.ts";
import { loadPreference, savePreference } from "../preferences.ts";
import { installFocus } from "../index.ts";
import { mountSidebar, TodoPanel } from "../../todo-sidebar/core.ts";

const modules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const components = `${modules}/@earendil-works/pi-coding-agent/dist/modes/interactive/components`;
const themes = await import(`${modules}/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js`);
themes.initTheme("dark");
const { AssistantMessageComponent } = await import(`${components}/assistant-message.js`);
const { ToolExecutionComponent } = await import(`${components}/tool-execution.js`);
const { UserMessageComponent } = await import(`${components}/user-message.js`);
const { CustomMessageComponent } = await import(`${components}/custom-message.js`);
const { SkillInvocationMessageComponent } = await import(`${components}/skill-invocation-message.js`);
const plain = (lines: string[]) => lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
let time = 1;
const message = (text = "FINAL_VISIBLE", tool = false, stopReason = tool ? "toolUse" : "stop") => ({
	role: "assistant", provider: "fixture", api: "fixture", model: "fixture", timestamp: time++, stopReason,
	content: [{ type: "thinking", thinking: "THINKING_SECRET" }, { type: "text", text },
		...(tool ? [{ type: "toolCall", id: "call", name: "read", arguments: { path: "fixture" } }] : [])],
	usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
});
const assistant = (msg = message()) => new AssistantMessageComponent(msg);
const tool = (name: string, args: unknown = {}, isError = false) => {
	const component = new ToolExecutionComponent(name, `${name}-id`, args, {}, undefined, { requestRender() {} });
	component.updateResult({ content: [{ type: "text", text: isError ? "IMPORTANT_TOOL_ERROR" : "INTERNAL_TOOL_RESULT" }], details: {}, isError }, false);
	return component;
};
const custom = (customType: string, details: unknown = {}) => new CustomMessageComponent({ role: "custom", customType, details, content: "CUSTOM_INTERNAL_BODY", display: true, timestamp: time++ });
function native() {
	const terminal = { columns: 160, rows: 35, write() {} };
	const tui = new TuiMainScreen(terminal as any);
	tui.requestRender = () => {};
	const chat = new Container();
	const document = new Container();
	document.addChild(new Container()); document.addChild(new Container()); document.addChild(chat);
	tui.addChild(document);
	const editor = new Text("EDITOR_AND_PERMISSIONS", 0, 0);
	tui.addChild(editor);
	tui.setFocus(editor);
	return { tui, chat, document, terminal, editor };
}
function view() {
	const ui = native();
	ui.chat.addChild(new UserMessageComponent("USER_PROMPT"));
	const focus = new FocusView(ui.chat, () => themes.theme);
	return { ...ui, focus, text: (width = 100) => plain(ui.chat.render(width)) };
}

function harness(path: string, mode = "tui") {
	const ui = native();
	const handlers = new Map<string, Function[]>();
	const commands = new Map<string, any>();
	const notices: { text: string; level: string }[] = [];
	const status = new Map<string, string>();
	let widget: any;
	const pi = {
		on(name: string, handler: Function) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
		registerCommand(name: string, command: any) { commands.set(name, command); },
	};
	const ctx = {
		mode, isIdle: () => true,
		ui: {
			theme: themes.theme,
			setWidget(_key: string, factory: Function) { widget?.dispose(); widget = factory(ui.tui); },
			setStatus(key: string, value: string) { status.set(key, value); },
			notify(text: string, level: string) { notices.push({ text, level }); },
		},
	};
	installFocus(pi as any, path);
	return { ...ui, ctx, handlers, commands, notices, status,
		emit: async (name: string, event = {}) => { for (const handler of handlers.get(name) ?? []) await handler(event, ctx); },
		command: async (args: string) => commands.get("focus").handler(args, ctx),
	};
}

function withTemp(run: (path: string, folder: string) => void | Promise<void>) {
	const folder = mkdtempSync(join(tmpdir(), "focus-unit-"));
	return Promise.resolve().then(() => run(join(folder, "focus.json"), folder)).finally(() => rmSync(folder, { recursive: true, force: true }));
}

describe("visual policy", () => {
	test("hides routine tools, summarizes important ones and fails open for unknown tools", () => {
		for (const name of ["read", "bash", "powershell", "edit", "write", "grep", "find", "ls", "todowrite", "codemode", "tool_search", "web_enable", "subagents_enable"]) expect(toolPolicy(name)).toBe("hidden");
		for (const name of ["web_search", "source_check", "fetch_content", "get_search_content"]) expect(toolPolicy(name)).toBe("web");
		expect(toolPolicy("mem_search")).toBe("memory");
		expect(toolPolicy("subagent")).toBe("subagent");
		expect(toolPolicy("request_permission")).toBe("native");
		expect(toolPolicy("ask_user")).toBe("native");
	});
	test("recognizes only skill-file reads and uses the declared name without exposing instructions", () => {
		expect(toolPolicy("read", { path: "/skills/folder-name/SKILL.md" })).toBe("skill");
		expect(toolPolicy("read", { path: "skills/folder-name/notes.md" })).toBe("hidden");
		expect(toolPolicy("read", { path: "skills/SKILL.md.backup" })).toBe("hidden");
		expect(toolPolicy("write", { path: "/skills/folder-name/SKILL.md" })).toBe("hidden");
		expect(activityLabel("skill", "read", { path: "/skills/folder-name/SKILL.md" }, {
			result: { content: [{ type: "text", text: '---\nname: "declared-skill"\ndescription: private description\n---\nSKILL_BODY_SECRET' }] },
		})).toBe("Skill cargada · declared-skill");
		expect(activityLabel("skill", "read", { path: "/skills/folder-name/SKILL.md" }, { pending: true })).toBe("Cargando skill · folder-name");
	});
	test("falls back to the skill directory for partial reads, missing or invalid frontmatter", () => {
		for (const text of ["SKILL_BODY_SECRET", "---\nname: [broken\n---\nSKILL_BODY_SECRET"]) {
			expect(activityLabel("skill", "read", { path: "skills/folder-name/SKILL.md" }, {
				result: { content: [{ type: "text", text }] },
			})).toBe("Skill cargada · folder-name");
		}
		expect(activityLabel("skill", "read", { path: "skills/folder-name/SKILL.md", offset: 20 }, {
			result: { content: [{ type: "text", text: "---\nname: not-the-frontmatter\n---" }] },
		})).toBe("Skill cargada · folder-name");
		expect(activityLabel("skill", "read", { path: "C:\\skills\\windows-skill\\SKILL.md" })).toBe("Skill cargada · windows-skill");
	});
	test("refreshes a cached skill name if the result text changes", () => {
		const args = { path: "/skills/folder-name/SKILL.md" };
		const result = { content: [{ type: "text", text: "---\nname: first-name\n---\nSKILL_BODY_SECRET" }] };
		expect(activityLabel("skill", "read", args, { result })).toBe("Skill cargada · first-name");
		expect(activityLabel("skill", "read", args, { result })).toBe("Skill cargada · first-name");
		result.content[0].text = "---\nname: second-name\n---\nSKILL_BODY_SECRET";
		expect(activityLabel("skill", "read", args, { result })).toBe("Skill cargada · second-name");
	});
	test("sanitizes summary text and supports batched web requests", () => {
		expect(cleanLine("hola\x1b[2J\r\n\u202emundo")).toBe("hola mundo");
		expect(activityLabel("web", "web_search", { queries: ["Pi docs", "second"] })).toBe("Web · Pi docs");
		expect(activityLabel("web", "fetch_content", { urls: ["https://example.test"] })).toContain("https://example.test");
		expect(activityLabel("memory", "mem_save", { content: "PRIVATE_MEMORY_BODY" })).not.toContain("PRIVATE_MEMORY_BODY");
	});
	test("compacts only known successful custom notifications", () => {
		expect(customActivity({ customType: "subagent-notify", details: { runs: [{ agent: "ox-explore", status: "completed" }] } })).toContain("ox-explore");
		for (const status of ["failed", "paused", "stopped"]) expect(customActivity({ customType: "subagent-notify", details: { runs: [{ agent: "ox-explore", status }] } })).toBeUndefined();
		for (const customType of ["subagent-supervisor-blocked", "subagent_watchdog_warning", "subagent_watchdog_clarification", "unknown"]) expect(customActivity({ customType })).toBeUndefined();
		expect(customActivity({ customType: "subagent_supervisor_request", details: { reason: "need_decision" } })).toBeUndefined();
	});
	test("recognizes failures inside otherwise successful orchestration results", () => {
		expect(toolHasError({ details: { results: [{ exitCode: 1 }] } })).toBe(true);
		expect(toolHasError({ details: { status: "blocked" } })).toBe(true);
		expect(toolHasError({ isError: true })).toBe(true);
		expect(toolHasError({ details: {} })).toBe(false);
	});
});

describe("real Pi components", () => {
	test("renders correlated workflow child snapshots without exposing scripts or arguments", () => {
		const h = view();
		const component = new ToolExecutionComponent("subagent", "parent-1", { workflow: true, workflowScript: "SCRIPT_SECRET" }, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		const update = (parentToolCallId: unknown, children: unknown[], inventoryComplete = false) => component.updateResult({ content: [{ type: "text", text: "Workflow running." }], details: { mode: "workflow", runId: "run-1", results: [], workflow: {}, workflowChildren: { version: 1, parentToolCallId, workflowRunId: "run-1", inventoryComplete, workflowState: "running", children }, chatProgress: {} } }, true);
		const first = [{ childId: "one", agent: "scout", state: "running", activity: { currentTool: "bash", durationMs: 2000, args: "ARG_SECRET" } }];
		for (const id of [undefined, "other"]) { update(id, first); expect(h.text()).not.toContain("scout"); }
		update("parent-1", first);
		let text = h.text();
		expect(text).toContain("scout"); expect(text).toContain("en marcha"); expect(text).toContain("2s");
		expect(text).not.toContain("SCRIPT_SECRET"); expect(text).not.toContain("ARG_SECRET"); expect(text).not.toContain("auditor");
		update("parent-1", [{ childId: "one", agent: "scout", state: "completed" }, { childId: "two", agent: "auditor", state: "running" }], true);
		text = h.text(); expect(text).toContain("completado"); expect(text).toContain("auditor"); expect(text).toContain("en marcha");
		h.focus.dispose();
	});
	test("rejects mismatched workflow run IDs and keeps failed child secrets private", () => {
		const h = view();
		const component = new ToolExecutionComponent("subagent", "parent", { workflow: true, workflowScript: "SCRIPT_SECRET" }, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		const summary = { version: 1, parentToolCallId: "parent", workflowRunId: "wrong", inventoryComplete: false, workflowState: "running", children: [{ childId: "child", agent: "auditor", state: "failed", task: "TASK_SECRET", activity: { currentTool: "bash", args: "ARGS_SECRET" } }] };
		const update = () => component.updateResult({ content: [{ type: "text", text: "Workflow running." }], details: { mode: "workflow", runId: "correct", results: [], workflow: {}, workflowChildren: summary, chatProgress: {} } }, true);
		update(); expect(h.text()).not.toContain("auditor");
		summary.workflowRunId = "correct"; update();
		const text = h.text(); expect(text).toContain("auditor"); expect(text).toContain("fallido");
		for (const secret of ["TASK_SECRET", "SCRIPT_SECRET", "ARGS_SECRET"]) expect(text).not.toContain(secret);
		h.focus.dispose();
	});
	test("refreshes a detached run whose status arrives after the initial unknown state", () => withTemp(async (_path, folder) => {
		const ui = native(); let requests = 0;
		const focus = new FocusView(ui.chat, () => themes.theme, () => { requests++; });
		for (const initial of ["missing", "empty"]) {
			const dir = join(folder, initial); const { mkdirSync } = await import("node:fs"); mkdirSync(dir);
			if (initial === "empty") writeFileSync(join(dir, "status.json"), JSON.stringify({ steps: [] }));
			const component = new ToolExecutionComponent("subagent", initial, { agent: "scout" }, {}, undefined, { requestRender() {} });
			component.updateResult({ content: [], details: { asyncDir: dir } }, false);
			ui.chat.addChild(component);
			expect(plain(ui.chat.render(100))).toContain("estado desconocido");
			writeFileSync(join(dir, "status.json"), JSON.stringify({ steps: [{ agent: "scout", status: "running" }] }));
		}
		await new Promise(resolve => setTimeout(resolve, 1200));
		expect(requests).toBeGreaterThan(0);
		expect(plain(ui.chat.render(100)).split("en marcha")).toHaveLength(3);
		focus.dispose();
	}));
	test("shows async workflow step labels and observed states without inspecting scripts", () => withTemp((_path, folder) => {
		writeFileSync(join(folder, "status.json"), JSON.stringify({ steps: [
			{ agent: "scout", status: "running", label: "Explore sources", startedAt: 1000, workflowKey: "step-1" },
			{ agent: "auditor", status: "completed", label: "Audit findings", workflowKey: "step-2" },
		] }));
		const h = view();
		const component = new ToolExecutionComponent("subagent", "async-workflow", { workflow: true, workflowScript: "SCRIPT_SECRET" }, {}, undefined, { requestRender() {} });
		component.updateResult({ content: [], details: { asyncDir: folder } }, false);
		h.chat.addChild(component);
		const text = h.text();
		for (const value of ["scout", "auditor", "Explore sources", "Audit findings", "en marcha", "completado"]) expect(text).toContain(value);
		expect(text).not.toContain("SCRIPT_SECRET");
		h.focus.dispose();
	}));
	test("shows chain stages and dependencies pending and unknown after settlement", () => {
		const h = view();
		const component = new ToolExecutionComponent("subagent", "chain", { chain: [
			{ parallel: [{ agent: "scout", task: "Explore" }, { agent: "researcher", task: "Research" }] },
			{ agent: "auditor", task: "Audit {previous}" },
		] }, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		let text = h.text();
		for (const value of ["scout", "researcher", "auditor", "pendiente", "depende de", "Explore", "Research"]) expect(text).toContain(value);
		expect(text).not.toContain("en marcha");
		component.updateResult({ content: [], details: {} }, false);
		text = h.text();
		expect(text).toContain("estado desconocido");
		expect(text).not.toContain("completado");
		h.focus.dispose();
	});
	test("does not invent single agent state without results", () => {
		const h = view();
		const component = new ToolExecutionComponent("subagent", "single", { agent: "scout", task: "Explore" }, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		expect(h.text()).toContain("pendiente");
		component.updateResult({ content: [], details: {} }, false);
		expect(h.text()).toContain("estado desconocido");
		expect(h.text()).not.toContain("completado");
		h.focus.dispose();
	});
	test("shows planned parallel agents before results without claiming they are running", () => {
		const h = view();
		const component = new ToolExecutionComponent("subagent", "parallel", { workflow: "parallel", args: { tasks: [
			{ agent: "alpha", task: "First task" }, { agent: "beta", task: "Second task" }, { agent: "gamma", task: "Third task" },
		] } }, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		const text = h.text();
		for (const value of ["alpha", "beta", "gamma", "First task", "Second task", "Third task", "pendiente"]) expect(text).toContain(value);
		expect(text).not.toContain("en marcha");
		expect(text).not.toContain("completado");
		h.focus.dispose();
	});
	test("buffers assistant text until settlement, hides thinking and restores the exact native view", () => {
		const h = view();
		const msg = message();
		const before = JSON.stringify(msg);
		Object.freeze(msg.content); Object.freeze(msg);
		const component = assistant(msg);
		h.chat.addChild(component);
		const originalRender = component.render;
		const nativeText = plain(component.render(100));
		h.focus.busy = true;
		expect(h.text()).not.toContain("FINAL_VISIBLE");
		expect(h.text()).not.toContain("THINKING_SECRET");
		h.focus.busy = false;
		expect(h.text()).toContain("FINAL_VISIBLE");
		expect(h.text()).not.toContain("THINKING_SECRET");
		expect(h.text()).not.toContain("Thinking...");
		expect(JSON.stringify(msg)).toBe(before);
		expect(withoutThinking(msg).content).not.toBe(msg.content);
		h.focus.enabled = false;
		expect(plain(component.render(100))).toBe(nativeText);
		h.focus.dispose(); h.focus.dispose();
		expect(component.render).toBe(originalRender);
	});
	test("hides progress text with tool calls, keeps earlier answers and reveals the final question", () => {
		const h = view();
		h.chat.addChild(assistant(message("FIRST_ANSWER")));
		expect(h.text()).toContain("FIRST_ANSWER");
		h.chat.addChild(new UserMessageComponent("SECOND_PROMPT"));
		h.focus.busy = true;
		h.chat.addChild(assistant(message("PROGRESS_TEXT", true)));
		h.chat.addChild(tool("read"));
		h.chat.addChild(assistant(message("¿Qué opción prefieres?")));
		expect(h.text()).toContain("FIRST_ANSWER");
		expect(h.text()).not.toContain("PROGRESS_TEXT");
		expect(h.text()).not.toContain("¿Qué opción prefieres?");
		h.focus.busy = false;
		expect(h.text()).toContain("¿Qué opción prefieres?");
		expect(h.text()).not.toContain("INTERNAL_TOOL_RESULT");
	});
	test("resumed history chooses the last answer per prompt, including text-only intermediate turns", () => {
		const h = view();
		h.chat.addChild(assistant(message("TEXT_ONLY_INTERMEDIATE")));
		h.chat.addChild(assistant(message("PROGRESS_WITH_TOOLS", true)));
		h.chat.addChild(tool("read"));
		h.chat.addChild(assistant(message("FINAL_ONE")));
		h.chat.addChild(new UserMessageComponent("next"));
		h.chat.addChild(assistant(message("FINAL_TWO")));
		expect(h.text()).not.toContain("INTERMEDIATE");
		expect(h.text()).not.toContain("PROGRESS_WITH_TOOLS");
		expect(h.text()).toContain("FINAL_ONE");
		expect(h.text()).toContain("FINAL_TWO");
	});
	test("shows errors, aborts and truncated responses during execution without thinking", () => {
		for (const reason of ["error", "aborted", "length"]) {
			const h = view(); h.focus.busy = true;
			h.chat.addChild(assistant({ ...message("PARTIAL_OUTPUT", false, reason), errorMessage: "IMPORTANT_ERROR" }));
			expect(h.text()).toContain("PARTIAL_OUTPUT");
			expect(h.text()).toContain(reason === "length" ? "truncated" : "IMPORTANT_ERROR");
			expect(h.text()).not.toContain("THINKING_SECRET");
		}
	});
	test("frames failed subagents while preserving native diagnostics and expansion", () => {
		for (const diagnostic of ["OAuth authentication failed", "Invalid tool arguments: missing task"]) {
			const h = view();
			const component = new ToolExecutionComponent("subagent", "failed", { agent: "ox-explore" }, {}, undefined, { requestRender() {} });
			const result = { content: [{ type: "text", text: diagnostic + "\n" + Array.from({ length: 20 }, (_, i) => `detail-${i}`).join("\n") }], details: {}, isError: true };
			component.updateResult(result, false);
			const snapshot = JSON.stringify(result);
			h.chat.addChild(component);
			for (const expanded of [false, true]) {
				component.setExpanded(expanded);
				h.focus.enabled = false;
				const native = plain(component.render(100));
				h.focus.enabled = true;
				const rendered = h.text();
				expect(rendered).toContain("╭─ ✗ ox-explore");
				expect(rendered).toContain(native.trim());
				expect(rendered).toContain(diagnostic);
				for (const line of h.chat.render(100)) expect(visibleWidth(line)).toBeLessThanOrEqual(100);
			}
			expect(JSON.stringify(result)).toBe(snapshot);
			h.focus.dispose();
		}
	});
	test("does not disclose an agent hidden by a custom native failure renderer", () => {
		const h = view();
		const definition = { renderShell: "self", renderCall: () => new Text("NATIVE_CALL", 0, 0),
			renderResult: (_result: unknown, options: { expanded: boolean }) => new Text(options.expanded ? "ERROR_EXPANDED" : "ERROR_COLLAPSED", 0, 0) };
		const component = new ToolExecutionComponent("subagent", "hidden-agent", { agent: "PRIVATE_AGENT" }, {}, definition, { requestRender() {} });
		const result = { content: [{ type: "text", text: "ERROR_BODY" }], details: {}, isError: true };
		component.updateResult(result, false);
		const snapshot = JSON.stringify(result);
		h.chat.addChild(component);
		for (const expanded of [false, true]) {
			component.setExpanded(expanded);
			h.focus.enabled = false;
			const native = plain(component.render(100));
			h.focus.enabled = true;
			const text = h.text();
			expect(text).toContain(native.trim());
			expect(text).toContain(expanded ? "ERROR_EXPANDED" : "ERROR_COLLAPSED");
			expect(text).toContain("subagente");
			expect(text).not.toContain("PRIVATE_AGENT");
		}
		expect(JSON.stringify(result)).toBe(snapshot);
		h.focus.dispose();
	});
	test("hides a quiet shell failure and keeps the ones that need attention", () => {
		const failedShell = (text: string, exitCode = 1) => ({ content: [{ type: "text", text }], details: { exitCode }, isError: true });
		// Sondas normales: grep sin coincidencias, cat de un archivo que no existe.
		expect(seriousToolFailure("bash", failedShell("patches\n=== pkg ===\n"))).toBe(false);
		expect(seriousToolFailure("bash", failedShell(""))).toBe(false);
		expect(seriousToolFailure("bash", failedShell("No such file or directory"))).toBe(false);
		// Fallos que sí piden atención.
		expect(seriousToolFailure("bash", failedShell("bash: foo: command not found"))).toBe(true);
		expect(seriousToolFailure("bash", failedShell(" 8 pass\n 1 fail"))).toBe(true);
		expect(seriousToolFailure("bash", failedShell("error TS2322: Type mismatch"))).toBe(true);
		expect(seriousToolFailure("bash", failedShell("", 127))).toBe(true);
		expect(seriousToolFailure("bash", failedShell("CONFLICT (content): Merge conflict in src/app.ts"))).toBe(true);
		expect(seriousToolFailure("bash", failedShell("! [rejected] main -> main (non-fast-forward)"))).toBe(true);
		// El resto de herramientas conserva el bloque nativo al fallar.
		expect(seriousToolFailure("read", failedShell("ENOENT"))).toBe(true);
		expect(seriousToolFailure("edit", failedShell("no match"))).toBe(true);
		expect(seriousToolFailure("bash", { content: [], details: {}, isError: false })).toBe(false);
	});
	test("drops a failed shell row from the transcript while focus is on", () => {
		const h = view(); h.focus.busy = true;
		const component = new ToolExecutionComponent("bash", "quiet-shell", { command: "cat package.json 2>/dev/null" }, {}, undefined, { requestRender() {} });
		component.updateResult({ content: [{ type: "text", text: "=== pkg ===" }], details: { exitCode: 1 }, isError: true }, false);
		h.chat.addChild(component);
		h.focus.enabled = false;
		expect(h.text()).toContain("=== pkg ===");
		h.focus.enabled = true;
		expect(h.text()).not.toContain("=== pkg ===");
		h.focus.dispose();
	});
	test("keeps tool failures, unknown tools and permission UI visible", () => {
		const h = view(); h.focus.busy = true;
		h.chat.addChild(tool("read", { path: "missing.ts" }, true));
		h.chat.addChild(tool("ask_user", { question: "CHOOSE_OPTION" }));
		h.chat.addChild(tool("contact_supervisor", { reason: "need_decision", message: "DECISION_REQUIRED" }));
		expect(h.text()).toContain("IMPORTANT_TOOL_ERROR");
		expect(h.text()).toContain("CHOOSE_OPTION");
		expect(h.text()).toContain("DECISION_REQUIRED");
		expect(plain(h.tui.render(100))).toContain("EDITOR_AND_PERMISSIONS");
		expect(h.tui.getFocusedComponent()).toBe(h.editor);
	});
	test("shows a skill loading and then its declared name, with its content and history unchanged", () => {
		const h = view(); h.focus.busy = true;
		const args = { path: "/skills/folder-name/SKILL.md" };
		const component = new ToolExecutionComponent("read", "skill-read", args, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		expect(h.text()).toContain("Cargando skill · folder-name");
		expect(h.text()).not.toContain("Skill cargada");
		const result = { content: [{ type: "text", text: "---\nname: declared-skill\ndescription: private\n---\nSKILL_BODY_SECRET" }], isError: false };
		const snapshot = JSON.stringify(result);
		component.updateResult(result, false);
		expect(h.text()).toContain("Skill cargada · declared-skill");
		expect(h.text()).not.toContain("SKILL_BODY_SECRET");
		expect(h.text()).not.toContain("description: private");
		expect(JSON.stringify(result)).toBe(snapshot);
		h.focus.enabled = false;
		component.setExpanded(true);
		expect(h.text()).toContain("SKILL_BODY_SECRET");
	});
	test("skill read errors remain native and never appear as loaded", () => {
		const h = view();
		h.chat.addChild(tool("read", { path: "/skills/missing-skill/SKILL.md" }, true));
		expect(h.text()).toContain("IMPORTANT_TOOL_ERROR");
		expect(h.text()).not.toContain("Skill cargada");
	});
	test("keeps explicit skill invocations compact even when native output is expanded", () => {
		const h = view();
		const invocation = new SkillInvocationMessageComponent({ name: "manual-skill", content: "MANUAL_SKILL_BODY_SECRET" });
		invocation.setExpanded(true);
		h.chat.addChild(invocation);
		h.chat.addChild(assistant());
		expect(h.text()).toContain("Skill cargada · manual-skill");
		expect(h.text()).not.toContain("MANUAL_SKILL_BODY_SECRET");
		expect(h.text()).toContain("FINAL_VISIBLE");
		h.focus.enabled = false;
		expect(h.text()).toContain("MANUAL_SKILL_BODY_SECRET");
	});
	test("shows nested skill reads live and from resumed metadata without showing the parent result", () => {
		const h = view();
		const parent = tool("codemode");
		h.chat.addChild(parent);
		h.focus.nestedStart("codemode-id", "skill-nested", "read", { path: "/skills/nested-skill/SKILL.md" });
		expect(h.text()).toContain("Cargando skill · nested-skill");
		h.focus.nestedEnd("codemode-id", "skill-nested", false);
		expect(h.text()).toContain("Skill cargada · nested-skill");
		expect(h.text()).not.toContain("INTERNAL_TOOL_RESULT");
		h.focus.dispose();
		const restored = new FocusView(h.chat, () => themes.theme);
		parent.updateResult({ content: [{ type: "text", text: "SKILL_BODY_SECRET" }], nestedCalls: { complete: true, calls: [
			{ name: "read", arguments: { path: "/skills/resumed-skill/SKILL.md" }, status: "ok" },
		] } }, false);
		expect(h.text()).toContain("Skill cargada · resumed-skill");
		expect(h.text()).not.toContain("SKILL_BODY_SECRET");
		restored.dispose();
	});
	test("compacts web, memory and subagents, preserving task names and hiding result bodies", () => {
		const h = view();
		h.chat.addChild(tool("web_search", { query: "Pi documentation" }));
		h.chat.addChild(tool("mem_save", { content: "PRIVATE_MEMORY_BODY" }));
		h.chat.addChild(tool("subagent", { agent: "ox-explore", task: "Revisar contrato visual" }));
		h.chat.addChild(custom("subagent-notify", { runs: [{ agent: "ox-explore", status: "completed" }] }));
		expect(h.text()).toContain("Web · Pi documentation");
		expect(h.text()).toContain("Engram · save");
		expect(h.text()).toContain("Revisar contrato visual");
		expect(h.text()).toContain("ox-explore · terminado");
		expect(h.text()).not.toContain("PRIVATE_MEMORY_BODY");
		expect(h.text()).not.toContain("INTERNAL_TOOL_RESULT");
		expect(h.text()).not.toContain("CUSTOM_INTERNAL_BODY");
		for (const width of [8, 24, 80, 160]) for (const line of h.chat.render(width)) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
	});
	test("does not compact failure notifications or supervisor questions", () => {
		const h = view();
		for (const component of [custom("subagent-notify", { runs: [{ agent: "ox-explore", status: "failed" }] }),
			custom("subagent_supervisor_request", { reason: "need_decision" }), custom("subagent_watchdog_warning")]) {
			h.chat.addChild(component);
			expect(h.text()).toContain("CUSTOM_INTERNAL_BODY");
			h.chat.removeChild(component);
		}
	});
	test("shows important nested codemode calls live and from resumed metadata", () => {
		const h = view();
		const parent = tool("codemode");
		h.chat.addChild(parent);
		h.focus.nestedStart("codemode-id", "nested-1", "web_search", { query: "NESTED_WEB_QUERY" });
		expect(h.text()).toContain("NESTED_WEB_QUERY");
		expect(h.text()).not.toContain("INTERNAL_TOOL_RESULT");
		h.focus.nestedEnd("codemode-id", "nested-1", true);
		expect(h.text()).toContain("INTERNAL_TOOL_RESULT");
		h.focus.dispose();
		const again = new FocusView(h.chat, () => themes.theme);
		parent.updateResult({ content: [{ type: "text", text: "BODY" }], nestedCalls: { complete: true, calls: [
			{ name: "mem_search", arguments: { query: "hidden" }, status: "ok" },
		] } }, false);
		expect(h.text()).toContain("Engram · search");
		again.dispose();
	});
	test("preserves native self-rendering tools when disabled and invalidates the answer projection on theme changes", () => {
		const h = view();
		const definition = { renderShell: "self", renderCall: () => new Text("NATIVE_MEMORY_CHROME", 0, 0),
			renderResult: () => new Text("NATIVE_MEMORY_BODY", 0, 0) };
		const memory = new ToolExecutionComponent("mem_context", "mem-call", {}, {}, definition, { requestRender() {} });
		memory.updateResult({ content: [{ type: "text", text: "MODEL_MEMORY_BODY" }], details: {} }, false);
		const answer = assistant();
		h.chat.addChild(memory); h.chat.addChild(answer);
		expect(h.text()).toContain("Engram · context");
		expect(h.text()).not.toContain("NATIVE_MEMORY_BODY");
		h.focus.enabled = false;
		expect(h.text()).toContain("NATIVE_MEMORY_BODY");
		h.focus.enabled = true;
		themes.initTheme("light");
		h.chat.invalidate();
		expect(h.text()).toContain("FINAL_VISIBLE");
		expect(h.text()).not.toContain("THINKING_SECRET");
		themes.initTheme("dark");
	});
	test("fails open for incomplete nested-call records and never hides an unknown nested permission tool", () => {
		for (const nestedCalls of [
			{ complete: false, calls: [] },
			{ complete: true, calls: [{ name: "ask_user", status: "ok" }] },
		]) {
			const h = view();
			const parent = tool("codemode");
			parent.updateResult({ content: [{ type: "text", text: "NESTED_ATTENTION" }], nestedCalls }, false);
			h.chat.addChild(parent);
			expect(h.text()).toContain("NESTED_ATTENTION");
		}
	});
	test("does not alter layout roots or the task sidebar and cleans up after transcript rebuilds", () => {
		const h = native();
		const panel = new TodoPanel(() => themes.theme);
		panel.setState({ version: 1, title: "Plan de trabajo", todos: [{ id: "1", content: "Prueba", status: "pending" }] });
		const sidebar = mountSidebar(h.tui, panel, () => ["SESSION_STATUS_VISIBLE"]);
		expect(findChat(h.tui)).toBe(h.chat);
		const focus = new FocusView(h.chat, () => themes.theme);
		const answer = assistant();
		const original = answer.render;
		h.chat.addChild(answer);
		expect(plain(h.tui.render(160))).toContain("SESSION_STATUS_VISIBLE");
		expect(panel.state.todos[0].content).toBe("Prueba");
		expect(plain(h.tui.render(160))).toContain("FINAL_VISIBLE");
		h.chat.clear(); h.chat.render(100);
		expect(answer.render).toBe(original);
		expect(h.tui.getFocusedComponent()).toBe(h.editor);
		focus.dispose(); sidebar.dispose();
	});
	test("fails open for unknown native layouts", () => {
		const tui = new TuiMainScreen({ columns: 100, rows: 30, write() {} } as any);
		tui.addChild(new Text("UNKNOWN_LAYOUT"));
		expect(findChat(tui)).toBeUndefined();
	});
});

describe("preferences and lifecycle", () => {
	test("defaults on and persists an explicit preference atomically", () => withTemp((path, folder) => {
		expect(loadPreference(path).enabled).toBe(true);
		savePreference(path, false);
		expect(loadPreference(path)).toEqual({ enabled: false });
		expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ version: 1, enabled: false });
		writeFileSync(path, "invalid");
		expect(loadPreference(path).warning).toBeTruthy();
		savePreference(path, true);
		expect(loadPreference(path)).toEqual({ enabled: true });
	}));
	test("commands toggle, report status and remember the choice after reload", () => withTemp(async path => {
		const h = harness(path);
		await h.emit("session_start");
		h.chat.addChild(assistant());
		expect(plain(h.chat.render(100))).not.toContain("THINKING_SECRET");
		await h.command("off");
		expect(plain(h.chat.render(100))).toContain("THINKING_SECRET");
		await h.emit("session_shutdown");
		await h.emit("session_start");
		expect(plain(h.chat.render(100))).toContain("THINKING_SECRET");
		await h.command("");
		expect(loadPreference(path).enabled).toBe(true);
		await h.command("status");
		expect(h.notices.at(-1)?.text).toContain("Focus activo");
		await h.command("invalid");
		expect(h.notices.at(-1)?.text).toContain("Uso:");
		expect(h.commands.get("focus").getArgumentCompletions("o")).toHaveLength(2);
	}));
	test("keeps an enabled preference after reload without stacking render wrappers", () => withTemp(async path => {
		const h = harness(path); await h.emit("session_start");
		h.chat.addChild(assistant());
		for (let index = 0; index < 3; index++) {
			await h.command("on");
			await h.emit("session_shutdown");
			await h.emit("session_start");
			expect(plain(h.chat.render(100))).toContain("FINAL_VISIBLE");
			expect(plain(h.chat.render(100))).not.toContain("THINKING_SECRET");
		}
		await h.emit("session_shutdown");
		expect(plain(h.chat.render(100))).toContain("THINKING_SECRET");
	}));
	test("waits for agent_settled rather than agent_end and registers no data transformers", () => withTemp(async path => {
		const h = harness(path); await h.emit("session_start");
		await h.emit("before_agent_start");
		h.chat.addChild(assistant());
		await h.emit("agent_end");
		expect(plain(h.chat.render(100))).not.toContain("FINAL_VISIBLE");
		await h.emit("agent_settled");
		expect(plain(h.chat.render(100))).toContain("FINAL_VISIBLE");
		for (const forbidden of ["context", "context_with_system", "message_end", "tool_result", "before_provider_request", "tool_call"]) expect(h.handlers.has(forbidden)).toBe(false);
	}));
	test("a failed preference write does not change the active view", () => withTemp(async (_path, folder) => {
		const path = join(folder, "not-a-directory", "focus.json");
		writeFileSync(join(folder, "not-a-directory"), "file");
		const h = harness(path); await h.emit("session_start");
		await h.command("off");
		expect(h.notices.at(-1)?.level).toBe("error");
		h.chat.addChild(assistant());
		expect(plain(h.chat.render(100))).not.toContain("THINKING_SECRET");
	}));
	test("RPC, JSON and print never install a view or change preferences", () => withTemp(async path => {
		for (const mode of ["rpc", "json", "print"]) {
			const h = harness(path, mode); await h.emit("session_start");
			await h.command("off");
			expect(loadPreference(path).enabled).toBe(true);
			h.chat.addChild(assistant());
			expect(plain(h.chat.render(100))).toContain("THINKING_SECRET");
		}
	}));
});

describe("subagent cards", () => {
	const runDir = (status: unknown) => {
		const folder = mkdtempSync(join(tmpdir(), "focus-run-"));
		writeFileSync(join(folder, "status.json"), JSON.stringify(status));
		return folder;
	};
	const running = {
		state: "running", startedAt: 1_000, lastUpdate: 5_400,
		steps: [{
			agent: "ox-researcher", status: "running", model: "opencode-go/gpt-5.6-luna", thinking: "high",
			description: "Buscar la versión publicada", startedAt: 1_000,
			tokens: { window: 11_141, output: 3_489 }, totalCost: { costUsd: 0.00267 }, toolCount: 8,
			recentTools: [{ tool: "fetch_content", args: "https://registry.npmjs.org/pkg" }],
		}],
	};
	const launch = { agent: "ox-researcher", task: "Buscar la versión publicada" };
	const render = (folder: string | undefined, input: unknown = launch, width = 110, now = 5_400) =>
		plain(subagentCards(input, { content: [{ type: "text", text: "RUN_BODY_SECRET" }], details: folder ? { asyncId: "run-1", asyncDir: folder } : {} },
			width, themes.theme, { now }).lines);

	test("known agents have stable distinct Gentleman-Sexy colors and unknown agents remain deterministic", () => {
		const names = ["ox-code-auditor", "ox-committer", "ox-explore", "ox-researcher", "ox-spec-auditor", "ox-spec-exec", "ox-spec-fix"];
		const colors = { ...themes.theme.colors, accent: "#F43888", toolDiffAdded: "#A9C7EE", mdLink: "#FF4F9A", syntaxType: "#A9C7EE", customMessageLabel: "#E0C27A", syntaxFunction: "#C49BFF", syntaxNumber: "#D7A0B8", warning: "#F2B86D", error: "#FF718F" };
		const theme = { colors } as any;
		const chosen = names.map(name => agentColor(name, theme));
		expect(new Set(chosen).size).toBe(7);
		for (const name of [...names, "unknown-agent"]) expect(agentColor(name, theme)).toEqual(agentColor(name, theme));
		expect(Object.values(colors)).toContain(agentColor("unknown-agent", theme));
	});
	test("gives each agent a stable color of its own", () => {
		const scout = agentColor("ox-explore", themes.theme);
		expect(agentColor("ox-explore", themes.theme)).toEqual(scout);
		expect(agentColor("ox-researcher", themes.theme)).not.toEqual(scout);
	});
	test("uses exact theme colors instead of interpolated agent shades", () => {
		expect(agentColor("ox-explore", themes.theme)).toEqual(themes.theme.colors.toolDiffAdded);
		expect(agentColor("ox-researcher", themes.theme)).toEqual(themes.theme.colors.mdLink);
		const colors = Object.values(themes.theme.colors);
		for (const name of ["custom-a", "custom-b", "custom-c"]) expect(colors).toContainEqual(agentColor(name, themes.theme));
	});
	test("frames each agent with its title in the top border", () => {
		const lines = subagentCards(launch, {}, 80, themes.theme).lines;
		const card = lines.filter(line => line.length > 0).map(line => plain([line]));
		expect(card[0]).toStartWith("╭─ ");
		expect(card[0]).toContain("ox-researcher");
		expect(card[0]).toEndWith("╮");
		expect(card.at(-1)).toStartWith("╰");
		expect(card.at(-1)).toEndWith("╯");
		for (const line of card) expect(visibleWidth(line)).toBe(80);
	});
	test("shows state, elapsed time, model, tokens, cost and the page being read", () => {
		const text = render(runDir(running));
		for (const expected of ["ox-researcher", "en marcha", "4s", "gpt-5.6-luna", "high", "ctx 11.1k", "out 3.5k", "$0.0027", "8 tools",
			"fetch_content", "https://registry.npmjs.org/pkg", "Buscar la versión publicada"]) expect(text).toContain(expected);
		expect(text).not.toContain("RUN_BODY_SECRET");
	});
	test("draws the context bar only with a valid per-step limit", () => {
		const folder = runDir({ state: "complete", totalTokens: { window: 500 }, steps: [
			{ agent: "a", status: "complete", tokens: { window: 250 }, contextLimit: 1000 },
			{ agent: "b", status: "complete", tokens: { window: 0 }, contextLimit: 1000 },
			{ agent: "c", status: "complete", contextLimit: 1000 },
			{ agent: "d", status: "complete", tokens: { window: 250 }, contextLimit: 0 },
			{ agent: "e", status: "complete", tokens: { window: 4 }, contextLimit: 1000 },
		] });
		const cards = render(folder, {}, 110).split("╭─ ").slice(1);
		expect(cards[0]).toContain("ctx ▮▮▯▯▯▯▯▯ 25%");
		expect(cards[1]).toContain("ctx ▯▯▯▯▯▯▯▯ 0%");
		expect(cards[2]).toContain("ctx % desconocido");
		expect(cards[3]).toContain("ctx 250 (% desconocido)");
		expect(cards[4]).toContain("ctx ▮▯▯▯▯▯▯▯ <1%");
	});
	test("reports per-step duration and explicit zero cost without inventing missing values", () => {
		const folder = runDir({ state: "complete", startedAt: 1000, endedAt: 9000, steps: [
			{ agent: "ox-explore", status: "complete", durationMs: 2000, totalCost: { costUsd: 0 } },
			{ agent: "ox-researcher", status: "complete" },
		] });
		const cards = plain(subagentCards({}, { details: { asyncDir: folder } }, 110, themes.theme, { now: 50000 }).lines);
		const [first, second] = cards.split("╭─ ").slice(1);
		expect(first).toContain("2s");
		expect(first).toContain("$0");
		expect(second).not.toContain("8s");
		expect(second).not.toContain("$0");
	});
	test("marks a finished run and reports the run duration instead of the clock", () => {
		const folder = runDir({ ...running, state: "complete", steps: [{ ...running.steps[0], status: "complete", endedAt: 61_000 }] });
		const card = subagentCards(launch, { details: { asyncId: "run-1", asyncDir: folder } }, 110, themes.theme, { now: 999_000 });
		expect(card.running).toBe(false);
		expect(plain(card.lines)).toContain("completado");
		expect(plain(card.lines)).toContain("1m00s");
	});
	test("keeps memory bodies and shell arguments off the card", () => {
		const folder = runDir({ ...running, steps: [{ ...running.steps[0], recentTools: [{ tool: "mem_save", args: "PRIVATE_MEMORY_BODY" }] }] });
		const memory = render(folder);
		expect(memory).toContain("mem_save");
		expect(memory).not.toContain("PRIVATE_MEMORY_BODY");
		const shell = render(runDir({ ...running, steps: [{ ...running.steps[0], recentTools: [{ tool: "bash", args: "TOKEN=secret npm publish" }] }] }));
		expect(shell).toContain("bash");
		expect(shell).not.toContain("secret");
	});
	test("fits every card line to the width and keeps narrow widths legible", () => {
		const folder = runDir(running);
		for (const width of [8, 12, 24, 40, 80, 160]) {
			const lines = subagentCards(launch, { details: { asyncId: "run-1", asyncDir: folder } }, width, themes.theme, { now: 5_400 }).lines;
			for (const line of lines) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
			expect(plain(lines)).toContain(width >= 24 ? "ox-researcher" : "ox-");
		}
	});
	test("prefers the launch task over the redacted status description", () => {
		const redacted = runDir({ ...running, steps: [{ ...running.steps[0], description: "[prompt redacted]" }] });
		const text = render(redacted, { agent: "ox-researcher", task: "Tarea real del encargo" });
		expect(text).toContain("Tarea real del encargo");
		expect(text).not.toContain("[prompt redacted]");
		expect(render(redacted, { agent: "ox-researcher" })).not.toContain("[prompt redacted]");
	});
	test("takes each parallel task from the launch arguments", () => {
		const folder = runDir({ ...running, steps: [
			{ ...running.steps[0], agent: "ox-explore", description: "[prompt redacted]" },
			{ ...running.steps[0], agent: "ox-researcher", description: "[prompt redacted]" },
		] });
		const text = render(folder, { workflow: "parallel", tasks: [{ agent: "ox-explore", task: "Explorar el código" }, { agent: "ox-researcher", task: "Buscar la versión" }] });
		expect(text).toContain("Explorar el código");
		expect(text).toContain("Buscar la versión");
		expect(text).not.toContain("[prompt redacted]");
	});
	test("shows the agent and task before the run writes its status file", () => {
		const text = render(undefined);
		expect(text).toContain("ox-researcher");
		expect(text).toContain("Buscar la versión publicada");
		expect(text).toContain("pendiente");
	});
	test("uses foreground results when the run did not detach", () => {
		const text = plain(subagentCards({ agent: "ox-explore", task: "Explorar" }, { details: { results: [{
			agent: "ox-explore", task: "Explorar", status: "completed", exitCode: 0, model: "opencode-go/mimo-v2.6-flash",
			usage: { window: 2_000, output: 100, cost: { total: 0.01 } }, toolCalls: [{ name: "read", args: "/repo/src/file.ts" }],
		}] } }, 110, themes.theme).lines);
		for (const expected of ["ox-explore", "completado", "mimo-v2.6-flash", "ctx 2k", "$0.010", "read", "/repo/src/file.ts"]) expect(text).toContain(expected);
	});
	test("renders the card inside the transcript and still hides the run body", () => {
		const h = view();
		const component = new ToolExecutionComponent("subagent", "subagent-id", launch, {}, undefined, { requestRender() {} });
		h.chat.addChild(component);
		component.updateResult({ content: [{ type: "text", text: "RUN_BODY_SECRET" }], details: { asyncId: "run-1", asyncDir: runDir(running) } }, false);
		expect(h.text()).toContain("ox-researcher");
		expect(h.text()).not.toContain("RUN_BODY_SECRET");
		expect(h.text()).not.toContain("Subagentes");
		h.focus.enabled = false;
		expect(h.text()).toContain("RUN_BODY_SECRET");
	});
});
