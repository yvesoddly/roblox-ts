import luau, { renderAST } from "@roblox-ts/luau-ast";
import { execFileSync } from "child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";

function expectProgram(statements: luau.List<luau.Statement>, setup: string, assertion: string) {
	const output = renderAST(statements);
	expect(output).toMatchSnapshot();

	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luau-ast-program-"));
	try {
		const script = path.join(directory, "test.luau");
		fs.writeFileSync(script, `${setup}\n${output}\nassert(${assertion})\n`);
		execFileSync("lune", ["run", script], { encoding: "utf8" });
	} finally {
		fs.removeSync(directory);
	}
}

it("preserves concatenation grouping for metamethods", () => {
	expectProgram(
		luau.list.make(
			luau.create(luau.SyntaxKind.VariableDeclaration, {
				left: luau.id("result"),
				right: luau.binary(luau.binary(luau.id("a"), "..", luau.id("b")), "..", luau.id("c")),
			}),
		),
		`local mt = {}
mt.__concat = function(a, b) return setmetatable({value = "(" .. a.value .. b.value .. ")"}, mt) end
local a = setmetatable({value = "a"}, mt)
local b = setmetatable({value = "b"}, mt)
local c = setmetatable({value = "c"}, mt)`,
		'result.value == "((ab)c)"',
	);
});

it.each(["left", "right"] as const)("rejects multiple %s operands in compound assignments", side => {
	const node = luau.create(luau.SyntaxKind.Assignment, {
		left: side === "left" ? luau.list.make(luau.id("a"), luau.id("b")) : luau.id("a"),
		operator: "+=",
		right: side === "right" ? luau.list.make(luau.number(1), luau.number(2)) : luau.number(1),
	});
	expect(() => renderAST(luau.list.make(node))).toThrow();
});

