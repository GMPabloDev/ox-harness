import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, HStack, isViewportTUI, ScrollView, VStack, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Component, TUI, TuiMouseEvent } from "@earendil-works/pi-tui";

export type Status = "pending" | "in_progress" | "completed" | "cancelled";
export interface Todo { id: string; content: string; status: Status }
export interface TodoState { version: 1; title: string; todos: Todo[] }
export const ENTRY_TYPE = "todo-sidebar-state";
export const emptyState = (): TodoState => ({ version: 1, title: "Plan de trabajo", todos: [] });

// No terminal controls, bidi overrides, or multi-line titles in stored task text.
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
	if (columns < 120 || rows < 16) return 0;
	return Math.min(50, Math.max(33, Math.floor(columns * 0.26)));
}

/** Apply follow targets only after native layout has measured the new content. */
class TaskScrollView extends ScrollView {
	followingActive = true;
	target: number | undefined = 0;
	scrollBy(lines: number): number {
		this.followingActive = false;
		super.scrollBy(lines);
		// Pi 1.4 can otherwise send leftover wheel delta to the primary chat.
		return 0;
	}
	scrollTo(...args: Parameters<ScrollView["scrollTo"]>): void {
		this.followingActive = false;
		super.scrollTo(...args);
	}
	updateLayout(contentHeight: number, viewportHeight: number, requestRender: () => void): void {
		super.updateLayout(contentHeight, viewportHeight, requestRender);
		if (this.followingActive && this.target !== undefined) super.scrollTo(this.target);
		this.target = undefined;
	}
}

export class TodoPanel extends VStack {
	state = emptyState();
	readonly scroll: TaskScrollView;
	private height = 24;
	private bodyCache = new Map<number, string[]>();
	private headerCache = new Map<number, string[]>();
	private contentRows = 0;

	constructor(private theme: () => Theme) {
		super();
		const body = { render: (width: number) => this.renderBody(width), invalidate: () => this.bodyCache.clear() };
		this.scroll = new TaskScrollView(body, {
			primary: false, follow: "none", overscroll: "contain", scrollbar: "always",
			scrollbarTrackStyle: text => this.scrollbarStyle(text, "borderMuted"),
			scrollbarThumbStyle: () => this.scrollbarStyle("┃", "muted"),
		});
		this.addChild({
			render: width => this.renderHeader(width),
			invalidate: () => this.headerCache.clear(),
			handleMouse: (event: TuiMouseEvent) => {
				if (event.type !== "wheel") return;
				this.scrollBy(event.wheelDelta ?? 0);
				return { handled: true, render: true };
			},
		}, { shrink: 0 });
		this.addChild(this.scroll, { basis: 0, grow: 1, shrink: 1, minSize: 1 });
	}
	getTheme(): Theme { return this.theme(); }
	setState(state: TodoState): void {
		const newPlan = state.title !== this.state.title || state.todos.map(t => t.id).join("\0") !== this.state.todos.map(t => t.id).join("\0");
		this.state = state;
		if (newPlan) { this.scroll.followingActive = true; this.scroll.target = 0; }
		this.invalidate();
	}
	setHeight(height: number): void {
		if (height === this.height) return;
		this.height = height;
		this.invalidate();
	}
	scrollBy(lines: number): void { this.scroll.scrollBy(lines); }
	scrollToEdge(edge: "top" | "bottom"): void {
		this.scroll.followingActive = false;
		if (edge === "top") this.scroll.scrollToStart();
		else this.scroll.scrollToEnd();
	}
	follow(): void {
		this.scroll.followingActive = true;
		this.scroll.target = 0;
		this.invalidate();
	}
	invalidate(): void { this.bodyCache.clear(); this.headerCache.clear(); }
	render(width: number): string[] { return this.renderHeight(width, this.height); }

