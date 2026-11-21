import { describe, expect, test } from "bun:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { QuestionView, type Answer, type Question } from "../view.ts";

const theme = { fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text,
	colors: { borderMuted: "grey" }, style: (text: string) => text } as any;
const base: Question = { header: "Tema", question: "Pregunta", options: [{ label: "Primera" }, { label: "Segunda", description: "Detalle" }] };
function setup(questions = [base], rows = 15) {
	let result: Answer[] | null | undefined;
	const view = new QuestionView(questions, theme, () => rows, () => {}, value => { result = value; });
	view.focused = true;
	return { view, result: () => result };
}
describe("ox questions", () => {
	test("spaces the header, question and option groups with panel padding", () => {
		const { view } = setup([base], 32);
		const lines = view.render(60).map(stripTerminalSequences);
		expect(lines.every(line => line.startsWith("│ "))).toBe(true);
		expect(lines.map(line => line.slice(2).trimEnd())).toEqual([
			"", "Tema", "", "Pregunta", "", "> Primera", "  Segunda", "  Detalle", "",
			"  Escribir respuesta", "", "↑↓: opciones · Enter: elegir · Esc: cancelar", "",
		]);
		expect(lines.join("\n")).not.toContain("j/k: texto");
	});
	test("highlights only the active tab and keeps status markers when tabs wrap", () => {
		const backgrounds: string[] = [];
		const colors: string[] = [];
		const styles: unknown[] = [];
		const headerTheme = { ...theme, bg: (color: string, text: string) => { backgrounds.push(color); return text; },
			fg: (color: string, text: string) => { if (text.includes("Tema")) colors.push(color); return text; },
			style: (text: string, options: unknown) => { styles.push(options); return `\x1b[1m${text}\x1b[22m`; } };
		const view = new QuestionView([base, base], headerTheme, () => 32, () => {}, () => {});
		const lines = view.render(20);
		expect(lines.some(line => line.includes("\x1b[1m □ Tema \x1b[22m"))).toBe(true);
		expect(styles).toEqual([{ bg: "grey", fg: "text", bold: true }]);
		expect(colors).toContain("muted");
		expect(backgrounds.filter(color => color === "toolPendingBg")).toHaveLength(lines.length * 2);
	});
	test("restores the sidebar background after the active tab", () => {
		const themed = { ...theme, bg: (_color: string, text: string) => `\x1b[45m${text}\x1b[49m`,
			style: (text: string) => `\x1b[44m${text}\x1b[49m` };
		const view = new QuestionView([base, base], themed, () => 32, () => {}, () => {});
		const header = view.render(80).find(line => line.includes("\x1b[44m"))!;
		expect(header).toContain("\x1b[49m\x1b[45m");
	});
	test("aligns navigation and action help when they fit, and stacks them otherwise", () => {
		const { view } = setup([base, base], 32);
		const wide = view.render(100).map(stripTerminalSequences);
		const footer = wide.find(line => line.includes("Tab / Shift+Tab"))!;
		expect(footer).toContain("↑↓: opciones · Enter: elegir · Esc: cancelar");
		expect(footer.indexOf("Tab / Shift+Tab")).toBeLessThan(footer.indexOf("↑↓: opciones"));
		const narrow = view.render(45).map(stripTerminalSequences);
		expect(narrow.find(line => line.includes("Tab / Shift+Tab"))).not.toContain("↑↓: opciones");
		expect(narrow.some(line => line.includes("↑↓: opciones"))).toBe(true);
	});
	test("paints every row to full width with the sidebar background", () => {
		const backgrounds: string[] = [];
		const paintedTheme = { ...theme, bg: (color: string, text: string) => {
			backgrounds.push(color);
			return `\x1b[48;2;30;30;40m${text}\x1b[49m`;
		} };
		const view = new QuestionView([base], paintedTheme, () => 24, () => {}, () => {});
		for (const width of [1, 2, 3, 12, 60]) {
			for (const editing of [false, true]) {
				if (editing) { view.handleInput("\x1b[B"); view.handleInput("\x1b[B"); view.handleInput("\r"); }
				const lines = view.render(width);
				for (const line of lines) {
					expect(line.startsWith("\x1b[48;2;30;30;40m")).toBe(true);
					expect(line.endsWith("\x1b[49m")).toBe(true);
					expect(visibleWidth(line)).toBe(width);
				}
				if (editing) view.handleInput("\x1b");
			}
		}
		expect(backgrounds.length).toBeGreaterThan(0);
		expect(backgrounds.every(color => color === "toolPendingBg")).toBe(true);
	});
	test("returns the selected option and preview", () => {
		const { view, result } = setup([{ ...base, options: [{ label: "A", preview: "Detalle completo" }] }]);
		view.render(30); view.handleInput("\r");
		expect(result()?.[0]).toMatchObject({ kind: "option", answer: "A", preview: "Detalle completo" });
	});
	test("retains multiple choices when a custom answer is submitted", () => {
		const { view, result } = setup([{ ...base, multiSelect: true }]);
		view.render(30); view.handleInput("\r"); view.handleInput("\x1b[B"); view.render(30); view.handleInput("\x1b[B"); view.handleInput("\r");
		view.handleInput("otra"); view.handleInput("\r");
		expect(result()?.[0]).toMatchObject({ kind: "custom", answer: "otra", selected: ["Primera"] });
	});
	test("cancels the entire questionnaire", () => {
		const { view, result } = setup([base, base]);
		view.handleInput("\r"); view.handleInput("\x1b");
		expect(result()).toBeNull();
	});
	test("all long content remains reachable through paging and fits narrow widths", () => {
		const text = Array.from({ length: 50 }, (_, i) => `segment${i}`).join(" ");
		const { view } = setup([{ ...base, question: text }], 12);
		const collected = new Set<string>();
		for (let i = 0; i < 100; i++) {
			const lines = view.render(12);
			expect(stripTerminalSequences(lines[0]!).trim()).toBe("│");
			expect(stripTerminalSequences(lines.at(-1)!).trim()).toBe("│");
			expect(lines.length).toBeLessThanOrEqual(12);
			for (const line of lines) { expect(visibleWidth(line)).toBeLessThanOrEqual(12); collected.add(stripTerminalSequences(line)); }
			view.handleInput("j");
		}
		for (let i = 0; i < 50; i++) expect([...collected].join(" ")).toContain(`segment${i}`);
	});
});
