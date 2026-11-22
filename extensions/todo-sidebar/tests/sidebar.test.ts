import { describe, expect, test } from "bun:test";
import { Container, CURSOR_MARKER, ScrollView, Text, TuiAltScreen, TuiMainScreen, VStack, visibleWidth } from "@earendil-works/pi-tui";
import { AgentRegistry, detailsRows, launchRows, notifyRows, phaseOf } from "../agents.ts";
import { ENTRY_TYPE, emptyState, mountSidebar, parseState, restoreState, sidebarWidth, Sidebar, TodoPanel } from "../core.ts";
import extension from "../index.ts";
import type { AgentRow, AgentSnapshot } from "../agents.ts";
import type { TodoState } from "../core.ts";

const globalModules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const { loadThemeFromPath } = await import(`${globalModules}/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js`);
const { renderLayoutFrame, getScrollViewsAt } = await import(`${globalModules}/@earendil-works/pi-tui/dist/layout.js`);
const theme = loadThemeFromPath(new URL("../../../themes/tokyo-night.json", import.meta.url).pathname, "truecolor");
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;\x07/g, "");
const NOW = 1_600_000;

const state = (statuses = ["completed", "in_progress", "pending"]) => parseState({
	version: 1, title: "Construir sidebar", todos: statuses.map((status, index) => ({ id: String(index), content: ["Leer contratos", "Implementar panel", "Probar redimensionado"][index] ?? `Tarea ${index}`, status })),
});

const row = (over: Partial<AgentRow>): AgentRow => ({ key: over.key ?? over.agent ?? "row", agent: "ox-explore", phase: "working", startedAt: NOW - 72_000, ...over });
const snapshot = (active: AgentRow[] = [], recent: AgentRow[] = []): AgentSnapshot => ({ active, recent, now: NOW });

function nativeTui(columns = 160, rows = 35) {
	const terminal = { columns, rows, write() {} };
	const tui = new TuiMainScreen(terminal as any);
	tui.requestRender = () => {};
	const document = new Container();
	document.addChild(new Text("Pi header\nChat", 0, 0));
	const editor = new Text(`Editor ${CURSOR_MARKER}`, 0, 0);
	const footer = new Text("native footer · herdr unaffected", 0, 0);
	tui.addChild(document); tui.addChild(editor); tui.addChild(footer);
	tui.setFocus(editor);
	return { tui, terminal, document, editor, footer };
}

function harness(mode = "tui", fullscreen = false) {
	const handlers = new Map<string, Function[]>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const shortcuts = new Map<string, any>();
	const entries: any[] = [];
	const native = nativeTui();
	if (fullscreen) {
		const tui = new TuiAltScreen(native.terminal as any);
		tui.requestRender = () => {};
		tui.setLayoutRoot(new VStack([new Text("Chat", 0, 0)]));
		native.tui = tui as any;
	}
	let widget: any;
	let footer: any;
	const pi = {
		on(name: string, handler: Function) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
		registerTool(tool: any) { tools.set(tool.name, tool); },
		registerCommand(name: string, command: any) { commands.set(name, command); },
		registerShortcut(key: string, shortcut: any) { shortcuts.set(key, shortcut); },
		getThinkingLevel: () => "high",
		appendEntry(customType: string, data: unknown) { entries.push({ type: "custom", customType, data: structuredClone(data) }); },
	};
	const ctx = {
		mode, hasUI: mode === "tui", cwd: "/home/test", getContextUsage: () => ({ percent: 20, contextWindow: 100000 }),
		model: { provider: "test", id: "model", reasoning: true }, sessionManager: { getBranch: () => entries, getEntries: () => entries },
		ui: {
			theme,
			setFooter(factory: Function) { footer = factory(native.tui, theme, { getGitBranch: () => "main", getExtensionStatuses: () => new Map(), onBranchChange: () => () => {} }); },
			setWidget(_key: string, factory: Function) { widget?.dispose(); widget = factory(native.tui, theme); },
			confirm: async () => true, notify() {},
		},
	};
	extension(pi as any);
	const emit = async (name: string, event: any = {}) => {
		let result: any;
		for (const handler of handlers.get(name) ?? []) result = await handler(event, ctx);
		return result;
	};
	return { ...native, tools, commands, shortcuts, entries, ctx, pi, emit, widget: () => widget, footer: () => footer };
}

function sidebarFor(todos: TodoState, agents: AgentSnapshot, rows = 30) {
	const tasks = new TodoPanel(() => theme);
	tasks.setState(todos);
	const tui = { terminal: { rows, columns: 160 }, mode: "regular", requestRender() {} };
	const panel = new Sidebar(tui as any, tasks, () => agents, () => theme);
	return { tasks, panel };
}

