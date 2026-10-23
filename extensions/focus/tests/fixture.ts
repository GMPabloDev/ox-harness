// Offline, zero-cost provider used only by the real-PTY smoke test.
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAssistantMessageEventStream, Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export default function fixture(pi: ExtensionAPI) {
	const output = process.env.FOCUS_TEST_OUTPUT!;
	let turn = 0;
	pi.registerProvider("focus-fixture", {
		api: "focus-fixture", apiKey: "fixture", baseUrl: "http://127.0.0.1:1",
		models: [{ id: "fixture", name: "Offline Focus fixture", reasoning: true, input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 }],
		streamSimple(model, context) {
			const stream = createAssistantMessageEventStream();
			const current = ++turn;
			appendFileSync(join(output, "requests.jsonl"), JSON.stringify(context) + "\n");
			void (async () => {
				const msg: any = { role: "assistant", api: model.api, provider: model.provider, model: model.id,
					timestamp: Date.now(), content: [], stopReason: "stop",
					usage: { input: 10, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 20,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
				stream.push({ type: "start", partial: msg });
				const addText = (type: "text" | "thinking", text: string) => {
					const index = msg.content.length;
					msg.content.push(type === "text" ? { type, text: "" } : { type, thinking: "" });
					stream.push({ type: `${type}_start`, contentIndex: index, partial: msg } as any);
					msg.content[index][type === "text" ? "text" : "thinking"] = text;
					stream.push({ type: `${type}_delta`, contentIndex: index, delta: text, partial: msg } as any);
					stream.push({ type: `${type}_end`, contentIndex: index, content: text, partial: msg } as any);
				};
				const addTool = (name: string, args: unknown, id: string) => {
					const index = msg.content.length;
					msg.content.push({ type: "toolCall", id, name, arguments: args });
					stream.push({ type: "toolcall_start", contentIndex: index, partial: msg });
					stream.push({ type: "toolcall_end", contentIndex: index, toolCall: msg.content[index], partial: msg });
				};
				addText("thinking", "THINKING_SECRET");
				await sleep(200);
				if (current === 1) {
					addText("text", "PROGRESS_SECRET");
					await sleep(200);
					addTool("read", { path: "fixture.txt" }, "read-ok");
					addTool("read", { path: "missing-fixture.txt" }, "read-fail");
					msg.stopReason = "toolUse";
				} else if (current === 2) {
					addText("text", "MORE_PROGRESS_SECRET");
					addTool("web_search", { query: "FIXTURE_WEB_QUERY" }, "web-call");
					addTool("mem_search", { query: "private query" }, "mem-call");
					addTool("subagent", { agent: "fixture-scout", task: "FIXTURE_SUBAGENT_TASK" }, "subagent-call");
					msg.stopReason = "toolUse";
				} else {
					addText("text", "FINAL_VISIBLE ¿Quieres continuar?");
					writeFileSync(join(output, "streaming"), "yes");
					await sleep(1000);
				}
				stream.push({ type: "done", reason: msg.stopReason, message: msg });
				stream.end();
			})();
			return stream;
		},
	});
	for (const [name, parameters] of [
		["web_search", Type.Object({ query: Type.String() })],
		["mem_search", Type.Object({ query: Type.String() })],
		["subagent", Type.Object({ agent: Type.String(), task: Type.String() })],
	] as const) {
		pi.registerTool({ name, label: name, description: "Offline fixture", parameters,
			async execute() {
				await sleep(250);
				return { content: [{ type: "text", text: `${name.toUpperCase()}_RESULT_SECRET` }], details: {} };
			},
		});
	}
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.sessionManager.getBranch().some(entry => entry.type === "custom" && entry.customType === "todo-sidebar-state")) {
			pi.appendEntry("todo-sidebar-state", { version: 1, title: "FOCUS_SIDEBAR_TEST", todos: [
				{ id: "1", content: "Mantener el panel visible", status: "in_progress" },
			] });
		}
	});
	pi.on("agent_settled", (_event, ctx) => {
		writeFileSync(join(output, "branch.json"), JSON.stringify(ctx.sessionManager.getBranch(), null, 2));
		writeFileSync(join(output, "settled"), "yes");
	});
	pi.registerCommand("fixture", { description: "Run the offline fixture", handler: async () => pi.sendUserMessage("FIXTURE_REQUEST") });
	pi.registerCommand("fixture-permission", { description: "Test native permissions", handler: async (_args, ctx) => {
		const accepted = await ctx.ui.confirm("PERMISSION_VISIBLE", "¿Permitir esta prueba local?");
		ctx.ui.notify(accepted ? "PERMISSION_ACCEPTED" : "PERMISSION_CANCELLED", "info");
	} });
}
