import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const modules = process.env.PI_GLOBAL_NODE_MODULES ?? "/home/osiosad/.bun/install/global/node_modules";
const core = resolve(modules, "@earendil-works/pi-coding-agent/dist/core");
const { loadPromptTemplates, expandPromptTemplate } = await import(pathToFileURL(resolve(core, "prompt-templates.js")));
const { loadSkills, formatSkillsForPrompt } = await import(pathToFileURL(resolve(core, "skills.js")));
const { createReadTool } = await import(pathToFileURL(resolve(core, "tools/read.js")));
const cwd = mkdtempSync(resolve(tmpdir(), "ox-mode-runtime-"));
after(() => rmSync(cwd, { recursive: true, force: true }));

const mode = resolve(root, "skills/ox-mode/SKILL.md");
const selector = resolve(root, "skills/ox-mode/principles.md");
const procedures = [
	"skills/ox-foundation/SKILL.md", "skills/ox-spec/SKILL.md", "skills/ox-prototype/SKILL.md",
	"skills/ox-spec-impl/SKILL.md", "skills/ox-spec-impl/review.md", "skills/ox-tdd/SKILL.md",
].map(path => resolve(root, path));
const templates = loadPromptTemplates({ cwd, agentDir: root, promptPaths: [], includeDefaults: true });
const skills = loadSkills({ cwd, agentDir: root, skillPaths: [], includeDefaults: true });

function links(path) {
	return [...readFileSync(path, "utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
		.map(match => match[1])
		.filter(target => !/^[a-z]+:\/\//i.test(target))
		.map(target => {
			const [file, fragment] = target.split("#");
			return { path: file ? resolve(dirname(path), decodeURIComponent(file)) : path, fragment };
		});
}

function anchor(heading) {
	return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").replaceAll(" ", "-");
}

test("Pi descubre /ox-mode como un único prompt de usuario desde otro cwd", () => {
	assert.deepEqual(templates.diagnostics, []);
	const matches = templates.templates.filter(template => template.name === "ox-mode");
	assert.equal(matches.length, 1);
	assert.equal(matches[0].filePath, resolve(root, "prompts/ox-mode.md"));
	assert.equal(matches[0].sourceInfo.scope, "user");
	assert.ok(matches[0].description);
	assert.ok(matches[0].argumentHint);
});

test("la expansión nativa conserva la petición y opciones, sin sustituir argumentos recursivamente", () => {
	const expanded = expandPromptTemplate('/ox-mode implementar "12-importar clientes" --block "literal $1"', templates.templates);
	assert.notEqual(expanded, '/ox-mode implementar "12-importar clientes" --block "literal $1"');
	assert.ok(expanded.trimEnd().endsWith("implementar 12-importar clientes --block literal $1"));
	assert.ok(!expanded.includes("$ARGUMENTS"));
	const empty = expandPromptTemplate("/ox-mode", templates.templates);
	assert.notEqual(empty, "/ox-mode");
	assert.ok(!empty.includes("$ARGUMENTS"));
	assert.equal(expandPromptTemplate("/otro-comando tarea", templates.templates), "/otro-comando tarea");
});

test("el lector real de Pi resuelve el destino explícito del prompt fuera del repositorio", async () => {
	const expanded = expandPromptTemplate("/ox-mode", templates.templates);
	const target = expanded.match(/`([^`]+SKILL\.md)`/)?.[1];
	assert.ok(target, "El prompt necesita una ruta explícita, no un alias /skill anidado");
	const absolute = target.startsWith("~/") ? resolve(homedir(), target.slice(2)) : resolve(target);
	assert.equal(realpathSync(absolute), realpathSync(mode));
	const result = await createReadTool(cwd).execute("ox-mode-read", { path: target });
	const content = result.content.filter(block => block.type === "text").map(block => block.text).join("\n");
	assert.ok(content.includes(readFileSync(mode, "utf8").trim()));
});

test("el descubrimiento mantiene el selector fuera de los comandos y los principios fuera del prompt automático", () => {
	assert.deepEqual(skills.diagnostics, []);
	const modeSkills = skills.skills.filter(skill => skill.filePath.startsWith(dirname(mode) + "/"));
	assert.deepEqual(modeSkills.map(skill => skill.name), ["ox-mode"]);
	const hidden = skills.skills.filter(skill => skill.name === "ox-mode" || skill.name.startsWith("ox-principle-"));
	assert.equal(hidden.length, 20);
	assert.ok(hidden.every(skill => skill.disableModelInvocation));
	assert.equal(formatSkillsForPrompt(hidden), "");
});

test("el índice enlaza una vez cada principio instalado", () => {
	const installed = readdirSync(resolve(root, "skills")).filter(name => name.startsWith("ox-principle-"))
		.map(name => resolve(root, "skills", name, "SKILL.md")).sort();
	const targets = links(selector).map(link => link.path).sort();
	assert.equal(installed.length, 19);
	assert.deepEqual(targets, installed);
});

test("todas las fases alcanzan el mismo selector incluso sin entrar por /ox-mode", () => {
	for (const path of procedures) {
		assert.ok(links(path).some(link => link.path === selector), path);
	}
	assert.ok(links(mode).some(link => link.path === selector));
	for (const path of procedures.filter(path => path.endsWith("SKILL.md"))) {
		assert.ok(links(mode).some(link => link.path === path), path);
	}
});

test("las rutas y anclas Markdown del router y los procedimientos resuelven a archivos reales", () => {
	for (const path of [mode, selector, ...procedures]) {
		for (const link of links(path)) {
			const content = readFileSync(link.path, "utf8");
			if (link.fragment) {
				const anchors = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => anchor(match[1]));
				assert.ok(anchors.includes(decodeURIComponent(link.fragment)), `${path} -> ${link.path}#${link.fragment}`);
			}
		}
	}
});

test("Git permite guardar el prompt en la configuración versionada", () => {
	const result = spawnSync("git", ["check-ignore", "--no-index", "prompts/ox-mode.md"], { cwd: root, encoding: "utf8" });
	assert.equal(result.status, 1, result.stdout + result.stderr);
});
