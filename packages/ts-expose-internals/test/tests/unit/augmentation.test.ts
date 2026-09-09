import fs from "fs";
import os from "os";
import path from "path";
import * as ts from "typescript";
import { repoRootPath } from "../../src/config";

test("TypeScript 5.9.3 loads public and internal APIs through the @types alias", () => {
	expect(ts.version).toBe("5.9.3");
	const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsei-augmentation-"));

	try {
		const modulesDir = path.join(fixtureDir, "node_modules");
		fs.mkdirSync(path.join(modulesDir, "@types"), { recursive: true });
		fs.symlinkSync(repoRootPath, path.join(modulesDir, "@types/ts-expose-internals"), "junction");
		fs.symlinkSync(
			path.dirname(require.resolve("typescript/package.json")),
			path.join(modulesDir, "typescript"),
			"junction",
		);
		const sourcePath = path.join(fixtureDir, "consumer.ts");
		fs.writeFileSync(sourcePath, `
import ts from "typescript";
const source: ts.SourceFile = ts.createSourceFile("test.ts", "", ts.ScriptTarget.Latest);
const assignment: boolean = ts.isAssignmentOperator(ts.SyntaxKind.EqualsToken);
function resolver(checker: ts.TypeChecker): ts.EmitResolver {
	return checker.getEmitResolver(source);
}
`);

		const program = ts.createProgram([sourcePath], {
			strict: true,
			noEmit: true,
			skipLibCheck: false,
			esModuleInterop: true,
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			moduleResolution: ts.ModuleResolutionKind.Node10,
			types: ["ts-expose-internals"],
			typeRoots: [path.join(modulesDir, "@types")],
		});
		const diagnostics = ts.getPreEmitDiagnostics(program);
		expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
	} finally {
		fs.rmSync(fixtureDir, { recursive: true, force: true });
	}
});
