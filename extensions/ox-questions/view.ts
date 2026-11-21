import type { Theme } from "@earendil-works/pi-coding-agent";
import { Input, Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

export interface Question {
	question: string;
	header: string;
	options: { label: string; description?: string; preview?: string }[];
	multiSelect?: boolean;
}
export interface Answer {
	questionIndex: number;
	question: string;
	kind: "option" | "multi" | "custom";
	answer: string | null;
	selected?: string[];
	preview?: string;
}

interface QuestionState {
	choice: number;
	scroll: number;
	selected: Set<number>;
	input: Input;
	editing: boolean;
	answer?: Answer;
}

/** Scrollable questions with retained drafts and an explicit review for multi-question forms. */
export class QuestionView {
	private index = 0;
	private drafts: QuestionState[];
	private review = { choice: 0, scroll: 0 };
	private focus = false;
	private choiceLines: number[] = [];
	private viewport = 1;
	private bodyLength = 0;

	constructor(private questions: Question[], private theme: Theme, private rows: () => number,
		private refresh: () => void, private done: (answers: Answer[] | null) => void) {
		this.drafts = questions.map(() => {
			const input = new Input({ prompt: "> ", placeholder: "Escribe tu respuesta" });
			input.onSubmit = (value) => {
				if (!value.trim()) return;
				this.commit({ kind: "custom", answer: value, selected: this.selection() });
			};
			return { choice: 0, scroll: 0, selected: new Set<number>(), input, editing: false };
		});
	}
	get focused(): boolean { return this.focus; }
	set focused(value: boolean) { this.focus = value; if (!this.isReview) this.input.focused = value && this.editing; }
	invalidate(): void { for (const draft of this.drafts) draft.input.invalidate(); }
	private get isMulti(): boolean { return this.questions.length > 1; }
	private get isReview(): boolean { return this.index === this.questions.length; }
	private get draft(): QuestionState { return this.drafts[this.index]!; }
	private get input(): Input { return this.draft.input; }
	private get state(): { choice: number; scroll: number } { return this.isReview ? this.review : this.draft; }
	private get editing(): boolean { return !this.isReview && this.draft.editing; }
	private get question(): Question { return this.questions[this.index]!; }
	private selection(): string[] { return this.question.options.filter((_, i) => this.draft.selected.has(i)).map(o => o.label); }
	private get allAnswered(): boolean { return this.drafts.every(draft => draft.answer !== undefined); }
	private answerSummary(answer: Answer | undefined): string {
		if (!answer) return "Pendiente";
		const selected = answer.selected?.join(", ");
		if (answer.answer === null) return selected || "Sin opciones";
		return answer.answer + (selected ? ` (${selected})` : "");
	}

	private goTo(index: number): void {
		if (!this.isReview) this.input.focused = false;
		this.index = index;
		if (this.isReview) this.review = { choice: 0, scroll: 0 };
		else this.input.focused = this.focus && this.editing;
		this.choiceLines = [];
		this.refresh();
	}
	private commit(answer: Omit<Answer, "questionIndex" | "question">): void {
		this.draft.answer = { questionIndex: this.index, question: this.question.question, ...answer };
		this.draft.editing = false;
		this.input.focused = false;
		if (!this.isMulti) { this.done([this.draft.answer]); return; }
		this.goTo(this.index + 1);
	}
	private confirmReview(): void {
		if (this.review.choice < this.questions.length) { this.goTo(this.review.choice); return; }
		const missing = this.drafts.findIndex(draft => !draft.answer);
		if (missing >= 0) { this.goTo(missing); return; }
		this.done(this.drafts.map(draft => draft.answer!));
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.ctrl("c"))) { this.done(null); return; }
		if (this.isMulti) {
			const next = matchesKey(data, Key.tab) || (!this.editing && matchesKey(data, Key.right));
			const previous = matchesKey(data, Key.shift("tab")) || (!this.editing && matchesKey(data, Key.left));
			if (next || previous) {
				const count = this.questions.length + 1;
				this.goTo((this.index + (next ? 1 : count - 1)) % count);
				return;
			}
		}
		if (this.editing) {
			if (matchesKey(data, Key.escape)) { this.draft.editing = false; this.input.focused = false; }
			else {
				const index = this.index;
				const value = this.input.getValue();
				this.input.handleInput(data);
				if (this.index === index && this.input.getValue() !== value) {
					this.draft.answer = undefined;
				}
			}
			this.refresh(); return;
		}
		if (matchesKey(data, Key.escape)) { this.done(null); return; }
		const state = this.state;
		const last = this.isReview ? this.questions.length : this.question.options.length + (this.question.multiSelect ? 1 : 0);
		if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
			state.choice = Math.max(0, Math.min(last, state.choice + (matchesKey(data, Key.up) ? -1 : 1)));
			const line = this.choiceLines[state.choice] ?? 0;
			if (line < state.scroll) state.scroll = line;
			else if (line >= state.scroll + this.viewport) state.scroll = Math.max(0, line - this.viewport + 1);
		} else if (matchesKey(data, Key.pageUp) || matchesKey(data, "k")) state.scroll = Math.max(0, state.scroll - this.viewport);
		else if (matchesKey(data, Key.pageDown) || matchesKey(data, "j")) state.scroll = Math.min(Math.max(0, this.bodyLength - this.viewport), state.scroll + this.viewport);
		else if (matchesKey(data, Key.enter) || (!this.isReview && this.question.multiSelect && matchesKey(data, Key.space))) {
			if (this.isReview) this.confirmReview();
			else {
				const options = this.question.options.length;
				if (state.choice === options) { this.draft.editing = true; this.input.focused = this.focus; }
				else if (state.choice === options + 1) this.commit({ kind: "multi", answer: null, selected: this.selection() });
				else if (this.question.multiSelect) {
					if (this.draft.selected.has(state.choice)) this.draft.selected.delete(state.choice); else this.draft.selected.add(state.choice);
					this.draft.answer = undefined;
				} else {
					const option = this.question.options[state.choice]!;
					this.commit({ kind: "option", answer: option.label, ...(option.preview !== undefined ? { preview: option.preview } : {}) });
				}
			}
		} else return;
		this.refresh();
	}

	render(width: number): string[] {
		const outerWidth = Math.max(1, width);
		const framed = outerWidth >= 3;
		width = framed ? outerWidth - 2 : outerWidth;
		const th = this.theme;
		const state = this.state;
		const body: string[] = [];
		const add = (text: string, color: "text" | "accent" | "muted" | "dim" | "success") => {
			for (const line of wrapTextWithAnsi(text, width)) body.push(th.fg(color, line));
		};
		if (this.isMulti) {
			const tab = (label: string, active: boolean, answered: boolean) => {
				const text = ` ${label} `;
				return active ? th.style(text, { bg: th.colors.borderMuted, fg: "text", bold: true })
					: th.fg(answered ? "success" : "muted", text);
			};
			const tabs = this.questions.map((question, i) =>
				tab(`${this.drafts[i]!.answer ? "✓" : "□"} ${question.header}`, i === this.index, !!this.drafts[i]!.answer));
			tabs.push(tab("✓ Revisar", this.isReview, false));
			for (const line of wrapTextWithAnsi(tabs.join(" "), width)) body.push(line);
		} else add(this.question.header, "accent");
		body.push("");
		this.choiceLines = [];
		if (this.isReview) {
			add("Revisa las respuestas antes de enviarlas", "accent");
			body.push("");
			this.questions.forEach((question, i) => {
				this.choiceLines.push(body.length);
				const summary = this.answerSummary(this.drafts[i]!.answer);
				add(`${i === state.choice ? "> " : "  "}${question.header}: ${summary}`, i === state.choice ? "accent" : "text");
				body.push("");
			});
			this.choiceLines.push(body.length);
			add(`${state.choice === this.questions.length ? "> " : "  "}${this.allAnswered ? "Enviar respuestas" : "Responder pendientes"}`, state.choice === this.questions.length ? "accent" : "text");
		} else {
			add(this.question.question, "text");
			body.push("");
			this.question.options.forEach((option, i) => {
				this.choiceLines.push(body.length);
				const marker = this.question.multiSelect ? (this.draft.selected.has(i) ? "[x] " : "[ ] ") : "";
				add(`${i === state.choice ? "> " : "  "}${marker}${option.label}`, i === state.choice ? "accent" : "text");
				if (option.description) add(`  ${option.description}`, "muted");
				if (option.preview) add(`  ${option.preview}`, "dim");
				if (option.description || option.preview) body.push("");
			});
			if (body.at(-1) !== "") body.push("");
			this.choiceLines.push(body.length);
			add(`${state.choice === this.question.options.length ? "> " : "  "}Escribir respuesta`, state.choice === this.question.options.length ? "accent" : "text");
			if (this.question.multiSelect) {
				body.push("");
				this.choiceLines.push(body.length);
				add(`${state.choice === this.question.options.length + 1 ? "> " : "  "}Terminar selección`, state.choice === this.question.options.length + 1 ? "accent" : "text");
			}
		}
		this.bodyLength = body.length;
		// Reserve panel padding plus space for Pi's footer and widgets; long content stays pageable.
		this.viewport = Math.max(1, this.rows() - Math.min(14, Math.floor(this.rows() * 0.4) + 3) - 2 - (this.isMulti ? 1 : 0));
		state.scroll = Math.min(state.scroll, Math.max(0, body.length - this.viewport));
		const indicator = body.length > this.viewport
			? [truncateToWidth(th.fg("dim", `${state.scroll + 1}-${Math.min(state.scroll + this.viewport, body.length)}/${body.length}  j/k: texto`), width)] : [];
		const help = this.editing ? `Enter: ${this.isMulti ? "guardar" : "enviar"} · Esc: volver`
			: this.isReview ? "↑↓: respuestas · Enter: revisar/enviar · Esc: cancelar" : "↑↓: opciones · Enter: elegir · Esc: cancelar";
		const navigation = "Tab / Shift+Tab: cambiar de pregunta";
		const helpLines = this.isMulti && visibleWidth(navigation) + 2 + visibleWidth(help) <= width
			? [th.fg("dim", navigation + " ".repeat(width - visibleWidth(navigation) - visibleWidth(help)) + help)]
			: [...(this.isMulti ? [truncateToWidth(th.fg("dim", navigation), width)] : []), truncateToWidth(th.fg("dim", help), width)];
		const lines = ["", ...body.slice(state.scroll, state.scroll + this.viewport), ...indicator,
			...(this.editing ? this.input.render(width) : []),
			"", ...helpLines, ""];
		return lines.map(line => {
			const content = framed ? th.fg("accent", "│") + " " + line : line;
			const background = th.bg("toolPendingBg", "").replace(/\x1b\[49m$/, "");
			return th.bg("toolPendingBg", content.replace(/\x1b\[49m/g, `\x1b[49m${background}`) + " ".repeat(Math.max(0, outerWidth - visibleWidth(content))));
		});
	}
}
