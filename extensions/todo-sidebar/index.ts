import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, Text, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { ENTRY_TYPE, emptyState, mountSidebar, parseState, restoreState, TodoPanel } from "./core.ts";
import type { TodoState } from "./core.ts";

const parameters = Type.Object({
	title: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: "Short title for this plan." })),
	todos: Type.Array(Type.Object({
		id: Type.String({ minLength: 1, maxLength: 64 }),
		content: Type.String({ minLength: 1, maxLength: 300 }),
		status: Type.Union([Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed"), Type.Literal("cancelled")]),
	}), { maxItems: 80, description: "The complete current list, including completed tasks. Replaces the previous snapshot." }),
});

export default function todoSidebar(pi: ExtensionAPI) {
	let state = emptyState();
	let panel: TodoPanel | undefined;
	let mounted: ReturnType<typeof mountSidebar> | undefined;
	let requestRender: (() => void) | undefined;

	const redraw = () => { panel?.setState(state); requestRender?.(); };
	const restore = (ctx: ExtensionContext) => { state = restoreState(ctx.sessionManager.getBranch()); redraw(); };
	const save = (next: TodoState) => {
		pi.appendEntry(ENTRY_TYPE, next);
		state = next;
		redraw();
	};
	const dispose = () => {
		mounted?.dispose();
		mounted = undefined;
		panel = undefined;
		requestRender = undefined;
	};

	pi.on("session_start", (_event, ctx) => {
		dispose();
		restore(ctx);
		if (ctx.mode !== "tui") return;
		// A zero-line widget provides the TUI reference and Pi-managed disposal.
		// Its content is drawn by a regular Container, not by a floating overlay.
		ctx.ui.setWidget("todo-sidebar-lifecycle", (tui) => {
			panel = new TodoPanel(() => ctx.ui.theme);
			panel.setState(state);
			mounted = mountSidebar(tui, panel);
			requestRender = () => tui.requestRender();
			return { render: () => { mounted?.sync(); return []; }, invalidate: () => panel?.invalidate(), dispose };
		});
	});
	pi.on("session_tree", (_event, ctx) => restore(ctx));
	pi.on("session_compact", (_event, ctx) => restore(ctx));
	pi.on("session_shutdown", dispose);

	pi.on("before_agent_start", () => {
		if (!state.todos.length) return;
		return { message: {
			customType: "todo-sidebar-context",
			content: "Current todo sidebar snapshot. Update it with todowrite as work progresses. Preserve completed items until a genuinely new plan replaces this one. Do not mark unfinished work completed.\n" + JSON.stringify(state),
			display: false,
		} };
	});

	pi.registerTool({
		name: "todowrite",
		label: "Plan de trabajo",
		description: "Replace the persistent todo sidebar with the complete latest plan. Keep all tasks, including completed tasks. Use pending, in_progress, completed, or cancelled. The list remains visible after the agent finishes.",
		promptSnippet: "Update the persistent task sidebar with the complete latest plan.",
		promptGuidelines: [
			"For multi-step implementation or investigation, create a concise plan with todowrite before starting work. Skip it for trivial requests.",
			"Keep the sidebar current: mark a task in_progress before working on it, and completed immediately after verifying it. Update between work steps, not only at the end.",
			"Send the entire list on every todowrite call, preserving completed tasks and stable ids. Never clear a finished list automatically. Replace it only when starting a genuinely new plan.",
			"Do not mark blocked, failed, or unverified tasks completed. Leave them pending or in_progress, or explicitly mark cancelled work cancelled.",
		],
		parameters,
		executionMode: "sequential",
		async execute(_id, params, signal) {
			if (signal?.aborted) throw new Error("Actualización cancelada.");
			const next = parseState({ version: 1, title: params.title ?? state.title, todos: params.todos });
			save(next);
			const done = next.todos.filter(todo => todo.status === "completed").length;
			return {
				content: [{ type: "text", text: `${done}/${next.todos.length} tareas completadas. El panel conserva la lista completa.` }],
				details: next,
			};
		},
		renderCall(_args, theme) { return new Text(theme.fg("muted", "Actualizar plan de trabajo"), 0, 0); },
		renderResult(result, { expanded }, theme) {
			const snapshot = result.details;
			if (!snapshot?.todos) return new Text("", 0, 0);
			const done = snapshot.todos.filter(todo => todo.status === "completed").length;
			const text = theme.fg("dim", `${done}/${snapshot.todos.length} completadas · panel actualizado`);
			return new Text(expanded ? text + "\n" + snapshot.todos.map(todo => `${todo.status}  ${todo.content}`).join("\n") : text, 0, 0);
		},
	});

	for (const [key, delta] of [["ctrl+alt+up", -3], ["ctrl+alt+down", 3]] as const) {
		pi.registerShortcut(key, {
			description: delta < 0 ? "Desplazar tareas hacia arriba" : "Desplazar tareas hacia abajo",
			handler: async () => { panel?.scrollBy(delta); requestRender?.(); },
		});
	}

	pi.registerCommand("todos", {
		description: "Ver el plan. Opciones: up, down, top, bottom, auto, show, hide, clear.",
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (action === "clear") {
				if (await ctx.ui.confirm("Borrar plan", "¿Borrar todas las tareas de esta sesión?")) save(emptyState());
				return;
			}
			if (ctx.mode !== "tui") {
				ctx.ui.notify(JSON.stringify(state), "info");
				return;
			}
			if (["up", "down", "top", "bottom", "auto"].includes(action)) {
				if (action === "auto") panel?.follow();
				else if (action === "top" || action === "bottom") panel?.scrollToEdge(action);
				else panel?.scrollBy(action === "down" ? 3 : -3);
				requestRender?.();
				return;
			}
			if (action === "show" || action === "hide") {
				if (mounted) mounted.layout.enabled = action === "show";
				requestRender?.();
				return;
			}
			if (action) {
				ctx.ui.notify("Uso: /todos [up|down|top|bottom|auto|show|hide|clear]", "info");
				return;
			}
			await ctx.ui.custom<void>((tui, _theme, _keys, done) => {
				let offset = 0;
				let maxOffset = 0;
				let pageHeight = 1;
				return {
					render(width: number) {
						const th = ctx.ui.theme;
						const titleLines = wrapTextWithAnsi(state.title, Math.max(1, width - 4)).map(text => th.bold("  " + text));
						pageHeight = Math.max(1, Math.min(Math.floor(tui.terminal.rows * 0.95) - titleLines.length - 3, 30));
						const body = state.todos.flatMap(todo => wrapTextWithAnsi(todo.content, Math.max(1, width - 8)).map((text, row) => {
							const mark = todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "●" : todo.status === "cancelled" ? "−" : "○";
							return "  " + (row ? "   " : `${mark}  `) + th.style(text, { fg: todo.status === "in_progress" ? th.colors.mdHeading : "text", strikethrough: todo.status === "completed" || todo.status === "cancelled" });
						}));
						if (!body.length) body.push("  No hay tareas todavía.");
						maxOffset = Math.max(0, body.length - pageHeight);
						offset = Math.min(offset, maxOffset);
						return [
							th.fg("mdHeading", "─".repeat(width)),
							...titleLines,
							...body.slice(offset, offset + pageHeight),
							th.fg("dim", width >= 44 ? "  ↑↓ desplazar · PgUp/PgDn · Esc cerrar" : "  ↑↓ · Esc cerrar"),
							th.fg("mdHeading", "─".repeat(width)),
						].map(line => truncateToWidth(line, width));
					},
					handleInput(data: string) {
						if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, "enter")) return done();
						if (matchesKey(data, "down")) offset = Math.min(maxOffset, offset + 1);
						if (matchesKey(data, "up")) offset = Math.max(0, offset - 1);
						if (matchesKey(data, "pageDown")) offset = Math.min(maxOffset, offset + pageHeight);
						if (matchesKey(data, "pageUp")) offset = Math.max(0, offset - pageHeight);
						if (matchesKey(data, "home")) offset = 0;
						if (matchesKey(data, "end")) offset = maxOffset;
						tui.requestRender();
					},
					invalidate() {},
				};
			}, { overlay: true, overlayOptions: { width: "70%", maxHeight: "95%", anchor: "center" } });
		},
	});
}
