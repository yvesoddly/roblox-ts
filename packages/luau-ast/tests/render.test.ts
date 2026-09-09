import luau, { renderAST } from "@roblox-ts/luau-ast";
import { execFileSync } from "child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";

it.each([
	{
		name: "mixed tables",
		expression: luau.mixedTable([luau.number(5), [luau.string("count"), luau.number(9)]]),
		assertion: "result[1] == 5 and result.count == 9",
	},
	{
		name: "sets",
		expression: luau.set([luau.string("first"), luau.number(2)]),
		assertion: "result.first == true and result[2] == true and result.missing == nil",
	},
])("renders $name as executable Luau tables", ({ expression, assertion }) => {
	const output = renderAST(luau.list.make(luau.create(luau.SyntaxKind.ReturnStatement, { expression })));

	expect(output).toMatchSnapshot();

	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luau-ast-render-"));
	try {
		const script = path.join(directory, "test.luau");
		fs.writeFileSync(script, `local result = (function()\n${output}end)()\nassert(${assertion})\n`);
		execFileSync("lune", ["run", script], { encoding: "utf8" });
	} finally {
		fs.removeSync(directory);
	}
});