	private line(text: string, width: number): string {
		return this.theme().bg("toolPendingBg", "  " + fit(text, Math.max(0, width - 3)) + " ");
	}
	private scrollbarStyle(text: string, color: "borderMuted" | "muted"): string {
		const th = this.theme();
		return th.bg("toolPendingBg", this.contentRows > this.scroll.viewportHeight ? th.fg(color, text) : " ");
	}
	private renderHeader(width: number): string[] {
		const cached = this.headerCache.get(width);
		if (cached) return cached;
		const th = this.theme();
		const amber = th.colors.mdHeading;
		const { todos, title } = this.state;
		const completed = todos.filter(t => t.status === "completed").length;
		const inner = Math.max(1, width - 3);
		const count = `${completed}/${todos.length}`;
		const maxDots = Math.max(1, Math.floor((inner - count.length - 2) / 2));
		const dots = Math.min(todos.length, maxDots);
		const proportional = todos.length ? Math.round(dots * completed / todos.length) : 0;
		const filled = dots > 1 && completed > 0 && completed < todos.length ? Math.max(1, Math.min(dots - 1, proportional)) : proportional;
		const progress = Array.from({ length: dots }, (_, index) => index < filled
			? th.style("●", { fg: amber }) : th.fg("borderMuted", "○")).join(" ");
		const lines = [
			"",
			...wrapTextWithAnsi(title, inner).map(text => th.style(text, { fg: "text", bold: true })),
			"",
			progress + th.fg("muted", `${dots ? "  " : ""}${count}`),
			"",
		].map(text => this.line(text, width));
		this.headerCache.set(width, lines);
		return lines;
	}
	private renderBody(width: number): string[] {
		const cached = this.bodyCache.get(width);
		if (cached) { this.contentRows = cached.length; return cached; }
		const th = this.theme();
		const body: string[] = [];
		let activeRow: number | undefined;
		for (const todo of this.state.todos) {
			const done = todo.status === "completed";
			const removed = todo.status === "cancelled";
			const current = todo.status === "in_progress";
			if (current && activeRow === undefined) activeRow = body.length;
			const marker = current ? "●" : done ? "✓" : removed ? "−" : "○";
			const markerColor = current ? th.colors.mdHeading : done ? th.colors.success : th.colors.dim;
			for (const [row, text] of wrapTextWithAnsi(todo.content, Math.max(1, width - 6)).entries()) {
				body.push(th.style(row ? "   " : `${marker}  `, { fg: markerColor }) + th.style(text, {
					fg: done || removed ? "dim" : current ? "text" : "muted", strikethrough: done || removed, bold: current,
				}));
			}
			body.push("");
		}
		if (body.length) body.pop();
		else body.push(th.fg("muted", "El plan aparecerá aquí"), th.fg("muted", "cuando empiece el trabajo."));
		if (this.scroll.followingActive && activeRow !== undefined) this.scroll.target = activeRow;
		const lines = body.map(text => this.line(text, width));
		this.contentRows = lines.length;
		this.bodyCache.set(width, lines);
		return lines;
	}

	/** Height needed for the complete list at this width, before viewport clipping. */
	naturalHeight(width: number): number {
		return this.renderHeader(width).length + this.renderBody(Math.max(1, width - 1)).length;
	}

	/** Regular mode uses the same scroll state, without enabling mouse capture. */
	renderHeight(width: number, height: number): string[] {
		if (width < 1 || height < 1) return Array.from({ length: Math.max(0, height) }, () => "");
		this.setHeight(height);
		const header = this.renderHeader(width);
		const capacity = Math.max(1, height - header.length);
		const body = this.renderBody(width - 1);
		this.scroll.updateLayout(body.length, capacity, () => {});
		const max = Math.max(0, body.length - capacity);
		const thumbHeight = Math.max(Math.min(2, capacity), Math.round(capacity * capacity / body.length));
		const thumbTop = max ? Math.round(this.scroll.scrollTop / max * (capacity - thumbHeight)) : 0;
		return [...header, ...Array.from({ length: capacity }, (_, row) => {
			const thumb = row >= thumbTop && row < thumbTop + thumbHeight;
			return (body[this.scroll.scrollTop + row] ?? this.line("", width - 1)) + this.scrollbarStyle(thumb ? "┃" : "│", thumb ? "muted" : "borderMuted");
		})];
	}
}

