import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { QuestionView, type Answer } from "./view.ts";

const parameters = Type.Object({
	questions: Type.Array(Type.Object({
		header: Type.String({ description: "A short title for this question." }),
		question: Type.String({ description: "The full question." }),
		options: Type.Array(Type.Object({
			label: Type.String({ description: "Choice label." }),
			description: Type.Optional(Type.String({ description: "Explanation of the choice." })),
			preview: Type.Optional(Type.String({ description: "Additional detail to compare." })),
		}), { minItems: 1, description: "Choices; the interface also offers a free-text answer." }),
		multiSelect: Type.Optional(Type.Boolean({ description: "Allow multiple choices." })),
	}), { minItems: 1 }),
});

export default function (pi: ExtensionAPI): void {
	pi.registerTool({
		name: "ask_user_question",
		label: "Ox questions",
		description: "Ask the user one or more questions with choices, optional descriptions and previews, and an always-available free-text response.",
		promptGuidelines: ["Use ask_user_question when the user's decision is needed. Set multiSelect for choices that can be combined. Do not use it for decisions you should make yourself."],
		parameters,
		exposure: "model-only",
		executionMode: "sequential",
		async execute(_id, params, signal, _update, ctx) {
			if (ctx.mode !== "tui") return { content: [{ type: "text", text: "Error: ask_user_question requires the interactive TUI. Ask the user in the conversation instead." }], details: { error: "unavailable_outside_tui" }, isError: true };
			if (signal?.aborted) return { content: [{ type: "text", text: "Questionnaire cancelled." }], details: { cancelled: true } };
			let cancel: (() => void) | undefined;
			const onAbort = () => cancel?.();
			signal?.addEventListener("abort", onAbort, { once: true });
			let answers: Answer[] | null;
			try {
				ctx.ui.setWorkingVisible(false);
				answers = await ctx.ui.custom<Answer[] | null>((tui, theme, _keys, done) => {
					cancel = () => done(null);
					const view = new QuestionView(params.questions, theme, () => tui.terminal.rows, () => tui.requestRender(), done);
					if (signal?.aborted) queueMicrotask(cancel);
					return view;
				});
			} finally {
				signal?.removeEventListener("abort", onAbort);
				cancel = undefined;
				ctx.ui.setWorkingVisible(true);
			}
			if (!answers) return { content: [{ type: "text", text: "User cancelled the questionnaire. Do not assume an answer." }], details: { cancelled: true } };
			return { content: [{ type: "text", text: JSON.stringify({ answers }) }], details: { answers } };
		},
		renderCall(args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("ox questions ")) + theme.fg("muted", `${args.questions?.length ?? 0} pregunta(s)`), 0, 0);
		},
		renderResult(result, _options, theme) {
			const details = result.details as { answers?: Answer[]; cancelled?: boolean; error?: string } | undefined;
			if (details?.error) return new Text(theme.fg("error", details.error), 0, 0);
			if (details?.cancelled) return new Text(theme.fg("warning", "Cancelado"), 0, 0);
			return new Text((details?.answers ?? []).map(a => theme.fg("success", "✓ ") + theme.fg("text", `${a.question}: ${a.answer ?? (a.selected ?? []).join(", ")}${a.kind === "custom" && a.selected?.length ? ` (${a.selected.join(", ")})` : ""}`)).join("\n"), 0, 0);
		},
	});
}
