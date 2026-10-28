import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { Container, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component, TUI, TuiMouseEvent } from "@earendil-works/pi-tui";
import { agentColor, MEMORY_COLOR, subagentCards, WEB_COLOR } from "./cards.ts";
import { activityLabel, cleanLine, customActivity, customAgent, hasAssistantError, isAnswer, record, toolHasError, toolPolicy, withoutThinking } from "./policy.ts";
import type { ToolPolicy } from "./policy.ts";

interface NativeComponent extends Component {
	children?: Component[];
	lastMessage?: unknown;
	message?: unknown;
	entry?: unknown;
	skillBlock?: unknown;
	isStreaming?: boolean;
	toolName?: string;
	toolCallId?: string;
	args?: unknown;
	result?: unknown;
	isPartial?: boolean;
	outputPad?: number;
	markdownTheme?: unknown;
	markdownTransformers?: unknown;
	hiddenThinkingLabel?: string;
}
interface SavedComponent {
	render: Component["render"];
	handleMouse: Component["handleMouse"];
	invalidate: Component["invalidate"];
	wrapper: Component["render"];
	projection?: Component;
	message?: unknown;
}

type Kind = "assistant" | "tool" | "custom" | "skill" | "user" | "other";

function chipIcon(policy: ToolPolicy): string {
	if (policy === "memory") return "🧠";
	if (policy === "web") return "🌐";
	if (policy === "subagent") return "◆";
	return "✦";
}

function chipStyle(policy: ToolPolicy, input: unknown): { color?: ThemeColor; agent?: string } {
	if (policy === "memory") return { color: MEMORY_COLOR };
	if (policy === "web") return { color: WEB_COLOR };
	if (policy === "subagent") return { agent: cleanLine(record(input).agent, 40) || undefined };
	return { color: "muted" };
}

function kind(component: NativeComponent): Kind {
	const name = component.constructor.name;
	if (name === "AssistantMessageComponent" && "lastMessage" in component && "updateContent" in component) return "assistant";
	if (name === "ToolExecutionComponent" && typeof component.toolName === "string" && "updateResult" in component) return "tool";
	if (name === "CustomMessageComponent" && "message" in component) return "custom";
	if (name === "SkillInvocationMessageComponent" && typeof record(component.skillBlock).name === "string") return "skill";
	if (name === "UserMessageComponent" || name === "SkillInvocationMessageComponent") return "user";
	return "other";
}

/**
 * Pi 1.4 compatibility boundary. Pi exposes widgets but no transcript filter.
 * The native document is retained in tui.children in both TUI modes, also when
 * todo-sidebar wraps those children. Do not replace layout roots or scroll views.
 * Unknown layouts retain the unfiltered UI instead of guessing at child indices.
 */
export function findChat(tui: Pick<TUI, "children">): Container | undefined {
	const seen = new Set<Component>();
	const visit = (node: Component): Container | undefined => {
		if (seen.has(node)) return;
		seen.add(node);
		const children = (node as NativeComponent).children;
		if (!Array.isArray(children)) return;
		if (node.constructor.name === "Container" && children.length === 3 &&
			children.every(child => child.constructor.name === "Container" && Array.isArray((child as NativeComponent).children))) {
			return children[2] as Container;
		}
		for (const child of children) {
			const found = visit(child);
			if (found) return found;
		}
	};
	for (const root of tui.children) {
		const found = visit(root);
		if (found) return found;
	}
}

export class FocusView {
	enabled = true;
	busy = false;
	private published = new WeakSet<object>();
	private selected = new Set<Component>();
	private saved = new Map<NativeComponent, SavedComponent>();
	private nativeRender: Component["render"];
	private chatRender: Component["render"];
	private disposed = false;
	private nested = new Map<string, Map<string, { name: string; args: unknown; pending: boolean; error: boolean }>>();

	// Nested codemode calls are not transcript entries. Observe only their
	// presentation metadata so web/memory/subagent activity remains visible.
	nestedStart(parent: string, id: string, name: string, args: unknown): void {
		let calls = this.nested.get(parent);
		if (!calls) this.nested.set(parent, calls = new Map());
		calls.set(id, { name, args, pending: true, error: false });
	}
	nestedEnd(parent: string, id: string, error: boolean): void {
		const call = this.nested.get(parent)?.get(id);
		if (call) { call.pending = false; call.error = error; }
	}

	constructor(private chat: Container, private theme: () => Theme, private requestRender?: () => void) {
		this.nativeRender = chat.render;
		this.chatRender = (width: number) => {
			this.prepare();
			return this.nativeRender.call(chat, width);
		};
		chat.render = this.chatRender;
	}

	private prepare(): void {
		const live = new Set(this.chat.children);
		for (const [component, saved] of this.saved) {
			if (live.has(component)) continue;
			this.restore(component, saved);
			this.saved.delete(component);
			if (component.toolCallId) this.nested.delete(component.toolCallId);
		}
		this.selected.clear();
		let candidate: NativeComponent | undefined;
		const publish = () => {
			if (!candidate) return;
			this.selected.add(candidate);
			const message = candidate.lastMessage;
			if (message && typeof message === "object") this.published.add(message);
		};
		for (const raw of this.chat.children) {
			const child = raw as NativeComponent;
			const type = kind(child);
			if (type === "user" || type === "skill") { publish(); candidate = undefined; }
			if (type === "assistant") candidate = !child.isStreaming && isAnswer(child.lastMessage) ? child : undefined;
			if (["assistant", "tool", "custom", "skill"].includes(type)) this.wrap(child);
		}
		// agent_end is not sufficient: retries, compaction and extensions can continue.
		if (!this.busy) publish();
	}