describe("state", () => {
	test("validates ids, status, sizes and terminal controls", () => {
		expect(() => parseState({ ...state(), todos: [{ id: "x", content: "a", status: "done" }] })).toThrow();
		expect(() => parseState({ ...state(), todos: [state().todos[0], state().todos[0]] })).toThrow();
		expect(() => parseState({ ...state(), todos: Array(81).fill(state().todos[0]) })).toThrow();
		expect(() => parseState({ ...state(), title: "\n\t" })).toThrow();
		const cleaned = parseState({ version: 1, title: "  Plan\n ", todos: [{ id: "1", content: "hola\u001b[2J\n\u202emundo", status: "pending" }] });
		expect(cleaned.title).toBe("Plan");
		expect(cleaned.todos[0].content).not.toMatch(/[\p{Cc}\p{Cf}]/u);
	});
	test("restores only latest valid snapshot on the supplied branch", () => {
		const first = { type: "custom", customType: ENTRY_TYPE, data: state(["pending"]) };
		const last = { type: "custom", customType: ENTRY_TYPE, data: state(["completed"]) };
		expect(restoreState([first, last]).todos[0].status).toBe("completed");
		expect(restoreState([first]).todos[0].status).toBe("pending");
		expect(restoreState([first, { ...last, data: { broken: true } }])).toEqual(first.data);
		expect(restoreState([])).toEqual(emptyState());
	});
});

describe("agent feed", () => {
	test("builds optimistic rows and ignores management calls", () => {
		expect(launchRows({ agent: "ox-explore", task: "mapa" }, "c1", NOW)).toEqual([{ key: "tool:c1:0", agent: "ox-explore", phase: "queued", startedAt: NOW, task: "mapa" }]);
		expect(launchRows({ tasks: [{ agent: "a" }, { agent: "b" }] }, "c2", NOW).map(item => item.agent)).toEqual(["a", "b"]);
		expect(launchRows({ chain: [{ agent: "a" }, { parallel: [{ agent: "b" }, { agent: "c" }] }] }, "c3", NOW).map(item => item.agent)).toEqual(["a", "b", "c"]);
		expect(launchRows({ workflow: true }, "c4", NOW).map(item => item.agent)).toEqual(["workflow"]);
		expect(launchRows({ action: "status" }, "c5", NOW)).toEqual([]);
		expect(launchRows({ action: "stop", id: "x" }, "c6", NOW)).toEqual([]);
	});
	test("reads live progress without inventing success from placeholder exit codes", () => {
		const live = detailsRows({ mode: "single", results: [{ agent: "ox-explore", index: 0, exitCode: 0, progress: { status: "running", durationMs: 5000 } }] }, { toolCallId: "c1", final: false, now: NOW });
		expect(live[0].phase).toBe("working");
		const final = detailsRows({ mode: "single", results: [{ agent: "ox-explore", index: 0, exitCode: 0 }] }, { toolCallId: "c1", final: true, now: NOW });
		expect(final[0].phase).toBe("done");
		expect(detailsRows({ mode: "single", results: [{ agent: "a", index: 0, exitCode: 1 }] }, { final: true, now: NOW })[0].phase).toBe("failed");
		expect(detailsRows({ mode: "single", results: [{ agent: "a", index: 0, exitCode: 0, detached: true }] }, { final: true, now: NOW })[0].phase).toBe("working");
		expect(detailsRows({ mode: "management", results: [] }, { final: true, now: NOW })).toEqual([]);
		expect(phaseOf("paused")).toBe("paused");
		expect(phaseOf("blocked")).toBe("failed");
	});
	test("correlates completion by run id and never downgrades a terminal row", () => {
		const registry = new AgentRegistry();
		registry.merge(launchRows({ agent: "ox-explore", task: "mapa" }, "c1", NOW));
		registry.observe({ mode: "single", runId: "run-1", results: [] }, { toolCallId: "c1", final: true, now: NOW + 1000 });
		expect(registry.snapshot(NOW + 1000).active[0]).toMatchObject({ agent: "ox-explore", phase: "working", runId: "run-1" });
		registry.notify({ details: { runs: [{ agent: "ox-explore", status: "completed", runId: "run-1", durationMs: 60_000 }] } }, NOW + 60_000);
		expect(registry.snapshot(NOW + 60_000).active).toEqual([]);
		expect(registry.snapshot(NOW + 60_000).recent[0]).toMatchObject({ agent: "ox-explore", phase: "done", durationMs: 60_000 });
		registry.observe({ mode: "single", runId: "run-1", results: [{ agent: "ox-explore", index: 0, progress: { status: "running" } }] }, { toolCallId: "c1", final: false, now: NOW + 61_000 });
		expect(registry.snapshot(NOW + 61_000).active).toEqual([]);
	});
	test("replaces a workflow parent with its children", () => {
		const registry = new AgentRegistry();
		registry.merge(launchRows({ workflow: true }, "c1", NOW));
		registry.observe({ mode: "workflow", runId: "w1", results: [] }, { toolCallId: "c1", final: true, now: NOW + 1000 });
		registry.notify({ details: { runs: [{ agent: "workflow", runId: "w1", status: "completed", durationMs: 5000, childRuns: [
			{ agent: "ox-spec-auditor", runId: "k1", status: "completed" },
			{ agent: "ox-code-auditor", runId: "k2", status: "failed" },
		] }] } }, NOW + 6000);
		expect(registry.snapshot(NOW + 6000).active).toEqual([]);
		expect(registry.snapshot(NOW + 6000).recent.map(item => [item.agent, item.phase])).toEqual([["ox-spec-auditor", "done"], ["ox-code-auditor", "failed"]]);
	});
	test("marks a decision request as waiting until it is answered", () => {
		const registry = new AgentRegistry();
		registry.merge(launchRows({ agent: "ox-researcher" }, "c1", NOW));
		registry.waiting({ runId: "r1", requestId: "req-1", agent: "ox-researcher", reason: "need_decision" });
		expect(registry.snapshot(NOW).active[0]).toMatchObject({ agent: "ox-researcher", phase: "waiting", runId: "r1" });
		registry.answered("req-1");
		expect(registry.snapshot(NOW).active[0].phase).toBe("working");
		registry.notify({ details: { runs: [{ agent: "ox-researcher", runId: "r1", status: "completed", durationMs: 1000 }] } }, NOW + 2000);
		registry.waiting({ runId: "r1", requestId: "req-2", agent: "ox-researcher" });
		expect(registry.snapshot(NOW + 3000).recent[0].phase).toBe("done");
	});
	test("orders attention first and keeps only the latest finished rows", () => {
		const registry = new AgentRegistry();
		registry.merge([
			row({ key: "w", agent: "working", phase: "working" }),
			row({ key: "q", agent: "queued", phase: "queued" }),
			row({ key: "a", agent: "asking", phase: "waiting" }),
		]);
		expect(registry.snapshot(NOW).active.map(item => item.agent)).toEqual(["asking", "working", "queued"]);
		for (let index = 0; index < 6; index++) {
			registry.merge([row({ key: `d${index}`, agent: `done-${index}`, phase: "done", endedAt: NOW + index * 1000 })]);
		}
		expect(registry.snapshot(NOW).recent).toHaveLength(3);
		expect(registry.snapshot(NOW).recent.map(item => item.agent)).toEqual(["done-5", "done-4", "done-3"]);
		registry.clearTerminal();
		expect(registry.snapshot(NOW).recent).toEqual([]);
	});
	test("rebuilds the roster from tool results and completion messages", () => {
		const entries = [
			{ type: "message", timestamp: 5000, message: { role: "toolResult", toolName: "subagent", toolCallId: "c1", details: { mode: "single", runId: "r1", results: [{ agent: "ox-explore", index: 0, exitCode: 0, task: "mapa" }] } } },
			{ type: "message", timestamp: 6000, message: { role: "toolResult", toolName: "subagent", isError: true, details: { mode: "single", results: [{ agent: "broken" }] } } },
			{ type: "custom_message", customType: "subagent-notify", timestamp: 9000, details: { runs: [{ agent: "ox-committer", runId: "r2", status: "completed", durationMs: 7000 }] } },
		];
		const registry = new AgentRegistry();
		registry.restore(entries, 10_000);
		expect(registry.snapshot(10_000).recent.map(item => item.agent)).toEqual(["ox-committer", "ox-explore"]);
		expect(registry.snapshot(10_000).recent.find(item => item.agent === "ox-explore")).toMatchObject({ phase: "done", endedAt: 5000 });
	});
	test("notifyRows expands child runs and keeps duration", () => {
		const result = notifyRows({ details: { runs: [{ agent: "workflow", runId: "w", status: "failed", durationMs: 5000, childRuns: [{ agent: "ox-spec-auditor", runId: "k1", status: "completed" }] }] } }, NOW);
		expect(result.parentRunId).toBe("w");
		expect(result.rows[0]).toMatchObject({ agent: "ox-spec-auditor", phase: "done", durationMs: 5000, endedAt: NOW });
	});
});

