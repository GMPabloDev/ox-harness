import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let turn = 0;
	pi.registerProvider("ox-questions-fixture", {
		api: "ox-questions-fixture", apiKey: "fixture", baseUrl: "http://127.0.0.1:1",
		models: [{ id: "fixture", name: "Questions fixture", reasoning: false, input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 }],
		streamSimple(model) {
			const stream = createAssistantMessageEventStream();
			const current = ++turn;
			setTimeout(() => {
				const msg: any = { role: "assistant", api: model.api, provider: model.provider, model: model.id,
					timestamp: Date.now(), content: [], stopReason: current === 1 ? "toolUse" : "stop",
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
				stream.push({ type: "start", partial: msg });
				if (current === 1) {
					const call = { type: "toolCall", id: "fixture-question", name: "ask_user_question", arguments: {
						questions: [
							{ header: "CABECERA", question: "PREGUNTA " + "detalle ".repeat(90) + " FINAL_PREGUNTA", options: [{ label: "OPCION_A" }, { label: "OPCION_B", description: "DESCRIPCION" }] },
							{ header: "SEGUNDA", question: "SEGUNDA_PREGUNTA", options: [{ label: "OPCION_C" }, { label: "OPCION_D" }] },
						],
					} };
					msg.content.push(call);
					stream.push({ type: "toolcall_start", contentIndex: 0, partial: msg });
					stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: msg });
				} else {
					msg.content.push({ type: "text", text: "RESULTADO_VISIBLE" });
					stream.push({ type: "text_start", contentIndex: 0, partial: msg });
					stream.push({ type: "text_delta", contentIndex: 0, delta: "RESULTADO_VISIBLE", partial: msg });
					stream.push({ type: "text_end", contentIndex: 0, content: "RESULTADO_VISIBLE", partial: msg });
				}
				stream.push({ type: "done", reason: msg.stopReason, message: msg });
				stream.end();
			}, current === 1 ? 0 : 500);
			return stream;
		},
	});
}
