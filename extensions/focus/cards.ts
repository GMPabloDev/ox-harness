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
	"ox-explore": "toolDiffAdded",
	"ox-researcher": "mdLink",
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
	outputTokens?: number;
	costUsd?: number;
	startedAt?: number;
	endedAt?: number;
	toolCount?: number;
	activity?: { tool: string; detail: string };
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
	const totalTokens = record(file.totalTokens);
	const tasks = Array.isArray(input.tasks) ? input.tasks.map(record) : [];
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
			task: text(tasks[index]?.task, 160) || text(input.task, 160) || withoutRedaction(text(step.description, 160)),
			state: text(step.status, 16) || text(file.state, 16),
			model: text(step.model, 64) || undefined,
			thinking: text(step.thinking, 12) || undefined,
			windowTokens: number(tokens.window) ?? number(totalTokens.window),
			outputTokens: number(tokens.output),
			costUsd: number(cost.costUsd),
			startedAt: number(step.startedAt) ?? number(file.startedAt),
			endedAt: number(step.endedAt) ?? number(file.endedAt) ?? number(file.lastUpdate),
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

const RAIL = "▌";
const CARD_PADDING = 2;
const CARD_CHROME = 1 + CARD_PADDING * 2;
const MIN_CARD_WIDTH = 24;

const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, "");

const partsWidth = (parts: Part[]) => parts.reduce((total, part) => total + visibleWidth(part.text), 0);

function cardLine(theme: Theme, accent: ThemeColor | Color, parts: Part[], width: number): string {
	const background = theme.colors.customMessageBg;
	const paint = (value: string, style: { fg?: ThemeColor | Color; bold?: boolean }) =>
		value ? theme.style(value, { bg: background, ...style }) : "";
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
	return paint(RAIL, { fg: accent, bold: true }) + paint(" ".repeat(CARD_PADDING), {}) + body +
		paint(" ".repeat(Math.max(0, budget) + CARD_PADDING), {});
}

function metaParts(run: AgentRun): Part[] {
	const pieces: string[] = [];
	// The provider prefix adds noise; the model id is what identifies the run.
	if (run.model) pieces.push(truncateToWidth(run.model.split("/").at(-1) ?? run.model, 24));
	if (run.thinking) pieces.push(run.thinking);
	if (run.windowTokens) pieces.push(`ctx ${count(run.windowTokens)}`);
	if (run.outputTokens) pieces.push(`out ${count(run.outputTokens)}`);
	if (run.costUsd) pieces.push(money(run.costUsd));
	if (run.toolCount) pieces.push(`${run.toolCount} tools`);
	return pieces.length ? [{ text: pieces.join(" · "), fg: "dim" }] : [];
}

function runtime(run: AgentRun, now: number): string {
	const end = run.endedAt && !isActive(run.state) ? run.endedAt : now;
	if (!run.startedAt) return "";
	return elapsed(Math.max(0, end - run.startedAt));
}

/** Card lines for one tool call: one card per agent, colored and stable. */
export function subagentCards(inputValue: unknown, resultValue: unknown, width: number, theme: Theme, options: { pending?: boolean; now?: number } = {}): { lines: string[]; running: boolean } {
	const input = record(inputValue);
	const details = record(record(resultValue).details);
	const asyncDir = typeof details.asyncDir === "string" ? details.asyncDir : "";
	let runs = asyncDir ? runsFromStatus(readStatus(asyncDir), input) : [];
	if (!runs.length) runs = runsFromResults(details, input);
	if (!runs.length) {
		runs = [{
			agent: text(input.agent, 40) || "subagente",
			task: text(input.task, 160),
			state: options.pending === false ? "completed" : "running",
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
		const meta = metaParts(run);
		const gap = width - CARD_CHROME - partsWidth(title) - partsWidth(meta);
		return { run, accent, state, title, meta, gap };
	});
	// One layout per block: either every card right-aligns its numbers on the
	// header or every card keeps them on a separate line. Mixing both looks broken.
	const inline = prepared.every(card => !card.meta.length || card.gap >= 2);
	const lines: string[] = [];
	let running = false;
	for (const { run, accent, state, title, meta, gap } of prepared) {
		if (isActive(run.state)) running = true;
		if (width < MIN_CARD_WIDTH) {
			const flat = `${state.icon} ${run.agent} · ${state.label}${run.model ? " · " + run.model : ""}`;
			lines.push("", truncateToWidth(flat, Math.max(1, width)));
			continue;
		}
		lines.push("", cardLine(theme, accent, [], width));
		if (inline && meta.length) {
			lines.push(cardLine(theme, accent, [...title, { text: " ".repeat(gap) }, ...meta], width));
		} else {
			lines.push(cardLine(theme, accent, title, width));
			if (meta.length) lines.push(cardLine(theme, accent, meta, width));
		}
		if (run.task) lines.push(cardLine(theme, accent, [{ text: run.task, fg: "muted" }], width));
		if (run.activity) {
			const activity: Part[] = [{ text: WEB_TOOLS.has(run.activity.tool) ? "🌐 " : "↳ ", fg: "dim" },
				{ text: run.activity.tool, fg: accent, bold: true }];
			if (run.activity.detail) activity.push({ text: " · " + run.activity.detail, fg: "muted" });
			lines.push(cardLine(theme, accent, activity, width));
		}
		lines.push(cardLine(theme, accent, [], width));
	}
	return { lines, running };
}
