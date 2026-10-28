import { describe, expect, test } from "bun:test";
import install, { activityForTool } from "../index.ts";

function harness(mode = "tui") {
	const handlers = new Map<string, Function>();
	const messages: (string | undefined)[] = [];
	install({ on(name: string, handler: Function) { handlers.set(name, handler); } } as any);
	const ctx = { mode, ui: { setWorkingMessage(message?: string) { messages.push(message); } } };
	return { messages, emit(name: string, event: object = {}) { handlers.get(name)?.(event, ctx); } };
}

describe("activity indicator", () => {
	test("classifies known tools and uses a safe fallback", () => {
		expect(activityForTool("read")).toBe("Explorando");
		expect(activityForTool("edit")).toBe("Editando archivos");
		expect(activityForTool("bash")).toBe("Ejecutando comandos");
		expect(activityForTool("web_search")).toBe("Investigando en la web");
		expect(activityForTool("unknown")).toBe("Trabajando");
	});
	test("tracks parallel and nested calls until each one ends", () => {
		const h = harness();
		h.emit("agent_start");
		h.emit("tool_execution_start", { toolCallId: "a", toolName: "read" });
		h.emit("tool_execution_start", { toolCallId: "b", toolName: "edit" });
		h.emit("tool_execution_end", { toolCallId: "a" });
		h.emit("tool_execution_end", { toolCallId: "b" });
		h.emit("message_update", { assistantMessageEvent: { type: "text_start" } });
		h.emit("agent_settled");
		expect(h.messages).toEqual(["Pensando", "Explorando", "Editando archivos", "Editando archivos", "Pensando", "Redactando", undefined]);
	});
	test("restores the previous active call and resets on shutdown", () => {
		const h = harness();
		h.emit("tool_execution_start", { toolCallId: "parent", toolName: "bash" });
		h.emit("tool_execution_start", { toolCallId: "child", toolName: "read" });
		h.emit("tool_execution_end", { toolCallId: "child" });
		h.emit("session_shutdown");
		expect(h.messages).toEqual(["Ejecutando comandos", "Explorando", "Ejecutando comandos", undefined]);
	});
	test("does not touch the UI outside TUI mode", () => {
		const h = harness("rpc");
		h.emit("agent_start"); h.emit("tool_execution_start", { toolCallId: "a", toolName: "read" }); h.emit("agent_settled");
		expect(h.messages).toEqual([]);
	});
});
