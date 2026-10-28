import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function activityForTool(name: string): string {
	if (["read", "grep", "find", "ls"].includes(name)) return "Explorando";
	if (["edit", "write"].includes(name)) return "Editando archivos";
	if (["bash", "powershell"].includes(name)) return "Ejecutando comandos";
	if (["web_search", "source_check", "fetch_content", "get_search_content"].includes(name)) return "Investigando en la web";
	if (name === "subagent") return "Consultando a otro agente";
	if (name.startsWith("mem_")) return "Consultando memoria";
	if (name === "todowrite") return "Organizando tareas";
	return "Trabajando";
}

export default function activityIndicator(pi: ExtensionAPI) {
	const active = new Map<string, string>();
	let modelMessage = "Pensando";
	const show = (ctx: any) => {
		if (ctx.mode !== "tui") return;
		const labels = [...active.values()];
		ctx.ui.setWorkingMessage(labels.at(-1) ?? modelMessage);
	};
	const reset = (ctx: any) => {
		active.clear();
		modelMessage = "Pensando";
		if (ctx.mode === "tui") ctx.ui.setWorkingMessage();
	};

	pi.on("agent_start", (_event, ctx) => { active.clear(); modelMessage = "Pensando"; show(ctx); });
	pi.on("turn_start", (_event, ctx) => { modelMessage = "Pensando"; show(ctx); });
	pi.on("message_update", (event, ctx) => {
		if (event.assistantMessageEvent.type === "text_start") {
			modelMessage = "Redactando";
			show(ctx);
		}
	});
	pi.on("tool_execution_start", (event, ctx) => {
		active.set(event.toolCallId, activityForTool(event.toolName));
		show(ctx);
	});
	pi.on("tool_execution_end", (event, ctx) => {
		active.delete(event.toolCallId);
		modelMessage = "Pensando";
		show(ctx);
	});
	pi.on("agent_settled", (_event, ctx) => reset(ctx));
	pi.on("session_shutdown", (_event, ctx) => reset(ctx));
}
