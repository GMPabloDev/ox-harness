import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { Color } from "@earendil-works/pi-tui";

/**
 * Session roster for the AGENTS sidebar section.
 *
 * Rows come from the `subagent` tool lifecycle, from `subagent-notify` custom
 * messages, and from the session branch on reload. Nothing here reads model
 * messages or changes them. The sidebar shows identity and state only; the
 * chat cards keep task, model, context, and cost detail.
 */

export type AgentPhase = "queued" | "working" | "waiting" | "done" | "failed" | "stopped" | "paused";

const TERMINAL = new Set<AgentPhase>(["done", "failed", "stopped", "paused"]);
const RECENT_LIMIT = 3;
const MAX_ROWS = 40;

export function isTerminal(phase: AgentPhase): boolean {
	return TERMINAL.has(phase);
}

export interface AgentRow {
	key: string;
	agent: string;
	phase: AgentPhase;
	startedAt: number;
	endedAt?: number;
	durationMs?: number;
	runId?: string;
	task?: string;
	/** Row expanded from a workflow notification; match it by run id only. */
	viaChildRun?: boolean;
}

export interface AgentSnapshot {
	active: AgentRow[];
	recent: AgentRow[];
	now: number;
}

// Keep this table in sync with extensions/focus/cards.ts. The sidebar and the
// chat card must paint the same agent with the same color.
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

export function agentColor(name: string, theme: Theme): Color {
	let hash = 2_166_136_261;
	for (const character of name) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16_777_619) >>> 0;
	}
	const role = Object.hasOwn(AGENT_COLORS, name) ? AGENT_COLORS[name] : AGENT_PALETTE[(hash >>> 16) % AGENT_PALETTE.length];
	return theme.colors[role];
}

export interface PhaseStyle { icon: string; color: ThemeColor }

export function phaseStyle(phase: AgentPhase): PhaseStyle {
	switch (phase) {
		case "waiting": return { icon: "◆", color: "warning" };
		case "done": return { icon: "✓", color: "success" };
		case "failed": return { icon: "✗", color: "error" };
		case "queued": return { icon: "○", color: "dim" };
		case "stopped": return { icon: "■", color: "warning" };
		case "paused": return { icon: "‖", color: "warning" };
		default: return { icon: "●", color: "accent" };
	}
}

export function phaseLabel(phase: AgentPhase): string {
	switch (phase) {
		case "waiting": return "esperando";
		case "done": return "terminado";
		case "failed": return "fallido";
		case "queued": return "en cola";
		case "stopped": return "detenido";
		case "paused": return "en pausa";
		default: return "en marcha";
	}
}

