import { describe, expect, test } from "bun:test";
import { Container, CURSOR_MARKER, ScrollView, Text, TuiAltScreen, TuiMainScreen, VStack, visibleWidth } from "@earendil-works/pi-tui";
import { ENTRY_TYPE, emptyState, mountSidebar, parseState, restoreState, sidebarWidth, Sidebar, TodoPanel } from "../core.ts";
import extension from "../index.ts";
import { sessionLines } from "../status.ts";

const globalModules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const { loadThemeFromPath } = await import(`${globalModules}/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js`);
const { renderLayoutFrame, getScrollViewBox, getScrollViewsAt } = await import(`${globalModules}/@earendil-works/pi-tui/dist/layout.js`);
const theme = loadThemeFromPath(new URL("../../../themes/tokyo-night.json", import.meta.url).pathname, "truecolor");
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");
const state = (statuses = ["completed", "in_progress", "pending"]) => parseState({
	version: 1, title: "Construir sidebar", todos: statuses.map((status, index) => ({ id: String(index), content: ["Leer contratos", "Implementar panel", "Probar redimensionado"][index] ?? `Tarea ${index}`, status })),
});
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
function harness(mode = "tui") {
	const handlers = new Map<string, Function[]>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const shortcuts = new Map<string, any>();
	const entries: any[] = [];
	const native = nativeTui();
	let widget: any;
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
			setFooter(factory: Function) { factory(native.tui, theme, { getGitBranch: () => "main", getExtensionStatuses: () => new Map(), onBranchChange: () => () => {} }); },
			setWidget(_key: string, factory: Function) { widget?.dispose(); widget = factory(native.tui, theme); },
			confirm: async () => true, notify() {},
		},
	};
	extension(pi as any);
	const emit = async (name: string) => { for (const handler of handlers.get(name) ?? []) await handler({}, ctx); };
	return { ...native, tools, commands, shortcuts, entries, ctx, emit, widget: () => widget };
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

describe("session information", () => {
	test("includes model, usage, directory, branch and extension statuses", () => {
		const usage = { input: 1000, output: 250, cacheRead: 9000, cacheWrite: 0, cost: { total: 1.23 } };
		const ctx = { cwd: "/work/demo", model: { provider: "provider", id: "model", reasoning: true, contextWindow: 100000 }, getContextUsage: () => ({ percent: 20, contextWindow: 100000 }), sessionManager: { getEntries: () => [{ type: "message", message: { role: "assistant", usage } }] } };
		const lines = sessionLines({ getThinkingLevel: () => "high" } as any, ctx as any, "main", new Map([["focus", "focus activo"]])).join("\n");
		for (const value of ["Proveedor", "Modelo", "Proyecto", "Detalles", "provider", "model", "high", "/work/demo", "main", "20.0%", "↑1.0k", "R9.0k", "$1.230", "90.0%", "focus activo"]) expect(lines).toContain(value);
		const styled = sessionLines({ getThinkingLevel: () => "high" } as any, ctx as any, "main", new Map([["focus", "focus activo"], ["engram", "🧠 yay"]]), theme);
		expect(styled[0]).toBe("");
		expect(styled.join("\n")).toContain(theme.fg("mdCode", "provider"));
		expect(styled.join("\n")).toContain(theme.fg("success", "$1.230 · caché 90.0%"));
		expect(styled.map(plain).indexOf("Detalles")).toBeGreaterThan(styled.map(plain).findIndex(line => line.includes("Coste estimado")));
		const compact = sessionLines({ getThinkingLevel: () => "high" } as any, ctx as any, null, new Map([["focus", "focus activo"]]), theme, true);
		expect(compact.length).toBeLessThanOrEqual(8);
		expect(compact.map(plain).join("\n")).toContain("Detalles  focus activo");
	});
});