describe("sidebar sections", () => {
	test("paints AGENTS above PLAN in compact boxes", () => {
		const { panel } = sidebarFor(state(), snapshot(
			[row({ key: "a", agent: "ox-explore", phase: "working", startedAt: NOW - 72_000 }), row({ key: "b", agent: "ox-spec-fix", phase: "waiting", startedAt: NOW - 38_000 })],
			[row({ key: "c", agent: "ox-committer", phase: "done", startedAt: NOW - 200_000, endedAt: NOW - 66_000 })],
		));
		const raw = panel.renderHeight(40, 30).join("\n");
		const lines = raw.split("\n").map(plain);
		const text = lines.join("\n");
		expect(text).toContain("AGENTS");
		expect(text).toContain("PLAN");
		expect(text).toContain("2 activos");
		expect(text.indexOf("AGENTS")).toBeLessThan(text.indexOf("PLAN"));
		expect(text).toContain("ox-explore");
		expect(text).toContain("ox-spec-fix");
		expect(text).toContain("ox-committer");
		expect(text).toContain("1m12s");
		expect(text).toContain("◆");
		expect(text).toContain("✓");
		expect(text).toContain("1/3");
		const agentsTop = lines.find(line => line.includes("▾ AGENTS"))!;
		const planTop = lines.find(line => line.includes("▾ PLAN"))!;
		expect(agentsTop.startsWith("╭─ ")).toBe(true);
		expect(agentsTop.endsWith("╮")).toBe(true);
		expect(planTop.startsWith("╭─ ")).toBe(true);
		expect(planTop.endsWith("╮")).toBe(true);
		expect(raw).toContain(theme.fg("border", "╭─ "));
		expect(raw).toContain(theme.bold(theme.fg("text", "▾ AGENTS")));
		expect(raw).toContain(theme.fg("muted", "2 activos"));
		expect(text).not.toContain("Proveedor");
		expect(text).not.toContain("Vacío por el momento");
		expect(text).not.toContain("Plan de trabajo");
		expect(lines.filter(line => line.includes("╭"))).toHaveLength(2);
		expect(lines.filter(line => line.includes("╰"))).toHaveLength(2);
		expect(lines).toHaveLength(30);
	});
	test("shows empty states and caps the visible agents", () => {
		const empty = sidebarFor(emptyState(), snapshot()).panel.renderHeight(40, 30).map(plain).join("\n");
		expect(empty).toContain("ninguno activo · /agents");
		expect(empty).toContain("sin tareas · /todos");
		expect(empty).toContain("idle");
		const many = sidebarFor(state(), snapshot(Array.from({ length: 11 }, (_, index) => row({ key: `a${index}`, agent: `agente-${index}` }))));
		const lines = many.panel.renderHeight(40, 30).map(plain);
		expect(lines.join("\n")).toContain("11 activos");
		expect(lines.join("\n")).toContain("agente-7");
		expect(lines.join("\n")).not.toContain("agente-8");
		expect(lines.join("\n")).toContain("+3 más · /agents");
	});
	test("fits every supported width with wide characters and long names", () => {
		const todos = parseState({ version: 1, title: "Pruebas", todos: [{ id: "1", content: "日本語 🧠 café 中文 ".repeat(6), status: "in_progress" }] });
		const agents = snapshot([row({ key: "a", agent: "ox-spec-auditor-con-un-nombre-larguisimo", phase: "working" })], [row({ key: "b", agent: "ox-committer", phase: "done", endedAt: NOW - 1000 })]);
		const { panel } = sidebarFor(todos, agents);
		for (let width = 30; width <= 56; width++) {
			for (const line of panel.renderHeight(width, 20)) expect(visibleWidth(line)).toBe(width);
		}
	});
	test("grows with the plan and collapses finished rows when it no longer fits", () => {
		const small = sidebarFor(state(), snapshot(), 30).panel.renderHeight(40, 30).map(plain).join("\n");
		expect(small).toContain("Leer contratos");
		expect(small).toContain("Implementar panel");
		expect(small).toContain("Probar redimensionado");
		expect(small).not.toContain("· /todos");
		expect(small).not.toContain("más · /todos");

		const grown = sidebarFor(state(Array(12).fill("pending")), snapshot(), 30).panel.renderHeight(40, 30).map(plain).join("\n");
		expect(grown).toContain("Tarea 11");
		expect(grown).not.toContain("más · /todos");
		expect(grown.split("\n").filter(line => line.includes("╰"))).toHaveLength(2);

		const crowd = state(Array(40).fill("pending"));
		crowd.todos[0].status = "completed";
		crowd.todos[1].status = "completed";
		const cramped = sidebarFor(crowd, snapshot(), 20);
		const capped = cramped.panel.renderHeight(40, 20).map(plain).join("\n");
		expect(capped).toContain("✓ 2 · /todos");
		expect(capped).toContain("más · /todos");
		for (const line of cramped.panel.renderHeight(40, 20)) expect(visibleWidth(line)).toBe(40);
	});
	test("keeps the in-progress task visible when the plan overflows", () => {
		const tasks = new TodoPanel(() => theme);
		const data = state(Array(40).fill("pending"));
		data.todos[38].status = "in_progress";
		tasks.setState(data);
		const rows = tasks.render(46, 10).map(plain);
		expect(rows).toHaveLength(10);
		expect(rows.join("\n")).toContain("Tarea 38");
		expect(rows.join("\n")).toContain("●");
		expect(rows.join("\n")).toContain("más · /todos");
	});
	test("shows the active row at one-line capacity and summarizes only finished work", () => {
		const active = new TodoPanel(() => theme);
		const data = state(Array(5).fill("pending"));
		data.todos[4].status = "in_progress";
		active.setState(data);
		const one = active.render(46, 1).map(plain);
		expect(one).toHaveLength(1);
		expect(one[0]).toContain("Tarea 4");

		const done = new TodoPanel(() => theme);
		done.setState(state(Array(20).fill("completed")));
		const summary = done.render(46, 5).map(plain);
		expect(summary).toHaveLength(5);
		expect(summary[0]).toContain("✓ 16 · /todos");
		expect(summary.join("\n")).toContain("Tarea 19");
		expect(summary.join("\n")).not.toContain("Leer contratos");
	});
	test("fills free rows with the newest finished work before summarizing", () => {
		const tasks = new TodoPanel(() => theme);
		const data = state(Array(13).fill("pending"));
		for (let index = 0; index < 10; index++) data.todos[index].status = "completed";
		data.todos[12].status = "in_progress";
		tasks.setState(data);
		const rows = tasks.render(46, 10).map(plain);
		const text = rows.join("\n");
		expect(rows).toHaveLength(10);
		expect(text).toContain("✓ 4 · /todos");
		expect(text).toContain("Tarea 12");
		expect(text).toContain("Tarea 9");
		expect(text).toContain("Tarea 4");
		expect(text).not.toContain("Tarea 3 ");
		expect(text).not.toContain("más · /todos");
	});
	test("labels cancelled work separately in the compact summary", () => {
		const tasks = new TodoPanel(() => theme);
		const data = state(Array(13).fill("pending"));
		for (let index = 0; index < 10; index++) data.todos[index].status = "cancelled";
		data.todos[12].status = "in_progress";
		tasks.setState(data);
		const text = tasks.render(46, 10).map(plain).join("\n");
		expect(text).toContain("− 4 · /todos");
		expect(text).not.toContain("✓");
		expect(text).toContain("Tarea 12");
	});
	test("starts the compact view at the top when nothing is in progress", () => {
		const tasks = new TodoPanel(() => theme);
		tasks.setState(state(Array(20).fill("pending")));
		const rows = tasks.render(46, 6).map(plain);
		expect(rows[0]).toContain("Leer contratos");
		expect(rows.join("\n")).toContain("+15 más · /todos");
	});
		test("uses the session palette for each agent", () => {
		const { panel } = sidebarFor(state(), snapshot([row({ key: "a", agent: "ox-explore", phase: "working" })]));
		const text = panel.renderHeight(40, 30).join("\n");
		expect(text).toContain(theme.style("ox-explore", { fg: theme.colors.toolDiffAdded, bold: true }));
	});
});