export function elapsed(ms: number): string {
	const seconds = Math.max(0, Math.round(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
	return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

export function rowTime(row: AgentRow, now: number): string {
	if (isTerminal(row.phase)) {
		const duration = row.durationMs ?? (row.endedAt !== undefined ? row.endedAt - row.startedAt : undefined);
		return duration !== undefined && duration > 0 ? elapsed(duration) : "";
	}
	const duration = now - row.startedAt;
	return duration >= 1000 ? elapsed(duration) : "";
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function str(value: unknown, limit = 90): string {
	return typeof value === "string" ? value.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit) : "";
}

function num(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function phaseOf(value: unknown, fallback: AgentPhase = "working"): AgentPhase {
	switch (str(value, 24).toLowerCase()) {
		case "complete": case "completed": case "done": case "success": return "done";
		case "failed": case "error": case "blocked": case "rejected": return "failed";
		case "stopped": case "stopping": return "stopped";
		case "paused": return "paused";
		case "pending": case "queued": return "queued";
		case "waiting": case "waiting_for_user": return "waiting";
		case "running": case "active": case "launching": case "started": case "in_progress": return "working";
		default: return fallback;
	}
}

function entriesOf(source: Record<string, unknown>, name: string): unknown[] | undefined {
	const direct = source[name];
	if (Array.isArray(direct)) return direct;
	const nested = record(source.args)[name];
	return Array.isArray(nested) ? nested : undefined;
}

/** Optimistic rows created from the launch arguments, before any child reports. */
export function launchRows(input: unknown, toolCallId: string, now: number): AgentRow[] {
	const args = record(input);
	if (typeof args.action === "string" && args.action) return [];
	const nested = record(args.args);
	const key = (index: number) => `tool:${toolCallId}:${index}`;
	const rows: AgentRow[] = [];
	const push = (raw: unknown) => {
		const task = record(raw);
		rows.push({
			key: key(rows.length),
			agent: str(task.agent, 40) || "subagente",
			phase: "queued",
			startedAt: now,
			task: str(task.task, 160) || undefined,
		});
	};
	const tasks = entriesOf(args, "tasks");
	if (tasks?.length) {
		for (const task of tasks) push(task);
		return rows;
	}
	const chain = entriesOf(args, "chain");
	if (chain?.length) {
		for (const raw of chain) {
			const step = record(raw);
			const parallel = Array.isArray(step.parallel) ? step.parallel : [step];
			for (const child of parallel) push(child);
		}
		return rows;
	}
	if ((args.workflow ?? nested.workflow) !== undefined && (args.workflow ?? nested.workflow) !== false) {
		return [{ key: key(0), agent: "workflow", phase: "queued", startedAt: now }];
	}
	return [{
		key: key(0),
		agent: str(args.agent, 40) || "subagente",
		phase: "queued",
		startedAt: now,
		task: str(args.task, 160) || undefined,
	}];
}

export interface ObserveOptions { toolCallId?: string; final?: boolean; now?: number }

/**
 * Rows from a `subagent` tool result or progress snapshot.
 *
 * `final: false` never infers success from `exitCode`, because live placeholder
 * rows carry `exitCode: 0` while their child is still running.
 */
export function detailsRows(details: unknown, options: ObserveOptions = {}): AgentRow[] {
	const data = record(details);
	if (data.mode === "management") return [];
	const now = options.now ?? Date.now();
	const runId = str(data.runId, 64) || undefined;
	const children = record(data.workflowChildren);
	const childRows = Array.isArray(children.children) ? children.children.map(record) : [];
	if (childRows.length) {
		return childRows.map((child, index) => {
			const activity = record(child.activity);
			const durationMs = num(activity.durationMs);
			return {
				key: `child:${str(child.runId, 64) || str(child.workflowKey, 64) || index}`,
				agent: str(child.agent, 40) || "subagente",
				phase: phaseOf(child.state ?? child.status, options.final ? "done" : "working"),
				startedAt: num(child.startedAt) ?? (durationMs !== undefined ? now - durationMs : now),
				durationMs,
				runId: str(child.runId, 64) || undefined,
				task: str(child.task, 160) || undefined,
			};
		});
	}
	const progress = Array.isArray(data.progress) ? data.progress.map(record) : [];
	const results = Array.isArray(data.results) ? data.results.map(record) : [];
	return results.map((result, index) => {
		const childIndex = num(result.index) ?? index;
		const live = progress.find(item => num(item.index) === childIndex) ?? record(result.progress);
		const status = live.status ?? result.status;
		const stopped = result.stopped === true || result.interrupted === true || result.timedOut === true;
		let phase = status !== undefined
			? phaseOf(status, "working")
			: options.final ? (stopped ? "stopped" : (num(result.exitCode) ?? 0) === 0 ? "done" : "failed") : "working";
		// A detached child keeps working after the foreground tool call returns.
		if (result.detached === true && options.final && !stopped) phase = "working";
		const durationMs = num(live.durationMs);
		return {
			key: options.toolCallId ? `tool:${options.toolCallId}:${childIndex}` : `run:${runId ?? "unknown"}:${childIndex}`,
			agent: str(result.agent, 40) || "subagente",
			phase,
			startedAt: durationMs !== undefined ? now - durationMs : now,
			durationMs,
			runId: str(result.runId, 64) || undefined,
			task: str(result.task, 160) || undefined,
		};
	});
}

/** Terminal rows from a `subagent-notify` message. */
export function notifyRows(message: unknown, now: number): { rows: AgentRow[]; parentRunId?: string } {
	const details = record(record(message).details);
	const runs = Array.isArray(details.runs) ? details.runs.map(record) : [];
	const rows: AgentRow[] = [];
	let parentRunId: string | undefined;
	for (const run of runs) {
		const runId = str(run.runId, 64) || undefined;
		const status = phaseOf(run.status, "done");
		const durationMs = num(run.durationMs);
		const agent = str(run.agent, 40) || "subagente";
		const startedAt = durationMs !== undefined ? now - durationMs : now;
		const children = Array.isArray(run.childRuns) ? run.childRuns.map(record) : [];
		if (children.length) {
			parentRunId ??= runId;
			for (const child of children) {
				rows.push({
					key: `run:${str(child.runId, 64) || str(child.workflowKey, 64) || agent}`,
					agent: str(child.agent, 40) || "subagente",
					phase: phaseOf(child.status, status),
					startedAt,
					endedAt: now,
					durationMs,
					runId: str(child.runId, 64) || undefined,
					viaChildRun: true,
				});
			}
			continue;
		}
		rows.push({ key: `run:${runId ?? agent}`, agent, phase: status, startedAt, endedAt: now, durationMs, runId });
	}
	return { rows, parentRunId };
}

function activeRank(phase: AgentPhase): number {
	switch (phase) {
		case "waiting": return 0;
		case "working": return 1;
		default: return 2;
	}
}

export class AgentRegistry {
	private rows = new Map<string, AgentRow>();
	private requests = new Map<string, string>();

	reset(): void {
		this.rows.clear();
		this.requests.clear();
	}

	/** Merge rows, never downgrading a terminal row to a live one. */
	merge(inputs: readonly AgentRow[]): void {
		for (const input of inputs) {
			const current = this.rows.get(input.key);
			if (!current) {
				this.rows.set(input.key, { ...input });
				continue;
			}
			if (isTerminal(current.phase) && !isTerminal(input.phase)) continue;
			const merged: AgentRow = {
				...current,
				...input,
				agent: input.agent === "subagente" ? current.agent : input.agent,
				startedAt: Math.min(current.startedAt, input.startedAt),
			};
			if (isTerminal(current.phase) && current.endedAt !== undefined) {
				merged.endedAt = Math.min(current.endedAt, input.endedAt ?? current.endedAt);
				merged.durationMs ??= current.durationMs;
			}
			this.rows.set(input.key, merged);
		}
		this.prune();
	}

	/** Tie the optimistic launch rows to the async run id that will notify later. */
	attachRun(toolCallId: string, runId: string): void {
		const prefix = `tool:${toolCallId}:`;
		for (const row of this.rows.values()) {
			if (!row.key.startsWith(prefix)) continue;
			if (!row.runId) row.runId = runId;
			if (row.phase === "queued") row.phase = "working";
		}
	}

	/** Apply one tool result or progress snapshot. */
	observe(details: unknown, options: ObserveOptions = {}): void {
		const data = record(details);
		const runId = str(data.runId, 64) || undefined;
		if (runId && options.toolCallId) this.attachRun(options.toolCallId, runId);
		const rows = detailsRows(data, options);
		const children = record(data.workflowChildren);
		const workflowChildren = Array.isArray(children.children) && children.children.length > 0;
		if (workflowChildren && runId) this.replaceRun(runId, rows);
		else this.merge(rows);
	}

	/** Replace a workflow parent row with its concrete children. */
	replaceRun(parentRunId: string, rows: readonly AgentRow[]): void {
		const parent = [...this.rows.values()].find(row => row.runId === parentRunId);
		if (!parent) {
			this.merge(rows);
			return;
		}
		for (const row of [...this.rows.values()]) {
			if (row.runId === parentRunId || row.key === `run:${parentRunId}`) this.rows.delete(row.key);
		}
		this.merge(rows.map(row => ({ ...row, startedAt: Math.min(row.startedAt, parent.startedAt) })));
	}

	/** Terminal state delivered by `subagent-notify`. */
	notify(message: unknown, now = Date.now()): void {
		const { rows, parentRunId } = notifyRows(message, now);
		if (!rows.length) return;
		for (const row of rows) {
			const target = this.findByRun(row.runId, row.agent) ?? (row.viaChildRun ? undefined : this.findActive(row.agent));
			if (!target) continue;
			target.phase = row.phase;
			target.endedAt = row.endedAt;
			if (row.durationMs !== undefined) {
				target.durationMs = row.durationMs;
				target.startedAt = Math.min(target.startedAt, row.startedAt);
			}
			if (row.runId) target.runId = row.runId;
			for (const other of [...this.rows.values()]) {
				if (other !== target && row.runId && other.runId === row.runId) this.rows.delete(other.key);
			}
			if (target.key !== row.key) this.rows.delete(row.key);
		}
		if (parentRunId) this.removeRun(parentRunId);
		this.merge(rows.filter(row => ![...this.rows.values()].some(existing =>
			existing.key === row.key || (row.runId !== undefined && existing.runId === row.runId))));
		this.prune();
	}

	/** A child asked for a decision: it needs the operator, not more tokens. */
	waiting(details: unknown): void {
		const data = record(details);
		const runId = str(data.runId, 64) || undefined;
		const requestId = str(data.requestId ?? data.id, 64) || undefined;
		const agent = str(data.agent, 40) || "subagente";
		const known = runId ? this.findByRun(runId, agent) : undefined;
		if (known && isTerminal(known.phase)) return;
		let row = known ?? this.findActive(agent);
		if (row) {
			row.phase = "waiting";
			if (runId) row.runId ??= runId;
		} else {
			const key = `run:${runId ?? requestId ?? agent}`;
			this.rows.set(key, { key, agent, phase: "waiting", startedAt: Date.now(), runId });
			row = this.rows.get(key);
		}
		if (requestId && row?.runId) this.requests.set(requestId, row.runId);
		this.prune();
	}

	/** The operator answered that request: the child goes back to work. */
	answered(requestId: string | undefined): void {
		if (!requestId) return;
		const runId = this.requests.get(requestId);
		this.requests.delete(requestId);
		const row = runId ? this.findByRun(runId) : undefined;
		if (row?.phase === "waiting") row.phase = "working";
	}

	/** A failed `subagent` call: its optimistic rows will never report. */
	fail(toolCallId: string, now = Date.now()): void {
		const prefix = `tool:${toolCallId}:`;
		for (const row of this.rows.values()) {
			if (!row.key.startsWith(prefix) || isTerminal(row.phase)) continue;
			row.phase = "failed";
			row.endedAt = now;
		}
	}

	snapshot(now = Date.now()): AgentSnapshot {
		const rows = [...this.rows.values()];
		const active = rows
			.filter(row => !isTerminal(row.phase))
			.sort((a, b) => activeRank(a.phase) - activeRank(b.phase) || a.startedAt - b.startedAt);
		const recent = rows
			.filter(row => isTerminal(row.phase))
			.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
			.slice(0, RECENT_LIMIT);
		return { active, recent, now };
	}

	/** Full roster for the `/agents` overlay. */
	list(): AgentRow[] {
		const rows = [...this.rows.values()];
		const active = rows.filter(row => !isTerminal(row.phase))
			.sort((a, b) => activeRank(a.phase) - activeRank(b.phase) || a.startedAt - b.startedAt);
		const done = rows.filter(row => isTerminal(row.phase))
			.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
		return [...active, ...done];
	}

	/** Drop terminated rows and keep live ones. */
	clearTerminal(): void {
		for (const row of [...this.rows.values()]) if (isTerminal(row.phase)) this.rows.delete(row.key);
	}

	/** Rebuild from the session branch after a reload or a branch change. */
	restore(entries: Iterable<unknown>, now = Date.now()): void {
		for (const raw of entries) {
			const entry = record(raw);
			const at = num(entry.timestamp) ?? now;
			if (entry.type === "message") {
				const message = record(entry.message);
				if (message.role !== "toolResult" || message.toolName !== "subagent" || message.isError === true) continue;
				const rows = detailsRows(message.details, { toolCallId: str(message.toolCallId, 80) || undefined, final: true, now: at });
				for (const row of rows) {
					row.phase = isTerminal(row.phase) ? row.phase : "stopped";
					row.endedAt = at;
					row.startedAt = Math.min(row.startedAt, at);
				}
				this.merge(rows);
			} else if (entry.type === "custom_message" && entry.customType === "subagent-notify") {
				this.notify({ details: entry.details }, at);
			}
		}
	}

	private findByRun(runId: string | undefined, agent?: string): AgentRow | undefined {
		if (!runId) return undefined;
		const matches = [...this.rows.values()].filter(row => row.runId === runId);
		if (agent) {
			const exact = matches.find(row => row.agent === agent);
			if (exact) return exact;
		}
		return matches.length === 1 ? matches[0] : undefined;
	}

	/** Prefer a row that has no run id yet; a launch batch shares the parent run id. */
	private findActive(agent: string): AgentRow | undefined {
		const matches = [...this.rows.values()].filter(row => !isTerminal(row.phase) && row.agent === agent);
		return matches.find(row => !row.runId) ?? (matches.length === 1 ? matches[0] : undefined);
	}

	private removeRun(runId: string): void {
		for (const row of [...this.rows.values()]) {
			if (row.runId === runId || row.key === `run:${runId}`) this.rows.delete(row.key);
		}
	}

	private prune(): void {
		const terminal = [...this.rows.values()]
			.filter(row => isTerminal(row.phase))
			.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
		for (const row of terminal.slice(MAX_ROWS)) this.rows.delete(row.key);
		if (this.rows.size <= MAX_ROWS) return;
		for (const row of [...this.rows.values()].filter(item => isTerminal(item.phase)).slice(0, this.rows.size - MAX_ROWS)) {
			this.rows.delete(row.key);
		}
	}
}