describe("layout", () => {
	test("draws a separate left rail for each section without a surrounding frame", () => {
		const { tui } = nativeTui();
		const tasks = new TodoPanel(() => theme); tasks.setState(state());
		const sidebar = new Sidebar(tui, tasks, () => theme);
		sidebar.setStatus(() => ["Modelo", "Contexto"]);
		const rendered = sidebar.renderHeight(38, 35);
		expect(rendered[0]).toContain(theme.fg("mdCode", "│"));
		expect(rendered[3]).toContain(theme.fg("mdCode", "│"));
		const lines = rendered.map(plain);
		expect(lines[0].startsWith("│")).toBe(true);
		expect(lines[1].startsWith("│")).toBe(true);
		expect(lines[2].trim()).toBe("");
		expect(lines[3].startsWith("│")).toBe(true);
		for (const line of lines) {
			expect(line.endsWith("│")).toBe(false);
			expect(line).not.toMatch(/[┌┐└┘]/);
		}
	});
	test("uses a full-height right column and preserves editor cursor and native footer", () => {
		const { tui, editor, terminal } = nativeTui();
		const panel = new TodoPanel(() => theme); panel.setState(state());
		const mounted = mountSidebar(tui, panel);
		const lines = tui.render(terminal.columns);
		expect(lines).toHaveLength(terminal.rows);
		for (const line of lines) expect(visibleWidth(line)).toBe(terminal.columns);
		expect(plain(lines[0])).toContain("Pi header");
		expect(plain(lines[0])).not.toContain("TAREAS");
		expect(plain(lines.join("\n"))).toContain("Construir sidebar");
		expect(lines.join("\n")).toContain("│");
		expect(plain(lines.at(-1)!)).toContain("native footer");
		expect(lines.join("\n")).toContain(CURSOR_MARKER);
		expect(tui.getFocusedComponent()).toBe(editor);
		mounted.dispose(); mounted.dispose();
		expect(tui.children).toHaveLength(3);
		expect(tui.getFocusedComponent()).toBe(editor);
	});
	test("never draws the sidebar into old document rows", () => {
		const { tui, document, terminal } = nativeTui();
		document.addChild(new Text(Array(100).fill("chat history").join("\n"), 0, 0));
		const panel = new TodoPanel(() => theme); panel.setState(state());
		mountSidebar(tui, panel);
		const lines = tui.render(terminal.columns);
		const offscreen = lines.slice(0, -terminal.rows).join("\n");
		expect(offscreen).not.toContain("│");
		expect(lines.slice(-terminal.rows).every(line => visibleWidth(line) === terminal.columns)).toBe(true);
	});
	test("hides on narrow or short terminals and comes back after resize", () => {
		const { tui, terminal } = nativeTui();
		const panel = new TodoPanel(() => theme); panel.setState(state());
		mountSidebar(tui, panel);
		for (const width of [40, 80, 119, 120, 160, 260, 80, 160]) {
			terminal.columns = width;
			const lines = tui.render(width);
			expect(lines.every(line => visibleWidth(line) <= width)).toBe(true);
			expect(lines.join("\n").includes("Construir sidebar")).toBe(width >= 120);
		}
		terminal.rows = 15;
		expect(tui.render(160).join("\n")).not.toContain("Construir sidebar");
		expect(sidebarWidth(160, 35)).toBe(41);
	});
	test("retains completed tasks, strikes text, and clears stale cache on updates", () => {
		const panel = new TodoPanel(() => theme);
		panel.setState(state(["completed", "completed", "completed"]));
		const lines = panel.renderHeight(38, 35);
		expect(lines.join("\n")).toContain("\x1b[9m");
		expect(plain(lines.join("\n"))).not.toContain("Plan finalizado");
		expect(plain(lines.join("\n"))).not.toContain("─");
		expect(lines.join("\n")).toContain(theme.style("Construir sidebar", { fg: "text", bold: true }));
		expect(plain(lines.join("\n"))).toContain("Leer contratos");
		expect(plain(lines.join("\n"))).toContain("● ● ●  3/3");
		panel.setState(state(["in_progress"]));
		expect(plain(panel.renderHeight(38, 35).join("\n"))).not.toContain("En curso");
		expect(plain(panel.renderHeight(38, 35).join("\n"))).toContain("0/1");
	});
	test("wraps CJK, emoji and combining characters within all supported widths", () => {
		const panel = new TodoPanel(() => theme);
		panel.setState(parseState({ version: 1, title: "Pruebas 日本語", todos: [{ id: "1", content: "日本語 🧠 café 中文 ".repeat(12), status: "completed" }] }));
		for (let width = 30; width <= 56; width++) {
			for (const line of panel.renderHeight(width, 16)) expect(visibleWidth(line)).toBe(width);
		}
	});
	test("scrolls without discarding tasks and follows the active task", () => {
		const panel = new TodoPanel(() => theme);
		const data = state(Array(40).fill("pending")); data.todos[30].status = "in_progress";
		panel.setState(data);
		const current = plain(panel.renderHeight(30, 16).join("\n"));
		expect(current).toContain("Tarea 30");
		panel.scrollBy(-3);
		expect(plain(panel.renderHeight(30, 16).join("\n"))).not.toBe(current);
		panel.follow();
		expect(plain(panel.renderHeight(30, 16).join("\n"))).toBe(current);
		expect(panel.state.todos).toHaveLength(40);
	});
	test("wraps the full title and never shows a footer or pagination hint", () => {
		const panel = new TodoPanel(() => theme);
		const data = state(Array(40).fill("completed"));
		data.title = "Añadir prefijo ox a nombres de skills y verificar sus referencias";
		panel.setState(data);
		for (const width of [30, 38, 42]) {
			const lines = panel.renderHeight(width, 35).map(plain);
			const title = lines.slice(1, lines.findIndex(line => line.includes("40/40"))).map(line => line.trim()).filter(Boolean).join(" ");
			expect(title).toBe(data.title);
			expect(lines.join("\n")).not.toContain("…");
			expect(lines.join("\n")).not.toContain("/todos");
			expect(lines.join("\n")).not.toContain("guardado");
			expect(lines).toHaveLength(35);
		}
	});
	test("fits progress points on narrow panels for long lists", () => {
		const panel = new TodoPanel(() => theme);
		const data = state(Array(80).fill("pending"));
		data.todos.slice(0, 40).forEach(todo => { todo.status = "completed"; });
		panel.setState(data);
		for (const width of [30, 38, 50]) {
			const lines = panel.renderHeight(width, 35);
			const progress = plain(lines.find(line => plain(line).includes("40/80"))!);
			expect(progress).toContain("●");
			expect(progress).toContain("○");
			expect(visibleWidth(progress)).toBe(width);
		}
	});
	test("keeps manual position across task updates and clamps it after resize", () => {
		const panel = new TodoPanel(() => theme);
		const data = state(Array(40).fill("pending")); data.todos[30].status = "in_progress";
		panel.setState(data); panel.renderHeight(30, 16);
		panel.scrollToEdge("top");
		expect(panel.scroll.scrollTop).toBe(0);
		const next = structuredClone(data); next.todos[0].status = "completed";
		panel.setState(next); panel.renderHeight(30, 16);
		expect(panel.scroll.scrollTop).toBe(0);
		panel.scrollToEdge("bottom");
		expect(panel.scroll.scrollTop).toBeGreaterThan(0);
		panel.renderHeight(42, 100);
		expect(panel.scroll.scrollTop).toBe(0);
		panel.setState(state(["pending"])); panel.renderHeight(30, 16);
		expect(panel.scroll.scrollTop).toBe(0);
	});
});