	private wrap(component: NativeComponent): void {
		if (this.saved.has(component)) return;
		const saved: SavedComponent = {
			render: component.render, handleMouse: component.handleMouse, invalidate: component.invalidate,
			wrapper: (width: number) => this.render(component, saved, width),
		};
		component.render = saved.wrapper;
		component.handleMouse = (event: TuiMouseEvent) => {
			if (!this.enabled || this.useNative(component)) return saved.handleMouse?.call(component, event);
			return kind(component) === "assistant" ? saved.projection?.handleMouse?.(event) : undefined;
		};
		component.invalidate = () => {
			saved.projection = undefined;
			saved.invalidate.call(component);
		};
		this.saved.set(component, saved);
	}

	private nestedCalls(component: NativeComponent) {
		const live = component.toolCallId && this.nested.get(component.toolCallId);
		if (live) return [...live.values()];
		const stored = record(record(component.result).nestedCalls).calls;
		if (!Array.isArray(stored)) return [];
		return stored.map(raw => {
			const call = record(raw);
			return { name: String(call.name ?? ""), args: call.arguments, pending: call.status === "unfinished", error: call.status === "error" || !!call.error };
		});
	}

	private useNative(component: NativeComponent): boolean {
		if (kind(component) === "tool") {
			if (component.toolName === "contact_supervisor" && record(component.args).reason !== "progress_update") return true;
			return toolHasError(component.result) || toolPolicy(component.toolName!, component.args) === "native" ||
				record(record(component.result).nestedCalls).complete === false ||
				this.nestedCalls(component).some(call => call.error || toolPolicy(call.name, call.args) === "native");
		}
		if (kind(component) === "custom") return !customActivity(component.message);
		return false;
	}

	private assistant(component: NativeComponent, saved: SavedComponent, width: number): string[] {
		const message = component.lastMessage;
		const published = message && typeof message === "object" && this.published.has(message);
		if (!hasAssistantError(message) && !this.selected.has(component) && !published) return [];
		if (!saved.projection || saved.message !== message) {
			// Construct a separate native presentation component. The source message,
			// its content array, and the original component are never updated.
			const Constructor = component.constructor as new (...args: unknown[]) => Component;
			try {
				saved.projection = new Constructor(withoutThinking(message), true, component.markdownTheme,
					component.hiddenThinkingLabel, component.outputPad, component.markdownTransformers);
				saved.message = message;
			} catch {
				// A changed constructor must not swallow a response or an error.
				return saved.render.call(component, width);
			}
		}
		return saved.projection.render(width);
	}

	private compact(label: string, pending: boolean, width: number, padding = 1, options: { icon?: string; color?: ThemeColor; agent?: string } = {}): string[] {
		const theme = this.theme();
		const accent = options.agent ? agentColor(options.agent, theme) : options.color ?? "muted";
		const plain = `${pending ? "·" : "✓"}${options.icon ? " " + options.icon : ""} ${label}`;
		const room = Math.max(1, width - padding * 2);
		const text = theme.style(truncateToWidth(plain, room), { fg: accent, bold: true });
		return ["", " ".repeat(padding) + text];
	}

	// Async runs keep writing status.json after the launch call returned, so ask
	// for a repaint while a card is still running. One timer, cleared on dispose.
	private refreshTimer?: ReturnType<typeof setTimeout>;
	private scheduleRefresh(): void {
		if (this.refreshTimer || this.disposed) return;
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined;
			this.requestRender?.();
		}, 1000);
		this.refreshTimer.unref?.();
	}

	private render(component: NativeComponent, saved: SavedComponent, width: number): string[] {
		if (!this.enabled) return saved.render.call(component, width);
		const type = kind(component);
		if (type === "assistant") return this.assistant(component, saved, width);
		if (type === "skill") return this.compact("Skill cargada · " + cleanLine(record(component.skillBlock).name, 64), false, width, component.outputPad, { icon: "✦", color: "muted" });
		if (this.useNative(component)) return saved.render.call(component, width);
		if (type === "custom") {
			const message = component.message;
			return this.compact(customActivity(message)!, false, width, component.outputPad,
				{ icon: "◆", agent: customAgent(message) });
		}
		const policy = toolPolicy(component.toolName!, component.args);
		if (policy === "hidden") return this.nestedCalls(component).flatMap(call => {
			const nestedPolicy = toolPolicy(call.name, call.args);
			return nestedPolicy === "hidden" || nestedPolicy === "native" ? [] :
				this.compact(activityLabel(nestedPolicy, call.name, call.args, { pending: call.pending }), call.pending, width, component.outputPad,
					{ ...chipStyle(nestedPolicy, call.args), icon: chipIcon(nestedPolicy) });
		});
		if (policy === "native") return saved.render.call(component, width);
		const pending = component.isPartial !== false;
		if (policy === "subagent" && component.toolName === "subagent" && !record(component.args).action) {
			const card = subagentCards(component.args, component.result, width, this.theme(), { pending });
			if (card.running) this.scheduleRefresh();
			return card.lines;
		}
		const detached = !!record(record(component.result).details).asyncId;
		const label = activityLabel(policy, component.toolName!, component.args, { pending: pending || detached, result: component.result });
		return this.compact(label, pending || detached, width, component.outputPad,
			{ ...chipStyle(policy, component.args), icon: chipIcon(policy) });
	}

	private restore(component: NativeComponent, saved: SavedComponent): void {
		if (component.render !== saved.wrapper) return;
		component.render = saved.render;
		component.handleMouse = saved.handleMouse;
		component.invalidate = saved.invalidate;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.refreshTimer = undefined;
		if (this.chat.render === this.chatRender) this.chat.render = this.nativeRender;
		for (const [component, saved] of this.saved) this.restore(component, saved);
		this.saved.clear();
		this.nested.clear();
	}
}