describe("layout", () => {
	test("uses a full-height right column and preserves editor cursor, focus and native footer", () => {
		const { tui, editor, terminal } = nativeTui();
		const tasks = new TodoPanel(() => theme); tasks.setState(state());
		const mounted = mountSidebar(tui, tasks, () => snapshot());
		const lines = tui.render(terminal.columns);
		expect(lines).toHaveLength(terminal.rows);
		for (const line of lines) expect(visibleWidth(line)).toBe(terminal.columns);
		expect(plain(lines[0])).toContain("Pi header");
		expect(plain(lines.join("\n"))).toContain("Leer contratos");
		expect(plain(lines.join("\n"))).toContain("AGENTS");
		expect(lines.join("\n")).toContain("│");
		expect(plain(lines.at(-1)!)).toContain("native footer");
		expect(lines.join("\n")).toContain(CURSOR_MARKER);
		expect(tui.getFocusedComponent()).toBe(editor);
		mounted.dispose(); mounted.dispose();
		expect(tui.children).toHaveLength(3);
		expect(tui.getFocusedComponent()).toBe(editor);
	});
	test("hides on narrow or short terminals and comes back after resize", () => {
		const { tui, terminal } = nativeTui();
		const tasks = new TodoPanel(() => theme); tasks.setState(state());
		mountSidebar(tui, tasks, () => snapshot());
		for (const width of [40, 80, 139, 140, 160, 260, 80, 160]) {
			terminal.columns = width;
			const lines = tui.render(width);
			expect(lines.every(line => visibleWidth(line) <= width)).toBe(true);
			expect(lines.join("\n").includes("Leer contratos")).toBe(width >= 140);
		}
		terminal.rows = 15;
		expect(tui.render(160).join("\n")).not.toContain("Leer contratos");
		expect(sidebarWidth(160, 35)).toBe(50);
		expect(sidebarWidth(139, 35)).toBe(0);
		expect(sidebarWidth(140, 35)).toBe(50);
	});
	test("never draws the sidebar into old document rows", () => {
		const { tui, document, terminal } = nativeTui();
		document.addChild(new Text(Array(100).fill("chat history").join("\n"), 0, 0));
		const tasks = new TodoPanel(() => theme); tasks.setState(state());
		mountSidebar(tui, tasks, () => snapshot());
		const lines = tui.render(terminal.columns);
		const offscreen = lines.slice(0, -terminal.rows).join("\n");
		expect(offscreen).not.toContain("│");
		expect(lines.slice(-terminal.rows).every(line => visibleWidth(line) === terminal.columns)).toBe(true);
	});
});