describe("adaptive task box", () => {
	test("hides without tasks and sizes the rail to the wrapped list in both modes", () => {
		for (const mode of ["regular", "fullscreen"]) {
			const terminal = { columns: 160, rows: 35, write() {} };
			const tui = mode === "regular" ? new TuiMainScreen(terminal as any) : new TuiAltScreen(terminal as any);
			tui.requestRender = () => {};
			const root = new VStack([new Text("Chat", 0, 0)]);
			if (mode === "fullscreen") (tui as TuiAltScreen).setLayoutRoot(root);
			else tui.addChild(new Text("Chat", 0, 0));
			const panel = new TodoPanel(() => theme);
			const mounted = mountSidebar(tui, panel, () => ["Estado"]);
			const drawFull = () => (mode === "fullscreen" ? renderLayoutFrame(Reflect.get(tui, "layoutRoot"), 160, 35, () => {}).lines : tui.render(160)).map(plain).map((line: string) => line.replace(/\x1b\]8;;\x07/g, ""));
			const draw = () => drawFull().map((line: string) => line.slice(160 - sidebarWidth(160, 35)));
			const start = 160 - sidebarWidth(160, 35);
			expect(drawFull()[0].slice(start - 5, start + 1)).toBe("     │");
			let lines = draw();
			expect(lines.filter((line: string) => line.startsWith("│"))).toHaveLength(1);
			expect(lines.join("\n")).not.toContain("Plan de trabajo");
			const data = state(["pending"]);
			data.todos[0].content = "Tarea larga con varias palabras para ocupar más de una línea y comprobar el ajuste";
			panel.setState(data);
			lines = draw();
			const rail = lines.map((line: string, row: number) => line.startsWith("│") ? row : -1).filter((row: number) => row >= 0);
			expect(rail[0]).toBe(0);
			expect(rail[1]).toBe(2);
			expect(rail.at(-1)).toBeLessThan(34);
			expect(lines.join("\n")).toContain("ajuste");
			panel.setState(emptyState());
			lines = draw();
			expect(lines.filter((line: string) => line.startsWith("│"))).toHaveLength(1);
			expect(lines.join("\n")).not.toContain("ajuste");
			mounted.dispose();
		}
	});
});

