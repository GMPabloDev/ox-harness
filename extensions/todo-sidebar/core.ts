import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, HStack, isViewportTUI, VStack, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { agentColor, phaseStyle, rowTime } from "./agents.ts";
import type { AgentRow, AgentSnapshot } from "./agents.ts";

export type Status = "pending" | "in_progress" | "completed" | "cancelled";
export interface Todo { id: string; content: string; status: Status }
export interface TodoState { version: 1; title: string; todos: Todo[] }
export const ENTRY_TYPE = "todo-sidebar-state";
export const emptyState = (): TodoState => ({ version: 1, title: "Plan de trabajo", todos: [] });

const MAX_AGENT_ROWS = 8;
const PLAN_CHROME = 4;

// No terminal controls, bidi overrides, or multi-line task text in stored text.
export function cleanText(text: string): string {
	return text.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim();
}

export function parseState(value: unknown): TodoState {
	if (!value || typeof value !== "object") throw new Error("El plan no es válido.");
	const input = value as Record<string, unknown>;
	if (input.version !== 1 || typeof input.title !== "string" || !Array.isArray(input.todos) || input.todos.length > 80) {
		throw new Error("El plan debe tener versión 1, título y hasta 80 tareas.");
	}
	const title = cleanText(input.title);
	if (!title || title.length > 100) throw new Error("El título debe tener entre 1 y 100 caracteres.");
	const ids = new Set<string>();
	const todos = input.todos.map((item): Todo => {
		if (!item || typeof item !== "object") throw new Error("Tarea no válida.");
		const { id, content, status } = item;
		if (typeof id !== "string" || typeof content !== "string" || !["pending", "in_progress", "completed", "cancelled"].includes(status)) {
			throw new Error("Cada tarea necesita id, content y status válidos.");
		}
		const key = cleanText(id);
		const text = cleanText(content);
		if (!key || key.length > 64 || ids.has(key) || !text || text.length > 300) {
			throw new Error("Los ids deben ser únicos y el texto debe tener entre 1 y 300 caracteres.");
		}
		ids.add(key);
		return { id: key, content: text, status };
	});
	return { version: 1, title, todos };
}

