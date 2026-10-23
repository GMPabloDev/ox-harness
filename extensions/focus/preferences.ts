import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function loadPreference(path: string): { enabled: boolean; warning?: string } {
	try {
		const value = JSON.parse(readFileSync(path, "utf8"));
		if (value?.version !== 1 || typeof value.enabled !== "boolean") throw new Error("Formato no válido");
		return { enabled: value.enabled };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { enabled: true };
		return { enabled: true, warning: "No se pudo leer focus.json. Focus está activo; /focus on u off permite guardar la preferencia." };
	}
}

export function savePreference(path: string, enabled: boolean): void {
	mkdirSync(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temp, JSON.stringify({ version: 1, enabled }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
		renameSync(temp, path);
	} finally {
		try { unlinkSync(temp); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	}
}
