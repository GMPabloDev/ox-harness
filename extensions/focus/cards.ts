import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Color } from "@earendil-works/pi-tui";
import { cleanLine, record } from "./policy.ts";

/**
 * Presentation for subagent runs and for the one-line activities.
 *
 * Card content comes from the launch input (agent, task) and, when the run
 * wrote one, from `<asyncDir>/status.json`. Nothing here reads model messages
 * or changes them. The file is read at most once per second per run.
 */

// Use exact palette colors, not interpolated shades. Named ox roles stay
// distinct; other agents get a stable theme token from their name.
const AGENT_COLORS: Record<string, ThemeColor> = {
	"ox-code-auditor": "accent",
	"ox-committer": "customMessageLabel",
	"ox-explore": "toolDiffAdded",
	"ox-researcher": "mdLink",
	"ox-spec-auditor": "syntaxFunction",
	"ox-spec-exec": "syntaxNumber",
	"ox-spec-fix": "warning",
};
const AGENT_PALETTE: ThemeColor[] = ["accent", "toolDiffAdded", "mdLink", "syntaxType", "customMessageLabel", "syntaxFunction"];
export const MEMORY_COLOR: ThemeColor = "mdCode";
export const WEB_COLOR: ThemeColor = "mdLink";

export function agentColor(name: string, theme: Theme): Color {
	let hash = 2_166_136_261;
	for (const character of name) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16_777_619) >>> 0;
	}
	const role = Object.hasOwn(AGENT_COLORS, name) ? AGENT_COLORS[name] : AGENT_PALETTE[(hash >>> 16) % AGENT_PALETTE.length];
	return theme.colors[role];
}

export interface AgentRun {
	agent: string;
	task: string;
	state: string;
	model?: string;
	thinking?: string;
	windowTokens?: number;
	contextLimit?: number;
	outputTokens?: number;
	costUsd?: number;
	startedAt?: number;
	endedAt?: number;
	durationMs?: number;
	toolCount?: number;
	activity?: { tool: string; detail: string };
	dependsOn?: string;
}

// Only tools whose argument is useful to see and safe to echo. Memory writes
// and shell commands keep their arguments private.
const DETAIL_TOOLS = new Set(["web_search", "source_check", "fetch_content", "get_search_content", "read", "grep", "find", "ls"]);
const WEB_TOOLS = new Set(["web_search", "source_check", "fetch_content", "get_search_content"]);

const cache = new Map<string, { at: number; file: Record<string, unknown> | undefined }>();
const CACHE_MS = 1000;
const MAX_STATUS_BYTES = 4 * 1024 * 1024;

export function clearStatusCache(): void {
	cache.clear();
}

