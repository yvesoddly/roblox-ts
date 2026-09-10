import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

const rootDirectory = path.resolve(import.meta.dirname, "..");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));

it("registers a scaffolded rule in the public plugin and recommended configs", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "roblox-ts-create-rule-"));
	try {
		for (const name of ["src", "scripts", "package.json"]) {
			cpSync(path.join(rootDirectory, name), path.join(directory, name), { recursive: true });
		}

		symlinkSync(
			path.join(rootDirectory, "node_modules"),
			path.join(directory, "node_modules"),
			"junction",
		);

		execFileSync(
			process.execPath,
			[tsxCli, path.join(directory, "scripts/create-rule.ts"), "sample-rule"],
			{
				cwd: directory,
				encoding: "utf8",
			},
		);

		const entryUrl = pathToFileURL(path.join(directory, "src/index.ts")).href;
		const output = execFileSync(
			process.execPath,
			[
				tsxCli,
				"--eval",
				`import(${JSON.stringify(entryUrl)}).then(({ default: plugin }) => {
				console.log(JSON.stringify({
					rule: plugin.rules["sample-rule"]?.meta.docs.description,
					recommended: plugin.configs.recommended.rules["roblox-ts/sample-rule"],
					noTypeCheck: plugin.configs.recommendedNoTypeCheck.rules["roblox-ts/sample-rule"],
				}));
			});`,
			],
			{ cwd: directory, encoding: "utf8" },
		);

		expect(JSON.parse(output)).toEqual({
			noTypeCheck: "error",
			recommended: "error",
			rule: "Brief description of the rule's purpose",
		});
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
});
