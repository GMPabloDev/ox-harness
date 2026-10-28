import type { ExtensionAPI, ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

type Totals = { input: number; output: number; read: number; write: number; cost: number; hit: number | undefined };
const cache = new WeakMap<object, { count: number; leaf: string | null; totals: Totals }>();

/** Session information shared by the sidebar and its narrow-terminal fallback. */
export function sessionLines(pi: ExtensionAPI, ctx: ExtensionContext, branch: string | null, statuses: ReadonlyMap<string, string>, theme?: Theme, compact = false): string[] {
	const manager = ctx.sessionManager;
	const countEntries: unknown = Reflect.get(manager, "getEntryCount");
	const count = typeof countEntries === "function" ? countEntries.call(manager) as number : -1;
	const leaf = manager.getLeafId?.() ?? null;
	let totals = cache.get(manager);
	if (!totals || count < 0 || totals.count !== count || totals.leaf !== leaf) {
	let input = 0, output = 0, read = 0, write = 0, cost = 0;
	let hit: number | undefined;
	for (const entry of manager.getEntries()) {
		const usage = entry.type === "usage" ? entry.usage : entry.type === "message" && (entry.message.role === "assistant" || entry.message.role === "toolResult") ? entry.message.usage : (entry.type === "compaction" || entry.type === "branch_summary") ? entry.usage : undefined;
		if (!usage) continue;
		input += usage.input; output += usage.output; read += usage.cacheRead; write += usage.cacheWrite; cost += usage.cost.total;
		if (entry.type === "message" && entry.message.role === "assistant") {
			const total = usage.input + usage.cacheRead + usage.cacheWrite;
			hit = total ? usage.cacheRead / total * 100 : undefined;
		}
	}
	totals = { count, leaf, totals: { input, output, read, write, cost, hit } };
	cache.set(manager, totals);
	}
	const { input, output, read, write, cost, hit } = totals.totals;
	const fmt = (n: number) => n < 1000 ? `${n}` : n < 10000 ? `${(n / 1000).toFixed(1)}k` : n < 1000000 ? `${Math.round(n / 1000)}k` : `${(n / 1000000).toFixed(1)}M`;
	const context = ctx.getContextUsage();
	const cwd = ctx.cwd === process.env.HOME ? "~" : process.env.HOME && ctx.cwd.startsWith(process.env.HOME + "/") ? "~" + ctx.cwd.slice(process.env.HOME.length) : ctx.cwd;
	const clean = (value: string) => value.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
	const paint = (color: ThemeColor, value: string) => theme ? theme.fg(color, value) : value;
	const field = (label: string, value: string, color: ThemeColor = "text") => paint("muted", `${label}  `) + paint(color, clean(value));
	const heading = (text: string) => theme ? theme.bold(theme.fg("mdCode", text)) : text;
	const provider = clean(ctx.model?.provider ?? "sin proveedor");
	const model = clean(ctx.model?.id ?? "sin modelo");
	const effort = ctx.model?.reasoning ? pi.getThinkingLevel() : "no disponible";
	const contextText = `${context?.percent == null ? "?" : context.percent.toFixed(1) + "%"} / ${fmt(context?.contextWindow ?? ctx.model?.contextWindow ?? 0)}`;
	const tokens = `↑${fmt(input)} ↓${fmt(output)}${read ? ` R${fmt(read)}` : ""}${write ? ` W${fmt(write)}` : ""}`;
	const price = `$${cost.toFixed(3)}${hit !== undefined && (read || write) ? ` · caché ${hit.toFixed(1)}%` : ""}`;
	const details = Array.from(statuses.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => clean(text)).filter(Boolean);
	if (compact) return [
		field("Proveedor", `${provider} · ${model}`, "mdCode"),
		field("Esfuerzo", effort), field("Proyecto", cwd), ...(branch ? [field("Rama", branch)] : []),
		field("Contexto", contextText, "accent"), field("Tokens", tokens), field("Coste estimado", price, "success"),
		...(details.length ? [field("Detalles", details.join(" · "))] : []),
	];
	return [
		"", field("Proveedor", provider, "mdCode"), field("Modelo", model, "text"), field("Esfuerzo", effort),
		"", field("Proyecto", cwd, "mdLink"), ...(branch ? [field("Rama", branch, "mdLink")] : []),
		"", field("Contexto", contextText, "accent"), field("Tokens", tokens),
		"", field("Coste estimado", price, "success"),
		...(details.length ? ["", heading("Detalles"), ...details.map(text => paint("mdCode", text))] : []),
	];
}