function readStatus(asyncDir: string): Record<string, unknown> | undefined {
	const hit = cache.get(asyncDir);
	const now = Date.now();
	if (hit && now - hit.at < CACHE_MS) return hit.file;
	let file: Record<string, unknown> | undefined;
	try {
		const path = join(asyncDir, "status.json");
		if (statSync(path).size <= MAX_STATUS_BYTES) file = record(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		file = undefined;
	}
	if (cache.size >= 64) cache.delete(cache.keys().next().value!);
	cache.set(asyncDir, { at: now, file });
	return file;
}

const withoutRedaction = (value: string) => value.startsWith("[") && value.endsWith("]") ? "" : value;

function number(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown, limit = 90): string {
	return cleanLine(value, limit);
}

function runsFromStatus(file: Record<string, unknown> | undefined, input: Record<string, unknown>): AgentRun[] {
	if (!file) return [];
	const steps = Array.isArray(file.steps) ? file.steps.map(record) : [];
	if (!steps.length) return [];
	const rawTasks = Array.isArray(input.tasks) ? input.tasks : record(input.args).tasks;
	const tasks = Array.isArray(rawTasks) ? rawTasks.map(record) : []; 
	return steps.map((step, index) => {
		const tokens = record(step.tokens);
		const cost = record(step.totalCost);
		const tools = Array.isArray(step.recentTools) ? step.recentTools.map(record) : [];
		const last = tools.at(-1) ?? {};
		const tool = text(last.tool, 24);
		const detail = DETAIL_TOOLS.has(tool) ? text(last.args, 96) : "";
		return {
			agent: text(step.agent, 40) || text(input.agent, 40) || "subagente",
			// status.json redacts step descriptions. The launch arguments in the
			// transcript hold the real task, so prefer them and drop the placeholder.
			task: text(tasks[index]?.task, 160) || text(input.task, 160) || withoutRedaction(text(step.description, 160)) || withoutRedaction(text(step.label, 160)),
			state: text(step.status, 16) || text(file.state, 16),
			model: text(step.model, 64) || undefined,
			thinking: text(step.thinking, 12) || undefined,
			windowTokens: number(tokens.window),
			contextLimit: number(step.contextLimit),
			outputTokens: number(tokens.output),
			costUsd: number(cost.costUsd),
			startedAt: number(step.startedAt),
			endedAt: number(step.endedAt),
			durationMs: number(step.durationMs),
			toolCount: number(step.toolCount),
			activity: tool ? { tool, detail } : undefined,
		};
	});
}

function runsFromResults(details: Record<string, unknown>, input: Record<string, unknown>): AgentRun[] {
	const results = Array.isArray(details.results) ? details.results.map(record) : [];
	if (!results.length) return [];
	return results.map(result => {
		const usage = record(result.usage);
		const toolCalls = Array.isArray(result.toolCalls) ? result.toolCalls.map(record) : [];
		const last = toolCalls.at(-1) ?? {};
		const tool = text(last.name, 24);
		return {
			agent: text(result.agent, 40) || "subagente",
			task: text(result.task, 160) || text(input.task, 160),
			state: text(result.status, 16) || (number(result.exitCode) === 0 ? "completed" : ""),
			model: text(result.model, 64) || undefined,
			thinking: text(result.thinking, 12) || undefined,
			windowTokens: number(record(usage).window),
			outputTokens: number(usage.output),
			costUsd: number(record(usage.cost).total),
			toolCount: toolCalls.length || undefined,
			activity: tool ? { tool, detail: DETAIL_TOOLS.has(tool) ? text(last.args ?? last.summary, 96) : "" } : undefined,
		};
	});
}

function count(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(Math.round(value));
}

function money(value: number): string {
	if (!value) return "$0";
	return value >= 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(4)}`;
}

function elapsed(value: number): string {
	const seconds = Math.max(0, Math.round(value / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
	return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

interface StateLabel {
	icon: string;
	label: string;
	color: ThemeColor;
}

function stateLabel(state: string): StateLabel {
	switch (state) {
		case "complete": case "completed": return { icon: "✓", label: "completado", color: "success" };
		case "failed": case "error": return { icon: "✗", label: "fallido", color: "error" };
		case "blocked": return { icon: "✗", label: "bloqueado", color: "error" };
		case "stopped": return { icon: "■", label: "detenido", color: "warning" };
		case "paused": return { icon: "‖", label: "en pausa", color: "warning" };
		case "pending": return { icon: "○", label: "pendiente", color: "dim" };
		case "unknown": return { icon: "○", label: "estado desconocido", color: "dim" };
		case "detached": return { icon: "◐", label: "en segundo plano", color: "accent" };
		case "running": case "active": case "launching": return { icon: "◐", label: "en marcha", color: "accent" };
		default: return { icon: "◐", label: state ? state : "en marcha", color: "accent" };
	}
}

export function isActive(state: string): boolean {
	return !["complete", "completed", "failed", "error", "blocked", "stopped", "paused"].includes(state);
}

interface Part {
	text: string;
	fg?: ThemeColor | Color;
	bold?: boolean;
}

const CARD_CHROME = 4;
const MIN_CARD_WIDTH = 24;

const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, "");

function cardLine(theme: Theme, accent: ThemeColor | Color, parts: Part[], width: number): string {
	const paint = (value: string, style: { fg?: ThemeColor | Color; bold?: boolean }) =>
		value ? theme.style(value, style) : "";
	const inner = Math.max(1, width - CARD_CHROME);
	// Clip each part before styling: truncating an already painted string would
	// reset the card background on the ellipsis and leave a gap in the band.
	let budget = inner;
	let body = "";
	for (const part of parts) {
		if (budget <= 0) break;
		const clipped = visibleWidth(part.text) <= budget ? part.text : stripAnsi(truncateToWidth(part.text, budget));
		body += paint(clipped, part);
		budget -= visibleWidth(clipped);
	}
	return paint("│", { fg: accent }) + " " + body + " ".repeat(Math.max(0, budget) + 1) + paint("│", { fg: accent });
}

const CONTEXT_BAR_CELLS = 8;
const CONTEXT_BAR_FILLED = "▮";
const CONTEXT_BAR_EMPTY = "▯";

/** Barra proporcional de ocho celdas; con algo de uso, la primera celda siempre se llena. */
function contextBar(percentage: number): string {
	const raw = Math.round((percentage / 100) * CONTEXT_BAR_CELLS);
	const filled = Math.min(CONTEXT_BAR_CELLS, percentage > 0 ? Math.max(1, raw) : 0);
	return CONTEXT_BAR_FILLED.repeat(filled) + CONTEXT_BAR_EMPTY.repeat(CONTEXT_BAR_CELLS - filled);
}

/** Un porcentaje que redondea a 0 se lee mejor como `<1%` que como `0%` con una celda llena. */
function percentLabel(percentage: number): string {
	return percentage > 0 && percentage < 1 ? "<1%" : `${Math.round(percentage)}%`;
}

function metaParts(run: AgentRun, accent: ThemeColor | Color): Part[] {
	const groups: Part[][] = [];
	// The provider prefix adds noise; the model id is what identifies the run.
	if (run.model) groups.push([{ text: truncateToWidth(run.model.split("/").at(-1) ?? run.model, 24), fg: "dim" }]);
	if (run.thinking) groups.push([{ text: run.thinking, fg: "dim" }]);
	const window = run.windowTokens;
	const limit = run.contextLimit;
	const percentage = window !== undefined && window >= 0 && limit !== undefined && limit > 0
		? window / limit * 100 : undefined;
	if (percentage !== undefined) {
		groups.push([
			{ text: "ctx ", fg: "dim" },
			{ text: contextBar(percentage), fg: accent },
			{ text: " " + percentLabel(percentage), fg: "dim" },
		]);
	} else if (window !== undefined && window >= 0) {
		groups.push([{ text: `ctx ${count(window)} (% desconocido)`, fg: "dim" }]);
	} else {
		groups.push([{ text: "ctx % desconocido", fg: "dim" }]);
	}
	if (run.outputTokens) groups.push([{ text: `out ${count(run.outputTokens)}`, fg: "dim" }]);
	if (run.costUsd !== undefined) groups.push([{ text: money(run.costUsd), fg: "dim" }]);
	if (run.toolCount) groups.push([{ text: `${run.toolCount} tools`, fg: "dim" }]);
	const parts: Part[] = [];
	for (const group of groups) {
		if (parts.length) parts.push({ text: " · ", fg: "dim" });
		parts.push(...group);
	}
	return parts;
}

function runtime(run: AgentRun, now: number): string {
	if (run.durationMs !== undefined && run.durationMs >= 0) return elapsed(run.durationMs);
	const end = run.endedAt && !isActive(run.state) ? run.endedAt : now;
	if (!run.startedAt) return "";
	return elapsed(Math.max(0, end - run.startedAt));
}

/** Card lines for one tool call: one card per agent, colored and stable. */
export function subagentCards(inputValue: unknown, resultValue: unknown, width: number, theme: Theme, options: { pending?: boolean; now?: number; toolCallId?: string } = {}): { lines: string[]; running: boolean } {
	const input = record(inputValue);
	const details = record(record(resultValue).details);
	const asyncDir = typeof details.asyncDir === "string" ? details.asyncDir : "";
	const summary = record(details.workflowChildren);
	const correlated = details.mode === "workflow" && summary.version === 1 && !!options.toolCallId && summary.parentToolCallId === options.toolCallId && typeof details.runId === "string" && summary.workflowRunId === details.runId && Array.isArray(summary.children);
	let runs: AgentRun[] = correlated ? (summary.children as unknown[]).map(record).map(child => {
		const activity = record(child.activity);
		const tool = text(activity.currentTool, 24);
		const state = text(child.state, 16);
		return { agent: text(child.agent, 40) || "subagente", task: "", state: ["running", "completed", "complete", "failed", "error", "blocked", "stopped", "paused", "pending"].includes(state) ? state : "unknown", model: text(child.model, 64) || undefined, thinking: text(child.thinking, 12) || undefined, durationMs: number(activity.durationMs), activity: tool ? { tool, detail: "" } : undefined };
	}) : asyncDir ? runsFromStatus(readStatus(asyncDir), input) : [];
	if (!runs.length && !correlated) runs = runsFromResults(details, input);
	if (!runs.length) {
		const chain = Array.isArray(input.chain) ? input.chain : record(input.args).chain;
		if (Array.isArray(chain)) {
			let previous: string[] = [];
			for (const raw of chain) {
				const step = record(raw);
				const children = Array.isArray(step.parallel) ? step.parallel.map(record) : [step];
				const current = children.map(child => text(child.agent, 40) || "subagente");
				for (const [index, child] of children.entries()) runs.push({ agent: current[index], task: text(child.task, 160), state: options.pending === false ? "unknown" : "pending", dependsOn: previous.join(", ") || undefined });
				previous = current;
			}
		}
	}
	if (!runs.length) {
		const rawTasks = Array.isArray(input.tasks) ? input.tasks : record(input.args).tasks;
		if (Array.isArray(rawTasks) && rawTasks.length) runs = rawTasks.map(raw => {
			const task = record(raw);
			return { agent: text(task.agent, 40) || "subagente", task: text(task.task, 160), state: options.pending === false ? "unknown" : "pending" };
		});
	}
	if (!runs.length) {
		runs = [{
			agent: text(input.agent, 40) || "subagente",
			task: text(input.task, 160),
			state: options.pending === false ? "unknown" : "pending",
		}];
	}
	const now = options.now ?? Date.now();
	const prepared = runs.map(run => {
		const accent = agentColor(run.agent, theme);
		const state = stateLabel(run.state);
		const time = runtime(run, now);
		const title: Part[] = [
			{ text: state.icon + " ", fg: state.color, bold: true },
			{ text: run.agent, fg: accent, bold: true },
			{ text: " · " + state.label, fg: state.color },
		];
		if (time) title.push({ text: " · " + time, fg: "dim" });
		const meta = metaParts(run, accent);
		return { run, accent, state, title, meta };
	});
	const lines: string[] = [];
	let running = false;
	for (const { run, accent, state, title, meta } of prepared) {
		if (isActive(run.state)) running = true;
		if (width < MIN_CARD_WIDTH) {
			const flat = `${state.icon} ${run.agent} · ${state.label}${run.model ? " · " + run.model : ""}`;
			lines.push("", truncateToWidth(flat, Math.max(1, width)));
			continue;
		}
		const heading = title.map(part => theme.style(part.text, part)).join("");
		const available = width - 5;
		const clipped = truncateToWidth(heading, available);
		const border = (text: string) => theme.style(text, { fg: accent });
		lines.push("", border("╭─ ") + clipped + border(" " + "─".repeat(Math.max(0, available - visibleWidth(clipped))) + "╮"));
		if (run.task) lines.push(cardLine(theme, accent, [{ text: run.task, fg: "muted" }], width));
		if (run.dependsOn) lines.push(cardLine(theme, accent, [{ text: "depende de " + run.dependsOn, fg: "dim" }], width));
		if (run.activity) {
			const activity: Part[] = [{ text: WEB_TOOLS.has(run.activity.tool) ? "🌐 " : "↳ ", fg: "dim" },
				{ text: run.activity.tool, fg: accent, bold: true }];
			if (run.activity.detail) activity.push({ text: " · " + run.activity.detail, fg: "muted" });
			lines.push(cardLine(theme, accent, activity, width));
		}
		if (meta.length) lines.push(cardLine(theme, accent, meta, width));
		lines.push(border("╰" + "─".repeat(width - 2) + "╯"));
	}
	return { lines, running };
}
