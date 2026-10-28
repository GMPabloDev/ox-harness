import { join } from "node:path";
import { getAgentDir, VERSION } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { loadPreference, savePreference } from "./preferences.ts";
import { findChat, FocusView } from "./view.ts";

export function installFocus(pi: ExtensionAPI, preferencePath: string) {
	let preference = loadPreference(preferencePath);
	let view: FocusView | undefined;
	let tui: TUI | undefined;
	let busy = false;
	let warned = false;
	let supported = false;

	const refresh = (ctx: ExtensionContext) => {
		if (view) { view.enabled = preference.enabled; view.busy = busy; }
		ctx.ui.setStatus("focus", preference.enabled && supported ? "focus" : undefined);
		// Changing the transcript invalidates fullscreen selection coordinates.
		const resetSelection = tui && Reflect.get(tui, "resetTextSelection");
		if (typeof resetSelection === "function") resetSelection.call(tui);
		tui?.requestRender(true);
	};
	const dispose = () => {
		view?.dispose();
		view = undefined;
		tui?.requestRender(true);
		tui = undefined;
		supported = false;
	};

	pi.on("session_start", (_event, ctx) => {
		dispose();
		if (ctx.mode !== "tui") return;
		preference = loadPreference(preferencePath);
		busy = !ctx.isIdle();
		if (preference.warning) ctx.ui.notify(preference.warning, "warning");
		// This zero-line widget gives us Pi's stable TUI reference and automatic
		// disposal on reload. It does not replace the editor, footer or sidebar.
		ctx.ui.setWidget("focus-lifecycle", current => {
			tui = current;
			const chat = /^1\.4\./.test(VERSION) ? findChat(current) : undefined;
			supported = !!chat;
			if (chat) view = new FocusView(chat, () => ctx.ui.theme, () => tui?.requestRender());
			else if (!warned) {
				warned = true;
				ctx.ui.notify("Focus no reconoce esta versión de la interfaz de Pi. Se conserva la vista normal.", "warning");
			}
			refresh(ctx);
			return { render: () => [], invalidate() {}, dispose };
		});
	});
	pi.on("before_agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		busy = true;
		if (view) view.busy = true;
	});
	pi.on("agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		busy = true;
		if (view) view.busy = true;
	});
	pi.on("agent_settled", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		busy = false;
		if (view) view.busy = false;
		tui?.requestRender();
	});
	pi.on("tool_execution_start", (event, ctx) => {
		if (ctx.mode !== "tui" || !event.parentToolCallId) return;
		view?.nestedStart(event.parentToolCallId, event.toolCallId, event.toolName, event.args);
		tui?.requestRender();
	});
	pi.on("tool_execution_end", (event, ctx) => {
		if (ctx.mode !== "tui" || !event.parentToolCallId) return;
		view?.nestedEnd(event.parentToolCallId, event.toolCallId, event.isError);
		tui?.requestRender();
	});
	pi.on("session_shutdown", dispose);

	pi.registerCommand("focus", {
		description: "Filtrar solo la vista: /focus [on|off|status]. No cambia el historial ni el contexto.",
		getArgumentCompletions: prefix => ["on", "off", "status"].filter(value => value.startsWith(prefix)).map(value => ({ value, label: value })),
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("Focus solo filtra la interfaz interactiva de Pi. RPC, JSON y print no cambian.", "info");
				return;
			}
			const action = args.trim().toLowerCase();
			if (action === "status") {
				ctx.ui.notify(!supported ? "Focus no está disponible para esta interfaz. Vista normal." :
					`Focus ${preference.enabled ? "activo" : "desactivado"}. Solo cambia la vista. Preferencia en ${preferencePath}`, "info");
				return;
			}
			if (action && action !== "on" && action !== "off") {
				ctx.ui.notify("Uso: /focus [on|off|status]", "info");
				return;
			}
			const enabled = action ? action === "on" : !preference.enabled;
			if (enabled && !supported) {
				ctx.ui.notify("Focus no reconoce esta interfaz. No se ha cambiado la preferencia.", "warning");
				return;
			}
			try { savePreference(preferencePath, enabled); }
			catch {
				ctx.ui.notify("No se pudo guardar focus.json. No se ha cambiado el modo.", "error");
				return;
			}
			preference = { enabled };
			refresh(ctx);
			ctx.ui.notify(enabled ? "Focus activo. Solo respuesta final y actividad importante." : "Focus desactivado. Vista completa restaurada.", "info");
		},
	});
}

export default function focus(pi: ExtensionAPI) {
	installFocus(pi, join(getAgentDir(), "focus.json"));
}