describe("fullscreen native viewport", () => {
	test("keeps a full-width header fixed while the transcript scrolls", () => {
		const tui = new TuiAltScreen({ columns: 160, rows: 35, write() {} } as any);
		tui.requestRender = () => {};
		const transcript = new ScrollView(new Text(Array.from({ length: 100 }, (_, i) => `Chat ${i}`).join("\n"), 0, 0), { primary: true });
		tui.setLayoutRoot(new VStack([{ component: transcript, basis: 0, grow: 1 }, new Text("Editor", 0, 0)]));
		const tasks = new TodoPanel(() => theme); tasks.setState(state());
		const mounted = mountSidebar(tui, tasks, () => snapshot(), () => "FIXED HEADER");
		const draw = () => renderLayoutFrame(Reflect.get(tui, "layoutRoot"), 160, 35, () => {}).lines.map(plain);
		let lines = draw();
		expect(lines[1]).toContain("FIXED HEADER");
		expect(lines.join("\n")).toContain("Leer contratos");
		expect(lines.join("\n")).toContain("AGENTS");
		transcript.scrollTo(40); lines = draw();
		expect(lines[1]).toContain("FIXED HEADER");
		expect(lines.join("\n")).toContain("Editor");
		mounted.dispose();
	});
	test("grows the plan box with its content and keeps no inner scroll view", () => {
		const tui = new TuiAltScreen({ columns: 160, rows: 35, write() {} } as any);
		tui.requestRender = () => {};
		const transcript = new ScrollView(new Text(Array(60).fill("Chat").join("\n"), 0, 0), { primary: true });
		tui.setLayoutRoot(new VStack([{ component: transcript, basis: 0, grow: 1 }]));
		const tasks = new TodoPanel(() => theme); tasks.setState(state());
		const mounted = mountSidebar(tui, tasks, () => snapshot());
		const frame = renderLayoutFrame(Reflect.get(tui, "layoutRoot"), 160, 35, () => {});
		const sidebarX = 160 - sidebarWidth(160, 35);
		const planLine = frame.lines.findIndex(line => plain(line).slice(sidebarX).includes("▾ PLAN"));
		const bottom = frame.lines.findIndex((line, index) => index > planLine && plain(line).slice(sidebarX).includes("╰"));
		expect(frame.lines.map(line => plain(line).slice(sidebarX)).join("\n")).not.toContain("┃");
		expect(getScrollViewsAt(frame, sidebarX + 5, planLine + 2)).toEqual([]);
		expect(frame.primaryScrollView).toBe(transcript);
		mounted.dispose();
	});
	test("leaves the rail without an inner scroll, so the wheel keeps scrolling the chat", () => {
		const terminal = { columns: 160, rows: 35, write() {} };
		const tui = new TuiAltScreen(terminal as any); tui.requestRender = () => {};
		const transcript = new ScrollView(new Text(Array(100).fill("Chat history").join("\n"), 0, 0), { primary: true });
		tui.setLayoutRoot(new VStack([{ component: transcript, basis: 0, grow: 1 }]));
		const tasks = new TodoPanel(() => theme); tasks.setState(state(Array(60).fill("pending")));
		const mounted = mountSidebar(tui, tasks, () => snapshot());
		const draw = () => renderLayoutFrame(Reflect.get(tui, "layoutRoot"), 160, 35, () => {});
		let frame = draw();
		const sidebarX = 160 - sidebarWidth(160, 35);
		const planLine = frame.lines.findIndex(line => plain(line).slice(sidebarX).includes("▾ PLAN"));
		expect(getScrollViewsAt(frame, sidebarX + 5, planLine + 2)).toEqual([]);
		transcript.scrollTo(30);
		frame = draw();
		Reflect.set(tui, "currentLayout", frame);
		Reflect.get(tui, "routeWheel").call(tui, { x: sidebarX + 5, y: planLine + 2 }, 3);
		expect(transcript.scrollTop).toBe(33);
		mounted.dispose();
	});
	test("reattaches after Pi replaces its fullscreen layout and restores it on disposal", () => {
		const tui = new TuiAltScreen({ columns: 160, rows: 35, write() {} } as any);
		tui.requestRender = () => {};
		const first = new VStack([new Text("first", 0, 0)]);
		tui.setLayoutRoot(first);
		const mounted = mountSidebar(tui, new TodoPanel(() => theme), () => snapshot());
		const replacement = new VStack([new Text("replacement", 0, 0)]);
		tui.setLayoutRoot(replacement); mounted.sync();
		expect(Reflect.get(tui, "layoutRoot")).not.toBe(replacement);
		mounted.dispose();
		expect(Reflect.get(tui, "layoutRoot")).toBe(replacement);
	});
});

