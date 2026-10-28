import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

// Presentation policy only. These functions never transform model messages.
export type ActivityKind = "subagent" | "web" | "memory" | "skill";
export type ToolPolicy = "hidden" | "native" | ActivityKind;
type RecordValue = Record<string, unknown>;
export const record = (value: unknown): RecordValue => value !== null && typeof value === "object" ? value as RecordValue : {};

const routine = new Set([
	"read", "bash", "powershell", "edit", "write", "grep", "find", "ls", "todowrite",
	"tool_search", "codemode", "subagents_enable", "web_enable",
]);

export function toolPolicy(name: string, input?: unknown): ToolPolicy {
	if (name === "read" && /(?:^|[\\/])SKILL\.md$/.test(String(record(input).path ?? ""))) return "skill";
	if (routine.has(name)) return "hidden";
	if (/^mem_/.test(name)) return "memory";
	if (["subagent", "subagent_supervisor", "contact_supervisor", "bg_wait"].includes(name)) return "subagent";
	if (["web_search", "source_check", "fetch_content", "get_search_content"].includes(name)) return "web";
	// Unknown tools might ask the user a question or request approval. Fail open.
	return "native";
}

export function cleanLine(value: unknown, limit = 110): string {
	if (typeof value !== "string") return "";
	return value.replace(/\x1b\][^\x07]*(?:\x07|$)/g, " ").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, " ")
		.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit);
}

function firstText(args: RecordValue, keys: string[]): string {
	for (const key of keys) {
		const text = cleanLine(args[key]);
		if (text) return text;
	}
	return "";
}

// Render runs repeatedly while the model streams. Cache parsed names without
// retaining tool results after their native components are released.
const skillNames = new WeakMap<object, { text: string; name: string }>();

function skillName(input: unknown, result: unknown): string {
	const args = record(input);
	// Use only content already returned to the model. Do not read files or load
	// skills on the user's behalf just to obtain a display name.
	if (!(typeof args.offset === "number" && args.offset > 1)) {
		const content = record(result).content;
		const first = Array.isArray(content) ? content.find(block => record(block).type === "text") : undefined;
		const text = record(first).text;
		if (typeof text === "string") {
			const key = record(result);
			let cached = skillNames.get(key);
			if (!cached || cached.text !== text) {
				let name = "";
				try { name = cleanLine(record(parseFrontmatter(text).frontmatter).name, 64); }
				catch { /* Malformed or truncated frontmatter: use the directory name. */ }
				cached = { text, name };
				skillNames.set(key, cached);
			}
			if (cached.name) return cached.name;
		}
	}
	const parts = String(args.path ?? "").replaceAll("\\", "/").split("/").filter(part => part && part !== ".");
	const folder = parts.at(-2);
	return cleanLine(folder && folder !== ".." ? folder : "SKILL.md", 64);
}

export function activityLabel(kind: ActivityKind, name: string, input: unknown, options: { pending?: boolean; result?: unknown } = {}): string {
	const args = record(input);
	if (kind === "skill") return `${options.pending ? "Cargando skill" : "Skill cargada"} · ${skillName(input, options.result)}`;
	if (kind === "memory") return "Engram · " + name.replace(/^mem_/, "").replace(/_/g, " ");
	if (kind === "web") {
		const queries = Array.isArray(args.queries) ? args.queries : [];
		const urls = Array.isArray(args.urls) ? args.urls : [];
		const detail = firstText(args, ["query", "url", "claim"]) || cleanLine(queries[0]) || firstText(record(queries[0]), ["query"]) || cleanLine(urls[0]);
		return "Web" + (detail ? " · " + detail : " · " + name);
	}
	if (name === "bg_wait") return "Subagentes · esperando";
	const detail = firstText(args, ["agent", "action", "reason", "workflow"]);
	const task = firstText(args, ["task", "message"]);
	return "Subagentes" + (detail ? " · " + detail : "") + (task ? " · " + task : "");
}

export function customActivity(message: unknown): string | undefined {
	const msg = record(message);
	const details = record(msg.details);
	if (msg.isError || details.isError || details.error) return;
	if (msg.customType === "subagent-notify" && Array.isArray(details.runs) && details.runs.length &&
		details.runs.every(run => record(run).status === "completed")) {
		return "Subagentes · " + details.runs.map(run => cleanLine(record(run).agent, 40)).join(", ") + " · terminado";
	}
	if (msg.customType === "subagent-incremental-child-notify" && details.outcome === "completed") {
		return "Subagentes · " + cleanLine(details.childKey, 70) + " · terminado";
	}
	if (msg.customType === "subagent_supervisor_request" && details.reason === "progress_update") {
		return "Subagentes · " + cleanLine(details.agent, 40) + " · actualización";
	}
	// Requests, failures, watchdog warnings, and unrecognized/legacy payloads
	// keep their native renderer. Do not infer success from a display string.
	return;
}

export function customAgent(message: unknown): string | undefined {
	const details = record(record(message).details);
	const runs = Array.isArray(details.runs) ? details.runs.map(record) : [];
	const run = runs.find(item => cleanLine(item.agent, 40));
	return cleanLine(run?.agent ?? details.childKey, 40) || undefined;
}

export function toolHasError(result: unknown): boolean {
	const value = record(result);
	if (value.isError === true) return true;
	const details = record(value.details);
	if (details.isError === true || details.error) return true;
	if (["failed", "blocked", "partial", "stopped", "paused"].includes(String(details.status))) return true;
	return Array.isArray(details.results) && details.results.some(item => {
		const child = record(item);
		return (typeof child.exitCode === "number" && child.exitCode !== 0) ||
			["failed", "blocked", "partial", "stopped", "paused"].includes(String(child.status));
	});
}

export function hasAssistantError(message: unknown): boolean {
	return ["error", "aborted", "length"].includes(String(record(message).stopReason));
}

export function isAnswer(message: unknown): boolean {
	const msg = record(message);
	if (msg.role !== "assistant" || hasAssistantError(msg) || !Array.isArray(msg.content)) return false;
	return msg.content.some(block => record(block).type === "text" && String(record(block).text ?? "").trim()) &&
		!msg.content.some(block => record(block).type === "toolCall");
}

export function withoutThinking(message: unknown): RecordValue {
	const msg = record(message);
	return { ...msg, content: Array.isArray(msg.content) ? msg.content.filter(block => record(block).type !== "thinking") : [] };
}
