import luau from "@roblox-ts/luau-ast";

it("clones reused subtrees and their lists without changing the original parents", () => {
	const expression = luau.binary(luau.number(2), "^", luau.number(3));
	const original = luau.array([expression]);
	const reused = luau.create(luau.SyntaxKind.Array, { members: original.members });
	const originalChild = luau.list.toArray(original.members)[0];
	const reusedChild = luau.list.toArray(reused.members)[0];

	expect(reused.members).not.toBe(original.members);
	expect(originalChild).toBe(expression);
	expect(originalChild.parent).toBe(original);
	expect(reusedChild.parent).toBe(reused);
	if (!luau.isBinaryExpression(reusedChild)) {
		throw new Error("expected a binary expression");
	}
	expect(reusedChild.left.parent).toBe(reusedChild);
	expect(reusedChild.right.parent).toBe(reusedChild);
	expect(expression.left.parent).toBe(expression);
	expect(expression.right.parent).toBe(expression);

	const outer = luau.binary(original, "..", luau.string("suffix"));
	const second = luau.binary(original, "..", luau.string("other"));
	expect(original.parent).toBe(outer);
	expect(second.left.parent).toBe(second);
	if (!luau.isArray(second.left)) {
		throw new Error("expected an array");
	}
	expect(luau.list.toArray(second.left.members)[0].parent).toBe(second.left);
});

it.each([null, undefined, {}, 1, "list"])("rejects non-list value %p", value => {
	expect(luau.list.isList(value)).toBe(false);
});

it.each([luau.list.pushList, luau.list.unshiftList])("rejects self-splicing before mutating a list", splice => {
	const list = luau.list.make(luau.id("a"));
	expect(() => splice(list, list)).toThrow();
	expect(list.readonly).toBe(false);
	expect(list.head?.prev).toBeUndefined();
	expect(list.tail?.next).toBeUndefined();
	expect(luau.list.size(list)).toBe(1);
});