describe("fullscreen native viewport", () => {
	test("keeps Pi's original ScrollView, dock, focus and mouse layout inside an HStack", () => {
		const terminal = { columns: 160, rows: 35, write() {} };
		const tui = new TuiAltScreen(terminal as any);
		tui.requestRender = () => {};
		const document = new Text(Array(80).fill("Chat content").join("\n"), 0, 0);
		const transcript = new ScrollView(document, { primary: true, follow: "end" });
		const editor = new Text(`Editor ${CURSOR_MARKER}`, 0, 0);
		const footer = new Text("Native footer", 0, 0);
		const root = new VStack([
			{ component: transcript, basis: 0, grow: 1, minSize: 1 },
			new VStack([editor, footer]),
		]);
		tui.addChild(document); tui.addChild(editor); tui.addChild(footer);
		tui.setLayoutRoot(root); tui.setFocus(editor);
		const panel = new TodoPanel(() => theme); panel.setState(state());
		const mounted = mountSidebar(tui, panel);
		for (const [columns, rows] of [[160, 35], [80, 35], [120, 16], [160, 15], [220, 50], [160, 35]]) {
			terminal.columns = columns; terminal.rows = rows;
			const frame = renderLayoutFrame(Reflect.get(tui, "layoutRoot"), columns, rows, () => {});
			expect(frame.lines).toHaveLength(rows);
			expect(frame.lines.every((line: string) => visibleWidth(line) <= columns)).toBe(true);
			expect(frame.lines.join("\n").includes("Construir sidebar")).toBe(columns >= 120 && rows >= 16);
			expect(frame.primaryScrollView).toBe(transcript);
			expect(getScrollViewBox(frame, transcript)).toBeDefined();
			expect(tui.getFocusedComponent()).toBe(editor);
			expect(plain(frame.lines.at(-1))).toContain("Native footer");
			expect(frame.lines.join("\n")).toContain(CURSOR_MARKER);
		}
		mounted.layout.enabled = false;
		expect(renderLayoutFrame(Reflect.get(tui, "layoutRoot"), 160, 35, () => {}).lines.join("\n")).not.toContain("Construir sidebar");
		mounted.dispose();
		expect(Reflect.get(tui, "layoutRoot")).toBe(root);
		expect(tui.children).toEqual([document, editor, footer]);
	});
	test("routes mouse wheel to tasks without moving chat, including both scroll limits", () => {
		const terminal = { columns: 160, rows: 35, write() {} };
		const tui = new TuiAltScreen(terminal as any); tui.requestRender = () => {};
		const transcript = new ScrollView(new Text(Array(100).fill("Chat history").join("\n"), 0, 0), { primary: true });
		const root = new VStack([{ component: transcript, basis: 0, grow: 1 }]);
		tui.setLayoutRoot(root);
		const panel = new TodoPanel(() => theme); panel.setState(state(Array(60).fill("pending")));
		const mounted = mountSidebar(tui, panel);
		const draw = () => renderLayoutFrame(Reflect.get(tui, "layoutRoot"), 160, 35, () => {});
		let frame = draw();
		const taskBox = getScrollViewBox(frame, panel.scroll)!;
		expect(taskBox).toBeDefined();
		expect(getScrollViewsAt(frame, taskBox.rect.x + 3, taskBox.rect.y + 3)).toContain(panel.scroll);
		expect(frame.primaryScrollView).toBe(transcript);
		transcript.scrollTo(30);
		frame = draw();
		const header = frame.lines.slice(0, taskBox.rect.y);
		const wheel = (delta: number) => {
			Reflect.set(tui, "currentLayout", frame);
			Reflect.get(tui, "routeWheel").call(tui, { x: taskBox.rect.x + 3, y: taskBox.rect.y + 3 }, delta);
			frame = draw();
		};
		wheel(3);
		expect(panel.scroll.scrollTop).toBe(3);
		expect(transcript.scrollTop).toBe(30);
		expect(frame.lines.slice(0, taskBox.rect.y)).toEqual(header);
		panel.scrollToEdge("bottom"); wheel(3);
		expect(transcript.scrollTop).toBe(30);
		panel.scrollToEdge("top"); wheel(-3);
		expect(transcript.scrollTop).toBe(30);
		expect(panel.scroll.scrollTop).toBe(0);
		const response = panel.children[0].handleMouse!({ type: "wheel", wheelDelta: 3 } as any);
		expect(response?.handled).toBe(true);
		frame = draw();
		expect(panel.scroll.scrollTop).toBe(3);
		expect(transcript.scrollTop).toBe(30);
		expect(tui.getFocusedComponent()).not.toBe(panel);
		mounted.dispose();
	});
	test("reattaches after Pi replaces its fullscreen layout and restores it on disposal", () => {
		const tui = new TuiAltScreen({ columns: 160, rows: 35, write() {} } as any);
		tui.requestRender = () => {};
		const first = new VStack([new Text("first", 0, 0)]);
		tui.setLayoutRoot(first);
		const mounted = mountSidebar(tui, new TodoPanel(() => theme));
		const replacement = new VStack([new Text("replacement", 0, 0)]);
		tui.setLayoutRoot(replacement); mounted.sync();
		expect(Reflect.get(tui, "layoutRoot")).not.toBe(replacement);
		mounted.dispose();
		expect(Reflect.get(tui, "layoutRoot")).toBe(replacement);
	});
});

