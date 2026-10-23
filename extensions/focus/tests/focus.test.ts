import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container, Text, TuiMainScreen, visibleWidth } from "@earendil-works/pi-tui";
import { FocusView, findChat } from "../view.ts";
import { activityLabel, cleanLine, customActivity, toolHasError, toolPolicy, withoutThinking } from "../policy.ts";
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
	test("sanitizes summary text and supports batched web requests", () => {
		expect(cleanLine("hola\x1b[2J\r\n\u202emundo")).toBe("hola mundo");
		expect(activityLabel("web", "web_search", { queries: ["Pi docs", "second"] })).toBe("Web · Pi docs");
		expect(activityLabel("web", "fetch_content", { urls: ["https://example.test"] })).toContain("https://example.test");
		expect(activityLabel("memory", "mem_save", { content: "PRIVATE_MEMORY_BODY" })).not.toContain("PRIVATE_MEMORY_BODY");
	});
	test("compacts only known successful custom notifications", () => {
		expect(customActivity({ customType: "subagent-notify", details: { runs: [{ agent: "ox-scout", status: "completed" }] } })).toContain("ox-scout");
		for (const status of ["failed", "paused", "stopped"]) expect(customActivity({ customType: "subagent-notify", details: { runs: [{ agent: "ox-scout", status }] } })).toBeUndefined();
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
	test("keeps tool failures, unknown tools and permission UI visible", () => {
		const h = view(); h.focus.busy = true;
		h.chat.addChild(tool("bash", {}, true));
		h.chat.addChild(tool("ask_user", { question: "CHOOSE_OPTION" }));
		h.chat.addChild(tool("contact_supervisor", { reason: "need_decision", message: "DECISION_REQUIRED" }));
		expect(h.text()).toContain("IMPORTANT_TOOL_ERROR");
		expect(h.text()).toContain("CHOOSE_OPTION");
		expect(h.text()).toContain("DECISION_REQUIRED");
		expect(plain(h.tui.render(100))).toContain("EDITOR_AND_PERMISSIONS");
		expect(h.tui.getFocusedComponent()).toBe(h.editor);
	});
	test("compacts web, memory and subagents, preserving task names and hiding result bodies", () => {
		const h = view();
		h.chat.addChild(tool("web_search", { query: "Pi documentation" }));
		h.chat.addChild(tool("mem_save", { content: "PRIVATE_MEMORY_BODY" }));
		h.chat.addChild(tool("subagent", { agent: "ox-scout", task: "Revisar contrato visual" }));
		h.chat.addChild(custom("subagent-notify", { runs: [{ agent: "ox-scout", status: "completed" }] }));
		expect(h.text()).toContain("Web · Pi documentation");
		expect(h.text()).toContain("Engram · save");
		expect(h.text()).toContain("Revisar contrato visual");
		expect(h.text()).toContain("ox-scout · terminado");
		expect(h.text()).not.toContain("PRIVATE_MEMORY_BODY");
		expect(h.text()).not.toContain("INTERNAL_TOOL_RESULT");
		expect(h.text()).not.toContain("CUSTOM_INTERNAL_BODY");
		for (const width of [8, 24, 80, 160]) for (const line of h.chat.render(width)) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
	});
	test("does not compact failure notifications or supervisor questions", () => {
		const h = view();
		for (const component of [custom("subagent-notify", { runs: [{ agent: "ox-scout", status: "failed" }] }),
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
		const sidebar = mountSidebar(h.tui, panel);
		expect(findChat(h.tui)).toBe(h.chat);
		const focus = new FocusView(h.chat, () => themes.theme);
		const answer = assistant();
		const original = answer.render;
		h.chat.addChild(answer);
		expect(plain(h.tui.render(160))).toContain("TAREAS");
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
