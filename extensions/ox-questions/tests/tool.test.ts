import { expect, test } from "bun:test";
import register from "../index.ts";

function tool() {
	let definition: any;
	register({ registerTool: (value: any) => { definition = value; } } as any);
	return definition;
}
const params = { questions: [{ header: "H", question: "Q", options: [{ label: "A" }] }] };

test("non-TUI mode fails explicitly", async () => {
	const result = await tool().execute("id", params, undefined, undefined, { mode: "rpc" });
	expect(result.isError).toBe(true);
	expect(result.details.error).toBe("unavailable_outside_tui");
});

test("uses Pi's native interaction area rather than a full-terminal overlay", async () => {
	let options: any;
	const context = { mode: "tui", ui: { setWorkingVisible() {}, custom: async (_factory: any, value: any) => { options = value; return null; } } };
	await tool().execute("id", params, undefined, undefined, context);
	expect(options).toBeUndefined();
});

test("abort closes the pending interaction", async () => {
	const controller = new AbortController();
	const visibility: boolean[] = [];
	const context = { mode: "tui", ui: { setWorkingVisible: (value: boolean) => visibility.push(value), custom: (factory: any) => new Promise(resolve => {
		factory({ terminal: { rows: 25 }, requestRender() {} }, { fg: (_: string, s: string) => s }, {}, resolve);
	}) } };
	const pending = tool().execute("id", params, controller.signal, undefined, context);
	controller.abort();
	const result = await pending;
	expect(result.details.cancelled).toBe(true);
	expect(visibility).toEqual([false, true]);
});

for (const outcome of ["answer", "cancel", "error"] as const) {
	test(`hides activity only while the questionnaire is open: ${outcome}`, async () => {
		const visibility: boolean[] = [];
		const answer = { questionIndex: 0, question: "Q", kind: "option", answer: "A" };
		const context = { mode: "tui", ui: {
			setWorkingVisible: (value: boolean) => visibility.push(value),
			custom: async () => {
				expect(visibility).toEqual([false]);
				if (outcome === "error") throw new Error("UI failure");
				return outcome === "answer" ? [answer] : null;
			},
		} };
		const pending = tool().execute("id", params, undefined, undefined, context);
		if (outcome === "error") await expect(pending).rejects.toThrow("UI failure");
		else {
			const result = await pending;
			if (outcome === "answer") expect(result.details.answers).toEqual([answer]);
			else expect(result.details.cancelled).toBe(true);
		}
		expect(visibility).toEqual([false, true]);
	});
}

test("an already aborted request does not change activity visibility", async () => {
	const controller = new AbortController();
	controller.abort();
	const result = await tool().execute("id", params, controller.signal, undefined, { mode: "tui", ui: {} });
	expect(result.details.cancelled).toBe(true);
});