it.each([
	{
		name: "contextual keyword fields",
		expression: luau.map(["continue", "const", "export", "type"].map(name => [luau.string(name), luau.number(1)])),
		assertion: "result.continue == 1 and result.const == 1 and result.export == 1 and result.type == 1",
	},
	{
		name: "escaped strings",
		expression: luau.array([luau.string("\\n"), luau.string("\\\\n"), luau.string("trailing\\\\")]),
		assertion: String.raw`result[1] == "\n" and result[2] == "\\n" and result[3] == "trailing\\"`,
	},
	{
		name: "interpolated backticks",
		expression: luau.create(luau.SyntaxKind.InterpolatedString, {
			parts: luau.list.make(luau.create(luau.SyntaxKind.InterpolatedStringPart, { text: "`{}" })),
		}),
		assertion: 'result == "`{}"',
	},
	{
		name: "left-nested exponentiation",
		expression: luau.binary(luau.binary(luau.number(2), "^", luau.number(3)), "^", luau.number(2)),
		assertion: "result == 64",
	},
	{
		name: "mixed tables",
		expression: luau.mixedTable([luau.number(5), [luau.string("count"), luau.number(9)]]),
		assertion: "result[1] == 5 and result.count == 9",
	},
	{
		name: "right-nested exponentiation",
		expression: luau.binary(luau.number(2), "^", luau.binary(luau.number(3), "^", luau.number(2))),
		assertion: "result == 512",
	},
	{
		name: "sets",
		expression: luau.set([luau.string("first"), luau.number(2)]),
		assertion: "result.first == true and result[2] == true and result.missing == nil",
	},
])("renders $name as executable Luau", ({ expression, assertion }) => {
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

it("renders single-operand compound lists", () => {
	expectProgram(
		luau.list.make(
			luau.create(luau.SyntaxKind.Assignment, {
				left: luau.list.make(luau.id("result")),
				operator: "+=",
				right: luau.list.make(luau.number(3)),
			}),
		),
		"local result = 2",
		"result == 5",
	);
});

it.each(["block", "top-level"])("reserves local function bindings in their enclosing scope (%s)", scope => {
	const temporary = luau.tempId("helper");
	const statements = luau.list.make<luau.Statement>(
		luau.create(luau.SyntaxKind.FunctionDeclaration, {
			localize: true,
			name: luau.id("_helper"),
			parameters: luau.list.make(),
			hasDotDotDot: false,
			statements: luau.list.make(luau.create(luau.SyntaxKind.ReturnStatement, { expression: luau.number(7) })),
		}),
		luau.create(luau.SyntaxKind.VariableDeclaration, { left: temporary, right: luau.number(99) }),
		luau.create(luau.SyntaxKind.Assignment, {
			left: luau.id("result"),
			operator: "=",
			right: luau.call(luau.id("_helper")),
		}),
	);

	expectProgram(
		scope === "block" ? luau.list.make(luau.create(luau.SyntaxKind.DoStatement, { statements })) : statements,
		"local result",
		"result == 7",
	);
});

it("numbers repeated temporary hints without rescanning earlier names", () => {
	const declare = (temporary: luau.TemporaryIdentifier, value: number) =>
		luau.create(luau.SyntaxKind.VariableDeclaration, { left: temporary, right: luau.number(value) });
	const inner = luau.tempId("value");
	const outer = [1, 2, 3].map(() => luau.tempId("value"));

	expectProgram(
		luau.list.make<luau.Statement>(
			...outer.map((temporary, index) => declare(temporary, index + 1)),
			luau.create(luau.SyntaxKind.DoStatement, {
				statements: luau.list.make<luau.Statement>(
					declare(inner, 4),
					luau.create(luau.SyntaxKind.Assignment, {
						left: luau.id("result"),
						operator: "=",
						right: luau.binary(luau.binary(outer[0]!, "+", outer[2]!), "+", inner),
					}),
				),
			}),
		),
		"local result",
		"result == 8",
	);
});

it.each(["generic", "numeric"])("reserves loop bindings for temporary names (%s)", kind => {
	const temporary = luau.tempId("value");
	const statements = luau.list.make<luau.Statement>(
		luau.create(luau.SyntaxKind.VariableDeclaration, { left: temporary, right: luau.number(99) }),
		luau.create(luau.SyntaxKind.Assignment, { left: luau.id("result"), operator: "=", right: luau.id("_value") }),
	);
	const loop =
		kind === "generic"
			? luau.create(luau.SyntaxKind.ForStatement, {
					ids: luau.list.make(luau.id("_key"), luau.id("_value")),
					expression: luau.array([luau.number(7)]),
					statements,
				})
			: luau.create(luau.SyntaxKind.NumericForStatement, {
					id: luau.id("_value"),
					start: luau.number(7),
					end: luau.number(7),
					statements,
				});

	expectProgram(luau.list.make(loop), "local result", "result == 7");
});

it("visits temporary identifiers in generic iterator expressions", () => {
	const temporary = luau.tempId("iterator");
	const iterator = luau.create(luau.SyntaxKind.FunctionExpression, {
		parameters: luau.list.make(),
		hasDotDotDot: false,
		statements: luau.list.make<luau.Statement>(
			luau.create(luau.SyntaxKind.VariableDeclaration, { left: temporary, right: luau.array([luau.number(7)]) }),
			luau.create(luau.SyntaxKind.CallStatement, {
				expression: luau.call(luau.id("assert"), [luau.binary(luau.id("_iterator"), "==", luau.number(99))]),
			}),
			luau.create(luau.SyntaxKind.ReturnStatement, { expression: temporary }),
		),
	});
	expectProgram(
		luau.list.make<luau.Statement>(
			luau.create(luau.SyntaxKind.VariableDeclaration, { left: luau.id("_iterator"), right: luau.number(99) }),
			luau.create(luau.SyntaxKind.ForStatement, {
				ids: luau.list.make(luau.id("key"), luau.id("value")),
				expression: luau.call(luau.create(luau.SyntaxKind.ParenthesizedExpression, { expression: iterator })),
				statements: luau.list.make(
					luau.create(luau.SyntaxKind.Assignment, {
						left: luau.id("result"),
						operator: "=",
						right: luau.id("value"),
					}),
				),
			}),
		),
		"local result",
		"result == 7 and _iterator == 99",
	);
});
