for (const name of ["repo", "packet", "skillDir"]) {
	if (typeof args[name] !== "string" || !args[name].startsWith("/")) {
		throw new Error(`${name} must be an absolute path`);
	}
}
if (typeof args.hasSpec !== "boolean") {
	throw new Error("hasSpec must explicitly state whether requirements are available");
}

const axes = [
	{ key: "standards", label: "Revisar estándares" },
	...(args.hasSpec ? [{ key: "spec", label: "Revisar la SPEC" }] : []),
	{ key: "correctness", label: "Revisar correctitud" },
];
const results = await runs.all(axes.map(axis => ({
	key: axis.key,
	label: axis.label,
	agent: "ox-reviewer",
	agentScope: "user",
	cwd: args.repo,
	context: "fresh",
	skill: false,
	progress: false,
	output: `${args.packet}/${axis.key}.md`,
	outputMode: "file-only",
	task: [
		`Revisa exclusivamente el eje ${axis.key}.`,
		`Lee su guía en ${JSON.stringify(`${args.skillDir}/axes/${axis.key}.md`)}.`,
		`Lee el paquete ${JSON.stringify(args.packet)}: context.md, manifest.json y diff.patch completos.`,
		"El contexto fija el alcance, los requisitos y la evidencia de validación disponible.",
		"Inspecciona el código y los contratos necesarios dentro del repositorio indicado en el manifest.",
		"Devuelve el informe definido por tu perfil, con cobertura y límites verificables.",
	].join("\n"),
})));

const unfinished = results.filter(result => !result.ok || result.state === "running" || !result.outputReference);
if (unfinished.length > 0) {
	throw new Error(`Review child failed or has no final report: ${unfinished.map(result => result.key).join(", ")}`);
}
return {
	reviews: results.map(result => ({
		key: result.key,
		ok: result.ok,
		runId: result.runId,
		requestedContext: result.requestedContext,
		resolvedContext: result.resolvedContext,
		outputReference: result.outputReference,
		artifactPaths: result.artifactPaths,
	})),
	omitted: args.hasSpec ? [] : ["spec"],
};
