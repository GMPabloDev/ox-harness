import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component, TUI, TuiMouseEvent } from "@earendil-works/pi-tui";
import { activityLabel, customActivity, hasAssistantError, isAnswer, record, toolHasError, toolPolicy, withoutThinking } from "./policy.ts";

interface NativeComponent extends Component {
	children?: Component[];
	lastMessage?: unknown;
	message?: unknown;
	entry?: unknown;
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

type Kind = "assistant" | "tool" | "custom" | "user" | "other";
function kind(component: NativeComponent): Kind {
	const name = component.constructor.name;
	if (name === "AssistantMessageComponent" && "lastMessage" in component && "updateContent" in component) return "assistant";
	if (name === "ToolExecutionComponent" && typeof component.toolName === "string" && "updateResult" in component) return "tool";
	if (name === "CustomMessageComponent" && "message" in component) return "custom";
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

	constructor(private chat: Container, private theme: () => Theme) {
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
			if (type === "user") { publish(); candidate = undefined; }
			if (type === "assistant") candidate = !child.isStreaming && isAnswer(child.lastMessage) ? child : undefined;
			if (["assistant", "tool", "custom"].includes(type)) this.wrap(child);
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
			return toolHasError(component.result) || toolPolicy(component.toolName!) === "native" ||
				record(record(component.result).nestedCalls).complete === false ||
				this.nestedCalls(component).some(call => call.error || toolPolicy(call.name) === "native");
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

	private compact(label: string, pending: boolean, width: number, padding = 1): string[] {
		const text = `${pending ? "·" : "✓"} ${label}`;
		const body = truncateToWidth(text, Math.max(1, width - padding * 2));
		return ["", ...new Text(this.theme().fg("muted", body), padding, 0).render(width)];
	}

	private render(component: NativeComponent, saved: SavedComponent, width: number): string[] {
		if (!this.enabled) return saved.render.call(component, width);
		const type = kind(component);
		if (type === "assistant") return this.assistant(component, saved, width);
		if (this.useNative(component)) return saved.render.call(component, width);
		if (type === "custom") return this.compact(customActivity(component.message)!, false, width, component.outputPad);
		const policy = toolPolicy(component.toolName!);
		if (policy === "hidden") return this.nestedCalls(component).flatMap(call => {
			const nestedPolicy = toolPolicy(call.name);
			return nestedPolicy === "hidden" || nestedPolicy === "native" ? [] :
				this.compact(activityLabel(nestedPolicy, call.name, call.args), call.pending, width, component.outputPad);
		});
		if (policy === "native") return saved.render.call(component, width);
		const detached = !!record(record(component.result).details).asyncId;
		return this.compact(activityLabel(policy, component.toolName!, component.args) + (detached ? " · en segundo plano" : ""),
			component.isPartial !== false || detached, width, component.outputPad);
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
		if (this.chat.render === this.chatRender) this.chat.render = this.nativeRender;
		for (const [component, saved] of this.saved) this.restore(component, saved);
		this.saved.clear();
		this.nested.clear();
	}
}