describe("extension lifecycle", () => {
	test("keeps a wrapped title and close hint visible in the full-list overlay", async () => {
		const h = harness(); await h.emit("session_start");
		const data = state(Array(60).fill("pending"));
		data.title = "Añadir prefijo ox a nombres de skills y verificar sus referencias";
		await h.tools.get("todowrite").execute("1", data, undefined);
		let lines: string[] = [];
		(h.ctx.ui as any).custom = async (factory: Function) => {
			const view = factory(h.tui, theme, {}, () => {});
			lines = view.render(30).map(plain);
		};
		await h.commands.get("todos").handler("", h.ctx);
		expect(lines.length).toBeLessThanOrEqual(Math.floor(h.terminal.rows * 0.95));
		expect(lines.join("\n")).toContain("Esc cerrar");
		expect(lines.join("\n")).not.toContain("…");
		expect(lines.slice(1, 4).map(line => line.trim()).join(" ")).toBe(data.title);
		await h.emit("session_shutdown");
	});
	test("offers independent scroll shortcuts and commands without changing editor focus", async () => {
		const h = harness(); await h.emit("session_start");
		await h.tools.get("todowrite").execute("1", state(Array(60).fill("pending")), undefined);
		const before = h.tui.render(160);
		await h.shortcuts.get("ctrl+alt+down").handler();
		expect(h.tui.render(160)).not.toEqual(before);
		expect(h.tui.getFocusedComponent()).toBe(h.editor);
		await h.commands.get("todos").handler("top", h.ctx);
		expect(h.tui.render(160)).toEqual(before);
		await h.commands.get("todos").handler("bottom", h.ctx);
		expect(plain(h.tui.render(160).join("\n"))).toContain("Tarea 59");
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
