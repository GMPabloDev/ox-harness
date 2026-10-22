import { Type, type Static } from "@earendil-works/pi-ai";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { defineTool, withFileMutationQueue, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createWorktreeManager, WorktreeError } from "./core.mjs";
import { createHerdrBridge } from "./herdr.mjs";

const actions = ["list", "prepare", "resolve", "open", "integration_acquire", "integration_release", "remove", "recover"] as const;
const parameters = Type.Object({
	action: Type.Union(actions.map(action => Type.Literal(action))),
	cwd: Type.Optional(Type.String({ description: "Ruta absoluta del repositorio o de uno de sus worktrees. Por defecto, la sesión actual." })),
	spec: Type.Optional(Type.String({ description: "Número, slug o NN-slug de una SPEC existente." })),
	slug: Type.Optional(Type.String({ description: "Slug kebab-case de una SPEC nueva. El número se reserva bajo bloqueo." })),
	number: Type.Optional(Type.Integer({ minimum: 0, maximum: 999999 })),
	mode: Type.Optional(Type.Union([Type.Literal("auto"), Type.Literal("here"), Type.Literal("worktree")])),
	task: Type.Optional(Type.String({ description: "Encargo autocontenido autorizado para una sesión que acaba de arrancar. Nunca se envía a una sesión Pi ya activa." })),
	focus: Type.Optional(Type.Boolean({ description: "Cambiar al workspace de destino solo si el usuario lo pide." })),
	confirmed: Type.Optional(Type.Boolean({ description: "El usuario autorizó expresamente esta integración, eliminación o recuperación. No se infiere de --all." })),
	sourceHead: Type.Optional(Type.String({ description: "Hash completo de origen presentado al confirmar la integración." })),
	devHead: Type.Optional(Type.String({ description: "Hash completo de dev presentado al confirmar la integración." })),
	token: Type.Optional(Type.String({ description: "Token devuelto por integration_acquire, necesario para liberarla." })),
});
type WorktreeParams = Static<typeof parameters>;
const guide = fileURLToPath(new URL("../../skills/ox-spec/worktrees.md", import.meta.url));
const integrationGuide = fileURLToPath(new URL("../../skills/ox-spec/integration.md", import.meta.url));

