import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const agentDir = fileURLToPath(new URL("../../../", import.meta.url));
const skillsDir = join(agentDir, "skills");

function findHost() {
	const explicit = process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT;
	if (explicit) return explicit;
	for (const directory of (process.env.PATH ?? "").split(delimiter)) {
		const executable = join(directory, process.platform === "win32" ? "pi.exe" : "pi");
		if (!existsSync(executable)) continue;
		let candidate = dirname(realpathSync(executable));
		while (candidate !== dirname(candidate)) {
			const manifest = join(candidate, "package.json");
			if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@earendil-works/pi-coding-agent") return candidate;
			candidate = dirname(candidate);
		}
	}
	throw new Error("Set PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT to the installed Pi package");
}

const host = findHost();
const { loadSkillsFromDir, formatSkillsForPrompt } = await import(pathToFileURL(join(host, "dist/core/skills.js")));
const { parseFrontmatter } = await import(pathToFileURL(join(host, "dist/utils/frontmatter.js")));
const additions = ["foundational-thinking", "laziness-protocol", "redesign-from-first-principles", "experience-first", "subtract-before-you-add"];
const principles = [...additions, "exhaust-the-design-space"];
const routes = new Map([
	["ox-foundation/SKILL.md", ["experience-first", "foundational-thinking"]],
	["ox-spec/SKILL.md", ["experience-first", "foundational-thinking", "redesign-from-first-principles", "subtract-before-you-add"]],
	["ox-prototype/SKILL.md", ["experience-first", "exhaust-the-design-space"]],
	["ox-spec-impl/block-execution.md", additions],
	["ox-tdd-feature/SKILL.md", ["foundational-thinking", "laziness-protocol"]],
	["ox-tdd-bugfix/SKILL.md", ["foundational-thinking", "laziness-protocol"]],
	["ox-code-review/axes/standards.md", ["laziness-protocol", "subtract-before-you-add"]],
]);

function prose(text, file) {
	let fence;
	const lines = [];
	for (const line of text.split("\n")) {
		const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
		if (match) {
			if (!fence) fence = match[1];
			else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = undefined;
			continue;
		}
		if (!fence) lines.push(line);
	}
	assert.equal(fence, undefined, `Unclosed fence in ${file}`);
	return lines.join("\n").replace(/(`+)([^\n]*?)\1/g, "");
}

function links(file) {
	const body = prose(readFileSync(file, "utf8"), file);
	return [...body.matchAll(/\[[^\]\n]*\]\(([^)]+)\)/g)]
		.map(match => match[1])
		.filter(target => !/^[a-z][a-z\d+.-]*:/i.test(target))
		.map(target => {
			const [name, anchor] = target.split("#");
			return { file: name ? resolve(dirname(file), decodeURIComponent(name)) : file, anchor };
		});
}

test("all six principles load once and stay outside automatic selection", () => {
	const loaded = loadSkillsFromDir({ dir: skillsDir, source: "user" });
	assert.deepEqual(loaded.diagnostics, []);
	const prompt = formatSkillsForPrompt(loaded.skills);
	for (const suffix of principles) {
		const name = `ox-principle-${suffix}`;
		const matching = loaded.skills.filter(skill => skill.name === name);
		assert.equal(matching.length, 1, name);
		assert.equal(matching[0].disableModelInvocation, true, name);
		assert.ok(!prompt.includes(`<name>${name}</name>`), name);
	}
	assert.equal(new Set(loaded.skills.map(skill => skill.name)).size, loaded.skills.length);
});

test("adapted principles retain their original provenance and portable names", () => {
	for (const suffix of additions) {
		const name = `ox-principle-${suffix}`;
		const file = join(skillsDir, name, "SKILL.md");
		const { frontmatter, body } = parseFrontmatter(readFileSync(file, "utf8"));
		assert.equal(frontmatter.name, name);
		assert.equal(frontmatter.metadata.source, `https://github.com/cursor/plugins/blob/main/pstack/skills/principle-${suffix}/SKILL.md`);
		assert.ok(frontmatter.description.trim());
		assert.ok(body.trim());
		assert.ok(!body.includes("/mnt/datos/"), file);
	}
});

for (const [entry, expected] of routes) {
	test(`${entry} explicitly references its applicable principles`, () => {
		const targets = new Set(links(join(skillsDir, entry)).map(link => link.file));
		for (const suffix of expected) {
			const target = join(skillsDir, `ox-principle-${suffix}`, "SKILL.md");
			assert.ok(existsSync(target), target);
			assert.ok(targets.has(target), `${entry} does not reference ${suffix}`);
		}
	});
}

test("workflow pointers resolve through existing references and valid anchors", () => {
	const queue = [...routes.keys()].map(file => join(skillsDir, file));
	const visited = new Set();
	while (queue.length) {
		const file = queue.shift();
		if (visited.has(file)) continue;
		visited.add(file);
		for (const target of links(file)) {
			assert.ok(existsSync(target.file) && statSync(target.file).isFile(), `${file}: ${target.file}`);
			if (target.anchor) {
				const headings = [...prose(readFileSync(target.file, "utf8"), target.file).matchAll(/^#{1,6}\s+(.+)$/gm)]
					.map(match => match[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").replace(/ /g, "-"));
				assert.ok(headings.includes(decodeURIComponent(target.anchor)), `${target.file}: #${target.anchor}`);
			}
			if (target.file.endsWith(".md")) queue.push(target.file);
		}
	}
	for (const suffix of principles) assert.ok(visited.has(join(skillsDir, `ox-principle-${suffix}`, "SKILL.md")), suffix);
});