export function restoreState(entries: Iterable<unknown>): TodoState {
	let state = emptyState();
	for (const raw of entries) {
		const entry = raw as { type?: string; customType?: string; data?: unknown };
		if (entry?.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
		try { state = parseState(entry.data); } catch { /* Ignore incompatible or damaged snapshots. */ }
	}
	return state;
}

const SIDEBAR_GAP = 5;

export function sidebarWidth(columns: number, rows: number): number {
	// Same rail as gentle-shell: 50 columns from 140, hidden on narrower terminals.
	if (columns < 140 || rows < 16) return 0;
	return 50;
}

function fit(text: string, width: number): string {
	const clipped = truncateToWidth(text, Math.max(0, width));
	return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

/** Top rule with the embedded section label and the right-aligned meta. */
function sectionTop(theme: Theme, width: number, label: string, meta: string): string {
	const name = `▾ ${label}`;
	const frame = (text: string) => theme.fg("border", text);
	const hintRoom = Math.max(0, width - 8 - visibleWidth(name));
	const hint = meta ? truncateToWidth(meta, hintRoom) : "";
	const hintWidth = hint ? visibleWidth(hint) + 2 : 0;
	const title = truncateToWidth(name, Math.max(1, width - 5 - hintWidth));
	const fill = Math.max(0, width - 5 - visibleWidth(title) - hintWidth);
	return frame("╭─ ") + theme.bold(theme.fg("text", title)) + frame(" " + "─".repeat(fill))
		+ (hint ? frame(" ") + theme.fg("muted", hint) + frame(" ") : "") + frame("╮");
}

/** Box interior rows with one-cell padding on both sides. */
function boxRows(theme: Theme, width: number, rows: string[]): string[] {
	const edge = theme.fg("border", "│");
	const content = Math.max(0, width - 4);
	return rows.map(row => edge + " " + fit(row, content) + " " + edge);
}

function boxBottom(theme: Theme, width: number): string {
	return theme.fg("border", "╰" + "─".repeat(Math.max(0, width - 2)) + "╯");
}

/**
 * Plan content for the PLAN box. The list grows with the work. When it no
 * longer fits, completed tasks collapse into one summary row and pending
 * tasks beyond the screen budget become a `+N más` row. There is no scroll.
 */
export class TodoPanel {
	state = emptyState();
	private cache = new Map<number, string[][]>();

	constructor(private theme: () => Theme) {}
	getTheme(): Theme { return this.theme(); }
	setState(state: TodoState): void {
		this.state = state;
		this.invalidate();
	}
	invalidate(): void { this.cache.clear(); }

	private groups(width: number): string[][] {
		const cached = this.cache.get(width);
		if (cached) return cached;
		const th = this.theme();
		const text = Math.max(1, width);
		const groups = this.state.todos.map(todo => {
			const done = todo.status === "completed";
			const removed = todo.status === "cancelled";
			const current = todo.status === "in_progress";
			const marker = current ? "●" : done ? "✓" : removed ? "−" : "○";
			const budget = Math.max(1, text - 3);
			return wrapTextWithAnsi(todo.content, budget).map((line, row) => fit(th.style((row ? "   " : `${marker}  `) + line, {
				fg: done || removed ? "dim" : current ? "text" : "muted",
				strikethrough: done || removed,
				bold: current,
			}), text));
		});
		this.cache.set(width, groups);
		return groups;
	}

	/** Rows for the box interior. Width excludes both borders; capacity is the row budget. */
	render(width: number, capacity: number): string[] {
		const th = this.theme();
		const text = Math.max(1, width);
		const groups = this.groups(text);
		const all = this.state.todos.map((todo, index) => ({ todo, index, rows: groups[index] }));
		const total = all.reduce((sum, item) => sum + item.rows.length, 0);
		if (!total) return [fit(th.fg("muted", "sin tareas · /todos"), text)];
		if (total <= capacity) return groups.flat();

		const live = all.filter(item => item.todo.status !== "completed" && item.todo.status !== "cancelled");
		const closed = all.filter(item => item.todo.status === "completed" || item.todo.status === "cancelled");
		const active = live.findIndex(item => item.todo.status === "in_progress");
		const summaryLine = (items: typeof all): string | undefined => {
			const completed = items.filter(item => item.todo.status === "completed").length;
			const cancelled = items.filter(item => item.todo.status === "cancelled").length;
			const parts = [completed ? `✓ ${completed}` : "", cancelled ? `− ${cancelled}` : ""].filter(Boolean);
			return parts.length ? fit(th.fg("dim", `${parts.join(" · ")} · /todos`), text) : undefined;
		};
		/** Newest finished rows first; the rest stay behind the summary. */
		const newestClosed = (budget: number): Set<number> => {
			const chosen = new Set<number>();
			let used = 0;
			for (let index = closed.length - 1; index >= 0; index--) {
				if (used + closed[index].rows.length > budget) break;
				chosen.add(closed[index].index);
				used += closed[index].rows.length;
			}
			return chosen;
		};
		const compose = (chosen: Set<number>, summary: string | undefined): string[] =>
			[...(summary ? [summary] : []), ...all.filter(item => chosen.has(item.index)).flatMap(item => item.rows)];

		if (capacity <= 1) {
			const item = live[active >= 0 ? active : 0] ?? closed[closed.length - 1];
			return item ? [item.rows[0]] : [];
		}
		if (!live.length) {
			const chosen = newestClosed(capacity - 1);
			return compose(chosen, summaryLine(closed.filter(item => !chosen.has(item.index)))).slice(0, capacity);
		}

		const liveRows = live.reduce((sum, item) => sum + item.rows.length, 0);
		if (liveRows < capacity) {
			// All live work fits. Spend the remaining rows on the newest finished work.
			const chosen = new Set<number>(live.map(item => item.index));
			for (const index of newestClosed(capacity - liveRows - 1)) chosen.add(index);
			return compose(chosen, summaryLine(closed.filter(item => !chosen.has(item.index)))).slice(0, capacity);
		}
		if (liveRows === capacity) return live.flatMap(item => item.rows);

		// Live work alone does not fit: the active task is mandatory, then the
		// nearest following tasks, then the nearest previous ones.
		const budget = Math.max(0, capacity - (closed.length ? 1 : 0) - 1);
		const chosen = new Set<number>();
		let used = 0;
		const take = (index: number) => {
			const item = live[index];
			if (chosen.has(item.index) || used + item.rows.length > budget) return;
			chosen.add(item.index);
			used += item.rows.length;
		};
		if (active >= 0) {
			chosen.add(live[active].index);
			used += live[active].rows.length;
			for (let index = active + 1; index < live.length; index++) take(index);
			for (let index = active - 1; index >= 0; index--) take(index);
		} else {
			for (let index = 0; index < live.length; index++) take(index);
		}
		const hidden = live.length - chosen.size;
		const body = compose(chosen, summaryLine(closed));
		if (hidden && body.length < capacity) body.push(fit(th.fg("muted", `+${hidden} más · /todos`), text));
		return body.slice(0, Math.max(1, capacity));
	}
}

function planMeta(state: TodoState): string {
	if (!state.todos.length) return "vacío";
	const done = state.todos.filter(todo => todo.status === "completed").length;
	return `${done}/${state.todos.length}`;
}

export class Sidebar extends VStack {
	private height: number;
	constructor(private tui: TUI, readonly tasks: TodoPanel, private agents: () => AgentSnapshot, private theme: () => Theme) {
		super([], { gap: 0 });
		this.height = tui.terminal.rows;
		const line = (render: (width: number) => string[]): Component => ({ render, invalidate() {} });
		this.addChild(line(() => [""]), { basis: 1, shrink: 0 });
		this.addChild({ render: (width: number) => this.agentSection(width), invalidate() {} }, { shrink: 0 });
		this.addChild(line(() => [""]), { basis: 1, shrink: 0 });
		this.addChild({ render: (width: number) => this.planSection(width), invalidate() {} }, { shrink: 0 });
	}
	/** Row budget for the plan, after the fixed chrome and the agent rows. */
	private planCapacity(width: number, agentsHeight = this.agentSection(width).length): number {
		return Math.max(1, this.height - agentsHeight - PLAN_CHROME);
	}
	private planSection(width: number): string[] {
		const rows = this.tasks.render(Math.max(1, width - 4), this.planCapacity(width));
		return [sectionTop(this.theme(), width, "PLAN", planMeta(this.tasks.state)), ...boxRows(this.theme(), width, rows), boxBottom(this.theme(), width)];
	}
	setHeight(height: number): void {
		if (height === this.height) return;
		this.height = height;
		this.invalidate();
	}
	invalidate(): void { this.tasks.invalidate(); }
	render(width: number): string[] {
		return this.renderHeight(width, this.height);
	}
	private maxAgentRows(): number {
		return Math.max(1, Math.min(MAX_AGENT_ROWS, this.height - 12));
	}
	private agentSection(width: number): string[] {
		const th = this.theme();
		const snapshot = this.agents();
		const rows = [...snapshot.active, ...snapshot.recent];
		const limit = this.maxAgentRows();
		const shown = rows.slice(0, limit);
		const body = shown.map(row => this.agentLine(row, width, snapshot.now));
		if (rows.length > shown.length) body.push(th.fg("muted", `+${rows.length - shown.length} más · /agents`));
		if (!body.length) body.push(th.fg("muted", "ninguno activo · /agents"));
		const count = snapshot.active.length;
		const meta = count ? `${count} ${count === 1 ? "activo" : "activos"}` : "idle";
		return [sectionTop(th, width, "AGENTS", meta), ...boxRows(th, width, body), boxBottom(th, width)];
	}
	private agentLine(row: AgentRow, width: number, now: number): string {
		const th = this.theme();
		const content = Math.max(1, width - 4);
		const style = phaseStyle(row.phase);
		const time = rowTime(row, now);
		const nameBudget = Math.max(1, content - 2 - (time ? visibleWidth(time) + 1 : 0));
		const name = truncateToWidth(row.agent, nameBudget);
		const left = th.style(style.icon, { fg: style.color }) + " " + th.style(name, { fg: agentColor(row.agent, th), bold: true });
		if (!time) return left;
		const gap = Math.max(1, content - visibleWidth(left) - visibleWidth(time));
		return left + " ".repeat(gap) + th.fg("dim", time);
	}
	renderHeight(width: number, height: number): string[] {
		this.setHeight(height);
		const agents = this.agentSection(width);
		const rows = this.tasks.render(Math.max(1, width - 4), this.planCapacity(width, agents.length));
		const lines = ["", ...agents, "", sectionTop(this.theme(), width, "PLAN", planMeta(this.tasks.state)), ...boxRows(this.theme(), width, rows), boxBottom(this.theme(), width)];
		return Array.from({ length: Math.max(0, height) }, (_, index) => fit(lines[index] ?? "", width));
	}
}

/** Regular-mode layout. The original components retain focus and input ownership. */
export class TodoSidebarLayout extends Container {
	enabled = true;
	constructor(private tui: TUI, readonly panel: Sidebar, children: Component[]) {
		super();
		this.children = children;
	}
	invalidate(): void { super.invalidate(); this.panel.invalidate(); }
	render(width: number): string[] {
		const height = this.tui.terminal.rows;
		const side = this.enabled && this.tui.mode === "regular" ? sidebarWidth(width, height) : 0;
		if (!side) return [...super.render(width)];
		const mainWidth = width - side - SIDEBAR_GAP;
		const blocks = this.children.map(child => child.render(mainWidth));
		const length = blocks.reduce((sum, block) => sum + block.length, 0);
		// Keep the editor and native footer at the bottom when the chat is short.
		if (length < height && blocks.length) blocks.splice(1, 0, Array<string>(height - length).fill(""));
		const left = blocks.flat();
		const right = this.panel.renderHeight(side, height);
		const top = Math.max(0, left.length - height);
		return left.map((text, row) => {
			// Only the visible viewport has a panel. No old task snapshots in the document.
			if (row < top) return text;
			return fit(text, mainWidth) + "\x1b[0m" + " ".repeat(SIDEBAR_GAP) + right[row - top];
		});
	}
}

class FullscreenSidebarLayout extends HStack {
	constructor(tui: TUI, root: Component, panel: Sidebar, regular: TodoSidebarLayout, reservedRows: number) {
		super([], { gap: SIDEBAR_GAP, align: "stretch" });
		this.addChild(root, { basis: 0, grow: 1, shrink: 1, minSize: 1 });
		this.addChild(panel, {
			basis: 0, grow: 0, shrink: 0,
			visible: viewport => {
				panel.setHeight(Math.max(1, tui.terminal.rows - reservedRows));
				const side = regular.enabled ? sidebarWidth(viewport.width, tui.terminal.rows) : 0;
				this.entries[1].basis = side;
				return side > 0;
			},
		});
	}
}

export function mountSidebar(tui: TUI, tasks: TodoPanel, agents: () => AgentSnapshot, header?: (width: number) => string): { layout: TodoSidebarLayout; sync(): void; dispose(): void } {
	const panel = new Sidebar(tui, tasks, agents, () => tasks.getTheme());
	const children = [...tui.children];
	const layout = new TodoSidebarLayout(tui, panel, children);
	tui.children.splice(0, tui.children.length, layout);
	let nativeRoot: Component | undefined;
	let fullscreen: Component | undefined;
	let disposed = false;
	const sync = () => {
		if (disposed || !isViewportTUI(tui)) return;
		// Pi 1.4 exposes setLayoutRoot but has no getter. Keep this single guarded
		// compatibility read isolated here. Unknown renderers retain their native UI.
		const current: unknown = Reflect.get(tui, "layoutRoot");
		if (current === fullscreen || !current || typeof current !== "object" ||
			!("render" in current) || typeof current.render !== "function" ||
			!("invalidate" in current) || typeof current.invalidate !== "function") return;
		nativeRoot = current as Component;
		const row = new FullscreenSidebarLayout(tui, nativeRoot, panel, layout, header ? 3 : 0);
		fullscreen = header ? new VStack([
			{ component: { render: (width: number) => ["", width < 2 ? truncateToWidth(header(width), width) : " " + fit(header(width - 2), width - 2) + " ", ""], invalidate() {} }, basis: 3, shrink: 0 },
			{ component: row, basis: 0, grow: 1, minSize: 1 },
		]) : row;
		tui.setLayoutRoot(fullscreen);
	};
	sync();
	tui.requestRender(true);
	return {
		layout, sync,
		dispose() {
			if (disposed) return;
			disposed = true;
			if (isViewportTUI(tui) && fullscreen && Reflect.get(tui, "layoutRoot") === fullscreen) tui.setLayoutRoot(nativeRoot);
			const index = tui.children.indexOf(layout);
			if (index >= 0) tui.children.splice(index, 1, ...layout.children);
			tui.requestRender(true);
		},
	};
}
