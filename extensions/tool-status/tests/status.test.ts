import { describe, expect, test } from "bun:test";
import { createReadToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text, visibleWidth } from "@earendil-works/pi-tui";
import { statusRenderer } from "../index.ts";

const modules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const themes = await import(`${modules}/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js`);
const { ToolExecutionComponent } = await import(`${modules}/@earendil-works/pi-coding-agent/dist/modes/interactive/components/tool-execution.js`);
const theme = themes.loadThemeFromPath("/home/osiosad/.pi/agent/themes/ox-theme.json", "truecolor");
themes.setThemeInstance(theme);
const native = createReadToolDefinition("/tmp");
const renderers = statusRenderer("read", () => native)!;
const plain = (lines: string[]) => lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
const context = (error = false, partial = false) => ({
	args: { path: "/tmp/status-demo.txt" }, toolCallId: "demo", invalidate() {}, state: {},
	cwd: "/tmp", executionStarted: true, argsComplete: true, isPartial: partial,
	expanded: true, showImages: false, isError: error, outputPad: 1,
});

describe("tool status presentation", () => {
	test("colors successful headings mint and failed headings pink", () => {
		for (const error of [false, true]) {
			const call = renderers.renderCall!(context().args, theme, context(error));
			const lines = call.render(80);
			expect(plain(lines)).toContain("▌ read");
			expect(lines.join("\n")).toContain(error ? "\x1b[38;2;255;92;122m" : "\x1b[38;2;95;215;160m");
		}
	});
	test("colors error output pink without changing its content or result", () => {
		const result = { content: [{ type: "text" as const, text: "ENOENT: archivo inexistente" }], details: {} };
		const before = JSON.stringify(result);
		const rendered = renderers.renderResult!(result, { expanded: true, isPartial: false }, theme, context(true));
		const lines = rendered.render(80);
		expect(plain(lines)).toContain("ENOENT: archivo inexistente");
		expect(lines.join("\n")).toContain("\x1b[38;2;255;92;122m");
		expect(JSON.stringify(result)).toBe(before);
	});
	test("keeps successful body styling and unmodified renderers while pending", () => {
		const body = new Text(theme.fg("mdCode", "BODY_VISIBLE"), 0, 0);
		const original = { renderResult: () => body };
		const wrapped = statusRenderer("read", () => original)!;
		const result = { content: [], details: {} };
		const complete = wrapped.renderResult!(result, { expanded: true, isPartial: false }, theme, context());
		expect(complete.render(80)[0]).toContain(theme.fg("mdCode", "BODY_VISIBLE"));
		const pending = wrapped.renderResult!(result, { expanded: true, isPartial: true }, theme, context(false, true));
		expect(pending).toBe(body);
	});
	test("leaves unknown tools and self-rendering extensions untouched", () => {
		expect(statusRenderer("ask_user", () => native)).toBe(native);
		const self = { ...native, renderShell: "self" as const };
		expect(statusRenderer("read", () => self)).toBe(self);
	});
	test("fits narrow widths and reuses the native component on updates", () => {
		const ctx = context(true);
		const call = renderers.renderCall!(ctx.args, theme, ctx);
		const reused = renderers.renderCall!(ctx.args, theme, { ...ctx, lastComponent: call });
		for (const width of [1, 2, 8, 24, 80]) {
			for (const line of reused.render(width)) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
		}
		expect(plain(reused.render(80))).toContain("status-demo.txt");
	});
	test("keeps the panel background behind every printed cell", () => {
		themes.setThemeInstance(theme);
		for (const error of [false, true]) {
			const component = new ToolExecutionComponent("read", "read-demo", context().args, {}, renderers, { requestRender() {} }, "/tmp");
			component.updateResult({ content: [{ type: "text", text: "BODY_VISIBLE" }], details: {}, isError: error }, false);
			component.setExpanded(true);
			const expected = error ? "43;20;32" : "16;38;32";
			for (const line of component.render(80).filter(Boolean)) {
				let background = "default";
				for (const segment of line.split(/(\x1b\[[0-9;]*m)/)) {
					if (segment.startsWith("\x1b[")) {
						const codes = segment.slice(2, -1).split(";");
						for (let i = 0; i < codes.length; i++) {
							if (["38", "48"].includes(codes[i]) && codes[i + 1] === "2") {
								if (codes[i] === "48") background = codes.slice(i + 2, i + 5).join(";");
								i += 4;
							} else if (["0", "49", ""].includes(codes[i])) background = "default";
						}
					} else if (segment) expect(background).toBe(expected);
				}
			}
		}
	});
	test("uses the requested background in real Pi tool components", () => {
		for (const error of [false, true]) {
			const component = new ToolExecutionComponent("read", "read-demo", context().args, {}, renderers, { requestRender() {} }, "/tmp");
			component.updateResult({ content: [{ type: "text", text: error ? "ENOENT: demo" : "Lectura correcta" }], details: {}, isError: error }, false);
			component.setExpanded(true);
			const lines = component.render(80);
			expect(lines.join("\n")).toContain(error ? "\x1b[48;2;43;20;32m" : "\x1b[48;2;16;38;32m");
			expect(plain(lines)).toContain(error ? "ENOENT: demo" : "Lectura correcta");
		}
	});
});
