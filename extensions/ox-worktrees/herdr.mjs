import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { WorktreeError } from "./core.mjs";

const execute = promisify(execFile);

export async function runHerdr(args, options = {}) {
	options.signal?.throwIfAborted();
	try {
		const result = await execute("herdr", args, { env: options.env ?? process.env, signal: options.signal, encoding: "utf8", timeout: 65000, maxBuffer: 1024 * 1024 });
		const body = JSON.parse(result.stdout);
		if (body.error) throw new WorktreeError("HERDR_FAILED", "Herdr devolvió un error. Conserva la carpeta y el workspace.", body.error);
		if (!body.result) throw new Error("Missing result");
		return body.result;
	} catch (error) {
		if (error instanceof WorktreeError) throw error;
		let details;
		try { details = JSON.parse(error.stderr ?? ""); } catch { details = { cause: error.message }; }
		throw new WorktreeError("HERDR_FAILED", "Herdr no completó la operación. El worktree se conserva; revisa el workspace antes de reintentar.", { args: args.slice(0, 3), ...details });
	}
}

export function createHerdrBridge(manager, options = {}) {
	const env = options.env ?? process.env;
	const run = options.run ?? (args => runHerdr(args, { env, signal: options.signal }));

	async function open(cwd, input) {
		options.signal?.throwIfAborted();
		const record = await manager.resolve(cwd, input.spec);
		if (!record.cwd) throw new WorktreeError("WORKTREE_REQUIRED", "Prepara el worktree de esta SPEC antes de abrir Pi.");
		if ((await manager.repository(cwd)).cwd === await realpath(record.cwd)) return { ...record, disposition: "current", message: "La sesión actual ya está en la carpeta de esta SPEC. Continúa aquí." };
		if (env.HERDR_ENV !== "1" || !env.HERDR_PANE_ID) throw new WorktreeError("HERDR_REQUIRED", "El worktree está preparado, pero abrir otra sesión automáticamente requiere ejecutar Pi dentro de Herdr. No se cambia la carpeta de la sesión actual.", { cwd: record.cwd });
		return manager.withOpenLock(cwd, record.spec, async () => {
			// Herdr owns workspace identity. Opening by exact path reuses it after reloads or interrupted launches.
			const opened = await run(["worktree", "open", "--cwd", record.repositoryRoot, "--path", record.cwd, "--label", `SPEC ${record.spec}`, "--no-focus"]);
			const workspaceId = opened.workspace?.workspace_id;
			let paneId = opened.root_pane?.pane_id;
			const saved = await manager.getPane(cwd, record.spec);
			if (workspaceId) {
				const listing = await run(["pane", "list", "--workspace", workspaceId]);
				if (!Array.isArray(listing.panes)) throw new WorktreeError("HERDR_RESPONSE", "Herdr no devolvió los paneles del workspace. Se conserva sin iniciar Pi.");
				const candidates = [];
				for (const pane of listing.panes.filter(item => item.agent === "pi")) {
					const actual = pane.foreground_cwd ?? pane.cwd;
					if (!actual) throw new WorktreeError("PANE_UNVERIFIED", "Una sesión Pi del workspace no identifica su carpeta. Se conserva sin iniciar otra.");
					if ((await manager.repository(actual)).cwd === await realpath(record.cwd)) candidates.push(pane);
				}
				const savedPane = saved?.workspaceId === workspaceId ? listing.panes.find(item => item.pane_id === saved.paneId) : null;
				if (savedPane && candidates.some(item => item.pane_id === savedPane.pane_id)) paneId = savedPane.pane_id;
				else if (candidates.length > 1) throw new WorktreeError("AMBIGUOUS_PI", "Hay varias sesiones Pi en esta carpeta. Elige la propietaria desde Herdr; no se inicia otro escritor.", { workspaceId });
				else if (candidates.length === 1) paneId = candidates[0].pane_id;
				else if (savedPane) paneId = savedPane.pane_id;
				else if (!paneId && listing.panes.length === 1) paneId = listing.panes[0].pane_id;
			}
			if (!workspaceId || !paneId) throw new WorktreeError("HERDR_RESPONSE", "Herdr no identificó un único panel para la SPEC. Se conserva el workspace sin iniciar otro agente.", { opened });
			let pane;
			try { pane = (await run(["pane", "get", paneId])).pane; }
			catch (error) {
				throw new WorktreeError("PANE_UNVERIFIED", "No se pudo verificar el panel guardado. Revisa el workspace antes de abrir otro Pi.", { workspaceId, paneId, cause: error.message });
			}
			const actualCwd = pane?.foreground_cwd ?? pane?.cwd;
			if (!actualCwd || (await manager.repository(actualCwd)).cwd !== await realpath(record.cwd)) throw new WorktreeError("PANE_CWD_MISMATCH", "El panel no está en el worktree esperado. Se conserva sin enviar instrucciones.", { workspaceId, paneId });
			if (pane.agent && pane.agent !== "pi") throw new WorktreeError("PANE_OCCUPIED", "El panel contiene otro agente. Se conserva sin reemplazarlo.", { workspaceId, paneId });
			const digest = createHash("sha256").update(record.commonDir).digest("hex").slice(0, 8);
			const name = `ox-${digest}-${record.spec.split("-")[0]}`;
			const sessionId = saved?.sessionId ?? `ox-spec-${record.spec}`;
			const sessionPath = saved?.sessionPath;
			if (!pane.agent && sessionPath && !await stat(sessionPath).then(item => item.isFile(), () => false)) throw new WorktreeError("SESSION_MISSING", "La sesión guardada ya no está disponible. Se conserva la referencia para no sustituirla por una sesión vacía.", { sessionPath });
			const binding = { workspaceId, paneId, sessionId, ...(sessionPath ? { sessionPath } : {}), name };
			await manager.savePane(cwd, record.spec, binding);
			let disposition = "reused";
			if (!pane.agent) {
				await run(["agent", "start", name, "--kind", "pi", "--pane", paneId, "--", ...(sessionPath ? ["--session", sessionPath] : ["--session-id", sessionId]), "--name", `SPEC ${record.spec}`, ...(options.piArgs ?? [])]);
				disposition = "started";
				// Only a newly started, ready session receives a handoff. Never inject work into an existing Pi.
				if (input.task) await run(["agent", "prompt", paneId, input.task]);
			}
			if (input.focus === true) await run(["agent", "focus", paneId]);
			return { ...record, ...binding, disposition, taskDelivered: disposition === "started" && Boolean(input.task), message: disposition === "reused" && input.task ? "La sesión ya existe. No se le envió otra tarea ni se interrumpió su trabajo. Ábrela para continuar allí." : "Pi está asociado al worktree. El estado de Herdr no sustituye las validaciones de la SPEC." };
		});
	}

	async function rememberCurrent(cwd, input) {
		if (env.HERDR_ENV !== "1" || !env.HERDR_PANE_ID) return { remembered: false };
		const record = await manager.resolve(cwd, input.spec);
		if ((await manager.repository(cwd)).cwd !== record.cwd) return { remembered: false };
		const pane = (await run(["pane", "get", env.HERDR_PANE_ID])).pane;
		if (pane?.agent !== "pi" || !pane.workspace_id || (await manager.repository(pane.foreground_cwd ?? pane.cwd)).cwd !== record.cwd) return { remembered: false };
		const saved = await manager.getPane(cwd, record.spec);
		if (saved && saved.paneId !== env.HERDR_PANE_ID) return { remembered: false };
		const previousPath = saved?.sessionId === input.sessionId ? saved?.sessionPath : undefined;
		const sessionPath = input.sessionPath && await stat(input.sessionPath).then(item => item.isFile(), () => false) ? input.sessionPath : previousPath;
		await manager.savePane(cwd, record.spec, { ...saved, workspaceId: pane.workspace_id, paneId: env.HERDR_PANE_ID, sessionId: input.sessionId, sessionPath });
		return { remembered: true };
	}

	return { open, rememberCurrent };
}
