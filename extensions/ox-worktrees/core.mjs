import { execFile } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { hostname, homedir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const SPEC_BRANCH = /^spec-(\d{2,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export class WorktreeError extends Error {
	constructor(code, message, details = {}) {
		super(message);
		this.name = "WorktreeError";
		this.code = code;
		this.details = details;
	}
}
const fail = (code, message, details) => { throw new WorktreeError(code, message, details); };
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);

export function cleanGitEnvironment(environment = process.env) {
	const env = { ...environment };
	for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
	return { ...env, GIT_TERMINAL_PROMPT: "0" };
}

export function parseWorktrees(text) {
	const worktrees = [];
	let current;
	for (const field of text.split("\0")) {
		if (field.startsWith("worktree ")) {
			current = { cwd: field.slice(9) };
			worktrees.push(current);
		} else if (current && field.startsWith("branch ")) current.branch = field.slice(7);
		else if (current && field.startsWith("HEAD ")) current.head = field.slice(5);
		else if (current && field === "bare") current.bare = true;
		else if (current && field.startsWith("locked")) current.locked = true;
		else if (current && field.startsWith("prunable")) current.prunable = true;
	}
	return worktrees;
}

async function readJSON(file, fallback) {
	try { return JSON.parse(await fs.readFile(file, "utf8")); }
	catch (error) {
		if (error.code === "ENOENT") return fallback;
		fail("INVALID_METADATA", `No se puede leer el registro ${file}. Se conserva sin sobrescribir.`, { cause: error.message });
	}
}

async function atomicJSON(file, value) {
	const temp = `${file}.${randomUUID()}.tmp`;
	try {
		await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
		await fs.rename(temp, file);
	} finally { await fs.rm(temp, { force: true }); }
}

async function assertNoSymlinks(directory) {
	let cursor = path.resolve(directory);
	while (true) {
		try {
			if ((await fs.lstat(cursor)).isSymbolicLink()) fail("SYMLINK_PATH", `La ruta contiene un enlace simbólico: ${cursor}. Usa una ubicación real.`);
		} catch (error) { if (error.code !== "ENOENT") throw error; }
		if (path.dirname(cursor) === cursor) break;
		cursor = path.dirname(cursor);
	}
}

export function processAlive(pid) {
	if (!Number.isSafeInteger(pid) || pid < 1) return true;
	try { process.kill(pid, 0); return true; }
	catch (error) { return error.code !== "ESRCH"; }
}

async function assertNoProcesses(cwd) {
	if (process.platform !== "linux") fail("PROCESS_CHECK_UNAVAILABLE", "La limpieza conserva el worktree porque no puede comprobar sus procesos en este sistema.");
	for (const item of await fs.readdir("/proc")) {
		if (!/^\d+$/.test(item)) continue;
		try {
			const proc = path.join("/proc", item);
			if ((await fs.stat(proc)).uid !== process.getuid()) continue;
			const processCwd = await fs.readlink(path.join(proc, "cwd"));
			if (within(cwd, processCwd)) fail("LIVE_PROCESS", `Hay un proceso o sesión usando el worktree, PID ${item}. Cierra su workspace y vuelve a intentar.`, { pid: Number(item), cwd });
		} catch (error) {
			if (["ENOENT", "ESRCH"].includes(error.code)) continue;
			if (error instanceof WorktreeError) throw error;
			fail("PROCESS_CHECK_UNAVAILABLE", "No se pudo comprobar si hay procesos usando el worktree. Se conserva.", { cause: error.message });
		}
	}
}

export function createWorktreeManager(options = {}) {
	const environment = options.env ?? process.env;
	const gitEnv = cleanGitEnvironment(environment);
	const pid = process.pid;
	const host = hostname();
	const git = async (cwd, args, allowFailure = false, cleanup = false) => {
		const signal = cleanup ? undefined : options.signal;
		signal?.throwIfAborted();
		try {
			const result = await execute("git", ["-C", cwd, ...args], { env: gitEnv, signal, encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
			return { code: 0, stdout: result.stdout, stderr: result.stderr };
		} catch (error) {
			if (allowFailure && typeof error.code === "number") return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
			fail("GIT_FAILED", `Git no pudo completar ${args[0]}. Se conserva el trabajo existente.`, { cwd, args, cause: error.stderr?.trim() || error.message });
		}
	};
	const text = async (cwd, args) => (await git(cwd, args)).stdout.trim();
	const worktrees = async cwd => parseWorktrees((await git(cwd, ["worktree", "list", "--porcelain", "-z"])).stdout);
	const branch = async cwd => (await git(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], true)).stdout.trim();
	const commit = async (cwd, ref) => text(cwd, ["rev-parse", "--verify", `${ref}^{commit}`]);

	async function repository(cwd) {
		const root = await fs.realpath(await text(path.resolve(cwd), ["rev-parse", "--show-toplevel"]));
		const commonDir = await fs.realpath(await text(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
		const trees = await worktrees(root);
		if (!trees[0] || trees[0].bare) fail("BARE_REPOSITORY", "Ox necesita un repositorio con checkout principal, no uno bare.");
		const repositoryRoot = await fs.realpath(trees[0].cwd);
		const agentDir = path.resolve(environment.PI_CODING_AGENT_DIR || path.join(homedir(), ".pi", "agent"));
		let managedRoot = path.join(path.dirname(repositoryRoot), ".ox-worktrees", path.basename(repositoryRoot));
		if (within(path.join(agentDir, "extensions"), managedRoot)) {
			const suffix = createHash("sha256").update(commonDir).digest("hex").slice(0, 8);
			managedRoot = path.join(agentDir, "worktrees", `${path.basename(repositoryRoot)}-${suffix}`);
		}
		return { cwd: root, repositoryRoot, commonDir, stateDir: path.join(commonDir, "ox-worktrees"), managedRoot, worktrees: trees };
	}

	async function devCommit(repo) {
		const result = await git(repo.cwd, ["rev-parse", "--verify", "refs/heads/dev^{commit}"], true);
		if (result.code !== 0) fail("DEV_MISSING", "Falta la rama local dev. Prepárala antes de crear o implementar una SPEC.");
		return result.stdout.trim();
	}

	async function metadata(repo) {
		const state = await readJSON(path.join(repo.stateDir, "state.json"), { version: 1, specs: {} });
		if (state.version !== 1 || !state.specs || typeof state.specs !== "object" || Array.isArray(state.specs)) fail("INVALID_METADATA", "El registro de worktrees no es válido. Se conserva para revisión.");
		return state;
	}

	async function writeMetadata(repo, state) {
		await atomicJSON(path.join(repo.stateDir, "state.json"), state);
	}

	async function withLock(repo, fn, lockName = "allocation.lock") {
		await assertNoSymlinks(repo.stateDir);
		await fs.mkdir(repo.stateDir, { recursive: true, mode: 0o700 });
		const file = path.join(repo.stateDir, lockName);
		const token = randomUUID();
		const started = Date.now();
		while (true) {
			options.signal?.throwIfAborted();
			try {
				const handle = await fs.open(file, "wx", 0o600);
				try { await handle.writeFile(JSON.stringify({ token, pid, host, createdAt: new Date().toISOString() })); }
				finally { await handle.close(); }
				break;
			} catch (error) {
				if (error.code !== "EEXIST") throw error;
				if (Date.now() - started > (options.lockTimeoutMs ?? 5000)) fail("REPOSITORY_BUSY", "Otra sesión está preparando este repositorio. Reintenta después; si quedó interrumpida, usa /ox-worktree recover.", { lock: await readJSON(file, null) });
				await delay(40);
			}
		}
		try { return await fn(); }
		finally {
			if ((await readJSON(file, null))?.token === token) await fs.unlink(file);
		}
	}

	async function withRecoveryLock(repo, fn) {
		await assertNoSymlinks(repo.stateDir);
		await fs.mkdir(repo.stateDir, { recursive: true, mode: 0o700 });
		// A compare-and-swap ref avoids making recovery depend on its own stale file lock.
		const ref = "refs/ox-worktrees/recovery";
		const old = await git(repo.cwd, ["rev-parse", "--verify", ref], true);
		const previous = old.code === 0 ? old.stdout.trim() : null;
		if (previous) {
			let owner;
			try { owner = JSON.parse(await text(repo.cwd, ["cat-file", "blob", previous])); }
			catch { fail("INVALID_METADATA", "La reserva de recuperación no es válida. Se conserva para revisión.", { ref }); }
			if (owner?.host !== host || processAlive(owner?.pid)) fail("OWNER_ALIVE", "Otra recuperación sigue activa o pertenece a otra máquina. Se conserva su reserva.", owner);
		}
		const file = path.join(repo.stateDir, `recovery-${randomUUID()}.json`);
		let object;
		try {
			await atomicJSON(file, { token: randomUUID(), pid, host, createdAt: new Date().toISOString() });
			object = await text(repo.cwd, ["hash-object", "-w", file]);
		} finally { await fs.rm(file, { force: true }); }
		try {
			const acquired = await git(repo.cwd, ["update-ref", ref, object, previous ?? "0".repeat(object.length)], true);
			if (acquired.code !== 0) fail("REPOSITORY_BUSY", "La reserva de recuperación cambió o Git no pudo obtenerla. Conserva el estado y revisa antes de reintentar.", { ref, cause: acquired.stderr });
			return await fn();
		} finally {
			// Cancellation still releases only our own operational ref, never another owner's lease.
			const current = await git(repo.cwd, ["rev-parse", "--verify", ref], true, true);
			if (current.code === 0 && current.stdout.trim() === object) await git(repo.cwd, ["update-ref", "-d", ref, object], false, true);
		}
	}

	async function assertNoOperation(cwd) {
		for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "index.lock"]) {
			const file = await text(cwd, ["rev-parse", "--path-format=absolute", "--git-path", name]);
			try { await fs.lstat(file); }
			catch (error) { if (error.code === "ENOENT") continue; throw error; }
			fail("GIT_OPERATION", `Hay una operación Git pendiente: ${name}. Conserva el estado y resuélvela antes de continuar.`, { cwd });
		}
	}

	async function assertClean(cwd) {
		await assertNoOperation(cwd);
		if ((await git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"])).stdout) fail("DIRTY_CHECKOUT", "El checkout debe estar limpio, incluidos los archivos sin seguimiento. Conserva sus cambios antes de continuar.", { cwd });
	}

	async function records(repo) {
		const state = await metadata(repo);
		const branches = (await text(repo.cwd, ["for-each-ref", "--format=%(refname:short)", "refs/heads/spec-*"])).split("\n");
		const trees = await worktrees(repo.cwd);
		const results = [];
		for (const name of branches) {
			if (!SPEC_BRANCH.test(name)) continue;
			const spec = name.slice(5);
			const tree = trees.find(item => item.branch === `refs/heads/${name}`);
			const saved = state.specs[spec] ?? {};
			const record = { spec, branch: name, cwd: tree?.cwd ?? null, specPath: tree ? path.join(tree.cwd, "specs", `${spec}.md`) : null, managed: saved.managed === true && saved.cwd === tree?.cwd, created: false, baseCommit: saved.baseCommit ?? null, repositoryRoot: repo.repositoryRoot, commonDir: repo.commonDir, isolated: tree ? tree.cwd !== repo.repositoryRoot : null, locked: tree?.locked === true, prunable: tree?.prunable === true, specState: null };
			if (record.specPath) {
				await assertNoSymlinks(record.specPath);
				try {
					const doc = await fs.readFile(record.specPath, "utf8");
					record.specState = doc.match(/^>\s*\*\*(?:Estado|State|Status):\*\*\s*(.+)$/mi)?.[1]?.trim() ?? null;
				} catch (error) { if (error.code !== "ENOENT") throw error; }
			}
			results.push(record);
		}
		return results.sort((a, b) => a.spec.localeCompare(b.spec, "en", { numeric: true }));
	}

	function matching(all, reference) {
		if (typeof reference !== "string" || !reference.trim()) fail("SPEC_REQUIRED", "Indica el número o nombre de la SPEC.");
		const value = path.basename(reference.trim()).replace(/\.md$/, "").replace(/^spec-/, "");
		const found = all.filter(item => item.spec === value || (/^\d+$/.test(value) ? Number(item.spec.split("-")[0]) === Number(value) : item.spec.replace(/^\d+-/, "") === value));
		if (found.length !== 1) fail("SPEC_AMBIGUOUS", found.length ? "Hay varias SPECs candidatas. Indica su nombre completo." : "No se encontró la rama de esa SPEC. Prepárala con ox-spec.");
		return found[0];
	}

	async function list(cwd) {
		const repo = await repository(cwd);
		return { repositoryRoot: repo.repositoryRoot, commonDir: repo.commonDir, managedRoot: repo.managedRoot, specs: await records(repo), integration: await readJSON(path.join(repo.stateDir, "integration.lock"), null) };
	}

	async function resolve(cwd, reference) {
		return matching((await list(cwd)).specs, reference);
	}

	async function prepare(cwd, input = {}) {
		const repo = await repository(cwd);
		return withLock(repo, async () => {
			const baseCommit = await devCommit(repo);
			const state = await metadata(repo);
			let name, spec;
			if (input.spec) {
				const found = matching(await records(repo), input.spec);
				if (found.cwd) {
					if (found.prunable || !await fs.stat(found.cwd).then(() => true, () => false)) fail("WORKTREE_MISSING", "Git registra un worktree ausente. Conserva el registro y revisa su recuperación antes de abrir otro.", found);
					return found;
				}
				({ spec, branch: name } = found);
			} else {
				if (typeof input.slug !== "string" || input.slug.length > 64 || !SLUG.test(input.slug)) fail("INVALID_SLUG", "Usa un slug kebab-case de letras ASCII, números y guiones, de hasta 64 caracteres.");
				const numbers = new Set();
				for (const item of await records(repo)) numbers.add(Number(item.spec.split("-")[0]));
				const devFiles = (await git(repo.cwd, ["ls-tree", "-r", "--name-only", "refs/heads/dev", "--", "specs/"])).stdout.split("\n");
				for (const file of devFiles) if (/^specs\/\d+-/.test(file)) numbers.add(Number(path.basename(file).split("-")[0]));
				for (const tree of await worktrees(repo.cwd)) {
					try {
						for (const file of await fs.readdir(path.join(tree.cwd, "specs"))) if (/^\d+-.*\.md$/.test(file)) numbers.add(Number(file.split("-")[0]));
					} catch (error) { if (error.code !== "ENOENT") throw error; }
				}
				let number = input.number ?? Math.max(0, ...numbers) + 1;
				if (!Number.isSafeInteger(number) || number < 0 || number > 999999) fail("INVALID_NUMBER", "El número de SPEC debe ser un entero entre 00 y 999999.");
				if (numbers.has(number)) fail("SPEC_NUMBER_RESERVED", "Ese número ya está reservado u ocupado por una SPEC.");
				spec = `${String(number).padStart(2, "0")}-${input.slug}`;
				name = `spec-${spec}`;
			}
			const mode = input.mode ?? "auto";
			if (!["auto", "here", "worktree"].includes(mode)) fail("INVALID_MODE", "Usa auto, here o worktree.");
			const currentBranch = await branch(repo.cwd);
			const dirty = (await git(repo.cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])).stdout !== "";
			const anotherSpec = (await worktrees(repo.cwd)).some(item => SPEC_BRANCH.test(item.branch?.replace(/^refs\/heads\//, "") ?? ""));
			const isolated = Boolean(input.spec) || mode === "worktree" || (mode === "auto" && (dirty || anotherSpec || !currentBranch));
			let target;
			if (!isolated) {
				if (SPEC_BRANCH.test(currentBranch)) fail("CHECKOUT_OWNED", "Esta carpeta pertenece a otra SPEC. Usa su worktree o prepara la nueva con --worktree.");
				await assertClean(repo.cwd);
				await git(repo.cwd, ["switch", "-c", name, baseCommit]);
				target = repo.cwd;
			} else {
				await assertNoSymlinks(repo.managedRoot);
				await fs.mkdir(repo.managedRoot, { recursive: true });
				target = path.join(repo.managedRoot, name);
				try { await fs.lstat(target); fail("PATH_OCCUPIED", "La carpeta de destino ya existe. No se reutiliza sin verificar su identidad Git.", { cwd: target }); }
				catch (error) { if (error.code !== "ENOENT") throw error; }
				await git(repo.cwd, input.spec ? ["worktree", "add", target, name] : ["worktree", "add", "-b", name, target, baseCommit]);
			}
			if (await branch(target) !== name) fail("BRANCH_MISMATCH", "La rama preparada no coincide con la SPEC. Se conserva para revisión.", { cwd: target, branch: name });
			await assertNoSymlinks(path.join(target, "specs"));
			await fs.mkdir(path.join(target, "specs"), { recursive: true });
			state.specs[spec] = { ...state.specs[spec], cwd: target, managed: isolated, baseCommit: state.specs[spec]?.baseCommit ?? baseCommit };
			await writeMetadata(repo, state);
			return { ...(await resolve(repo.cwd, spec)), created: true };
		});
	}

	async function acquireIntegration(cwd, input) {
		if (!input.owner) fail("OWNER_REQUIRED", "La integración necesita identificar la sesión propietaria.");
		const repo = await repository(cwd);
		return withLock(repo, async () => {
			const leasePath = path.join(repo.stateDir, "integration.lock");
			const existing = await readJSON(leasePath, null);
			if (existing) fail("INTEGRATION_BUSY", "Otra sesión tiene una integración reservada. Espera su cierre o revisa /ox-worktree recover.", existing);
			const source = await resolve(cwd, input.spec);
			if (!source.cwd) fail("SOURCE_NOT_OPEN", "Abre el worktree de la SPEC antes de integrar.");
			const sourceHead = await commit(repo.cwd, `refs/heads/${source.branch}`);
			const devHead = await devCommit(repo);
			if (sourceHead !== input.sourceHead || devHead !== input.devHead) fail("REVIEWED_TIPS_CHANGED", "Las puntas cambiaron o no coinciden con los commits presentados. Revisa y renueva la confirmación.", { sourceHead, devHead });
			await assertClean(source.cwd);
			const token = randomUUID();
			const lease = { version: 1, token, owner: input.owner, pid, host, sourceBranch: source.branch, sourceHead, devHead, devCwd: null, createdAt: new Date().toISOString() };
			await atomicJSON(leasePath, lease);
			try {
				let devTree = (await worktrees(repo.cwd)).find(item => item.branch === "refs/heads/dev");
				if (!devTree) {
					await assertNoSymlinks(repo.managedRoot);
					await fs.mkdir(repo.managedRoot, { recursive: true });
					const devCwd = path.join(repo.managedRoot, "dev");
					await git(repo.cwd, ["worktree", "add", devCwd, "dev"]);
					devTree = { cwd: devCwd };
				}
				if (devTree.locked || devTree.prunable) fail("DEV_UNAVAILABLE", "El worktree de dev está bloqueado o ausente. Se conserva sin modificar.");
				await assertClean(devTree.cwd);
				if (await branch(devTree.cwd) !== "dev" || await commit(devTree.cwd, "HEAD") !== devHead || await commit(repo.cwd, `refs/heads/${source.branch}`) !== sourceHead) fail("REVIEWED_TIPS_CHANGED", "Las puntas cambiaron al reservar la integración. Renueva la confirmación.");
				lease.devCwd = devTree.cwd;
				await atomicJSON(leasePath, lease);
				return lease;
			} catch (error) {
				await fs.unlink(leasePath);
				throw error;
			}
		});
	}

	async function releaseIntegration(cwd, input) {
		const repo = await repository(cwd);
		return withLock(repo, async () => {
			const file = path.join(repo.stateDir, "integration.lock");
			const lease = await readJSON(file, null);
			if (!lease || lease.token !== input.token || lease.owner !== input.owner || lease.pid !== pid || lease.host !== host) fail("LEASE_OWNER_MISMATCH", "La reserva no pertenece a esta sesión o el token cambió.");
			if (!lease.devCwd) fail("INCOMPLETE_LEASE", "La reserva quedó incompleta. Revisa su recuperación antes de liberarla.");
			await assertClean(lease.devCwd);
			if (await branch(lease.devCwd) !== "dev") fail("BRANCH_MISMATCH", "El checkout reservado ya no está en dev. Se conserva la reserva para revisión.");
			await fs.unlink(file);
			return { released: true, devCwd: lease.devCwd };
		});
	}

	async function savePane(cwd, reference, pane) {
		const repo = await repository(cwd);
		return withLock(repo, async () => {
			const record = await resolve(cwd, reference);
			const state = await metadata(repo);
			state.specs[record.spec] = { ...state.specs[record.spec], pane };
			await writeMetadata(repo, state);
		});
	}

	async function getPane(cwd, reference) {
		const repo = await repository(cwd);
		const record = await resolve(cwd, reference);
		return (await metadata(repo)).specs[record.spec]?.pane ?? null;
	}

	async function remove(cwd, input) {
		if (input.confirmed !== true) fail("CONFIRMATION_REQUIRED", "Eliminar el worktree requiere confirmación explícita. La rama se conserva.");
		const repo = await repository(cwd);
		return withLock(repo, async () => {
			if (await readJSON(path.join(repo.stateDir, "integration.lock"), null)) fail("INTEGRATION_BUSY", "Hay una integración reservada. Conserva los worktrees hasta su cierre.");
			const item = await resolve(cwd, input.spec);
			if (!item.managed || !item.cwd || item.cwd === repo.cwd || !within(repo.managedRoot, item.cwd)) fail("NOT_MANAGED", "Solo se elimina desde otra carpeta un worktree creado por ox. El checkout actual y los externos se conservan.");
			await assertNoSymlinks(item.cwd);
			await assertClean(item.cwd);
			if (item.locked || item.prunable) fail("WORKTREE_LOCKED", "Git marca el worktree bloqueado o ausente. Se conserva.");
			await devCommit(repo);
			const merged = await git(repo.cwd, ["merge-base", "--is-ancestor", `refs/heads/${item.branch}`, "refs/heads/dev"], true);
			if (merged.code !== 0) fail("UNMERGED_WORK", "La rama no está integrada en dev. Se conserva el worktree y sus commits.");
			if ((await git(item.cwd, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"])).stdout) fail("IGNORED_FILES", "Hay archivos ignorados, como configuración local o dependencias. Se conserva la carpeta para evitar borrarlos.");
			await (options.assertNoProcesses ?? assertNoProcesses)(item.cwd);
			await git(repo.cwd, ["worktree", "remove", item.cwd]);
			return { removed: true, cwd: item.cwd, retainedBranch: item.branch };
		});
	}

	async function recover(cwd, input) {
		if (input.confirmed !== true) fail("CONFIRMATION_REQUIRED", "Confirma primero que los procesos del intento interrumpido están detenidos.");
		const repo = await repository(cwd);
		return withRecoveryLock(repo, async () => {
			const removed = [];
			const lockNames = (await fs.readdir(repo.stateDir)).filter(name => /^(allocation|integration|recovery|open-\d+)\.lock$/.test(name));
			for (const name of lockNames) {
				const file = path.join(repo.stateDir, name);
				const lock = await readJSON(file, null);
				if (!lock) continue;
				if (lock.host !== host || processAlive(lock.pid)) fail("OWNER_ALIVE", "El propietario sigue activo o pertenece a otra máquina. La reserva se conserva.", lock);
				for (const tree of await worktrees(repo.cwd)) await assertNoOperation(tree.cwd);
				if (name === "integration.lock") {
					if (!lock.devCwd) fail("INCOMPLETE_LEASE", "La integración no identifica su checkout. Revisa el registro sin eliminarlo.");
					await assertClean(lock.devCwd);
				}
				if ((await readJSON(file, null))?.token !== lock.token) fail("LOCK_CHANGED", "La reserva cambió durante su revisión. Se conserva.");
				await fs.unlink(file);
				removed.push(name);
			}
			return { recovered: removed };
		});
	}

	async function withOpenLock(cwd, reference, fn) {
		const repo = await repository(cwd);
		const record = await resolve(cwd, reference);
		return withLock(repo, fn, `open-${record.spec.split("-")[0]}.lock`);
	}

	return { repository, list, resolve, prepare, acquireIntegration, releaseIntegration, savePane, getPane, withOpenLock, remove, recover };
}
