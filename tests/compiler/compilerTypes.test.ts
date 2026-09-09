import path from "path";
import { assert } from "Shared/util/assert";
import { formatDiagnostics } from "Shared/util/formatDiagnostics";
import ts from "typescript";

import { TEST_ROOT } from "./constants";

it("checks the local compiler declarations", () => {
	const config = ts.getParsedCommandLineOfConfigFile(
		path.resolve(TEST_ROOT, "../packages/compiler-types/tsconfig.json"),
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: diagnostic => {
				throw new Error(formatDiagnostics([diagnostic]));
			},
		},
	);
	assert(config);

	const program = ts.createProgram(config.fileNames, config.options);
	const diagnostics = [...config.errors, ...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];

	// check our declarations without reporting unrelated errors inside the external Roblox types
	for (const fileName of config.fileNames) {
		const sourceFile = program.getSourceFile(fileName);
		assert(sourceFile);
		diagnostics.push(...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile));
	}

	expect(formatDiagnostics(diagnostics)).toBe("");
});
