import type { ExtensionAPI, Theme, ToolRendererResolver } from "@earendil-works/pi-coding-agent";
import { stripVTControlCharacters } from "node:util";
import type { Component, TuiMouseEvent } from "@earendil-works/pi-tui";

const BUILTINS = new Set(["read", "bash", "powershell", "edit", "write", "grep", "find", "ls"]);
const PREFIX_WIDTH = 2;

class StatusLines implements Component {
	constructor(
		readonly child: Component,
		private theme: Theme,
		private error: boolean,
		private heading: boolean,
	) {}

	render(width: number): string[] {
		if (width <= PREFIX_WIDTH) return this.child.render(width);
		const fg = this.error ? "error" : "success";
		// The native Box owns the background. Painting it here would insert
		// SGR 49 resets inside that box and punch holes through the panel.
		const prefix = this.theme.fg(fg, "▌ ");
		return this.child.render(width - PREFIX_WIDTH).map(line => {
			const body = this.error || this.heading
				? this.theme.fg(fg, stripVTControlCharacters(line))
				: line;
			return prefix + body;
		});
	}

	invalidate(): void { this.child.invalidate(); }

	handleMouse(event: TuiMouseEvent) {
		if (event.width <= PREFIX_WIDTH) return this.child.handleMouse?.(event);
		if (event.x < PREFIX_WIDTH) return undefined;
		return this.child.handleMouse?.({ ...event, x: event.x - PREFIX_WIDTH, width: event.width - PREFIX_WIDTH });
	}
}

export const statusRenderer: ToolRendererResolver = (name, next) => {
	const native = next();
	if (!BUILTINS.has(name) || !native || native.renderShell === "self") return native;
	return {
		...native,
		renderCall: native.renderCall && ((args, theme, context) => {
			const previous = context.lastComponent;
			const child = native.renderCall!(args, theme, {
				...context, lastComponent: previous instanceof StatusLines ? previous.child : previous,
			});
			return context.isPartial ? child : new StatusLines(child, theme, context.isError, true);
		}),
		renderResult: native.renderResult && ((result, options, theme, context) => {
			const previous = context.lastComponent;
			const child = native.renderResult!(result, options, theme, {
				...context, lastComponent: previous instanceof StatusLines ? previous.child : previous,
			});
			return options.isPartial ? child : new StatusLines(child, theme, context.isError, false);
		}),
	};
};

export default function toolStatus(pi: ExtensionAPI) {
	pi.registerToolRenderer(statusRenderer);
}
