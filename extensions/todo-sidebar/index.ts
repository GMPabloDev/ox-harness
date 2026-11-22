import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isViewportTUI, matchesKey, Text, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { AgentRegistry, agentColor, launchRows, phaseLabel, phaseStyle, rowTime } from "./agents.ts";
import { ENTRY_TYPE, emptyState, mountSidebar, parseState, restoreState, sidebarWidth, TodoPanel } from "./core.ts";
import { sessionLines } from "./status.ts";
import type { AgentRow } from "./agents.ts";
import type { TodoState } from "./core.ts";

const parameters = Type.Object({
	title: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: "Short title for this plan." })),
	todos: Type.Array(Type.Object({
		id: Type.String({ minLength: 1, maxLength: 64 }),
		content: Type.String({ minLength: 1, maxLength: 300 }),
		status: Type.Union([Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed"), Type.Literal("cancelled")]),
	}), { maxItems: 80, description: "The complete current list, including completed tasks. Replaces the previous snapshot." }),
});

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim() : "";

export default function todoSidebar(pi: ExtensionAPI) {
	let state = emptyState();
	let panel: TodoPanel | undefined;
	let mounted: ReturnType<typeof mountSidebar> | undefined;
	let requestRender: (() => void) | undefined;
	let ticker: ReturnType<typeof setInterval> | undefined;
	let tickerAllowed = false;
	const agents = new AgentRegistry();

	const redraw = () => { panel?.setState(state); requestRender?.(); };
	const restore = (ctx: ExtensionContext) => { state = restoreState(ctx.sessionManager.getBranch()); redraw(); };
	const restoreAgents = (ctx: ExtensionContext) => {
		agents.reset();
		agents.restore(ctx.sessionManager.getBranch());
	};
	const save = (next: TodoState) => {
		pi.appendEntry(ENTRY_TYPE, next);
		state = next;
		redraw();
	};
	const stopTicker = () => { if (ticker) clearInterval(ticker); ticker = undefined; };
	const syncTicker = () => {
		if (!requestRender || !tickerAllowed) { stopTicker(); return; }
		const active = agents.snapshot().active.length > 0;
		if (active && !ticker) ticker = setInterval(() => requestRender?.(), 1000);
		else if (!active) stopTicker();
	};
	const redrawAgents = () => { syncTicker(); requestRender?.(); };
	const dispose = () => {
		stopTicker();
		tickerAllowed = false;
		mounted?.dispose();
		mounted = undefined;
		panel = undefined;
		requestRender = undefined;
	};

	// --- Agent roster feed -------------------------------------------------
	// Foreground children stream through the subagent tool call. Background
	// children report once at launch and once on completion. No polling: an
	// active row keeps ticking locally for its elapsed time only.
	pi.on("tool_execution_start", (event) => {
		if (event.toolName === "subagent_supervisor") {
			if (clean(record(event.args).action) === "reply") {
				agents.answered(clean(record(event.args).replyTo));
				redrawAgents();
			}
			return;
		}
		if (event.toolName !== "subagent") return;
		const rows = launchRows(event.args, event.toolCallId, Date.now());
		if (!rows.length) return;
		agents.merge(rows);
		redrawAgents();
	});
	pi.on("tool_execution_update", (event) => {
		if (event.toolName !== "subagent") return;
		agents.observe(record(record(event.partialResult).details), { toolCallId: event.toolCallId, final: false, now: Date.now() });
		redrawAgents();
	});
	pi.on("tool_execution_end", (event) => {
		if (event.toolName !== "subagent") return;
		const result = record(event.result);
		if (result.isError === true || event.isError === true) agents.fail(event.toolCallId);
		else agents.observe(record(result.details), { toolCallId: event.toolCallId, final: true, now: Date.now() });
		redrawAgents();
	});
	pi.on("message_end", (event) => {
		const message = record(event.message);
		if (message.role !== "custom") return;
		if (message.customType === "subagent-notify") {
			agents.notify(message);
			redrawAgents();
		} else if (message.customType === "subagent_supervisor_request") {
			agents.waiting(message.details);
			redrawAgents();
		}
	});

	// --- Session lifecycle -------------------------------------------------
	pi.on("session_start", (_event, ctx) => {
		dispose();
		restore(ctx);
		restoreAgents(ctx);
		if (ctx.mode !== "tui") return;
		let footerData: Parameters<Parameters<typeof ctx.ui.setFooter>[0] & Function>[2] | undefined;
		ctx.ui.setFooter((tui, _theme, data) => {
			footerData = data;
			const unsubscribe = data.onBranchChange(() => tui.requestRender());
			return {
				invalidate() {}, dispose: unsubscribe,
				render(width) {
					// Fullscreen already owns the header; regular mode keeps its native footer.
					if (mounted?.layout.enabled && isViewportTUI(tui) && sidebarWidth(tui.terminal.columns, tui.terminal.rows)) return [];
					return sessionLines(pi, ctx, data.getGitBranch(), data.getExtensionStatuses(), ctx.ui.theme, true).map(line => truncateToWidth(line, width));
				},
			};
		});
		// A zero-line widget provides the TUI reference and Pi-managed disposal.
		// Its content is drawn by a regular Container, not by a floating overlay.
		ctx.ui.setWidget("todo-sidebar-lifecycle", (tui) => {
			panel = new TodoPanel(() => ctx.ui.theme);
			panel.setState(state);
			mounted = mountSidebar(tui, panel, () => agents.snapshot(), (width) => {
				const statuses = footerData?.getExtensionStatuses() ?? new Map();
				const focus = statuses.get("focus");
				const lines = sessionLines(pi, ctx, footerData?.getGitBranch() ?? null, new Map(), undefined, true);
				const hasBranch = !!footerData?.getGitBranch();
				const labels = ["Proveedor  ", "Esfuerzo  ", "Proyecto  ", ...(hasBranch ? ["Rama  "] : []), "Contexto  ", "Tokens  ", "Coste estimado  "];
				const values = lines.map((line, index) => line.slice(labels[index].length));
				const metrics = values.slice(hasBranch ? 4 : 3);
				const project = clean(ctx.cwd.split("/").filter(Boolean).at(-1) ?? "/");
				const branch = hasBranch ? clean(values[3]) : "";
				const percent = ctx.getContextUsage()?.percent;
				const count = percent == null || !Number.isFinite(percent) ? 0 : Math.max(0, Math.min(8, Math.round(percent / 100 * 8)));
				const bar = ctx.ui.theme.fg("accent", "▰".repeat(count) + "▱".repeat(8 - count));
				const context = `${ctx.ui.theme.fg("muted", "ctx")} ${bar} ${percent == null || !Number.isFinite(percent) ? "?" : Math.round(percent) + "%"}`;
				const effortColors = { off: "dim", minimal: "muted", low: "success", medium: "accent", high: "warning", xhigh: "error", max: "thinkingHigh" } as const;
				const effort = values[1];
				const effortColor = Object.hasOwn(effortColors, effort) ? effortColors[effort as keyof typeof effortColors] : "text";
				const model = [truncateToWidth(clean(ctx.model?.id ?? "sin modelo"), 24), ctx.ui.theme.fg(effortColor, effort), truncateToWidth(clean(ctx.model?.provider ?? "sin proveedor"), 16)].join(" · ");
				const sep = ctx.ui.theme.fg("dim", " │ ");
				const right = [model, context, metrics[2], metrics[1]].join(sep);
				const left = [ctx.ui.theme.fg("accent", "✿") + " " + truncateToWidth(project, 24), branch ? ctx.ui.theme.fg("muted", branch) : "", focus ? ctx.ui.theme.fg("warning", "🔥 FOCUS") : ""].filter(Boolean).join(sep);
				const leftBudget = Math.max(0, Math.min(visibleWidth(left), width - visibleWidth(right) - 1));
				const trimmedLeft = truncateToWidth(left, leftBudget);
				const available = Math.max(0, width - visibleWidth(trimmedLeft) - (trimmedLeft ? 1 : 0));
				const trimmedRight = truncateToWidth(right, available);
				return trimmedLeft + " ".repeat(Math.max(0, width - visibleWidth(trimmedLeft) - visibleWidth(trimmedRight))) + trimmedRight;
			});
			requestRender = () => tui.requestRender();
			tickerAllowed = isViewportTUI(tui);
			redrawAgents();
			return { render: () => { mounted?.sync(); return []; }, invalidate: () => panel?.invalidate(), dispose };
		});
	});
	const restoreSession = (_event: unknown, ctx: ExtensionContext) => {
		restore(ctx);
		restoreAgents(ctx);
		redrawAgents();
	};
	pi.on("session_tree", restoreSession);
	pi.on("session_compact", restoreSession);
	pi.on("session_shutdown", dispose);

	pi.on("before_agent_start", () => {
		if (!state.todos.length) return;
		return { message: {
			customType: "todo-sidebar-context",
			content: "Current todo sidebar snapshot. Update it with todowrite as work progresses. Keep completed items while the plan is the same. If the user's new request is unrelated to this plan, replace it completely with new ids and a new title; do not carry over its tasks. To clear a plan that no longer applies, call todowrite with an empty todos list. Do not mark unfinished work completed.\n" + JSON.stringify(state),
			display: false,
		} };
	});

	pi.registerTool({
		name: "todowrite",
		label: "Plan de trabajo",
		description: "Replace the persistent todo sidebar with the complete latest plan. Keep all tasks, including completed ones, while the plan is the same. When the user starts unrelated work, replace the plan with new ids and a new title instead of carrying over the old tasks. Send an empty todos list to clear a plan that no longer applies. Use pending, in_progress, completed, or cancelled.",
		promptSnippet: "Update the persistent task sidebar with the complete latest plan.",
		promptGuidelines: [
			"For multi-step implementation or investigation, create a concise plan with todowrite before starting work. Skip it for trivial requests.",
			"Keep the sidebar current: mark a task in_progress before working on it, and completed immediately after verifying it. Update between work steps, not only at the end.",
			"Send the entire list on every todowrite call, preserving completed tasks and stable ids while the plan is the same. Never clear a finished list at the end of a turn. Replace it only when the user starts a genuinely new, unrelated plan.",
			"When the new request is unrelated to the current plan, use new ids and a new title, and do not keep the previous tasks. To clear a plan that no longer applies, send an empty todos list.",
			"Do not mark blocked, failed, or unverified tasks completed. Leave them pending or in_progress, or explicitly mark cancelled work cancelled.",
		],
		parameters,
		executionMode: "sequential",
		async execute(_id, params, signal) {
			if (signal?.aborted) throw new Error("Actualización cancelada.");
			const ids = new Set(params.todos.map(todo => clean(todo.id)));
			const overlaps = state.todos.some(todo => ids.has(todo.id));
			const fresh = params.todos.length === 0 || !overlaps;
			const next = parseState({ version: 1, title: params.title ?? (fresh ? "Plan de trabajo" : state.title), todos: params.todos });
			save(next);
			const done = next.todos.filter(todo => todo.status === "completed").length;
			const text = next.todos.length
				? `${done}/${next.todos.length} tareas completadas. El panel conserva la lista completa.`
				: "Plan borrado. El panel queda vacío.";
			return {
				content: [{ type: "text", text }],
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

	pi.registerCommand("agents", {
		description: "Ver los subagentes de la sesión. Opción: clear.",
		handler: async (args, ctx) => {
			if (args.trim().toLowerCase() === "clear") {
				agents.clearTerminal();
				redrawAgents();
				return;
			}
			const rows = agents.list();
			if (ctx.mode !== "tui") {
				const text = rows.length
					? rows.map(row => `${phaseStyle(row.phase).icon} ${row.agent} · ${phaseLabel(row.phase)}${row.task ? ` · ${row.task}` : ""}`).join("\n")
					: "Sin subagentes en esta sesión.";
				ctx.ui.notify(text, "info");
				return;
			}
			await ctx.ui.custom<void>((tui, _theme, _keys, done) => {
				let offset = 0;
				let maxOffset = 0;
				let pageHeight = 1;
				return {
					render(width: number) {
						const th = ctx.ui.theme;
						const lines = agents.list();
						const body = lines.flatMap(row => {
							const style = phaseStyle(row.phase);
							const time = rowTime(row, Date.now());
							const head = `${th.style(style.icon, { fg: style.color })} ${th.style(row.agent, { fg: agentColor(row.agent, th), bold: true })}`;
							const meta = th.fg("muted", ` · ${phaseLabel(row.phase)}`) + (time ? th.fg("dim", ` · ${time}`) : "");
							const rows = [head + meta];
							if (row.task) rows.push(...wrapTextWithAnsi(row.task, Math.max(1, width - 4)).map(text => th.fg("dim", "  " + text)));
							return rows;
						});
						if (!body.length) body.push(th.fg("muted", "  Sin subagentes todavía. /agents"));
						pageHeight = Math.max(1, Math.min(Math.floor(tui.terminal.rows * 0.95) - 3, 30));
						maxOffset = Math.max(0, body.length - pageHeight);
						offset = Math.min(offset, maxOffset);
						return [
							th.fg("mdHeading", "─".repeat(width)),
							th.bold(th.fg("text", "  Subagentes de la sesión")),
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

	pi.registerCommand("todos", {
		description: "Ver el plan completo. Opciones: show, hide, clear.",
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
			if (action === "show" || action === "hide") {
				if (mounted) mounted.layout.enabled = action === "show";
				requestRender?.();
				return;
			}
			if (action) {
				ctx.ui.notify("Uso: /todos [show|hide|clear]", "info");
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