export default function oxWorktrees(pi: ExtensionAPI) {
	const manager = createWorktreeManager();
	const herdr = createHerdrBridge(manager);

	async function dispatch(params: WorktreeParams, ctx: ExtensionContext, signal?: AbortSignal) {
		signal?.throwIfAborted();
		const manager = createWorktreeManager({ signal });
		const herdr = createHerdrBridge(manager, { signal });
		const cwd = params.cwd || ctx.cwd;
		const owner = ctx.sessionManager.getSessionId();
		switch (params.action) {
			case "list": return manager.list(cwd);
			case "prepare": {
				const record = await manager.prepare(cwd, params);
				if (ctx.mode === "tui") {
					try { await herdr.rememberCurrent(ctx.cwd, { spec: record.spec, sessionId: owner, sessionPath: ctx.sessionManager.getSessionFile() }); }
					catch (error) { return { ...record, sessionWarning: (error as Error).message }; }
				}
				return record;
			}
			case "resolve": return manager.resolve(cwd, params.spec);
			case "open": return herdr.open(cwd, params);
			case "integration_acquire":
				if (params.confirmed !== true) throw new WorktreeError("CONFIRMATION_REQUIRED", "El merge requiere la elección explícita del usuario sobre esa SPEC y los commits presentados.");
				return manager.acquireIntegration(cwd, { ...params, owner });
			case "integration_release": return manager.releaseIntegration(cwd, { ...params, owner });
			case "remove": return manager.remove(cwd, params);
			case "recover": return manager.recover(cwd, params);
			default: throw new WorktreeError("UNKNOWN_ACTION", "Acción de worktree desconocida.");
		}
	}

	pi.registerTool(defineTool({
		name: "ox_worktree",
		label: "Ox worktree",
		description: `Prepara o retoma la carpeta de una SPEC de ox y abre su sesión Pi en Herdr sin mover esta sesión. Lee ${guide} antes de preparar carpetas o coordinar trabajo paralelo, y ${integrationGuide} antes de reservar un merge. Usa prepare antes de guardar una SPEC y resolve antes de implementarla. auto conserva el flujo simple y aísla otra SPEC o cambios pendientes; worktree exige aislamiento. La herramienta no define ni aprueba requisitos, no hace commits ni merges. remove y recover requieren autorización explícita.`,
		parameters,
		async execute(_id, params, signal, _onUpdate, ctx) {
			try {
				signal?.throwIfAborted();
				if (params.cwd && !isAbsolute(params.cwd)) throw new WorktreeError("ABSOLUTE_CWD_REQUIRED", "Indica un cwd absoluto para no operar en otro repositorio por error.");
				const repo = await manager.repository(params.cwd || ctx.cwd);
				const result = await withFileMutationQueue(repo.stateDir, () => dispatch(params, ctx, signal));
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: result };
			} catch (error) {
				const issue = error as Error & { code?: string; details?: unknown };
				return { content: [{ type: "text", text: issue.message }], details: { code: issue.code ?? "OX_WORKTREE_FAILED", ...(issue.details ? { context: issue.details } : {}) }, isError: true };
			}
		},
	}));

	const rememberSession = async (_event: unknown, ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		try {
			const repo = await manager.repository(ctx.cwd);
			const record = (await manager.list(ctx.cwd)).specs.find(item => item.cwd === repo.cwd);
			if (!record) return;
			await herdr.rememberCurrent(ctx.cwd, { spec: record.spec, sessionId: ctx.sessionManager.getSessionId(), sessionPath: ctx.sessionManager.getSessionFile() });
			ctx.ui.setStatus("ox-worktree", `SPEC ${record.spec}`);
		} catch (error) {
			if ((error as WorktreeError).code !== "GIT_FAILED") ctx.ui.notify(`Ox conserva la carpeta, pero no pudo registrar esta sesión: ${(error as Error).message}`, "warning");
		}
	};
	pi.on("session_start", rememberSession);
	pi.on("session_info_changed", rememberSession);

	function show(value: unknown) {
		pi.sendMessage({ customType: "ox-worktrees", content: typeof value === "string" ? value : JSON.stringify(value, null, 2), display: true });
	}

	pi.registerCommand("ox-worktree", {
		description: "Lista, abre o limpia las carpetas de las SPECs. Sin argumentos muestra un selector.",
		getArgumentCompletions(prefix) {
			return ["list", "open", "remove", "recover", "help"].filter(item => item.startsWith(prefix)).map(value => ({ value, label: value }));
		},
		async handler(args, ctx) {
			try {
				let [action, spec, extra] = args.trim().split(/\s+/);
				if (extra || (action && !["list", "open", "remove", "recover", "help"].includes(action))) throw new Error("Usa /ox-worktree, /ox-worktree list, /ox-worktree open NN-slug, /ox-worktree remove NN-slug o /ox-worktree recover.");
				if (action === "help") {
					show("Define con /skill:ox-spec. Añade --worktree para una tarea paralela o usa --here para una tarea secuencial en una carpeta limpia. Implementa con /skill:ox-spec-impl NN-slug --all. /ox-worktree abre y retoma las carpetas existentes; remove conserva las ramas y solo elimina carpetas limpias, integradas y sin procesos comprobables. recover revisa reservas de procesos terminados. No se ejecutan merges desde este menú.");
					return;
				}
				if (!action) {
					const listing = await manager.list(ctx.cwd);
					if (!ctx.hasUI || listing.specs.length === 0) { show(listing); return; }
					const choices = listing.specs.map(item => `${item.spec} | ${item.specState ?? "sin estado leído"} | ${item.cwd ?? "sin carpeta abierta"}`);
					const selected = await ctx.ui.select("SPECs del repositorio. Abrir o retomar", choices);
					if (!selected) return;
					spec = listing.specs[choices.indexOf(selected)].spec;
					action = "open";
				}
				if (action === "list") { show(await manager.list(ctx.cwd)); return; }
				if (action === "recover") {
					if (!ctx.hasUI || !await ctx.ui.confirm("Recuperar reservas interrumpidas", "Confirma que no quedan workers, pruebas ni comandos del intento interrumpido. Solo se liberan reservas cuyo proceso propietario ya terminó y cuyo estado Git permite recuperarlas.")) return;
					show(await manager.recover(ctx.cwd, { confirmed: true }));
					return;
				}
				if (!spec) throw new Error("Indica la SPEC, por ejemplo /ox-worktree open 03-exportar.");
				if (action === "remove") {
					const record = await manager.resolve(ctx.cwd, spec);
					if (!ctx.hasUI || !await ctx.ui.confirm("Eliminar solo la carpeta de la SPEC", `${record.cwd ?? "Sin carpeta"}\nLa rama ${record.branch} se conserva. La operación se detiene si hay trabajo, archivos ignorados, procesos o comprobaciones pendientes.`)) return;
					show(await manager.remove(ctx.cwd, { spec, confirmed: true }));
					return;
				}
				const record = await manager.prepare(ctx.cwd, { spec });
				show(await herdr.open(ctx.cwd, { spec: record.spec, focus: true }));
			} catch (error) { ctx.ui.notify((error as Error).message, "error"); }
		},
	});
}
