import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { CURSOR_MARKER } from "@earendil-works/pi-tui";
import type { EditorTheme, TUI, TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";

const BAR = "│";
const GAP = "  ";
const GUTTER = BAR.length + GAP.length;
const MIN_ROWS = 3;

/**
 * Solid input with a single left border. The border keeps Pi's thinking-level
 * color because Pi updates `borderColor` on the editor instance.
 */
class GentlemanInput extends CustomEditor {
	private padTop = 0;
	private windowStart = 0;
	private windowCount = 1;
	private frameRows = MIN_ROWS;

	constructor(
		tui: TUI,
		editorTheme: EditorTheme,
		keybindings: KeybindingsManager,
		private readonly appTheme: () => Theme,
	) {
		super(tui, editorTheme, keybindings, { embedWorkingStatus: false });
	}

	private visibleLines(): number {
		const value = Reflect.get(this, "renderedVisibleLineCount");
		return typeof value === "number" && value > 0 ? value : 1;
	}

	private window(content: string[]): { shown: string[]; start: number } {
		if (content.length <= MIN_ROWS) return { shown: content, start: 0 };
		const cursor = content.findIndex(line => line.includes(CURSOR_MARKER));
		const focus = cursor >= 0 ? cursor : content.length - 1;
		const start = Math.max(0, Math.min(focus - 1, content.length - MIN_ROWS));
		return { shown: content.slice(start, start + MIN_ROWS), start };
	}

	render(width: number): string[] {
		const innerWidth = Math.max(1, width - GUTTER);
		const lines = super.render(innerWidth);
		const visible = this.visibleLines();
		const content = lines.slice(1, 1 + visible);
		const autocomplete = lines.slice(2 + visible);
		const { shown, start } = this.window(content);
		this.windowStart = start;
		this.windowCount = shown.length;
		this.padTop = 1;
		const padBottom = 1;
		this.frameRows = this.padTop + shown.length + padBottom;
		const theme = this.appTheme();
		const decorate = (line: string) =>
			theme.bg("customMessageBg", this.borderColor(BAR) + GAP + line);
		const blank = () => decorate(" ".repeat(innerWidth));
		return [
			...Array.from({ length: this.padTop }, blank),
			...shown.map(decorate),
			...Array.from({ length: padBottom }, blank),
			...autocomplete.map(decorate),
		];
	}

	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (event.x < GUTTER) return { handled: true, focus: true };
		const x = event.x - GUTTER;
		const width = Math.max(1, event.width - GUTTER);
		if (event.y >= this.padTop && event.y < this.padTop + this.windowCount) {
			const y = 1 + this.windowStart + (event.y - this.padTop);
			return super.handleMouse({ ...event, x, y, width });
		}
		if (event.y >= this.frameRows) {
			const y = this.visibleLines() + 2 + (event.y - this.frameRows);
			return super.handleMouse({ ...event, x, y, width });
		}
		return { handled: true, focus: true };
	}
}

export default function inputFrame(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent((tui, editorTheme, keybindings) =>
			new GentlemanInput(tui, editorTheme, keybindings, () => ctx.ui.theme),
		);
	});
}