describe("extension lifecycle", () => {
	test("keeps the native footer in regular mode and yields it in fullscreen", async () => {
		const regular = harness(); await regular.emit("session_start");
		expect(plain(regular.footer().render(160).join("\n"))).toContain("Proveedor");
		expect(plain(regular.tui.render(160).join("\n"))).not.toContain("Proveedor");
		await regular.emit("session_shutdown");
		const fullscreen = harness("tui", true); await fullscreen.emit("session_start");
		expect(fullscreen.footer().render(160)).toEqual([]);
		await fullscreen.emit("session_shutdown");
	});
	test("colors each effort and the ctx label in the fixed header", async () => {
		const h = harness("tui", true);
		await h.emit("session_start");
		const colors = { off: "dim", minimal: "muted", low: "success", medium: "accent", high: "warning", xhigh: "error", max: "thinkingHigh", future: "text" } as const;
		for (const [level, color] of Object.entries(colors)) {
			h.pi.getThinkingLevel = () => level;
			const header = renderLayoutFrame(Reflect.get(h.tui, "layoutRoot"), 160, 35, () => {}).lines[1];
			expect(header).toContain(theme.fg(color, level));
			expect(header).toContain(theme.fg("muted", "ctx"));
			expect(header).toContain(theme.fg("muted", "main"));
			expect(header).toContain(theme.fg("accent", "▰▰▱▱▱▱▱▱"));
		}
		await h.emit("session_shutdown");
	});
	test("renders session metrics in the fullscreen header", async () => {
		const h = harness("tui", true);
		h.ctx.cwd = "/work/project";
		h.entries.push({ type: "message", message: { role: "assistant", usage: { input: 1000, output: 250, cacheRead: 9000, cacheWrite: 0, cost: { total: 1.23 } } } });
		await h.emit("session_start");
		const frame = renderLayoutFrame(Reflect.get(h.tui, "layoutRoot"), 160, 35, () => {}).lines.map(plain);
		expect(frame[0].trim()).toBe("");
		const header = frame[1];
		expect(header).toContain("✿ project │ main");
		for (const value of ["project", "main", "model · high · test", "ctx ▰▰▱▱▱▱▱▱ 20%", "↑1.0k", "↓250", "$1.230"]) expect(header).toContain(value);
		await h.emit("session_shutdown");
	});
	test("feeds the roster from tool events, notices and supervisor replies", async () => {
		const h = harness(); await h.emit("session_start");
		await h.emit("tool_execution_start", { toolName: "subagent", toolCallId: "call-1", args: { agent: "ox-explore", task: "Mapa de archivos" } });
		let text = plain(h.tui.render(160).join("\n"));
		expect(text).toContain("ox-explore");
		expect(text).toContain("1 activo");
		await h.emit("tool_execution_update", { toolName: "subagent", toolCallId: "call-1", partialResult: { details: { mode: "single", runId: "run-1", results: [{ agent: "ox-explore", index: 0, progress: { status: "running" } }] } } });
		await h.emit("message_end", { message: { role: "custom", customType: "subagent_supervisor_request", details: { runId: "run-1", requestId: "req-1", agent: "ox-explore", reason: "need_decision" } } });
		text = plain(h.tui.render(160).join("\n"));
		expect(text).toContain("◆");
		await h.emit("tool_execution_start", { toolName: "subagent_supervisor", toolCallId: "sup-1", args: { action: "reply", replyTo: "req-1" } });
		expect(plain(h.tui.render(160).join("\n"))).toContain("●");
		await h.emit("tool_execution_end", { toolName: "subagent", toolCallId: "call-1", result: { details: { mode: "single", runId: "run-1", results: [{ agent: "ox-explore", index: 0, exitCode: 0 }] } } });
		text = plain(h.tui.render(160).join("\n"));
		expect(text).toContain("✓");
		await h.emit("message_end", { message: { role: "custom", customType: "subagent-notify", details: { runs: [{ agent: "ox-committer", runId: "run-2", status: "completed", durationMs: 60_000 }] } } });
		expect(plain(h.tui.render(160).join("\n"))).toContain("ox-committer");
		await h.emit("session_shutdown");
	});
	test("opens the full roster and clears finished rows", async () => {
		const h = harness(); await h.emit("session_start");
		await h.emit("message_end", { message: { role: "custom", customType: "subagent-notify", details: { runs: [{ agent: "ox-committer", runId: "r1", status: "completed", durationMs: 7000 }] } } });
		await h.emit("tool_execution_start", { toolName: "subagent", toolCallId: "c1", args: { agent: "ox-researcher", task: "Buscar fuentes" } });
		await h.emit("tool_execution_update", { toolName: "subagent", toolCallId: "c1", partialResult: { details: { mode: "single", results: [{ agent: "ox-researcher", index: 0, progress: { status: "running" } }] } } });
		let lines: string[] = [];
		(h.ctx.ui as any).custom = async (factory: Function) => {
			const view = factory(h.tui, theme, {}, () => {});
			lines = view.render(60).map(plain);
		};
		await h.commands.get("agents").handler("", h.ctx);
		expect(lines.join("\n")).toContain("ox-researcher");
		expect(lines.join("\n")).toContain("ox-committer");
		expect(lines.join("\n")).toContain("en marcha");
		expect(lines.join("\n")).toContain("terminado");
		expect(lines.join("\n")).toContain("Esc cerrar");
		await h.commands.get("agents").handler("clear", h.ctx);
		expect(plain(h.tui.render(160).join("\n"))).not.toContain("ox-committer");
		expect(plain(h.tui.render(160).join("\n"))).toContain("ox-researcher");
		await h.emit("session_shutdown");
	});
	test("replaces a plan when unrelated work starts and clears it on an empty list", async () => {
		const h = harness(); await h.emit("session_start");
		const tool = h.tools.get("todowrite");
		await tool.execute("1", { title: "Sidebar", todos: state().todos }, undefined);
		await tool.execute("2", { todos: [{ id: "0", content: "Leer contratos", status: "completed" }] }, undefined);
		expect(h.entries.at(-1).data.title).toBe("Sidebar");

		await tool.execute("3", { todos: [{ id: "a", content: "Preparar otra cosa", status: "in_progress" }] }, undefined);
		expect(h.entries.at(-1).data.title).toBe("Plan de trabajo");
		let text = plain(h.tui.render(160).join("\n"));
		expect(text).toContain("Preparar otra cosa");
		expect(text).not.toContain("Leer contratos");

		await tool.execute("4", { title: "Otra tarea", todos: [{ id: "b", content: "Otra", status: "pending" }] }, undefined);
		expect(h.entries.at(-1).data.title).toBe("Otra tarea");
		const cleared = await tool.execute("5", { todos: [] }, undefined);
		expect(h.entries.at(-1).data.todos).toEqual([]);
		expect(cleared.content[0].text).toContain("Plan borrado");
		text = plain(h.tui.render(160).join("\n"));
		expect(text).toContain("sin tareas · /todos");
		expect(text).not.toContain("Otra");
		await h.emit("session_shutdown");
	});
	test("tells the model to replace unrelated plans and clear empty ones", async () => {
		const h = harness(); await h.emit("session_start");
		await h.tools.get("todowrite").execute("1", state(), undefined);
		const result = await h.emit("before_agent_start", {});
		expect(result.message.content).toContain("unrelated to this plan");
		expect(result.message.content).toContain("empty todos list");
		expect(result.message.content).toContain("do not carry over its tasks");
		const tool = h.tools.get("todowrite");
		expect(tool.description).toContain("empty todos list");
		expect(tool.promptGuidelines.join(" ")).toContain("unrelated");
		await h.emit("session_shutdown");
	});
		test("shows the in-progress task from todowrite even when the plan is compacted", async () => {
		const h = harness(); await h.emit("session_start");
		const data = state(Array(40).fill("pending"));
		data.todos[38].status = "in_progress";
		await h.tools.get("todowrite").execute("1", data, undefined);
		const text = plain(h.tui.render(160).join("\n"));
		expect(text).toContain("Tarea 38");
		expect(text).toContain("●");
		expect(text).toContain("más · /todos");
		await h.emit("session_shutdown");
	});
		test("persists tool updates, restores on reload, and does not complete tasks at settlement", async () => {
		const h = harness(); await h.emit("session_start");
		const tool = h.tools.get("todowrite");
		expect(tool.executionMode).toBe("sequential");
		await tool.execute("1", state(), undefined);
		expect(h.entries).toHaveLength(1);
		expect(plain(h.tui.render(160).join("\n"))).toContain("1/3");
		await h.emit("agent_settled");
		expect(h.entries[0].data.todos[1].status).toBe("in_progress");
		await h.emit("session_shutdown");
		expect(h.tui.children).toHaveLength(3);
		await h.emit("session_start");
		expect(h.tui.children).toHaveLength(1);
		expect(plain(h.tui.render(160).join("\n"))).toContain("1/3");
		await h.emit("session_shutdown");
	});
	test("restores branch state and clears only on explicit confirmed command", async () => {
		const h = harness(); await h.emit("session_start");
		await h.tools.get("todowrite").execute("1", state(), undefined);
		await h.tools.get("todowrite").execute("2", state(["completed", "completed", "completed"]), undefined);
		h.entries.pop(); await h.emit("session_tree");
		expect(plain(h.tui.render(160).join("\n"))).toContain("1/3");
		await h.commands.get("todos").handler("clear", h.ctx);
		expect(h.entries.at(-1).data.todos).toEqual([]);
		await h.emit("session_shutdown");
	});
	test("aborted or invalid updates leave the last valid plan unchanged", async () => {
		const h = harness("json"); await h.emit("session_start");
		const tool = h.tools.get("todowrite");
		await tool.execute("1", state(), undefined);
		await expect(tool.execute("2", { todos: [] }, AbortSignal.abort())).rejects.toThrow();
		await expect(tool.execute("3", { todos: [{ id: "", content: "", status: "bad" }] }, undefined)).rejects.toThrow();
		expect(h.entries).toHaveLength(1);
	});
	test("works in non-TUI modes without touching terminal or Herdr hooks", async () => {
		for (const mode of ["json", "rpc", "print"]) {
			const h = harness(mode); await h.emit("session_start");
			await h.tools.get("todowrite").execute("1", state(), undefined);
			expect(h.tui.children).toHaveLength(3);
			expect(h.widget()).toBeUndefined();
			expect(h.entries).toHaveLength(1);
		}
	});
});