function fit(text: string, width: number): string {
	const clipped = truncateToWidth(text, width);
	return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

/** Two sections with separate left rails; the task ScrollView remains a native layout node. */
export class Sidebar extends VStack {
	private height = 24;
	private status: () => string[] = () => [];
	constructor(private tui: TUI, readonly tasks: TodoPanel, private theme: () => Theme) {
		super();
		const edge = (text: string) => this.theme().fg("mdCode", text);
		const vertical = () => ({ render: () => Array.from({ length: this.tui.terminal.rows }, () => edge("│")), invalidate() {} });
		const info = { render: (width: number) => this.infoLines().map(line => edge("│") + fit(" " + line, Math.max(0, width - 1))), invalidate() {} };
		const taskRow = new HStack([], { align: "stretch" });
		taskRow.addChild(vertical(), { basis: 1, grow: 0, shrink: 0 });
		taskRow.addChild(tasks, { basis: 0, grow: 1, shrink: 1, minSize: 1 });
		this.addChild(info, { shrink: 0 });
		this.addChild({ render: () => [""], invalidate() {} }, { shrink: 0, visible: () => this.tasks.state.todos.length > 0 });
		this.addChild(taskRow, { basis: 0, grow: 0, shrink: 1, minSize: 1, visible: viewport => {
			if (!this.tasks.state.todos.length) return false;
			const width = sidebarWidth(viewport.width, viewport.height);
			const available = Math.max(1, viewport.height - this.infoRows() - 1);
			const height = Math.min(available, this.tasks.naturalHeight(Math.max(1, width - 1)));
			this.entries[2].basis = height;
			this.tasks.setHeight(height);
			return true;
		} });
	}
	setStatus(get: () => string[]): void { this.status = get; }
	setHeight(height: number): void { this.height = height; this.tasks.setHeight(Math.max(1, height - this.infoRows() - 1)); }
	private infoRows(): number { return Math.max(1, Math.min(this.status().length, Math.max(1, this.height - (this.tasks.state.todos.length ? 8 : 0)))); }
	private infoLines(): string[] { const lines = this.status().slice(0, this.infoRows()); return lines.length ? lines : [""]; }
	render(width: number): string[] { return this.renderHeight(width, this.height); }
	renderHeight(width: number, height: number): string[] {
		this.setHeight(height);
		const edge = (text: string) => this.theme().fg("mdCode", text);
		const info = this.infoLines().map(line => edge("│") + fit(" " + line, width - 1));
		if (!this.tasks.state.todos.length) return [...info, ...Array(Math.max(0, height - info.length)).fill(" ".repeat(width))];
		const available = Math.max(1, height - info.length - 1);
		const taskHeight = Math.min(available, this.tasks.naturalHeight(width - 1));
		const body = this.tasks.renderHeight(width - 1, taskHeight);
		const lines = [...info, " ".repeat(width), ...body.map(line => edge("│") + fit(line, width - 1))];
		return [...lines, ...Array(Math.max(0, height - lines.length)).fill(" ".repeat(width))];
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
		if (!side) return super.render(width);
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
	constructor(tui: TUI, root: Component, panel: Sidebar, regular: TodoSidebarLayout) {
		super([], { gap: SIDEBAR_GAP, align: "stretch" });
		this.addChild(root, { basis: 0, grow: 1, shrink: 1, minSize: 1 });
		this.addChild(panel, {
			basis: 0, grow: 0, shrink: 0,
			visible: viewport => {
				panel.setHeight(tui.terminal.rows);
				const side = regular.enabled ? sidebarWidth(viewport.width, tui.terminal.rows) : 0;
				this.entries[1].basis = side;
				return side > 0;
			},
		});
	}
}

export function mountSidebar(tui: TUI, tasks: TodoPanel, status: () => string[] = () => []): { layout: TodoSidebarLayout; sync(): void; dispose(): void } {
	const panel = new Sidebar(tui, tasks, () => tasks.getTheme());
	panel.setStatus(status);
	const children = [...tui.children];
	const layout = new TodoSidebarLayout(tui, panel, children);
	tui.children.splice(0, tui.children.length, layout);
	let nativeRoot: Component | undefined;
	let fullscreen: FullscreenSidebarLayout | undefined;
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
		fullscreen = new FullscreenSidebarLayout(tui, nativeRoot, panel, layout);
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
