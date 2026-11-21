import { describe, expect, test } from "bun:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { QuestionView, type Answer, type Question } from "../view.ts";

const theme = { fg: (_: string, text: string) => text, bg: (_: string, text: string) => text, colors: { borderMuted: "grey" }, style: (text: string) => text } as any;
const first: Question = { header: "Primera", question: "Pregunta uno", options: [{ label: "A" }, { label: "B" }] };
const second: Question = { header: "Segunda", question: "Pregunta dos", options: [{ label: "C" }, { label: "D" }] };
const down = "\x1b[B", up = "\x1b[A", tab = "\t", back = "\x1b[Z", enter = "\r";
function setup(questions = [first, second], rows = 40) {
	let result: Answer[] | null | undefined;
	const view = new QuestionView(questions, theme, () => rows, () => {}, value => { result = value; });
	view.focused = true;
	const text = (width = 90) => view.render(width).map(stripTerminalSequences).join("\n");
	const keys = (...values: string[]) => { for (const value of values) { view.render(90); view.handleInput(value); } };
	return { view, result: () => result, text, keys };
}

describe("question tabs and review", () => {
	test("shows tabs and requires explicit submission after the last answer", () => {
		const { text, keys, result } = setup();
		expect(text()).toContain("□ Primera");
		keys(enter);
		expect(text()).toContain("□ Segunda");
		keys(enter);
		expect(result()).toBeUndefined();
		expect(text()).toContain("Revisar");
		expect(text()).toContain("Primera: A");
		expect(text()).toContain("Segunda: C");
		keys(down, down, enter);
		expect(result()?.map(answer => answer.answer)).toEqual(["A", "C"]);
	});

	test("going back restores the chosen option and replaces its answer without duplicates", () => {
		const { text, keys, result } = setup();
		keys(down, enter, back);
		expect(text()).toContain("> B");
		keys(up, enter, enter, down, down, enter);
		expect(result()).toHaveLength(2);
		expect(result()?.map(answer => [answer.questionIndex, answer.answer])).toEqual([[0, "A"], [1, "C"]]);
	});

	test("tabs wrap, can skip questions, and cannot submit missing answers", () => {
		const { text, keys, result } = setup();
		keys(back);
		expect(text()).toContain("Pendiente");
		keys(down, down, enter);
		expect(result()).toBeUndefined();
		expect(text()).toContain("Pregunta uno");
		keys(tab, enter, down, down, enter);
		expect(text()).toContain("Pregunta uno");
		keys(enter, tab, down, down, enter);
		expect(result()?.map(answer => answer.answer)).toEqual(["A", "C"]);
	});

	test("review entries reopen questions with Enter", () => {
		const { text, keys, result } = setup();
		keys(enter, enter);
		keys(enter);
		expect(text()).toContain("Pregunta uno");
		keys(down, enter, tab);
		expect(text()).toContain("Primera: B");
		keys(down, down, enter);
		expect(result()?.[0]?.answer).toBe("B");
	});

	test("custom text drafts survive tab navigation and retain input focus", () => {
		const { view, text, keys, result } = setup();
		keys(down, down, enter, "borrador", tab, back);
		expect(text()).toContain("borrador");
		expect(text()).toContain("Esc: volver");
		expect(view.focused).toBe(true);
		keys(" corregido", enter, enter, down, down, enter);
		expect(result()?.[0]).toMatchObject({ kind: "custom", answer: "borrador corregido" });
	});

	test("left/right switch tabs outside editing and move the text cursor inside editing", () => {
		const { text, keys, result } = setup();
		keys("\x1b[C");
		expect(text()).toContain("Pregunta dos");
		keys("\x1b[D", down, down, enter, "abc", "\x1b[D", "X", enter, enter, down, down, enter);
		expect(result()?.[0]?.answer).toBe("abXc");
	});

	test("each question retains its own custom draft and cursor", () => {
		const { text, keys, result } = setup();
		keys(down, down, enter, "uno", "\x1b[D", tab, down, down, enter, "dos", back, "X");
		expect(text()).toContain("unXo");
		expect(text()).not.toContain("dos");
		keys(enter, enter, down, down, enter);
		expect(result()?.map(answer => answer.answer)).toEqual(["unXo", "dos"]);
	});

	test("multi-selection drafts survive navigation and edits must be confirmed again", () => {
		const { text, keys, result } = setup([{ ...first, multiSelect: true }, second]);
		keys(enter, down, enter, tab, back);
		expect(text()).toContain("[x] A");
		expect(text()).toContain("[x] B");
		keys(down, down, enter, enter, back, back);
		keys(up, up, up, enter, back);
		expect(text()).toContain("Primera: Pendiente");
		keys(down, down, enter);
		expect(result()).toBeUndefined();
		expect(text()).toContain("[ ] A");
		expect(text()).toContain("[x] B");
		keys(down, down, down, enter, tab, down, down, enter);
		expect(result()?.[0]).toMatchObject({ kind: "multi", selected: ["B"] });
	});

	test("editing a committed custom answer makes the old answer pending", () => {
		const { text, keys, result } = setup();
		keys(down, down, enter, "original", enter, enter, enter);
		keys(enter, " nuevo", back);
		expect(text()).toContain("Primera: Pendiente");
		keys(tab, enter, tab, down, down, enter);
		expect(result()?.[0]?.answer).toBe("original nuevo");
	});

	test("review cancels with Escape and custom editing cancels with Ctrl+C", () => {
		const review = setup();
		review.keys(back, "\x1b");
		expect(review.result()).toBeNull();
		const editing = setup();
		editing.keys(down, down, enter, "\x03");
		expect(editing.result()).toBeNull();
	});

	test("long review content remains pageable and fits narrow terminals", () => {
		const long = "respuesta " + "detalle ".repeat(80) + "FINAL_RESPUESTA";
		const { view, keys, result } = setup([{ ...first, options: [{ label: long }] }, second], 12);
		keys(enter, enter);
		const collected: string[] = [];
		for (let i = 0; i < 150; i++) {
			for (const line of view.render(12)) {
				expect(visibleWidth(line)).toBeLessThanOrEqual(12);
				collected.push(stripTerminalSequences(line));
			}
			view.handleInput("j");
		}
		expect(collected.join(" ")).toContain("FINAL_RESP");
		expect(collected.join(" ")).toContain("Enviar");
		expect(result()).toBeUndefined();
	});
});
